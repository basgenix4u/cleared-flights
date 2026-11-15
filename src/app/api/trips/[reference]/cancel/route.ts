import { z } from "zod";
import { ApiError, readJson } from "@/lib/api";
import { confirmCancel, quoteCancel } from "@/lib/booking-service";
import { route } from "@/lib/route";
import { authorizedRefs, json } from "@/lib/security";

export const dynamic = "force-dynamic";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("quote") }),
  z.object({ action: z.literal("confirm"), expectedRefund: z.number().min(0) }),
]);

export const POST = route<{ reference: string }>("trips.cancel", "manage", async (req, ctx) => {
  const { reference } = await ctx.params();
  if (!(await authorizedRefs()).includes(reference)) throw new ApiError(403, "FORBIDDEN", "Retrieve this booking first.");
  const b = body.parse(await readJson(req));
  if (b.action === "quote") return json({ quote: await quoteCancel(reference) });
  return json({ result: await confirmCancel(reference, b.expectedRefund) });
});
