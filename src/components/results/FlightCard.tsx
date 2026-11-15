"use client";

import { useState } from "react";
import { dayDelta, fmtDay, fmtDuration, fmtMoney, plural, stopsLabel, timeOf } from "@/lib/format";
import { localToUtcMs, tzOffsetMin } from "@/lib/time";
import type { Fare, Itinerary, Layover, Slice } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import { IconAlert, IconArrow, IconBag, IconCarry, IconCheck, IconChevron, IconCompare, IconMinus, IconRefund } from "@/components/ui/icons";
import { AirlineMark } from "@/components/ui/marks";
import { Button } from "@/components/ui/ui";
import { bagText, cabinText, changeText, refundText, seatText } from "./fare-text";
import { RiskPill, TripInsight } from "./TripInsight";

export { bagText, cabinText, changeText, refundText, seatText };

const FLAG_TEXT: Record<Layover["flags"][number], string> = {
  short: "Short connection",
  long: "Long layover",
  overnight: "Overnight layover",
  airport_change: "Change of airport",
};

export function Tone({ tone, children, icon }: { tone: "yes" | "no" | "maybe"; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12.5px]", tone === "yes" ? "text-go" : tone === "no" ? "text-ink-3" : "text-warn")}>
      {icon ?? (tone === "yes" ? <IconCheck width={14} height={14} /> : tone === "no" ? <IconMinus width={14} height={14} /> : <IconAlert width={14} height={14} />)}
      <span className={tone === "yes" ? "font-medium" : ""}>{children}</span>
    </span>
  );
}

/* One direction of travel, drawn as a timetable row. */
export function SliceRow({ slice, owner, label }: { slice: Slice; owner: Itinerary["owner"]; label?: string }) {
  const stops = slice.segments.length - 1;
  const delta = dayDelta(slice.departLocal, slice.arriveLocal);
  const flags = slice.layovers.flatMap((l) => l.flags.map((f) => ({ f, l })));
  const carriers = [...new Map(slice.segments.map((s) => [s.operatingCarrier.code, s.operatingCarrier])).values()];
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 sm:grid-cols-[170px_1fr]">
      <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
        <AirlineMark carrier={owner} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight">{owner.name}</p>
          <p className="truncate font-mono text-[11px] text-ink-3">
            {label ? `${label} · ` : ""}{slice.segments.map((s) => `${s.carrier.code}${s.flightNumber}`).join(" · ")}
          </p>
        </div>
      </div>
      <div className="col-span-2 grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:col-span-1">
        <div>
          <p className="num code text-[28px] font-semibold">{timeOf(slice.departLocal)}</p>
          <p className="mt-1 font-mono text-[12px]">{slice.origin.code}</p>
        </div>
        <div className="min-w-0 px-1">
          <p className="num text-center text-[12px] text-ink-2">{fmtDuration(slice.durationMin)}</p>
          <div className="relative my-1.5 h-px bg-ink" aria-hidden>
            <span className="absolute -left-px top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full border border-ink bg-card" />
            {slice.layovers.map((l, i) => (
              <span key={i} className={cn("absolute top-1/2 h-[9px] w-[9px] -translate-y-1/2 rounded-full border border-ink", l.flags.length ? "bg-signal" : "bg-card")} style={{ left: `${((i + 1) / (stops + 1)) * 100}%` }} />
            ))}
            <span className="absolute -right-px top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full bg-ink" />
          </div>
          <p className="truncate text-center text-[12px] text-ink-3">
            {stops === 0 ? <span className="font-semibold text-go">Nonstop</span> : <>{stopsLabel(stops)} · {slice.layovers.map((l) => `${l.airport.code} ${fmtDuration(l.durationMin)}`).join(", ")}</>}
          </p>
        </div>
        <div className="text-right">
          <p className="num code text-[28px] font-semibold">
            {timeOf(slice.arriveLocal)}
            {delta > 0 && <sup className="ml-0.5 font-mono text-[11px] font-medium text-stop">+{delta}</sup>}
          </p>
          <p className="mt-1 font-mono text-[12px]">{slice.destination.code}</p>
        </div>
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:col-start-2">
        <span className="font-mono text-[11px] text-ink-3 sm:hidden">{owner.name}</span>
        {carriers.some((c) => c.code !== owner.code) && <span className="text-[11.5px] text-ink-3">Operated by {carriers.map((c) => c.name).join(", ")}</span>}
        {flags.map(({ f, l }, i) => (
          <span key={i} className={cn("inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-[11.5px] font-semibold", f === "airport_change" ? "bg-stop-bg text-stop" : "bg-warn-bg text-warn")}>
            <IconAlert width={12} height={12} /> {FLAG_TEXT[f]} · {l.airport.code} {fmtDuration(l.durationMin)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Fare comparison ── */
function FareTable({ it, onSelect, busy }: { it: Itinerary; onSelect: (f: Fare) => void; busy: string | null }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="grid min-w-max auto-cols-[minmax(210px,1fr)] grid-flow-col gap-3 sm:min-w-0">
        {it.fares.map((f, i) => (
          <div key={f.offerId} className={cn("flex flex-col rounded-sm border bg-card", i === 0 ? "border-ink" : "border-line-2")}>
            <div className="border-b border-line p-4">
              <p className="eyebrow">{i === 0 ? "Lowest" : "Upgrade"}</p>
              <p className="mt-1 text-[17px] font-semibold tracking-tight">{f.brand}</p>
              <p className="num code mt-3 text-[32px] font-semibold">{fmtMoney(f.price.total, f.price.currency)}</p>
              <p className="text-[12px] text-ink-3">total · {fmtMoney(f.price.perTraveller, f.price.currency)} per traveller</p>
              {i > 0 && <p className="mt-1 font-mono text-[11.5px] text-ink-2">+ {fmtMoney(f.price.total - it.fares[0].price.total, f.price.currency)} vs lowest</p>}
            </div>
            <ul className="flex-1 space-y-2.5 p-4">
              {[cabinText(f), bagText(f), seatText(f), changeText(f), refundText(f)].map((r, k) => (
                <li key={k}><Tone tone={r.tone}>{r.text}</Tone></li>
              ))}
              {f.perks.map((p) => <li key={p}><Tone tone="yes">{p}</Tone></li>)}
            </ul>
            <div className="p-4 pt-0">
              <Button variant={i === 0 ? "signal" : "outline"} className="w-full" loading={busy === f.offerId} disabled={!!busy && busy !== f.offerId} onClick={() => onSelect(f)}>
                Select {f.brand} <IconArrow className="arrow" width={15} height={15} />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-ink-3">Fare rules are shown as supplied by the airline. Anything marked “not stated” was not provided; confirm in the airline’s conditions of carriage.</p>
    </div>
  );
}

/* ── Segment-level details ── */
function utcLabel(local: string, tz: string) {
  const o = tzOffsetMin(tz, localToUtcMs(local, tz));
  const h = Math.trunc(o / 60);
  const m = Math.abs(o % 60);
  return `UTC${o >= 0 ? "+" : "−"}${Math.abs(h)}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

export function Details({ it }: { it: Itinerary }) {
  return (
    <div className="space-y-8">
      {it.slices.map((s, si) => (
        <div key={s.id}>
          <p className="eyebrow mb-3">
            {it.slices.length > 1 ? `Flight ${si + 1} · ` : ""}{s.origin.city} → {s.destination.city} · {fmtDay(s.departLocal)} · {fmtDuration(s.durationMin)} total
          </p>
          <ol className="border-l-[1.5px] border-ink pl-5">
            {s.segments.map((g, gi) => (
              <li key={g.id} className="relative pb-5 last:pb-0">
                <span aria-hidden className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-[1.5px] border-ink bg-signal" />
                <div className="grid gap-x-6 gap-y-1 sm:grid-cols-[1fr_1fr]">
                  <div>
                    <p className="num"><span className="code text-[22px] font-semibold">{timeOf(g.departLocal)}</span> <span className="ml-1 text-[13px] text-ink-3">{fmtDay(g.departLocal)}</span></p>
                    <p className="text-[13.5px] font-semibold">{g.origin.name} <span className="font-mono text-[12px] font-normal text-ink-3">{g.origin.code}</span></p>
                    <p className="text-[12px] text-ink-3">{g.origin.city} · local time, {utcLabel(g.departLocal, g.origin.tz)}</p>
                  </div>
                  <div>
                    <p className="num"><span className="code text-[22px] font-semibold">{timeOf(g.arriveLocal)}</span> <span className="ml-1 text-[13px] text-ink-3">{fmtDay(g.arriveLocal)}</span></p>
                    <p className="text-[13.5px] font-semibold">{g.destination.name} <span className="font-mono text-[12px] font-normal text-ink-3">{g.destination.code}</span></p>
                    <p className="text-[12px] text-ink-3">{g.destination.city} · local time, {utcLabel(g.arriveLocal, g.destination.tz)}</p>
                  </div>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-2">
                  <span className="inline-flex items-center gap-1.5"><AirlineMark carrier={g.carrier} size={18} /> <span className="font-mono">{g.carrier.code}{g.flightNumber}</span></span>
                  <span>Operated by {g.operatingCarrier.name}</span>
                  {g.aircraft && <span>{g.aircraft}</span>}
                  <span>{fmtDuration(g.durationMin)}</span>
                </p>
                {s.layovers[gi] && (
                  <div className={cn("mt-4 rounded-sm border border-dashed px-3 py-2 text-[13px]", s.layovers[gi].flags.length ? "border-[#d6b24a] bg-warn-bg text-warn" : "border-line-2 bg-paper-2/60 text-ink-2")}>
                    <strong className="font-semibold">Layover in {s.layovers[gi].airport.city} ({s.layovers[gi].airport.code}) · {fmtDuration(s.layovers[gi].durationMin)}</strong>
                    {s.layovers[gi].flags.length > 0 && <span> — {s.layovers[gi].flags.map((f) => FLAG_TEXT[f]).join(", ").toLowerCase()}</span>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function PriceTable({ it }: { it: Itinerary }) {
  const cur = it.fares[0].price.currency;
  const lines: [string, (f: Fare) => number][] = [
    ["Airline fare", (f) => f.price.fare],
    ["Taxes & carrier surcharges", (f) => f.price.taxes],
    ["Cleared service fee", (f) => f.price.serviceFee],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-[14px]">
        <caption className="sr-only">Price breakdown by fare</caption>
        <thead>
          <tr className="border-b border-ink text-left">
            <th className="py-2 pr-4 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">All travellers</th>
            {it.fares.map((f) => <th key={f.offerId} className="py-2 pl-4 text-right font-semibold">{f.brand}</th>)}
          </tr>
        </thead>
        <tbody>
          {lines.map(([label, get]) => (
            <tr key={label} className="border-b border-line">
              <th scope="row" className="py-2.5 pr-4 text-left font-normal text-ink-2">{label}</th>
              {it.fares.map((f) => <td key={f.offerId} className="num py-2.5 pl-4 text-right font-mono">{fmtMoney(get(f), cur)}</td>)}
            </tr>
          ))}
          <tr>
            <th scope="row" className="py-3 pr-4 text-left font-semibold">Total</th>
            {it.fares.map((f) => <td key={f.offerId} className="num py-3 pl-4 text-right font-mono text-[16px] font-medium">{fmtMoney(f.price.total, cur)}</td>)}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-ink-3">Optional extras such as bags, seats and meals are not included and are priced separately at checkout.</p>
    </div>
  );
}

type TabId = "insight" | "fares" | "details" | "price";

export function FlightCard({
  it,
  fare,
  travellers,
  open,
  onToggle,
  onSelect,
  busy,
  compared,
  onCompare,
  compareFull,
}: {
  it: Itinerary;
  fare: Fare;
  travellers: number;
  open: boolean;
  onToggle: () => void;
  onSelect: (f: Fare) => void;
  busy: string | null;
  compared: boolean;
  onCompare: () => void;
  compareFull: boolean;
}) {
  const [tab, setTab] = useState<TabId>("fares");
  const cur = fare.price.currency;
  const cheaper = it.fares[0].offerId !== fare.offerId;
  const tabs: { id: TabId; label: string }[] = [
    { id: "insight", label: "Trip insight" },
    { id: "fares", label: `Fares (${it.fares.length})` },
    { id: "details", label: "Flight details" },
    { id: "price", label: "Price breakdown" },
  ];
  return (
    <article className={cn("rise rounded-md border bg-card transition-colors", open ? "border-ink shadow-[4px_4px_0_0_var(--color-ink)]" : "border-line-2 hover:border-ink")} aria-label={`${it.owner.name}, ${fmtMoney(fare.price.total, cur)}`}>
      <div className="grid lg:grid-cols-[1fr_240px]">
        <div className="space-y-4 p-4 sm:p-5">
          {it.slices.map((s, i) => <SliceRow key={s.id} slice={s} owner={it.owner} label={it.slices.length > 1 ? (it.slices.length === 2 && i === 1 ? "Return" : i === 0 ? "Outbound" : `Flight ${i + 1}`) : undefined} />)}
        </div>
        <div className="flex flex-row items-end justify-between gap-4 border-t border-line p-4 sm:p-5 lg:flex-col lg:items-stretch lg:justify-between lg:border-l lg:border-t-0">
          <div className="lg:text-right">
            <p className="num code text-[27px] font-semibold leading-none md:text-[36px]">{fmtMoney(fare.price.total, cur)}</p>
            <p className="mt-1 text-[11.5px] text-ink-3 md:text-[12px]">
              total for {plural(travellers, "traveller")}
              {/* One traveller means "total" and "per traveller" are the same number twice. */}
              {travellers > 1 && (
                <span className="num text-ink-2"> · {fmtMoney(fare.price.perTraveller, cur)} each</span>
              )}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink-2 md:mt-1.5 md:text-[11.5px]">{fare.brand}{cheaper ? " · matches your filters" : ""}</p>
          </div>
          <ul className="hidden space-y-1 lg:block lg:text-right">
            {[bagText(fare), refundText(fare)].map((r, i) => (
              <li key={i} className="lg:flex lg:justify-end"><Tone tone={r.tone} icon={i === 0 ? <IconBag width={14} height={14} /> : <IconRefund width={14} height={14} />}>{r.text}</Tone></li>
            ))}
          </ul>
          <Button variant={open ? "outline" : "signal"} onClick={onToggle} aria-expanded={open} className="!h-11 shrink-0 lg:!h-10 lg:w-full">
            {open ? "Close" : "Choose fare"} <IconChevron className={cn("transition-transform", open && "rotate-180")} width={16} height={16} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="lg:hidden"><Tone tone={bagText(fare).tone} icon={<IconBag width={14} height={14} />}>{bagText(fare).text}</Tone></span>
          <span className="lg:hidden"><Tone tone={refundText(fare).tone} icon={<IconRefund width={14} height={14} />}>{refundText(fare).text}</Tone></span>
          <span className="hidden lg:inline"><Tone tone={cabinText(fare).tone} icon={<IconCarry width={14} height={14} />}>{cabinText(fare).text}</Tone></span>
          <RiskPill it={it} fare={fare} />
          <span className="hidden text-[12.5px] text-ink-3 lg:inline">{fare.cabin.replace("_", " ")} · {stopsLabel(it.stops).toLowerCase()}</span>
          {/* On a phone the comparison is a chip in this row, not a checkbox that only exists
              at md — otherwise the compare tray would have no way to fill itself. */}
          <button
            type="button"
            onClick={onCompare}
            disabled={compareFull && !compared}
            aria-pressed={compared}
            className={cn(
              "ml-auto flex min-h-11 shrink-0 items-center gap-1.5 rounded-xs border px-2.5 font-mono text-[11px] uppercase tracking-[0.04em] transition-colors md:hidden",
              compared ? "border-ink bg-ink text-paper" : "border-line-2 text-ink-2",
              compareFull && !compared && "opacity-40",
            )}
          >
            <IconCompare width={14} height={14} />
            {compared ? "Added" : "Compare"}
          </button>
        </div>
        <label className={cn("hidden cursor-pointer items-center gap-2 text-[12.5px] font-semibold md:flex", compareFull && !compared && "cursor-not-allowed opacity-50")}>
          <input type="checkbox" checked={compared} disabled={compareFull && !compared} onChange={onCompare} className="h-4 w-4" />
          Compare
        </label>
      </div>

      <div className="fold" data-open={open}>
        <div>
          {open && (
            <div className="border-t border-line bg-paper/60 p-4 sm:p-5">
              <div role="tablist" aria-label="Flight information" className="mb-5 flex gap-1 border-b border-line">
                {tabs.map((t) => (
                  <button key={t.id} role="tab" aria-selected={tab === t.id} aria-controls={`${it.id}-${t.id}`} id={`${it.id}-tab-${t.id}`} onClick={() => setTab(t.id)} className={cn("-mb-px border-b-[3px] px-3 py-2.5 text-[13.5px] font-semibold transition-colors", tab === t.id ? "border-signal text-ink" : "border-transparent text-ink-3 hover:text-ink")}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div role="tabpanel" id={`${it.id}-${tab}`} aria-labelledby={`${it.id}-tab-${tab}`}>
                {tab === "insight" && <TripInsight it={it} fare={fare} />}
                {tab === "fares" && <FareTable it={it} onSelect={onSelect} busy={busy} />}
                {tab === "details" && <Details it={it} />}
                {tab === "price" && <PriceTable it={it} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
