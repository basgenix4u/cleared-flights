import { readJson } from "@/lib/api";
import { createBooking } from "@/lib/booking-service";
import { route } from "@/lib/route";
import { bookingInputSchema } from "@/lib/schemas";
import { json } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = route("bookings", "bookings", async (req) => {
  const input = bookingInputSchema.parse(await readJson(req));
  const result = await createBooking(input, new URL(req.url).protocol === "https:");
  return json(result, result.replay ? 200 : 201);
});
