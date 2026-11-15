import { ApiError, errorResponse } from "@/lib/api";
import { getBookingRow } from "@/lib/booking-service";
import { authorizedRefs } from "@/lib/security";
import { localToUtcMs } from "@/lib/time";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export async function GET(_req: Request, { params }: { params: Promise<{ reference: string }> }) {
  try {
    const { reference } = await params;
    if (!(await authorizedRefs()).includes(reference)) throw new ApiError(403, "FORBIDDEN", "Retrieve this booking first.");
    const row = await getBookingRow(reference);
    if (!row) throw new ApiError(404, "NOT_FOUND", "Booking not found");
    const demo = row.mode === "demo" ? "[DEMO] " : "";
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cleared//Trips//EN", "CALSCALE:GREGORIAN"];
    for (const slice of row.itinerary.slices)
      for (const s of slice.segments) {
        const start = localToUtcMs(s.departLocal, s.origin.tz);
        lines.push(
          "BEGIN:VEVENT",
          `UID:${s.id}-${row.reference}@cleared`,
          `DTSTAMP:${stamp(Date.now())}`,
          `DTSTART:${stamp(start)}`,
          `DTEND:${stamp(start + s.durationMin * 60000)}`,
          `SUMMARY:${esc(`${demo}${s.carrier.code}${s.flightNumber} ${s.origin.code} → ${s.destination.code}`)}`,
          `LOCATION:${esc(`${s.origin.name} (${s.origin.code})`)}`,
          `DESCRIPTION:${esc(`Booking ${row.reference}. Operated by ${s.operatingCarrier.name}. Arrives ${s.destination.city} (${s.destination.code}) ${s.arriveLocal.replace("T", " ")} local time.${row.pnr ? ` Airline ref ${row.pnr}.` : ""}`)}`,
          "END:VEVENT",
        );
      }
    lines.push("END:VCALENDAR");
    return new Response(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${row.reference}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
