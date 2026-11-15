import { ApiError } from "@/lib/api";
import { paymentFor } from "@/lib/payment-service";
import { route } from "@/lib/route";
import { json, verifyPaymentToken } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Payment state for the customer's own booking. Requires the session payment token. */
export const GET = route<{ reference: string }>("payments.status", "paymentsStatus", async (req, ctx) => {
  const { reference } = await ctx.params();
  const ref = reference.toUpperCase();
  const token = new URL(req.url).searchParams.get("token");
  if (!verifyPaymentToken(ref, token)) throw new ApiError(403, "FORBIDDEN", "This payment link is not valid for this session.");

  const payment = await paymentFor(ref);
  if (!payment) return json({ payment: null }, 404);
  return json({ payment });
});
