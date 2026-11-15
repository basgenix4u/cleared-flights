import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "./types";

/**
 * Paystack.
 *
 * Amounts are the smallest unit (kobo, pesewas, cents). Webhook authenticity is the
 * `x-paystack-signature` header: HMAC-SHA512 of the raw request body, keyed with the
 * secret key. Verify on the raw bytes — re-serialising the parsed JSON changes them
 * and would fail (or worse, pass for the wrong reason).
 */
const api = "https://api.paystack.co";
const secretKey = () => process.env.PAYSTACK_SECRET_KEY ?? "";

export const paystackProvider: PaymentProvider = {
  id: "paystack",
  label: "Paystack",
  live: true,

  async initialize({ reference, amountMinor, currency, email, callbackUrl, metadata }) {
    if (!secretKey()) throw new Error("PAYSTACK_SECRET_KEY is not set");
    const res = await fetch(`${api}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        // Paystack expects a string amount in the smallest unit.
        amount: String(amountMinor),
        currency,
        reference,
        callback_url: callbackUrl,
        metadata: { ...metadata, reference },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const json = (await res.json().catch(() => null)) as
      | { status?: boolean; message?: string; data?: { authorization_url?: string; reference?: string } }
      | null;

    if (!res.ok || !json?.status || !json.data?.authorization_url) {
      throw new Error(json?.message ?? `Paystack refused the transaction (HTTP ${res.status}).`);
    }
    return { redirectUrl: json.data.authorization_url, providerRef: json.data.reference ?? reference };
  },

  async parseWebhook(rawBody, headers) {
    const signature = headers["x-paystack-signature"] ?? "";
    const expected = createHmac("sha512", secretKey()).update(rawBody).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, eventId: "", type: "", reference: "", amountMinor: 0, currency: "", providerRef: "", reason: "bad_signature" };
    }

    const body = JSON.parse(rawBody) as {
      event?: string;
      data?: { reference?: string; amount?: number; currency?: string; id?: number; status?: string; gateway_response?: string };
    };
    const data = body.data ?? {};
    return {
      ok: true,
      eventId: String(data.id ?? `${data.reference}:${body.event}`),
      type: body.event ?? "unknown",
      reference: data.reference ?? "",
      amountMinor: Number(data.amount ?? 0),
      currency: data.currency ?? "USD",
      providerRef: data.reference ?? "",
      reason: body.event === "charge.success" ? undefined : data.gateway_response,
    };
  },

  async refund({ providerRef, amountMinor }) {
    if (!secretKey()) return { ok: false, refundRef: "", reason: "not_configured" };
    const res = await fetch(`${api}/refund`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ transaction: providerRef, amount: String(amountMinor) }),
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: { id?: number; reference?: string } } | null;
    if (!res.ok || !json?.status) return { ok: false, refundRef: "", reason: json?.message ?? `HTTP ${res.status}` };
    return { ok: true, refundRef: String(json.data?.id ?? json.data?.reference ?? "") };
  },
};
