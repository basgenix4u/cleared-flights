"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fmtDay, fmtDuration, fmtMoneyWhole, plural, CABIN_LABEL } from "@/lib/format";
import { queryToSearchString, travellerCount } from "@/lib/search-params";
import type { Fare, SearchQuery, SearchResultPayload } from "@/lib/types";
import { SearchForm } from "@/components/search/SearchForm";
import { cn } from "@/components/ui/cn";
import { IconAlert, IconArrow, IconClose, IconCompare, IconFilter, IconSearch } from "@/components/ui/icons";
import { ModeBadge, Sign } from "@/components/ui/marks";
import { Sheet } from "@/components/ui/overlays";
import { Banner, Button, EmptyState, Skeleton } from "@/components/ui/ui";
import { CompareDrawer } from "./CompareDrawer";
import { DateStrip } from "./DateStrip";
import { FilterPanel } from "./FilterPanel";
import { FlightCard } from "./FlightCard";
import { activeFilterCount, applyFilters, DEFAULT_FILTERS, facetsOf, sortRows, type Filters, type SortKey } from "./utils";

interface ApiErr {
  code: string;
  message: string;
  retryable?: boolean;
  retryAfter?: number;
}
type State = { status: "loading" } | { status: "ready"; data: SearchResultPayload } | { status: "error"; error: ApiErr };

function ResultSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="grid gap-6 rounded-md border border-line bg-card p-5 lg:grid-cols-[1fr_220px]">
          <div className="space-y-6">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="ml-auto h-9 w-32" />
            <Skeleton className="ml-auto h-4 w-24" />
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

export function ResultsClient({ query }: { query: SearchQuery }) {
  const router = useRouter();
  const qs = queryToSearchString(query);
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("best");
  const [openId, setOpenId] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const now = useNow(30_000);
  const travellers = travellerCount(query);

  // A new search resets the view. This is a render-phase adjustment rather than an
  // effect: the results below are derived from `state`, so a stale frame is never shown.
  const [viewQs, setViewQs] = useState(qs);
  if (viewQs !== qs) {
    setViewQs(qs);
    setState({ status: "loading" });
    setFilters(DEFAULT_FILTERS);
    setOpenId(null);
    setCompare([]);
    setBusy(null);
    setEditing(false);
  }

  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query), signal: ctl.signal })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw j?.error ?? { code: "ERROR", message: "The search failed." };
        return j as SearchResultPayload;
      })
      .then((data) => setState({ status: "ready", data }))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setState({ status: "error", error: err?.message ? err : { code: "NETWORK", message: "We couldn’t reach the server. Check your connection and try again.", retryable: true } });
      });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, attempt]);

  const data = state.status === "ready" ? state.data : null;
  const facets = useMemo(() => (data && data.itineraries.length ? facetsOf(data.itineraries) : null), [data]);
  const rows = useMemo(() => (data ? sortRows(applyFilters(data.itineraries, filters), sort) : []), [data, filters, sort]);
  const currency = data?.itineraries[0]?.fares[0].price.currency ?? "USD";
  const expired = data ? now > new Date(data.expiresAt).getTime() : false;
  const minsLeft = data ? Math.max(0, Math.round((new Date(data.expiresAt).getTime() - now) / 60000)) : 0;

  const tabs = useMemo(() => {
    const base = data ? applyFilters(data.itineraries, filters) : [];
    return (["best", "cheapest", "fastest", "earliest"] as SortKey[]).map((k) => {
      const top = sortRows(base, k)[0];
      return {
        k,
        label: { best: "Best", cheapest: "Cheapest", fastest: "Fastest", earliest: "Earliest" }[k],
        sub: top
          ? k === "earliest"
            ? `${top.it.slices[0].departLocal.slice(11, 16)} · ${fmtMoneyWhole(top.fare.price.total, currency)}`
            : `${fmtMoneyWhole(top.fare.price.total, currency)} · ${fmtDuration(top.it.durationMin)}`
          : "—",
        // A phone shows the number that decides the choice; the duration crowds it out at 4-up.
        price: top ? fmtMoneyWhole(top.fare.price.total, currency) : "—",
      };
    });
  }, [data, filters, currency]);

  /** Re-run the search. The spinner is set here rather than in the effect so the click is acknowledged immediately. */
  const retry = () => {
    setState({ status: "loading" });
    setAttempt((a) => a + 1);
  };

  const choose = (fare: Fare) => {
    if (!data) return;
    setBusy(fare.offerId);
    router.push(`/checkout?session=${data.sessionId}&offer=${encodeURIComponent(fare.offerId)}`);
  };

  const compareRows = rows.filter((r) => compare.includes(r.it.id));
  const compareAll = data ? applyFilters(data.itineraries, DEFAULT_FILTERS).filter((r) => compare.includes(r.it.id)) : [];
  const nFilters = activeFilterCount(filters);

  return (
    <div className={cn("mx-auto max-w-[1320px] px-4 pt-3 md:px-8 md:pb-24 md:pt-6", compare.length > 0 ? "pb-56" : "pb-40")}>
      {/* Search summary */}
      <section
        aria-label="Search summary"
        className="sticky top-14 -mx-4 mb-3 border-y border-line bg-paper/95 backdrop-blur-sm md:static md:mx-0 md:mb-0 md:rounded-md md:border md:border-ink md:bg-card md:backdrop-blur-none"
        style={{ zIndex: "calc(var(--z-nav) - 1)" }}
      >
        {/* One line on a phone: where, when, who, and a way to change it. 56px is the budget. */}
        <div className="flex h-14 items-center gap-2 px-3 md:h-auto md:flex-wrap md:gap-x-6 md:gap-y-2 md:p-4">
          <div className="flex shrink-0 items-center gap-1">
            {query.trip === "multi" ? (
              <span className="font-mono text-[13px] font-semibold">
                {query.legs.length} legs
              </span>
            ) : (
              <>
                <Sign code={query.legs[0].from} size="sm" />
                <IconArrow width={14} height={14} className="text-ink-2" />
                <Sign code={query.trip === "round" ? query.legs[1].to : query.legs[0].to} size="sm" />
              </>
            )}
            {query.trip === "round" && <span className="hidden font-mono text-[11px] text-ink-3 md:inline">ROUND TRIP</span>}
          </div>
          <p className="min-w-0 flex-1 truncate text-[12px] text-ink-2 md:text-[14px]">
            {query.legs.map((l) => fmtDay(l.date)).join(" – ")}
            <span className="text-ink-3">
              {" · "}
              {plural(travellers, "traveller")} · {CABIN_LABEL[query.cabin]}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
            aria-label={editing ? "Close search form" : "Edit search"}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-sm border border-line-2 bg-card text-ink-2 active:bg-paper-2 md:hidden"
          >
            {editing ? <IconClose width={16} height={16} /> : <IconSearch width={16} height={16} />}
          </button>
          <div className="hidden items-center gap-2 md:flex">
            <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
              <IconSearch width={15} height={15} /> {editing ? "Close" : "Edit search"}
            </Button>
          </div>
        </div>
        {editing && (
          <div className="rise border-t border-line p-4">
            <SearchForm initial={query} variant="compact" />
          </div>
        )}
      </section>

      {state.status === "ready" && <DateStrip query={query} />}

      <div className="mt-8 grid gap-8 lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-2">
            {facets && data ? <FilterPanel value={filters} onChange={setFilters} facets={facets} currency={currency} shown={rows.length} total={data.itineraries.length} /> : <div className="space-y-6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>}
          </div>
        </aside>

        <div className="min-w-0">
          {/* Status line */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-ink-3" aria-live="polite" role="status">
              {state.status === "loading" && "Checking schedules and fares…"}
              {data && (<><span className="md:hidden">{plural(rows.length, "flight")} · all-in totals</span><span className="hidden md:inline">{plural(rows.length, "itinerary", "itineraries")} · prices are totals for {plural(travellers, "traveller")}, including taxes and fees</span></>)}
            </p>
            {data && <span className="hidden md:inline"><ModeBadge mode={data.mode} /></span>}
          </div>

          {data && data.mode !== "live" && (
            <Banner tone="info" className="mb-4" title={data.mode === "demo" ? "Demo fares" : "Sandbox fares"}>
              <span className="md:hidden">
                {data.mode === "demo" ? "Synthetic inventory — not bookable." : "Sandbox inventory — not bookable."}{" "}
                <details className="mt-1 inline">
                  <summary className="cursor-pointer font-semibold underline underline-offset-2">Why</summary>
                  <span className="mt-1 block">
                    {data.mode === "demo"
                      ? "Carriers, schedules and prices are synthetic so you can try the whole flow. They are not real inventory and cannot be ticketed."
                      : "Results come from the provider’s sandbox. Orders are simulated and no tickets are issued."}
                  </span>
                </details>
              </span>
              <span className="hidden md:inline">
                {data.mode === "demo" ? "Carriers, schedules and prices are synthetic so you can try the whole flow. They are not real inventory and cannot be ticketed." : "Results come from the provider’s sandbox. Orders are simulated and no tickets are issued."}
              </span>
            </Banner>
          )}
          {expired && (
            <Banner tone="warn" className="mb-4" title="These fares may have changed" action={<Button size="sm" variant="outline" onClick={retry}>Refresh</Button>}>
              The search is more than 30 minutes old. We re-check the price before you pay, but refreshing now avoids surprises.
            </Banner>
          )}
          {data && !expired && minsLeft <= 10 && (
            <p className="mb-3 font-mono text-[11.5px] text-ink-3">Fares valid for about {minsLeft} more min. We re-check at checkout.</p>
          )}

          {/* Sort */}
          {data && data.itineraries.length > 0 && (
            <div role="radiogroup" aria-label="Sort results" className="mb-4 grid grid-cols-4 gap-1.5 md:mb-5 md:gap-2">
              {tabs.map((t) => (
                <button
                  key={t.k}
                  type="button"
                  role="radio"
                  aria-checked={sort === t.k}
                  onClick={() => setSort(t.k)}
                  className={cn(
                    "min-h-[52px] rounded-sm border px-1.5 py-2 text-center transition-colors md:min-h-0 md:px-3.5 md:py-2.5 md:text-left",
                    sort === t.k ? "border-ink bg-ink text-paper" : "border-line-2 bg-card hover:border-ink",
                  )}
                >
                  <span className="block truncate text-[11.5px] font-semibold leading-tight md:hidden">{t.label}</span>
                  <span className="hidden text-[13.5px] font-semibold leading-tight md:block">{t.label}</span>
                  <span className={cn("num block truncate font-mono text-[10.5px] leading-tight md:hidden", sort === t.k ? "text-paper/75" : "text-ink-3")}>
                    {t.price}
                  </span>
                  <span className={cn("num hidden truncate font-mono text-[11.5px] leading-tight md:block", sort === t.k ? "text-paper/75" : "text-ink-3")}>
                    {t.sub}
                  </span>
                </button>
              ))}
            </div>
          )}

          {state.status === "loading" && <ResultSkeleton />}

          {state.status === "error" && (
            <div className="space-y-4">
              <Banner tone="error" title={state.error.code === "VALIDATION" ? "Check your search" : state.error.code === "RATE_LIMITED" ? "Slow down a moment" : "We couldn’t load flights"} action={state.error.code !== "VALIDATION" && <Button size="sm" variant="outline" onClick={retry}>Try again</Button>}>
                {state.error.message}
                {state.error.retryAfter ? ` Try again in ${state.error.retryAfter}s.` : ""}
              </Banner>
              <EmptyState title="Your search is saved in the address bar" icon={<IconAlert />} actions={<Button variant="signal" onClick={() => setEditing(true)}>Edit search</Button>}>
                Nothing was charged and no booking was made. You can retry, or adjust the search.
              </EmptyState>
            </div>
          )}

          {data && data.itineraries.length === 0 && (
            <EmptyState title="No flights found for this search" icon={<IconSearch />} actions={<><Button variant="signal" onClick={() => setEditing(true)}>Change dates or airports</Button><Button variant="outline" onClick={() => router.push(`/flights?${queryToSearchString({ ...query, cabin: "economy" })}`)}>Try Economy</Button></>}>
              Some cabins aren’t flown on short routes, and some dates have no schedule. Try nearby dates or include all airports in a city.
            </EmptyState>
          )}

          {data && data.itineraries.length > 0 && rows.length === 0 && (
            <EmptyState title="No flights match these filters" icon={<IconFilter />} actions={<Button variant="signal" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</Button>}>
              {plural(data.itineraries.length, "itinerary", "itineraries")} found before filtering.
            </EmptyState>
          )}

          <div className="space-y-4">
            {rows.map((r) => (
              <div key={r.it.id} id={`card-${r.it.id}`} className="scroll-mt-[132px] md:scroll-mt-24">
                <FlightCard
                  it={r.it}
                  fare={r.fare}
                  travellers={travellers}
                  open={openId === r.it.id}
                  onToggle={() => setOpenId(openId === r.it.id ? null : r.it.id)}
                  onSelect={choose}
                  busy={busy}
                  compared={compare.includes(r.it.id)}
                  compareFull={compare.length >= 3}
                  onCompare={() => setCompare((c) => (c.includes(r.it.id) ? c.filter((x) => x !== r.it.id) : [...c, r.it.id]))}
                />
              </div>
            ))}
          </div>

          {data && rows.length > 0 && (
            <p className="mt-8 text-[12.5px] leading-relaxed text-ink-3">
              Prices include taxes, carrier-imposed surcharges and the Cleared service fee. Baggage, seats and meals not shown as included are optional and priced at checkout. Airline-supplied rules are shown as given; “not stated” means the airline didn’t provide it.
            </p>
          )}
        </div>
      </div>

      {/* Phone bottom stack: the comparison tray rides on top of the filter bar, and the pair
          sits directly above the tab bar as one fixed block, so no magic offsets drift apart. */}
      {data && data.itineraries.length > 0 && (
        <div
          className="fixed inset-x-0 bg-paper lg:hidden"
          style={{ zIndex: "calc(var(--z-nav) + 1)", bottom: "var(--tabbar-total)" }}
        >
          {compare.length > 0 && (
            <div className="flex items-center gap-2 border-t border-ink bg-ink px-3 py-2 text-paper">
              <IconCompare width={15} height={15} className="shrink-0 text-signal" />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
                {compare.length} of 3 selected
              </span>
              <Button
                size="sm"
                variant="signal"
                disabled={compare.length < 2}
                onClick={() => setCompareOpen(true)}
                aria-label={`Compare the ${compare.length} selected flights`}
                className="!h-9 shrink-0 whitespace-nowrap"
              >
                {compare.length < 2 ? "Pick 1 more" : "Compare"}
              </Button>
              <button
                type="button"
                aria-label="Clear comparison"
                onClick={() => setCompare([])}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-sm text-paper/65 hover:text-signal"
              >
                <IconClose width={16} height={16} />
              </button>
            </div>
          )}
          <div className="safe-bottom border-t border-ink px-3 pt-2">
            <Button variant="primary" className="!h-11 w-full" onClick={() => setFiltersOpen(true)}>
              <IconFilter width={16} height={16} /> Filters{nFilters ? ` (${nFilters})` : ""}
              <span className="mx-1 text-paper/40">·</span> {rows.length} shown
            </Button>
          </div>
        </div>
      )}
      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" side="responsive" footer={<Button variant="signal" className="w-full" onClick={() => setFiltersOpen(false)}>Show {rows.length} itineraries</Button>}>
        {facets && data && (
          <div className="p-5"><FilterPanel value={filters} onChange={setFilters} facets={facets} currency={currency} shown={rows.length} total={data.itineraries.length} /></div>
        )}
      </Sheet>

      {/* Compare bar */}
      {compare.length > 0 && (
        <div className="fixed bottom-4 left-1/2 hidden -translate-x-1/2 items-center gap-3 rounded-md border border-ink bg-ink px-4 py-2.5 text-paper shadow-pop lg:flex" style={{ zIndex: "var(--z-nav)" }}>
          <IconCompare width={16} height={16} />
          <span className="text-[13.5px] font-semibold">{compare.length} selected</span>
          <Button size="sm" variant="signal" disabled={compare.length < 2} onClick={() => setCompareOpen(true)}>{compare.length < 2 ? "Select one more" : "Compare"}</Button>
          <button type="button" className="text-[13px] underline underline-offset-4" onClick={() => setCompare([])}>Clear</button>
        </div>
      )}
      {compareOpen && compareAll.length >= 2 && (
        <CompareDrawer
          rows={compareRows.length >= 2 ? compareRows : compareAll}
          open
          onClose={() => setCompareOpen(false)}
          onRemove={(id) => {
            setCompare((c) => c.filter((x) => x !== id));
            if (compare.length <= 2) setCompareOpen(false);
          }}
          onChoose={(r) => {
            setCompareOpen(false);
            setOpenId(r.it.id);
            window.setTimeout(() => document.getElementById(`card-${r.it.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
          }}
        />
      )}
    </div>
  );
}
