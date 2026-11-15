"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addDays, fmtDay, fmtMoneyWhole, todayISO } from "@/lib/format";
import { queryToSearchString } from "@/lib/search-params";
import type { SearchQuery } from "@/lib/types";
import { AirportField } from "@/components/search/AirportField";
import { cn } from "@/components/ui/cn";
import { IconSwap } from "@/components/ui/icons";
import { ModeBadge } from "@/components/ui/marks";
import { Banner, Button, Field, Skeleton } from "@/components/ui/ui";
import type { Mode } from "@/lib/config";

const LENGTHS = [
  { v: 0, l: "One way" },
  { v: 3, l: "3 nights" },
  { v: 7, l: "7 nights" },
  { v: 14, l: "14 nights" },
];

function months() {
  const t = todayISO();
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1 + i, 1));
    return d.toISOString().slice(0, 7);
  });
}

export function FareCalendar() {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [len, setLen] = useState(7);
  const [month, setMonth] = useState(months()[1]);
  const [state, setState] = useState<{ status: "idle" | "loading" | "ready" | "error" | "unsupported"; prices?: Record<string, number | null>; mode?: Mode; msg?: string; q?: SearchQuery }>({ status: "idle" });
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (!from || !to) return setErr("Choose both airports to see prices.");
    setErr(null);
    const [y, m] = month.split("-").map(Number);
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const dates = Array.from({ length: dim }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`).filter((d) => d >= todayISO());
    if (!dates.length) return setErr("That month has already passed.");
    const first = dates[0];
    const q: SearchQuery = { trip: len ? "round" : "oneway", legs: len ? [{ from, to, date: first }, { from: to, to: from, date: addDays(first, len) }] : [{ from, to, date: first }], adults: 1, children: 0, infants: 0, cabin: "economy" };
    setState({ status: "loading" });
    try {
      const r = await fetch("/api/search/dates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q, dates }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? "Something went wrong");
      if (!j.supported) setState({ status: "unsupported", mode: j.mode });
      else setState({ status: "ready", prices: j.prices, mode: j.mode, q });
    } catch (e) {
      setState({ status: "error", msg: (e as Error).message });
    }
  };

  const prices = state.prices ?? {};
  const vals = Object.values(prices).filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
  const cheap = new Set(vals.slice(0, 3));
  const [y, m] = month.split("-").map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const go = (date: string) => {
    if (!state.q) return;
    const delta = Math.round((Date.parse(date) - Date.parse(state.q.legs[0].date)) / 86400000);
    const q: SearchQuery = { ...state.q, legs: state.q.legs.map((l) => ({ ...l, date: addDays(l.date, delta) })) };
    router.push(`/flights?${queryToSearchString(q)}`);
  };

  return (
    <div>
      <div className="grid gap-3 rounded-md border-[1.5px] border-ink bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_170px_170px_auto] lg:items-start">
        <div className="relative sm:col-span-2 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-3">
          <AirportField id="fc-from" label="From" placeholder="Where from?" value={from} onChange={(c) => { setFrom(c); setOpen(to ? null : "to"); }} open={open === "from"} onOpenChange={(o) => setOpen(o ? "from" : null)} size="md" />
          <div className="my-2 flex justify-center lg:hidden"><button type="button" onClick={() => { setFrom(to); setTo(from); }} aria-label="Swap origin and destination" className="grid h-11 w-11 place-items-center rounded-full border border-ink bg-paper md:h-9 md:w-9"><IconSwap className="rotate-90" width={14} height={14} /></button></div>
          <AirportField id="fc-to" label="To" placeholder="Where to?" value={to} onChange={(c) => { setTo(c); setOpen(null); }} open={open === "to"} onOpenChange={(o) => setOpen(o ? "to" : null)} size="md" />
        </div>
        <Field label="Trip" htmlFor="fc-len"><select id="fc-len" className="input !h-[60px]" value={len} onChange={(e) => setLen(+e.target.value)}>{LENGTHS.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}</select></Field>
        <Field label="Departing in" htmlFor="fc-month"><select id="fc-month" className="input !h-[60px]" value={month} onChange={(e) => setMonth(e.target.value)}>{months().map((mm) => <option key={mm} value={mm}>{fmtDay(`${mm}-01`, "month")}</option>)}</select></Field>
        <Button variant="signal" size="lg" className="h-[60px] sm:mt-[26px] sm:col-span-2 lg:col-span-1" loading={state.status === "loading"} onClick={run}>Show prices</Button>
      </div>
      {err && <p role="alert" className="mt-2 text-[13px] font-medium text-stop">{err}</p>}

      <div className="mt-8" aria-live="polite">
        {state.status === "idle" && <p className="text-[14px] text-ink-3">Pick a route and a month. We’ll show the lowest all-in total for each departure day, for 1 adult in Economy.</p>}
        {state.status === "loading" && <div className="grid grid-cols-7 gap-1.5">{Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>}
        {state.status === "error" && <Banner tone="error" title="We couldn’t load prices">{state.msg}</Banner>}
        {state.status === "unsupported" && <Banner tone="info" title="Fare calendars aren’t available with the live provider">Checking 30 days of live fares would run a search per day. Use the ±3-day strip on the results page for nearby dates instead.</Banner>}
        {state.status === "ready" && state.mode && (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[18px] font-semibold tracking-tight">{fmtDay(`${month}-01`, "month")}</h2>
              <ModeBadge mode={state.mode} />
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d} className="pb-1 text-center font-mono text-[10.5px] uppercase text-ink-3">{d}</span>)}
              {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
              {Array.from({ length: dim }, (_, i) => {
                const d = `${month}-${String(i + 1).padStart(2, "0")}`;
                const p = prices[d];
                const has = typeof p === "number";
                return (
                  <button key={d} type="button" disabled={!has} onClick={() => go(d)} aria-label={`${fmtDay(d, "long")}${has ? `, lowest total ${fmtMoneyWhole(p, "USD")}` : ", no fare"}`} className={cn("min-h-16 rounded-sm border px-1.5 py-1.5 text-left transition-colors", has ? (cheap.has(p) ? "border-go bg-go-bg hover:border-ink" : "border-line-2 bg-card hover:border-ink") : "border-transparent bg-paper-2/50 text-ink-3/50")}>
                    <span className="num block font-mono text-[11px] text-ink-3">{i + 1}</span>
                    <span className={cn("num block text-[14px] font-semibold", has && cheap.has(p) && "text-go")}>{has ? fmtMoneyWhole(p, "USD") : "—"}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-[12.5px] text-ink-3">These are the lowest all-in totals (taxes, surcharges and our fee included), not discounts. Green marks the three lowest days. Select a day to see real itineraries and fare rules.</p>
          </div>
        )}
      </div>
    </div>
  );
}
