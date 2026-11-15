"use client";

import { dayDelta, fmtDay, fmtDuration, fmtMoney, timeOf } from "@/lib/format";
import type { Fare, Itinerary } from "@/lib/types";
import { IconArrow } from "@/components/ui/icons";
import { Sign } from "@/components/ui/marks";
import { bagText, changeText, refundText, Tone } from "@/components/results/FlightCard";

export interface ExtraLine {
  label: string;
  who: string;
  amount: number;
}

export function SummaryBody({ itinerary, fare, extras, extrasTotal, total }: { itinerary: Itinerary; fare: Fare; extras: ExtraLine[]; extrasTotal: number; total: number }) {
  const cur = fare.price.currency;
  const rows: [string, number][] = [
    ["Airline fare", fare.price.fare],
    ["Taxes & carrier surcharges", fare.price.taxes],
    ["Cleared service fee", fare.price.serviceFee],
  ];
  return (
    <div>
      <div className="space-y-4">
        {itinerary.slices.map((s, i) => {
          const d = dayDelta(s.departLocal, s.arriveLocal);
          return (
            <div key={s.id} className="text-[13.5px]">
              <div className="flex items-center gap-2">
                <Sign code={s.origin.code} size="sm" /> <IconArrow width={14} height={14} className="text-ink-3" /> <Sign code={s.destination.code} size="sm" />
                <span className="ml-auto font-mono text-[11.5px] text-ink-3">{fmtDay(s.departLocal)}</span>
              </div>
              <p className="num mt-1.5 font-mono text-[13px]">
                {timeOf(s.departLocal)} → {timeOf(s.arriveLocal)}{d > 0 && <sup className="text-stop"> +{d}</sup>} <span className="text-ink-3">· {fmtDuration(s.durationMin)} · {s.segments.length === 1 ? "nonstop" : `${s.segments.length - 1} stop${s.segments.length > 2 ? "s" : ""}`}</span>
              </p>
              <p className="text-[12px] text-ink-3">{s.segments.map((g) => `${g.carrier.code}${g.flightNumber}`).join(" · ")} · {itinerary.owner.name}{i === 0 && itinerary.slices.length > 1 ? "" : ""}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <p className="text-[14px] font-semibold">{fare.brand} <span className="font-normal text-ink-3">· {fare.cabin.replace("_", " ")}</span></p>
        <ul className="mt-2 space-y-1.5">
          {[bagText(fare), changeText(fare), refundText(fare)].map((r, i) => (
            <li key={i}><Tone tone={r.tone}>{r.text}</Tone></li>
          ))}
        </ul>
      </div>

      <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[14px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-2">
            <dt className="text-ink-2">{k}</dt><span className="leader" aria-hidden /><dd className="num font-mono">{fmtMoney(v, cur)}</dd>
          </div>
        ))}
        {extras.map((l, i) => (
          <div key={i} className="flex items-baseline gap-2">
            <dt className="text-ink-2">{l.label}<span className="block text-[11.5px] text-ink-3">{l.who}</span></dt><span className="leader" aria-hidden /><dd className="num font-mono">{l.amount ? fmtMoney(l.amount, cur) : "Free"}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-end justify-between border-t-[1.5px] border-ink pt-4">
        <div>
          <p className="eyebrow">Total to pay</p>
          <p className="text-[11.5px] text-ink-3">{extrasTotal ? `Includes ${fmtMoney(extrasTotal, cur)} of extras` : "No extras added"}</p>
        </div>
        <p className="num code text-[40px] font-semibold" aria-live="polite">{fmtMoney(total, cur)}</p>
      </div>
    </div>
  );
}
