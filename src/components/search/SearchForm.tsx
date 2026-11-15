"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { isKnownCode } from "@/lib/airports";
import { queryInputSchema, queryToSearchString } from "@/lib/search-params";
import type { SearchQuery, TripType } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import { IconAlert, IconArrow, IconClose, IconPlus, IconSwap } from "@/components/ui/icons";
import { Button } from "@/components/ui/ui";
import { AirportField } from "./AirportField";
import { DateField } from "./DateField";
import { TravellersField, type PaxState } from "./TravellersField";

interface LegState {
  from: string;
  to: string;
  date: string;
}
const emptyLeg = (): LegState => ({ from: "", to: "", date: "" });

interface FormState {
  trip: TripType;
  from: string;
  to: string;
  depart: string;
  ret: string;
  legs: LegState[];
  pax: PaxState;
}

function initState(q?: SearchQuery): FormState {
  return {
    trip: q?.trip ?? "round",
    from: q?.legs[0]?.from ?? "",
    to: q?.legs[0]?.to ?? "",
    depart: q?.legs[0]?.date ?? "",
    ret: q?.trip === "round" ? (q.legs[1]?.date ?? "") : "",
    legs: q?.trip === "multi" ? q.legs.map((l) => ({ ...l })) : [emptyLeg(), emptyLeg()],
    pax: { adults: q?.adults ?? 1, children: q?.children ?? 0, infants: q?.infants ?? 0, cabin: q?.cabin ?? "economy" },
  };
}

const TRIPS: { id: TripType; label: string }[] = [
  { id: "round", label: "Round trip" },
  { id: "oneway", label: "One way" },
  { id: "multi", label: "Multi-city" },
];

const FRIENDLY: Record<string, string> = {
  from: "Choose where you’re flying from",
  to: "Choose a destination",
  depart: "Choose a departure date",
  return: "Add a return date, or switch to one-way",
};

export function SearchForm({ initial, variant = "hero" }: { initial?: SearchQuery; variant?: "hero" | "compact" }) {
  const router = useRouter();
  const sp = useSearchParams();
  const uid = useId().replace(/:/g, "");
  const root = useRef<HTMLFormElement>(null);
  const [f, setF] = useState<FormState>(() => initState(initial));
  const [open, setOpen] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const compact = variant === "compact";
  const size = compact ? "md" : "lg";
  const patch = (p: Partial<FormState>) => setF((s) => ({ ...s, ...p }));
  const toggle = (key: string) => (o: boolean) => setOpen(o ? key : null);

  // Route links such as /?from=LON&to=NYC prefill the console and open the calendar.
  // The prefill is applied during render; the effect only touches the DOM, which is what
  // effects are for.
  const pf = `${sp.get("from") ?? ""}-${sp.get("to") ?? ""}`;
  const [pfApplied, setPfApplied] = useState<string | null>(null);
  if (!initial && pfApplied !== pf) {
    setPfApplied(pf);
    const from = sp.get("from");
    const to = sp.get("to");
    if (from && to && isKnownCode(from) && isKnownCode(to)) {
      setF((s) => ({ ...s, trip: s.trip === "multi" ? "round" : s.trip, from, to, depart: "", ret: "" }));
      setOpen("dates");
    }
  }

  useEffect(() => {
    if (initial) return;
    const from = sp.get("from");
    const to = sp.get("to");
    if (from && to && isKnownCode(from) && isKnownCode(to)) {
      root.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pf]);

  const clearErr = (...keys: string[]) => setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))));

  const build = (): SearchQuery => {
    const base = { ...f.pax };
    if (f.trip === "multi") return { trip: "multi", legs: f.legs, ...base };
    const legs = [{ from: f.from, to: f.to, date: f.depart }];
    if (f.trip === "round") legs.push({ from: f.to, to: f.from, date: f.ret });
    return { trip: f.trip, legs, ...base };
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = queryInputSchema.safeParse(build());
    if (!r.success) {
      const out: Record<string, string> = {};
      for (const issue of r.error.issues) {
        const [head, idx, field] = issue.path as [string, number, string];
        let key: string;
        if (head === "legs" && typeof idx === "number") {
          if (f.trip === "multi") key = `leg${idx}-${field}`;
          else if (idx === 0) key = field === "date" ? "depart" : field;
          else if (field === "date") key = "return";
          else continue;
        } else if (head === "legs") key = f.trip === "round" ? "return" : "depart";
        else key = "pax";
        if (out[key]) continue;
        out[key] = FRIENDLY[key] && (issue.message === "Choose a date" || issue.message === "Choose an airport") ? FRIENDLY[key] : issue.message;
      }
      setErrors(out);
      const first = Object.keys(out)[0];
      setOpen(first === "from" ? "from" : first === "to" ? "to" : first === "depart" || first === "return" ? "dates" : null);
      return;
    }
    setErrors({});
    setSubmitting(true);
    router.push(`/flights?${queryToSearchString(r.data)}`);
    window.setTimeout(() => setSubmitting(false), 2500);
  };

  const afterFrom = (code: string) => {
    patch({ from: code });
    clearErr("from");
    setOpen(!f.to ? "to" : !f.depart ? "dates" : null);
  };
  const afterTo = (code: string) => {
    patch({ to: code });
    clearErr("to");
    setOpen(!f.depart ? "dates" : null);
  };

  const swap = (
    <button
      type="button"
      onClick={() => patch({ from: f.to, to: f.from })}
      aria-label="Swap origin and destination"
      className="z-[5] grid h-11 w-11 place-items-center rounded-full border border-ink bg-paper transition-colors hover:bg-signal md:h-9 md:w-9"
    >
      <IconSwap className="rotate-90 sm:rotate-0" width={16} height={16} />
    </button>
  );

  const setLeg = (i: number, p: Partial<LegState>) => setF((s) => ({ ...s, legs: s.legs.map((l, j) => (j === i ? { ...l, ...p } : l)) }));
  const errList = Object.values(errors);

  return (
    <form
      ref={root}
      onSubmit={submit}
      noValidate
      aria-label="Flight search"
      id={compact ? undefined : "search"}
      className={cn("scroll-mt-24 border-[1.5px] border-ink bg-card", compact ? "rounded-md" : "rounded-md shadow-[6px_6px_0_0_var(--color-ink)]")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-5">
        <div role="radiogroup" aria-label="Trip type" className="inline-flex overflow-hidden rounded-sm border border-ink">
          {TRIPS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={f.trip === t.id}
              onClick={() => {
                patch({ trip: t.id });
                setErrors({});
              }}
              className={cn(
                "h-11 px-3 text-[13px] font-semibold transition-colors md:h-9 md:px-3.5",
                f.trip === t.id ? "bg-ink text-paper" : "bg-transparent text-ink hover:bg-paper-2",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="eyebrow hidden sm:block">All-in prices · taxes &amp; fees included</p>
      </div>

      <div className="grid gap-3 p-4 md:p-5">
        {errList.length > 0 && (
          <div role="alert" className="flex items-start gap-2 rounded-sm border border-[#e0a49f] bg-stop-bg px-3 py-2 text-[13.5px] text-[#7d1a14]">
            <IconAlert className="mt-0.5 shrink-0" width={16} height={16} />
            <span>
              {errList.length === 1 ? "One thing needs attention:" : `${errList.length} things need attention:`} {errList.join(" · ")}
            </span>
          </div>
        )}

        {f.trip !== "multi" ? (
          <div className={cn("grid gap-3", compact && "lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-start")}>
            <div className={cn("flex flex-col gap-3 sm:grid sm:grid-cols-2", "relative")}>
              <AirportField id={`${uid}-from`} label="From" placeholder="Where from?" value={f.from} onChange={afterFrom} open={open === "from"} onOpenChange={toggle("from")} error={errors.from} size={size} />
              <div className="relative -my-1.5 h-0 sm:hidden">
                <div className="absolute right-4 top-0 -translate-y-1/2">{swap}</div>
              </div>
              <div className="absolute left-1/2 hidden -translate-x-1/2 sm:block" style={{ top: compact ? 30 : 43, transform: "translate(-50%,-50%)", zIndex: 5 }}>
                {swap}
              </div>
              <AirportField id={`${uid}-to`} label="To" placeholder="Where to?" value={f.to} onChange={afterTo} open={open === "to"} onOpenChange={toggle("to")} error={errors.to} size={size} />
            </div>
            <div className={cn("grid gap-3", compact ? "contents" : "sm:grid-cols-[1.35fr_1fr]")}>
              <DateField
                id={`${uid}-dates`}
                mode="range"
                oneWay={f.trip === "oneway"}
                start={f.depart}
                end={f.ret}
                onChange={(s, e) => {
                  patch({ depart: s, ret: e });
                  clearErr("depart", "return");
                }}
                open={open === "dates"}
                onOpenChange={toggle("dates")}
                error={errors.depart ?? errors.return}
                size={size}
              />
              <TravellersField id={`${uid}-pax`} value={f.pax} onChange={(pax) => patch({ pax })} open={open === "pax"} onOpenChange={toggle("pax")} error={errors.pax} size={size} />
            </div>
            {compact && (
              <Button type="submit" variant="signal" size="lg" loading={submitting} className="h-[60px] lg:self-start">
                Search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {f.legs.map((leg, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_0.8fr_auto] sm:items-start">
                <AirportField id={`${uid}-l${i}f`} label={`Flight ${i + 1} · From`} placeholder="Where from?" value={leg.from} onChange={(c) => { setLeg(i, { from: c }); clearErr(`leg${i}-from`); setOpen(`l${i}t`); }} open={open === `l${i}f`} onOpenChange={toggle(`l${i}f`)} error={errors[`leg${i}-from`]} size="md" />
                <AirportField id={`${uid}-l${i}t`} label="To" placeholder="Where to?" value={leg.to} onChange={(c) => { setLeg(i, { to: c }); clearErr(`leg${i}-to`); setOpen(`l${i}d`); }} open={open === `l${i}t`} onOpenChange={toggle(`l${i}t`)} error={errors[`leg${i}-to`]} size="md" />
                <DateField id={`${uid}-l${i}d`} mode="single" startLabel="Date" start={leg.date} end="" minDate={i > 0 ? f.legs[i - 1].date : undefined} onChange={(s) => { setLeg(i, { date: s }); clearErr(`leg${i}-date`); }} open={open === `l${i}d`} onOpenChange={toggle(`l${i}d`)} error={errors[`leg${i}-date`]} size="md" />
                {f.legs.length > 2 ? (
                  <button type="button" aria-label={`Remove flight ${i + 1}`} onClick={() => patch({ legs: f.legs.filter((_, j) => j !== i) })} className="grid h-[60px] w-11 place-items-center rounded-sm border border-line-2 text-ink-3 hover:border-ink hover:text-ink">
                    <IconClose />
                  </button>
                ) : (
                  <span className="hidden w-11 sm:block" />
                )}
              </div>
            ))}
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
              <TravellersField id={`${uid}-pax`} value={f.pax} onChange={(pax) => patch({ pax })} open={open === "pax"} onOpenChange={toggle("pax")} error={errors.pax} size="md" />
              {f.legs.length < 5 && (
                <Button variant="outline" className="h-[60px]" onClick={() => patch({ legs: [...f.legs, { from: f.legs[f.legs.length - 1].to, to: "", date: "" }] })}>
                  <IconPlus width={16} height={16} /> Add flight
                </Button>
              )}
            </div>
          </div>
        )}

        {!compact && (
          <div className="flex flex-col-reverse items-stretch gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12.5px] text-ink-3">No account needed. The total you see includes taxes, carrier surcharges and our fee.</p>
            <Button type="submit" variant="signal" size="lg" loading={submitting} className="sm:min-w-[210px]">
              Search flights <IconArrow className="arrow" />
            </Button>
          </div>
        )}
        {compact && f.trip === "multi" && (
          <Button type="submit" variant="signal" size="lg" loading={submitting}>
            Search
          </Button>
        )}
      </div>
    </form>
  );
}
