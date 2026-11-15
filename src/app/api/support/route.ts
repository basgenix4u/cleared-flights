import { readJson } from "@/lib/api";
import { addRequest } from "@/lib/booking-service";
import { route } from "@/lib/route";
import { supportInputSchema } from "@/lib/schemas";
import { json } from "@/lib/security";

export const dynamic = "force-dynamic";

export const POST = route("support", "support", async (req) => {
  const b = supportInputSchema.parse(await readJson(req));
  // Never reveal whether a reference exists; we only attach it silently.
  await addRequest(b.reference ? b.reference.toUpperCase() : null, "support", b.message, b.email, b.topic);
  return json({ ok: true }, 201);
});
