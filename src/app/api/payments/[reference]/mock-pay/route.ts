import { ApiError } from "@/lib/api";
import { mockWebhookBody, signMockPayload } from "@/lib/payments/mock";
import { configuredProviderId } from "@/lib/payments";
import { paymentFor } from "@/lib/payment-service";
import { route } from "@/lib/route";
import { json, log, verifyPaymentToken } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Simulate the provider calling us back. Only available when PAYMENTS_PROVIDER=mock, so
 * it is unreachable in any deployment that can move real money.
 *
 * It deliberately goes through the real webhook path — signature, event store, capture,
 * fulfilment — rather than shortcutting to "mark it paid". A test that skips the
 * signature proves nothing about the thing most likely to break.
 */
export const POST = route<{ reference: string }>("payments.mockPay", "paymentsMock", async (req, ctx) => {
  if (configuredProviderId() !== "mock") throw new ApiError(404, "NOT_FOUND", "Not available on this deployment.");

  const { reference } = await ctx.params();
  const ref = reference.toUpperCase();
  const { token } = await req.json().catch(() => ({ token: undefined }));
  if (!verifyPaymentToken(ref, token)) throw new ApiError(403, "FORBIDDEN", "This payment link is not valid for this session.");

  const payment = await paymentFor(ref);
  if (!payment) throw new ApiError(409, "NO_PAYMENT", "Open a payment for this booking first.");

  const amount = payment.amountMinor / 100;
  const body = mockWebhookBody({ reference: ref, amount, currency: payment.currency, providerRef: `mock_${ref}` });
  const signature = signMockPayload(body);

  const url = new URL("/api/webhooks/mock", new URL(req.url).origin);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-mock-signature": signature },
    body,
  });
  const outcome = await res.json().catch(() => null);
  log("info", "mockpay.triggered", { reference: ref, status: res.status, requestId: ctx.requestId });
  return json({ simulated: true, webhookStatus: res.status, outcome }, res.status);
});
