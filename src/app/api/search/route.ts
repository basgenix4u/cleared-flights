import { ApiError, readJson } from "@/lib/api";
import { inventoryAvailable, providerMode } from "@/lib/config";
import { createSession } from "@/lib/booking-service";
import { getProvider } from "@/lib/providers";
import { route } from "@/lib/route";
import { queryInputSchema } from "@/lib/search-params";
import { json, log } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = route("search", "search", async (req, ctx) => {
  const query = queryInputSchema.parse(await readJson(req));
  // Fail closed. If this deployment has no inventory and is not explicitly allowed
  // to run on preview data, it must not show a customer a flight that does not exist.
  if (!inventoryAvailable())
    throw new ApiError(503, "INVENTORY_UNAVAILABLE", "Flight search is not open yet in this environment. Nothing has been charged.");
  const t0 = Date.now();
  const itineraries = await getProvider().search(query);
  const session = await createSession(query, providerMode(), itineraries);
  log("info", "search.done", { mode: providerMode(), results: itineraries.length, ms: Date.now() - t0, legs: query.legs.length, requestId: ctx.requestId });
  return json({
    sessionId: session.id,
    mode: providerMode(),
    searchedAt: new Date().toISOString(),
    expiresAt: session.expiresAt,
    itineraries,
  });
});
