import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "./types";
import { toMinor } from "./types";

/**
 * A payment provider that moves no money.
 *
 * Its purpose is to make the *state machine* testable: initialisation, signature
 * verification, webhook replay, capture, fulfilment and refund all run exactly as they
 * do in production. It is only ever selected explicitly, and `/api/payments/[ref]/mock-pay`
 * refuses to run unless this provider is active, so it cannot be reached in a real
 * deployment by accident.
 */
const secret = () => process.env.MOCK_PAY_SECRET ?? "mock-pay-secret-for-development-only";

export const mockProvider: PaymentProvider = {
  id: "mock",
  label: "Mock (no money moves)",
  live: false,

  async initialize({ reference, amountMinor, currency }) {
    const providerRef = `mock_${reference}_${Date.now().toString(36)}`;
    return {
      redirectUrl: `/checkout/pay?ref=${encodeURIComponent(reference)}&provider=mock`,
      providerRef,
    };
  },

  async parseWebhook(rawBody, headers) {
    const signature = headers["x-mock-signature"] ?? "";
    const expected = createHmac("sha256", secret()).update(rawBody).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, eventId: "", type: "", reference: "", amountMinor: 0, currency: "", providerRef: "", reason: "bad_signature" };
    }
    const body = JSON.parse(rawBody) as {
      id?: string;
      type?: string;
      data?: { reference?: string; amount?: number; currency?: string; providerRef?: string };
    };
    return {
      ok: true,
      eventId: body.id ?? `${body.data?.reference}-${body.type}`,
      type: body.type ?? "charge.success",
      reference: body.data?.reference ?? "",
      amountMinor: body.data?.amount ?? 0,
      currency: body.data?.currency ?? "USD",
      providerRef: body.data?.providerRef ?? `mock_${body.data?.reference}`,
    };
  },

  async refund({ providerRef, amountMinor }) {
    return { ok: true, refundRef: `mockrefund_${providerRef}_${amountMinor}` };
  },
};

/** Build the signed body a real provider would post, for tests and the mock-pay endpoint. */
export function mockWebhookBody(input: { reference: string; amount: number; currency: string; providerRef: string }) {
  return JSON.stringify({
    id:       `evt_${input.reference}_${Date.now().toString(36)}`,
    type: "charge.success",
    data: {
      reference: input.reference,
      amount: toMinor(input.amount, input.currency),
      currency: input.currency,
      providerRef: input.providerRef,
    },
  });
}

export const signMockPayload = (rawBody: string) => createHmac("sha256", secret()).update(rawBody).digest("hex");
