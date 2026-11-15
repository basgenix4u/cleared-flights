"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addDays, dayDelta, fmtDay, fmtMoneyWhole } from "@/lib/format";
import { queryToSearchString } from "@/lib/search-params";
import type { SearchQuery } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import { Skeleton } from "@/components/ui/ui";

/** ±3-day price strip. Only rendered when the active provider supports cheap calendar lookups. */
export function DateStrip({ query }: { query: SearchQuery }) {
  const router = useRouter();
  /** Prices are stamped with the search they belong to, so a new search reads as "loading" without an effect reset. */
  const [resp, setResp] = useState<{ key: string; prices: Record<string, number | null>; currency: string } | null>(null);
  const [unsupportedKey, setUnsupportedKey] = useState<string | null>(null);
  const base = query.legs[0].date;
  const dates = Array.from({ length: 7 }, (_, i) => addDays(base, i - 3));
  const key = queryToSearchString(query);
  const fresh = resp?.key === key ? resp : null;
  const prices = fresh?.prices ?? null;
  const cur = fresh?.currency ?? "USD";
  const supported = unsupportedKey !== key;

  useEffect(() => {
    if (query.trip === "multi") return;
    const ctl = new AbortController();
    fetch("/api/search/dates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, dates }), signal: ctl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (!j.supported) setUnsupportedKey(key);
        else setResp({ key, prices: j.prices, currency: j.currency ?? "USD" });
      })
      .catch(() => {});
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (query.trip === "multi" || !supported) return null;
  const vals = prices ? Object.values(prices).filter((v): v is number => v !== null) : [];
  const min = vals.length ? Math.min(...vals) : null;

  return (
    <div className="mt-4 md:mt-6" role="group" aria-label="Flexible dates">
      <p className="eyebrow mb-2 text-[10px] md:text-[11px]">Nearby dates · lowest all-in total</p>
      <div className="rail rail-fade -mx-4 flex gap-1.5 px-4 pb-1 pr-8 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0 sm:pr-0 sm:[mask-image:none]">
        {dates.map((d, i) => {
          const p = prices?.[d];
          const current = d === base;
          const shift = dayDelta(base, d);
          const q: SearchQuery = { ...query, legs: query.legs.map((l) => ({ ...l, date: addDays(l.date, shift) })) };
          const disabled = prices ? p === null || p === undefined : false;
          return (
            <button
              key={d}
              type="button"
              disabled={disabled || current}
              aria-current={current ? "date" : undefined}
              onClick={() => router.push(`/flights?${queryToSearchString(q)}`)}
              className={cn(
                "min-w-[80px] shrink-0 rounded-sm border px-2 py-1.5 text-left transition-colors sm:min-w-0 sm:py-2",
                current ? "border-ink bg-ink text-paper" : "border-line-2 bg-card hover:border-ink",
                disabled && !current && "opacity-40",
              )}
            >
              <span className="block font-mono text-[9.5px] uppercase tracking-wide opacity-75 sm:text-[10.5px]">{fmtDay(d)}</span>
              {prices ? (
                <span className={cn("num block text-[14px] font-semibold", !current && p === min && "text-go")}>{p ? fmtMoneyWhole(p, cur) : "—"}</span>
              ) : (
                <Skeleton className="mt-1 h-4 w-12" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
