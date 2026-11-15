import { ApiError } from "@/lib/api";
import { revalidateOffer } from "@/lib/booking-service";
import { route } from "@/lib/route";
import { json } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Re-price an offer before checkout. Prices move; this is how we refuse to sell a stale one. */
export const GET = route<{ offerId: string }>("offers", "offers", async (req, ctx) => {
  const { offerId } = await ctx.params();
  const sessionId = new URL(req.url).searchParams.get("session");
  if (!sessionId) throw new ApiError(422, "VALIDATION", "A search session is required.");
  return json(await revalidateOffer(sessionId, decodeURIComponent(offerId)));
});
