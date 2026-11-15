import { z } from "zod";
import { ApiError, readJson } from "@/lib/api";
import { createIntent, PaymentError } from "@/lib/payment-service";
import { paymentsConfigured } from "@/lib/payments";
import { route } from "@/lib/route";
import { json, verifyPaymentToken } from "@/lib/security";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  reference: z.string().min(6).max(16),
  token: z.string().min(8).max(64),
});

export const POST = route("payments.intent", "paymentsIntent", async (req) => {
  const { reference, token } = bodySchema.parse(await readJson(req));
  // The token proves this session created the booking; a guessed reference is useless.
  if (!verifyPaymentToken(reference.toUpperCase(), token)) throw new ApiError(403, "FORBIDDEN", "This payment link is not valid for this session.");
  if (!paymentsConfigured()) throw new ApiError(503, "PAYMENT_NOT_CONFIGURED", "Card payments are not enabled on this deployment.");

  try {
    const intent = await createIntent(reference.toUpperCase());
    return json({
      id: intent.id,
      status: intent.status,
      amountMinor: intent.amountMinor,
      currency: intent.currency,
      provider: intent.provider,
      redirectUrl: intent.redirectUrl,
    });
  } catch (e) {
    if (e instanceof PaymentError) throw new ApiError(e.status, e.code, e.message, e.extra);
    throw e;
  }
});
