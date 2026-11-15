import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "./types";

/**
 * Stripe Checkout.
 *
 * Signature scheme: header `stripe-signature: t=<unix>,v1=<hex>`, where the signed
 * payload is `${t}.${rawBody}` with HMAC-SHA256 keyed by the endpoint secret. The
 * timestamp is checked so a captured request cannot be replayed indefinitely.
 */
const api = "https://api.stripe.com";
const secretKey = () => process.env.STRIPE_SECRET_KEY ?? "";
const webhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET ?? "";
const TOLERANCE_SECONDS = 300;

const form = (obj: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) p.append(k, String(v));
  return p;
};

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  label: "Stripe",
  live: true,

  async initialize({ reference, amountMinor, currency, email, callbackUrl, metadata }) {
    if (!secretKey()) throw new Error("STRIPE_SECRET_KEY is not set");
    const body = form({
      mode: "payment",
      "payment_method_types[0]": "card",
      "line_items[0][price_data][currency]": currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": amountMinor,
      "line_items[0][price_data][product_data][name]": `Booking ${reference}`,
      "line_items[0][quantity]": 1,
      customer_email: email,
      client_reference_id: reference,
      success_url: callbackUrl,
      cancel_url: callbackUrl.replace("status=paid", "status=cancelled"),
      "metadata[reference]": reference,
      ...Object.fromEntries(Object.entries(metadata ?? {}).map(([k, v]) => [`metadata[${k}]`, String(v)])),
    });

    const res = await fetch(`${api}/v1/checkout/sessions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => null)) as { id?: string; url?: string; error?: { message?: string } } | null;
    if (!res.ok || !json?.url) throw new Error(json?.error?.message ?? `Stripe refused the session (HTTP ${res.status}).`);
    return { redirectUrl: json.url, providerRef: json.id ?? reference };
  },

  async parseWebhook(rawBody, headers) {
    const header = headers["stripe-signature"] ?? "";
    const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
    const timestamp = Number(parts.t ?? 0);
    const provided = parts.v1 ?? "";
    if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) {
      return { ok: false, eventId: "", type: "", reference: "", amountMinor: 0, currency: "", providerRef: "", reason: "stale_or_missing_timestamp" };
    }
    const expected = createHmac("sha256", webhookSecret()).update(`${timestamp}.${rawBody}`).digest("hex");
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, eventId: "", type: "", reference: "", amountMinor: 0, currency: "", providerRef: "", reason: "bad_signature" };
    }

    const body = JSON.parse(rawBody) as {
      id?: string;
      type?: string;
      data?: { object?: { client_reference_id?: string; amount_total?: number; currency?: string; id?: string; metadata?: { reference?: string } } };
    };
    const obj = body.data?.object ?? {};
    return {
      ok: true,
      eventId: body.id ?? "",
      type: body.type ?? "unknown",
      reference: obj.client_reference_id ?? obj.metadata?.reference ?? "",
      amountMinor: Number(obj.amount_total ?? 0),
      currency: (obj.currency ?? "usd").toUpperCase(),
      providerRef: obj.id ?? "",
    };
  },

  async refund({ providerRef, amountMinor }) {
    if (!secretKey()) return { ok: false, refundRef: "", reason: "not_configured" };
    const res = await fetch(`${api}/v1/refunds`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ payment_intent: providerRef, amount: amountMinor }),
      signal: AbortSignal.timeout(20_000),
    });
    const json = (await res.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null;
    if (!res.ok) return { ok: false, refundRef: "", reason: json?.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, refundRef: json?.id ?? "" };
  },
};
