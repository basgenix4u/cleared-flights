"use client";

import { dayDelta, fmtDay, fmtDuration, fmtMoney, stopsLabel, timeOf } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import { AirlineMark } from "@/components/ui/marks";
import { Sheet } from "@/components/ui/overlays";
import { Button } from "@/components/ui/ui";
import { bagText, cabinText, changeText, refundText, seatText, Tone } from "./FlightCard";
import { flexibility, riskProfile, type Tone as RiskTone } from "@/lib/itinerary-insight";
import { maxLayoverOf, longestSlice, type Row } from "./utils";

export function CompareDrawer({ rows, open, onClose, onChoose, onRemove }: { rows: Row[]; open: boolean; onClose: () => void; onChoose: (r: Row) => void; onRemove: (id: string) => void }) {
  const minPrice = Math.min(...rows.map((r) => r.fare.price.total));
  const minDur = Math.min(...rows.map((r) => longestSlice(r.it)));
  const minStops = Math.min(...rows.map((r) => r.it.stops));
  const maxRiskScore = Math.max(...rows.map((r) => riskProfile(r.it, r.fare).score));
  const riskTone: Record<RiskTone, string> = { good: "text-go", warn: "text-warn", bad: "text-stop", info: "text-ink-2" };
  const best = (cond: boolean) => (cond ? "bg-signal-soft font-semibold" : "");

  const line: { label: string; cell: (r: Row) => React.ReactNode; hl?: (r: Row) => boolean }[] = [
    { label: "Total price", cell: (r) => <span className="num font-mono text-[15px]">{fmtMoney(r.fare.price.total, r.fare.price.currency)}</span>, hl: (r) => r.fare.price.total === minPrice },
    { label: "Per traveller", cell: (r) => <span className="num font-mono">{fmtMoney(r.fare.price.perTraveller, r.fare.price.currency)}</span> },
    { label: "Fare", cell: (r) => r.fare.brand },
    ...(rows[0]?.it.slices.map((_, i) => ({
      label: rows[0].it.slices.length > 1 ? (i === 0 ? "Outbound" : i === 1 && rows[0].it.slices.length === 2 ? "Return" : `Flight ${i + 1}`) : "Flight",
      cell: (r: Row) => {
        const s = r.it.slices[i];
        const d = dayDelta(s.departLocal, s.arriveLocal);
        return (
          <span className="num block">
            <span className="font-mono text-[14px]">{timeOf(s.departLocal)} → {timeOf(s.arriveLocal)}{d > 0 && <sup className="text-stop"> +{d}</sup>}</span>
            <span className="block text-[12px] text-ink-3">{s.origin.code} → {s.destination.code} · {fmtDay(s.departLocal)}</span>
          </span>
        );
      },
    })) ?? []),
    { label: "Longest journey", cell: (r) => <span className="num font-mono">{fmtDuration(longestSlice(r.it))}</span>, hl: (r) => longestSlice(r.it) === minDur },
    { label: "Stops", cell: (r) => stopsLabel(r.it.stops), hl: (r) => r.it.stops === minStops },
    {
      label: "Disruption risk",
      cell: (r) => {
        const p = riskProfile(r.it, r.fare);
        const tone: RiskTone = p.band === "low" ? "good" : p.band === "moderate" ? "info" : p.band === "elevated" ? "warn" : "bad";
        const top = p.factors.find((f) => f.penalty > 0);
        return (
          <span className="block">
            <span className={cn("num font-mono font-medium", riskTone[tone])}>{p.score}/100</span>
            <span className="block text-[12px] text-ink-3">{top ? top.label : "Nothing notable"}</span>
          </span>
        );
      },
      hl: (r) => riskProfile(r.it, r.fare).score === maxRiskScore,
    },
    {
      label: "Money at risk",
      cell: (r) => {
        const f = flexibility(r.fare);
        return f.atRisk === null ? (
          <span className="text-[12.5px] text-ink-3">Not stated</span>
        ) : (
          <span className={cn("num font-mono", f.atRisk > 0 ? "text-stop" : "text-go")}>
            {f.atRisk > 0 ? fmtMoney(f.atRisk, r.fare.price.currency) : "Refundable"}
          </span>
        );
      },
    },
    { label: "Longest layover", cell: (r) => (maxLayoverOf(r.it) ? <span className="num font-mono">{fmtDuration(maxLayoverOf(r.it))}</span> : "None") },
    { label: "Cabin bag", cell: (r) => <Tone tone={cabinText(r.fare).tone}>{cabinText(r.fare).text}</Tone> },
    { label: "Checked bag", cell: (r) => <Tone tone={bagText(r.fare).tone}>{bagText(r.fare).text}</Tone> },
    { label: "Seat choice", cell: (r) => <Tone tone={seatText(r.fare).tone}>{seatText(r.fare).text}</Tone> },
    { label: "Changes", cell: (r) => <Tone tone={changeText(r.fare).tone}>{changeText(r.fare).text}</Tone> },
    { label: "Refund", cell: (r) => <Tone tone={refundText(r.fare).tone}>{refundText(r.fare).text}</Tone> },
  ];

  return (
    <Sheet open={open} onClose={onClose} title={`Compare ${rows.length} flights`} wide>
      <div className="overflow-x-auto p-3 md:p-5">
        <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
          <thead>
            <tr>
              {/* The label column stays pinned; on a phone the flight columns scroll under it
                  rather than sliding the row names out of view. */}
              <th className="sticky left-0 z-10 w-[88px] bg-paper md:w-32" />
              {rows.map((r) => (
                <th key={r.it.id} scope="col" className="border-b-[1.5px] border-ink px-3 pb-3 text-left align-bottom">
                  <span className="flex items-center gap-2"><AirlineMark carrier={r.it.owner} size={24} /><span className="font-semibold">{r.it.owner.name}</span></span>
                  <button type="button" onClick={() => onRemove(r.it.id)} className="mt-1 text-[12px] font-normal text-ink-3 underline underline-offset-4 hover:text-ink">Remove</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {line.map((l) => (
              <tr key={l.label} className="border-b border-line">
                <th scope="row" className="sticky left-0 z-10 bg-paper py-3 pr-2 text-left align-top font-mono text-[10.5px] font-medium uppercase tracking-[0.04em] text-ink-3 md:pr-3 md:text-[11px] md:tracking-[0.06em]">{l.label}</th>
                {rows.map((r) => (
                  <td key={r.it.id} className={cn("px-3 py-3 align-top", l.hl && best(l.hl(r)))}>{l.cell(r)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="sticky left-0 z-10 bg-paper" />
              {rows.map((r) => (
                <td key={r.it.id} className="px-3 pt-4">
                  <Button variant="signal" size="sm" className="w-full" onClick={() => onChoose(r)}>See fares</Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="mt-4 text-[12px] text-ink-3">Highlighted cells are the best value in that row. “Best” never hides the trade-offs; read the whole row.</p>
      </div>
    </Sheet>
  );
}
