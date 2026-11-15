import { z } from "zod";
import { ApiError, readJson } from "@/lib/api";
import { addRequest } from "@/lib/booking-service";
import { route } from "@/lib/route";
import { authorizedRefs, json } from "@/lib/security";

export const dynamic = "force-dynamic";

const body = z.object({ type: z.enum(["change", "support"]), message: z.string().trim().min(10, "Tell us a little more").max(2000) });

export const POST = route<{ reference: string }>("trips.requests", "manage", async (req, ctx) => {
  const { reference } = await ctx.params();
  if (!(await authorizedRefs()).includes(reference)) throw new ApiError(403, "FORBIDDEN", "Retrieve this booking first.");
  const b = body.parse(await readJson(req));
  await addRequest(reference, b.type, b.message);
  return json({ ok: true }, 201);
});
