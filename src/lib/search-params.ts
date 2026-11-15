import { z } from "zod";
import { isKnownCode, sameCity } from "./airports";
import { addDays, todayISO } from "./format";
import type { SearchQuery } from "./types";

const code = z.string().regex(/^[A-Z]{3}$/, "Choose an airport");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

export const queryInputSchema = z
  .object({
    trip: z.enum(["round", "oneway", "multi"]),
    legs: z.array(z.object({ from: code, to: code, date })).min(1).max(5),
    adults: z.number().int().min(1).max(9),
    children: z.number().int().min(0).max(8),
    infants: z.number().int().min(0).max(4),
    cabin: z.enum(["economy", "premium_economy", "business", "first"]),
  })
  .superRefine((q, ctx) => {
    const today = addDays(todayISO(), -1);
    const max = addDays(todayISO(), 330);
    q.legs.forEach((l, i) => {
      if (!isKnownCode(l.from)) ctx.addIssue({ code: "custom", message: "Unknown airport", path: ["legs", i, "from"] });
      if (!isKnownCode(l.to)) ctx.addIssue({ code: "custom", message: "Unknown airport", path: ["legs", i, "to"] });
      if (l.from === l.to || sameCity(l.from, l.to))
        ctx.addIssue({ code: "custom", message: "Origin and destination must differ", path: ["legs", i, "to"] });
      if (l.date < today) ctx.addIssue({ code: "custom", message: "Date is in the past", path: ["legs", i, "date"] });
      if (l.date > max) ctx.addIssue({ code: "custom", message: "Airlines sell about 11 months ahead", path: ["legs", i, "date"] });
      if (i > 0 && l.date < q.legs[i - 1].date)
        ctx.addIssue({ code: "custom", message: "Must be on or after the previous flight", path: ["legs", i, "date"] });
    });
    if (q.trip === "oneway" && q.legs.length !== 1) ctx.addIssue({ code: "custom", message: "One-way has one leg", path: ["legs"] });
    if (q.trip === "round" && q.legs.length !== 2) ctx.addIssue({ code: "custom", message: "Round trip needs a return date", path: ["legs"] });
    if (q.trip === "multi" && q.legs.length < 2) ctx.addIssue({ code: "custom", message: "Add at least two flights", path: ["legs"] });
    if (q.adults + q.children > 9) ctx.addIssue({ code: "custom", message: "Up to 9 travellers per booking", path: ["adults"] });
    if (q.infants > q.adults) ctx.addIssue({ code: "custom", message: "Each infant needs an adult", path: ["infants"] });
  });

export function queryToSearchString(q: SearchQuery): string {
  const p = new URLSearchParams();
  p.set("trip", q.trip);
  if (q.trip === "multi") {
    p.set("legs", q.legs.map((l) => `${l.from}.${l.to}.${l.date}`).join("~"));
  } else {
    p.set("from", q.legs[0].from);
    p.set("to", q.legs[0].to);
    p.set("depart", q.legs[0].date);
    if (q.trip === "round" && q.legs[1]) p.set("return", q.legs[1].date);
  }
  p.set("adults", String(q.adults));
  p.set("children", String(q.children));
  p.set("infants", String(q.infants));
  p.set("cabin", q.cabin);
  return p.toString();
}

type Source = URLSearchParams | { get(name: string): string | null };

/** Parse a query from URL params. Returns null if structurally unusable (validation happens later). */
export function parseQuery(sp: Source): SearchQuery | null {
  const trip = (sp.get("trip") ?? "round") as SearchQuery["trip"];
  if (!["round", "oneway", "multi"].includes(trip)) return null;
  const num = (k: string, d: number) => {
    const n = Number(sp.get(k));
    return Number.isFinite(n) && sp.get(k) !== null ? Math.trunc(n) : d;
  };
  const cabin = (sp.get("cabin") ?? "economy") as SearchQuery["cabin"];
  const base = {
    trip,
    adults: num("adults", 1),
    children: num("children", 0),
    infants: num("infants", 0),
    cabin: ["economy", "premium_economy", "business", "first"].includes(cabin) ? cabin : "economy",
  } as const;
  if (trip === "multi") {
    const raw = sp.get("legs");
    if (!raw) return null;
    const legs = raw.split("~").map((s) => {
      const [from, to, date] = s.split(".");
      return { from, to, date };
    });
    if (legs.some((l) => !l.from || !l.to || !l.date)) return null;
    return { ...base, legs };
  }
  const from = sp.get("from");
  const to = sp.get("to");
  const depart = sp.get("depart");
  if (!from || !to || !depart) return null;
  const legs = [{ from, to, date: depart }];
  if (trip === "round") {
    const ret = sp.get("return");
    if (!ret) return null;
    legs.push({ from: to, to: from, date: ret });
  }
  return { ...base, legs };
}

export function travellerCount(q: Pick<SearchQuery, "adults" | "children" | "infants">) {
  return q.adults + q.children + q.infants;
}
