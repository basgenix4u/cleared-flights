import { cn } from "@/components/ui/cn";
import { IconAlert, IconCheck, IconInfo, IconShield } from "@/components/ui/icons";
import { departureReadiness, readinessScore, type ChecklistItem } from "@/lib/travel-docs";
import type { BookingView } from "@/lib/booking-service";

/**
 * "Before you fly" — the checks that actually stop people boarding, run against the
 * booking we already hold. Nothing here calls an outside service: the six-month
 * passport rule, infant/child ages and name format are all deterministic.
 *
 * Rendered on the server so no extra passenger data is shipped to the browser.
 */
export function BeforeYouFly({ booking }: { booking: BookingView }) {
  const slices = booking.itinerary.slices;
  const firstDepart = slices[0].departLocal.slice(0, 10);
  const lastArrive = slices.reduce((acc, s) => (s.arriveLocal > acc ? s.arriveLocal : acc), slices[0].arriveLocal).slice(0, 10);
  const international = slices.some((s) => s.origin.cc !== s.destination.cc);
  const nights = Math.max(
    0,
    Math.round((new Date(`${lastArrive}T00:00:00Z`).getTime() - new Date(`${firstDepart}T00:00:00Z`).getTime()) / 86_400_000),
  );

  const items = departureReadiness({
    passengers: booking.passengers.map((p) => ({
      type: p.type,
      title: "mr",
      givenName: p.givenName,
      familyName: p.familyName,
      bornOn: p.bornOn,
      gender: "m",
      passportExpiry: p.passportExpiry ?? undefined,
    })),
    departIso: firstDepart,
    lastTravelIso: lastArrive,
    international,
    checkedBagsIncluded: booking.fare.baggage.checked ?? 0,
    nights,
  });

  const summary = readinessScore(items);
  const icon = (s: ChecklistItem["status"]) =>
    s === "pass" ? <IconCheck width={16} height={16} /> : s === "fail" ? <IconAlert width={16} height={16} /> : s === "warn" ? <IconAlert width={16} height={16} /> : <IconInfo width={16} height={16} />;
  const tone = (s: ChecklistItem["status"]) =>
    s === "pass" ? "text-go" : s === "fail" ? "text-stop" : s === "warn" ? "text-warn" : "text-ink-3";

  return (
    <section aria-labelledby="byf-h" className="rounded-md border border-line-2 bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="byf-h" className="flex items-center gap-2 text-[18px] font-semibold tracking-tight">
            <IconShield width={18} height={18} /> Before you fly
          </h2>
          <p className="mt-1 max-w-xl text-[13px] text-ink-3">
            Checked against this booking and the document details you gave us. Entry rules belong to the border authority — this is a
            checklist, not a guarantee of entry.
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-xs border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.06em]",
            summary.status === "fail" ? "border-[#e0a49f] bg-stop-bg text-stop" : summary.status === "warn" ? "border-[#d6b24a] bg-warn-bg text-warn" : "border-line-2 bg-paper-2/60 text-ink-2",
          )}
        >
          {summary.label}
        </span>
      </div>

      <ul className="mt-5 divide-y divide-line">
        {items.map((i) => (
          <li key={i.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <span className={cn("mt-[2px] shrink-0", tone(i.status))}>{icon(i.status)}</span>
            <div className="min-w-0">
              <p className={cn("text-[14px] font-semibold leading-snug", i.status === "fail" && "text-stop")}>{i.label}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{i.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-ink-3">
        Names are transmitted to the airline exactly as typed. Corrections after ticketing usually carry a fee, and some airlines do not
        allow them at all. Contact us before departure if anything above is wrong.
      </p>
    </section>
  );
}
