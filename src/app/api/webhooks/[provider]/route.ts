import { processWebhook } from "@/lib/payment-service";
import { json } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Provider webhook receiver.
 *
 * Reads the body as raw text — never `req.json()` — because the signature is computed
 * over the exact bytes the provider sent. Parsing first and re-serialising later is how
 * signature checks silently start accepting the wrong thing.
 *
 * Always answers 2xx for a valid signature, even when fulfilment failed: the money did
 * arrive, and telling the provider to retry risks a double charge.
 */
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const raw = await req.text();

  const headers: Record<string, string | undefined> = {
    "x-paystack-signature": req.headers.get("x-paystack-signature") ?? undefined,
    "x-mock-signature": req.headers.get("x-mock-signature") ?? undefined,
    "stripe-signature": req.headers.get("stripe-signature") ?? undefined,
  };

  const result = await processWebhook(provider, raw, headers);
  return json({ received: result.body.ok, ...result.body }, result.status);
}
