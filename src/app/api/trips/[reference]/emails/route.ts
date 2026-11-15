import { ApiError } from "@/lib/api";
import { getBookingRow } from "@/lib/booking-service";
import { emailsForBooking, retryEmail } from "@/lib/email-service";
import { route } from "@/lib/route";
import { authorizedRefs } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * The customer's own mail record for a booking.
 *
 * This exists so "I never got an email" is answerable with evidence rather than an apology:
 * every queued message is listed with what actually happened to it, including "not sent
 * because no mail provider is configured".
 */
export const GET = route<{ reference: string }>("trips.emails", "emailRead", async (_req, ctx) => {
  const { reference } = await ctx.params();
  if (!(await authorizedRefs()).includes(reference)) throw new ApiError(403, "FORBIDDEN", "Retrieve this booking first.");
  const row = await getBookingRow(reference);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Booking not found");

  const emails = await emailsForBooking(row.id);
  return Response.json({
    emails: emails.map((e) => ({
      id: e.id,
      kind: e.kind,
      status: e.status,
      failureReason: e.failureReason,
      to: e.toEmail.replace(/^(.).*(@.*)$/, "$1•••$2"),
      createdAt: e.createdAt,
      sentAt: e.sentAt,
    })),
  });
});

/** Ask for one message again. Only queued/failed/skipped messages can be resent. */
export const POST = route<{ reference: string }>("trips.emails.retry", "emailRetry", async (req, ctx) => {
  const { reference } = await ctx.params();
  if (!(await authorizedRefs()).includes(reference)) throw new ApiError(403, "FORBIDDEN", "Retrieve this booking first.");
  const row = await getBookingRow(reference);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Booking not found");

  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) throw new ApiError(422, "VALIDATION", "Which message?");
  const mine = (await emailsForBooking(row.id)).some((e) => e.id === body.id);
  if (!mine) throw new ApiError(404, "NOT_FOUND", "No such message on this booking.");

  const ok = await retryEmail(body.id);
  if (!ok) throw new ApiError(409, "ALREADY_SENT", "That message was already delivered.");
  return Response.json({ ok: true });
});
