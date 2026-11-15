import type { Fare, Itinerary } from "@/lib/types";

export type DepWindow = "night" | "morning" | "afternoon" | "evening";
export interface Filters {
  stops: number[]; // 0, 1, 2 (2 = two or more)
  airlines: string[];
  windows: DepWindow[];
  maxPrice: number | null;
  maxDuration: number | null; // minutes, longest single direction
  maxLayover: number | null; // minutes
  bags: boolean;
  refundable: boolean;
}
export const DEFAULT_FILTERS: Filters = { stops: [], airlines: [], windows: [], maxPrice: null, maxDuration: null, maxLayover: null, bags: false, refundable: false };

export type SortKey = "best" | "cheapest" | "fastest" | "earliest";
export interface Row {
  it: Itinerary;
  fare: Fare; // cheapest fare that satisfies the fare filters
}

export const WINDOWS: { id: DepWindow; label: string; hours: string }[] = [
  { id: "night", label: "Night", hours: "00–06" },
  { id: "morning", label: "Morning", hours: "06–12" },
  { id: "afternoon", label: "Afternoon", hours: "12–18" },
  { id: "evening", label: "Evening", hours: "18–24" },
];

export const windowOf = (local: string): DepWindow => {
  const h = +local.slice(11, 13);
  return h < 6 ? "night" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
};
export const maxLayoverOf = (it: Itinerary) => Math.max(0, ...it.slices.flatMap((s) => s.layovers.map((l) => l.durationMin)));
export const longestSlice = (it: Itinerary) => Math.max(...it.slices.map((s) => s.durationMin));

export function eligibleFare(it: Itinerary, f: Filters): Fare | null {
  return (
    it.fares.find(
      (fare) => (!f.bags || (fare.baggage.checked ?? 0) >= 1) && (!f.refundable || fare.conditions.refund.allowed === true),
    ) ?? null
  );
}

export function applyFilters(its: Itinerary[], f: Filters): Row[] {
  const rows: Row[] = [];
  for (const it of its) {
    const fare = eligibleFare(it, f);
    if (!fare) continue;
    if (f.stops.length && !f.stops.includes(Math.min(it.stops, 2))) continue;
    if (f.airlines.length && !f.airlines.includes(it.owner.code)) continue;
    if (f.windows.length && !f.windows.includes(windowOf(it.slices[0].departLocal))) continue;
    if (f.maxPrice !== null && fare.price.total > f.maxPrice) continue;
    if (f.maxDuration !== null && longestSlice(it) > f.maxDuration) continue;
    if (f.maxLayover !== null && maxLayoverOf(it) > f.maxLayover) continue;
    rows.push({ it, fare });
  }
  return rows;
}

export function sortRows(rows: Row[], key: SortKey): Row[] {
  if (!rows.length) return rows;
  const minP = Math.min(...rows.map((r) => r.fare.price.total));
  const minD = Math.min(...rows.map((r) => r.it.durationMin));
  const score = (r: Row) => (r.fare.price.total / minP) * 0.55 + (r.it.durationMin / minD) * 0.35 + Math.min(r.it.stops, 2) * 0.1;
  const cmp: Record<SortKey, (a: Row, b: Row) => number> = {
    best: (a, b) => score(a) - score(b),
    cheapest: (a, b) => a.fare.price.total - b.fare.price.total || a.it.durationMin - b.it.durationMin,
    fastest: (a, b) => a.it.durationMin - b.it.durationMin || a.fare.price.total - b.fare.price.total,
    earliest: (a, b) => a.it.slices[0].departLocal.localeCompare(b.it.slices[0].departLocal),
  };
  return [...rows].sort(cmp[key]);
}

export function facetsOf(its: Itinerary[]) {
  const prices = its.map((i) => i.fares[0].price.total);
  const airlines = new Map<string, { code: string; name: string; min: number }>();
  const stops: Record<number, number> = {};
  for (const it of its) {
    const p = it.fares[0].price.total;
    const a = airlines.get(it.owner.code);
    if (!a || p < a.min) airlines.set(it.owner.code, { code: it.owner.code, name: it.owner.name, min: p });
    const k = Math.min(it.stops, 2);
    if (stops[k] === undefined || p < stops[k]) stops[k] = p;
  }
  return {
    minPrice: Math.floor(Math.min(...prices)),
    maxPrice: Math.ceil(Math.max(...prices)),
    maxDuration: Math.max(...its.map(longestSlice)),
    minDuration: Math.min(...its.map(longestSlice)),
    maxLayover: Math.max(0, ...its.map(maxLayoverOf)),
    airlines: [...airlines.values()].sort((a, b) => a.min - b.min),
    stops,
  };
}

export function activeFilterCount(f: Filters): number {
  return (
    (f.stops.length ? 1 : 0) + (f.airlines.length ? 1 : 0) + (f.windows.length ? 1 : 0) + (f.maxPrice !== null ? 1 : 0) +
    (f.maxDuration !== null ? 1 : 0) + (f.maxLayover !== null ? 1 : 0) + (f.bags ? 1 : 0) + (f.refundable ? 1 : 0)
  );
}
