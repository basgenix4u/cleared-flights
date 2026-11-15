import { ApiError, readJson } from "@/lib/api";
import { getBookingRow, verifyLastName } from "@/lib/booking-service";
import { route } from "@/lib/route";
import { retrieveSchema } from "@/lib/schemas";
import { grantRef, isSecureRequest, json } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Retrieval is the one unauthenticated lookup that can confirm a booking exists, so it is
 * limited hard (2 per 2 s, 12 per minute) as well as requiring a surname, and answers with a
 * single generic message whether the booking or the name was wrong.
 */
export const POST = route("trips.retrieve", "trips", async (req) => {
  const { reference, lastName } = retrieveSchema.parse(await readJson(req));
  const row = await getBookingRow(reference);
  if (!row || row.status === "failed" || !(await verifyLastName(row, lastName)))
    throw new ApiError(404, "NOT_FOUND", "We couldn't find a booking matching those details. Check the reference and surname as entered at booking.");
  await grantRef(row.reference, isSecureRequest(req));
  return json({ reference: row.reference });
});
