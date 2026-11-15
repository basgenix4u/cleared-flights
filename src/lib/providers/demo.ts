import { HUBS, distanceKm, expandCode, getAirport, sameCity, toRef, type Airport } from "../airports";
import { SEARCH_TTL_MS } from "../config";
import { addDays, dayDelta, todayISO } from "../format";
import { buildPrice, round2 } from "../pricing";
import { localToUtcMs, utcMsToLocal } from "../time";
import type {
  Cabin,
  Carrier,
  Conditions,
  ExtraOption,
  Fare,
  FareExtras,
  Itinerary,
  Layover,
  Leg,
  SearchQuery,
  Segment,
  Slice,
} from "../types";
import type { FlightProvider, GetFareResult } from "./types";

/* ---------- deterministic randomness ---------- */
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
type Rng = () => number;
function rng(seed: string): Rng {
  let a = xmur3(seed)();
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- fictional carriers: demo data must never imply real airline inventory ---------- */
interface DemoCarrier extends Carrier {
  tier: "full" | "value";
  factor: number;
}
const CARRIERS: DemoCarrier[] = [
  { code: "KS", name: "Kestrel Air", color: "#1f3a5f", tier: "full", factor: 1.08 },
  { code: "MW", name: "Meridian Airways", color: "#7a1f2b", tier: "full", factor: 1.12 },
  { code: "SL", name: "Solenne", color: "#b8501a", tier: "full", factor: 1.0 },
  { code: "AP", name: "Aster Pacific", color: "#0f5c4d", tier: "full", factor: 1.05 },
  { code: "CV", name: "Corvid", color: "#2b2b2b", tier: "value", factor: 0.8 },
  { code: "HD", name: "Halden Air", color: "#4b3f8f", tier: "value", factor: 0.9 },
];

interface BrandDef {
  name: string;
  mult: number;
  checked: number;
  kg: number;
  refund: "no" | "fee" | "free";
  refundFee: number;
  change: "no" | "fee" | "free";
  changeFee: number;
  seat: Conditions["seat"];
  perks: string[];
}

function brandsFor(cabin: Cabin, tier: "full" | "value"): BrandDef[] {
  if (cabin === "economy") {
    const flex: BrandDef = { name: "Flex", mult: 1.45, checked: 1, kg: 23, refund: "fee", refundFee: 60, change: "free", changeFee: 0, seat: "free", perks: ["Seat selection included", "Priority boarding"] };
    return tier === "value"
      ? [
          { name: "Light", mult: 1, checked: 0, kg: 0, refund: "no", refundFee: 0, change: "no", changeFee: 0, seat: "paid", perks: [] },
          { name: "Standard", mult: 1.17, checked: 1, kg: 23, refund: "no", refundFee: 0, change: "fee", changeFee: 70, seat: "paid", perks: ["Checked bag included"] },
          flex,
        ]
      : [
          { name: "Standard", mult: 1, checked: 1, kg: 23, refund: "no", refundFee: 0, change: "fee", changeFee: 80, seat: "paid", perks: ["Meal included on long-haul"] },
          flex,
        ];
  }
  if (cabin === "premium_economy")
    return [
      { name: "Premium", mult: 1, checked: 2, kg: 23, refund: "no", refundFee: 0, change: "fee", changeFee: 100, seat: "free", perks: ["Wider seat", "Priority check-in"] },
      { name: "Premium Flex", mult: 1.28, checked: 2, kg: 23, refund: "fee", refundFee: 100, change: "free", changeFee: 0, seat: "free", perks: ["Wider seat", "Priority check-in"] },
    ];
  if (cabin === "business")
    return [
      { name: "Business", mult: 1, checked: 2, kg: 32, refund: "fee", refundFee: 250, change: "fee", changeFee: 150, seat: "free", perks: ["Lie-flat or extended seat", "Lounge access where available"] },
      { name: "Business Flex", mult: 1.22, checked: 2, kg: 32, refund: "free", refundFee: 0, change: "free", changeFee: 0, seat: "free", perks: ["Lie-flat or extended seat", "Lounge access where available"] },
    ];
  return [{ name: "First", mult: 1, checked: 3, kg: 32, refund: "fee", refundFee: 150, change: "free", changeFee: 0, seat: "free", perks: ["Suite or private seat", "Lounge access where available"] }];
}

const CABIN_MULT: Record<Cabin, number> = { economy: 1, premium_economy: 1.7, business: 3.4, first: 5.2 };

function aircraftFor(km: number, r: Rng) {
  const s =
    km < 1600
      ? ["Airbus A320neo", "Boeing 737-800", "Embraer E195-E2"]
      : km < 5500
        ? ["Airbus A321neo", "Boeing 737 MAX 8", "Airbus A330-300"]
        : ["Airbus A350-900", "Boeing 787-9", "Boeing 777-300ER", "Airbus A330-900"];
  return s[Math.floor(r() * s.length)];
}
const blockMinutes = (km: number, r: Rng) =>
  Math.round(32 + (km / (km > 2500 ? 845 : km > 800 ? 780 : 700)) * 60 + (r() * 10 - 5));

function dateFactor(date: string) {
  const days = dayDelta(todayISO(), date);
  const advance = days < 7 ? 1.35 : days < 21 ? 1.15 : days < 60 ? 1 : 0.95;
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const weekday = dow === 5 || dow === 0 ? 1.08 : dow === 2 || dow === 3 ? 0.94 : 1;
  return advance * weekday;
}

interface GenSlice {
  slice: Slice;
  km: number;
  base: number; // per adult
  tax: number;
  dest: Airport;
  orig: Airport;
}

function genSlice(leg: Leg, c: DemoCarrier, r: Rng, id: string, prefFrom?: Airport, prefTo?: Airport): GenSlice | null {
  const os = expandCode(leg.from);
  const ds = expandCode(leg.to);
  if (!os.length || !ds.length) return null;
  const pick = (list: Airport[], pref?: Airport) =>
    pref && list.some((a) => a.code === pref.code) ? pref : list[r() < 0.6 ? 0 : Math.floor(r() * list.length)];
  const o = pick(os, prefFrom);
  const d = pick(ds, prefTo);
  const km = distanceKm(o, d);
  if (km < 80) return null;

  let hub: Airport | null = null;
  const wantStop = km > 14000 ? true : km > 9800 ? r() < 0.75 : km < 700 ? false : r() < 0.36;
  if (wantStop) {
    const cands = HUBS.map((h) => getAirport(h) as Airport)
      .filter((h) => !sameCity(h.code, o.code) && !sameCity(h.code, d.code))
      .map((h) => ({ h, d1: distanceKm(o, h), d2: distanceKm(h, d) }))
      .filter((x) => x.d1 + x.d2 < km * 1.45 + 900 && x.d1 < 13500 && x.d2 < 13500 && x.d1 > 300 && x.d2 > 300)
      .sort((a, b) => a.d1 + a.d2 - (b.d1 + b.d2))
      .slice(0, 3);
    if (cands.length) hub = cands[Math.floor(r() * cands.length)].h;
  }

  const hops: [Airport, Airport][] = hub ? [[o, hub], [hub, d]] : [[o, d]];
  const depMin = 300 + Math.floor(r() * 204) * 5;
  const hh = String(Math.floor(depMin / 60)).padStart(2, "0");
  const mm = String(depMin % 60).padStart(2, "0");
  let cursor = localToUtcMs(`${leg.date}T${hh}:${mm}`, o.tz);
  const startUtc = cursor;
  const segments: Segment[] = [];
  const layovers: Layover[] = [];
  let endUtc = cursor;
  hops.forEach(([a, b], i) => {
    const dur = blockMinutes(distanceKm(a, b), r);
    const arrUtc = cursor + dur * 60000;
    const carrier: Carrier = { code: c.code, name: c.name, color: c.color };
    segments.push({
      id: `${id}-s${i}`,
      carrier,
      operatingCarrier: carrier,
      flightNumber: String(100 + Math.floor(r() * 8800)),
      aircraft: aircraftFor(distanceKm(a, b), r),
      origin: toRef(a),
      destination: toRef(b),
      departLocal: utcMsToLocal(cursor, a.tz),
      arriveLocal: utcMsToLocal(arrUtc, b.tz),
      durationMin: dur,
    });
    endUtc = arrUtc;
    if (i < hops.length - 1) {
      let lay = 55 + Math.floor(r() * 150);
      if (r() < 0.07) lay = 500 + Math.floor(r() * 200);
      layovers.push({
        airport: toRef(b),
        durationMin: lay,
        flags: lay < 60 ? ["short"] : lay >= 480 ? ["overnight", "long"] : lay >= 300 ? ["long"] : [],
      });
      cursor = arrUtc + lay * 60000;
    }
  });

  const stops = hops.length - 1;
  const base =
    (40 + km * 0.055 + (km > 6000 ? 55 : 0)) * c.factor * dateFactor(leg.date) * (stops ? 0.9 : 1) * (0.9 + r() * 0.25);
  const tax = base * 0.12 + 14 * hops.length + (o.cc !== d.cc ? 22 : 8);
  return {
    slice: {
      id,
      origin: toRef(o),
      destination: toRef(d),
      departLocal: segments[0].departLocal,
      arriveLocal: segments[segments.length - 1].arriveLocal,
      durationMin: Math.round((endUtc - startUtc) / 60000),
      segments,
      layovers,
    },
    km,
    base,
    tax,
    dest: d,
    orig: o,
  };
}

function conditionsOf(b: BrandDef): Conditions {
  return {
    refund: { allowed: b.refund !== "no", fee: b.refund === "no" ? null : b.refund === "free" ? 0 : b.refundFee },
    change: { allowed: b.change !== "no", fee: b.change === "no" ? null : b.change === "free" ? 0 : b.changeFee },
    seat: b.seat,
  };
}

export async function demoSearch(q: SearchQuery): Promise<Itinerary[]> {
  const key = `${q.trip}|${q.cabin}|${q.legs.map((l) => `${l.from}${l.to}${l.date}`).join("|")}`;
  const r0 = rng(key);
  const n = 11 + Math.floor(r0() * 5);
  const carriers = [...CARRIERS].sort(() => r0() - 0.5);
  const expiresAt = new Date(Date.now() + SEARCH_TTL_MS).toISOString();
  const out: Itinerary[] = [];

  const ids = [
    ...Array.from({ length: q.adults }, (_, i) => ({ id: `pas_demo_a${i}`, type: "adult" as const })),
    ...Array.from({ length: q.children }, (_, i) => ({ id: `pas_demo_c${i}`, type: "child" as const })),
    ...Array.from({ length: q.infants }, (_, i) => ({ id: `pas_demo_i${i}`, type: "infant" as const })),
  ];

  for (let k = 0; k < n; k++) {
    const c = carriers[k % carriers.length];
    const gens: GenSlice[] = [];
    let ok = true;
    for (let li = 0; li < q.legs.length; li++) {
      const prev = gens[li - 1];
      const prefFrom = prev?.dest;
      const prefTo = q.trip === "round" && li === 1 ? gens[0].orig : undefined;
      const g = genSlice(q.legs[li], c, rng(`${key}#${k}#${li}`), `sl_${k}_${li}`, prefFrom, prefTo);
      if (!g) {
        ok = false;
        break;
      }
      gens.push(g);
    }
    if (!ok) continue;
    if (q.cabin === "first" && gens.some((g) => g.km < 2500)) continue; // no first cabin on short sectors
    const stops = Math.max(...gens.map((g) => g.slice.segments.length - 1));
    const cabinMult = CABIN_MULT[q.cabin];
    const baseAdult = gens.reduce((a, g) => a + g.base, 0) * cabinMult;
    const taxAdult = gens.reduce((a, g) => a + g.tax, 0) * (1 + (cabinMult - 1) * 0.12);
    const rf = rng(`${key}#fare#${k}`);
    const fares: Fare[] = brandsFor(q.cabin, c.tier).map((b, bi) => {
      const fareAdult = baseAdult * b.mult;
      const fare = fareAdult * q.adults + fareAdult * 0.75 * q.children + fareAdult * 0.1 * q.infants;
      const taxes = taxAdult * q.adults + taxAdult * 0.85 * q.children + taxAdult * 0.25 * q.infants;
      const price = buildPrice(q, "USD", fare, taxes);
      return {
        offerId: `off_demo_${k}_${bi}_${Math.floor(rf() * 1e9).toString(36)}`,
        brand: b.name,
        cabin: q.cabin,
        baggage: { cabin: 1, checked: b.checked, checkedKg: b.kg || null },
        conditions: conditionsOf(b),
        perks: b.perks,
        price,
        expiresAt,
        providerTotal: round2(price.fare + price.taxes).toFixed(2),
        providerCurrency: "USD",
        passengerIds: ids,
      };
    });
    out.push({
      id: `it_${k}_${c.code}`,
      owner: { code: c.code, name: c.name, color: c.color },
      slices: gens.map((g) => g.slice),
      fares,
      stops,
      durationMin: gens.reduce((a, g) => a + g.slice.durationMin, 0),
    });
  }
  return out;
}

export function demoExtras(it: Itinerary, fare: Fare): FareExtras {
  const options: ExtraOption[] = [];
  const premium = fare.cabin === "economy" || fare.cabin === "premium_economy";
  it.slices.forEach((s, i) => {
    const a = getAirport(s.origin.code);
    const b = getAirport(s.destination.code);
    const km = a && b ? distanceKm(a, b) : 3000;
    const tag = `${s.origin.code} → ${s.destination.code}`;
    const bag = round2(18 + Math.min(km, 9000) * 0.006);
    if (fare.baggage.checked === 0)
      options.push({ id: `bag:${i}`, kind: "baggage", label: `Checked bag · ${tag}`, description: "1 bag up to 23 kg", price: bag, sliceIndex: i, max: 2 });
    else if (fare.cabin === "economy" || fare.cabin === "premium_economy")
      options.push({ id: `xbag:${i}`, kind: "baggage", label: `Extra checked bag · ${tag}`, description: "1 more bag up to 23 kg", price: round2(bag * 1.35), sliceIndex: i, max: 2 });
    if (premium) {
      if (fare.conditions.seat !== "free")
        options.push({ id: `seat:std:${i}`, kind: "seat", label: `Choose your seat · ${tag}`, description: "Any standard seat, selected after booking confirmation", price: round2(8 + km * 0.0022), sliceIndex: i, max: 1 });
      options.push({ id: `seat:ext:${i}`, kind: "seat", label: `Extra legroom · ${tag}`, description: "Exit-row or bulkhead where available", price: round2(24 + km * 0.007), sliceIndex: i, max: 1 });
    }
    if (fare.cabin === "economy")
      options.push({ id: `meal:${i}`, kind: "meal", label: `Hot meal · ${tag}`, description: "Pre-order; dietary options on request", price: 14, sliceIndex: i, max: 1 });
  });
  options.push({ id: "assist", kind: "assist", label: "Special assistance request", description: "Wheelchair, mobility or sensory support. Free of charge; confirmed with the airline.", price: 0, max: 1 });
  return { currency: fare.price.currency, options };
}

function findFare(offerId: string, stored: Itinerary[]) {
  for (const itinerary of stored) {
    const fare = itinerary.fares.find((f) => f.offerId === offerId);
    if (fare) return { itinerary, fare };
  }
  return null;
}

export const demoProvider: FlightProvider = {
  mode: "demo",
  supportsCalendar: true,
  search: demoSearch,

  async getFare(offerId, stored): Promise<GetFareResult> {
    const hit = findFare(offerId, stored);
    if (!hit) return { status: "unavailable" };
    if (new Date(hit.fare.expiresAt).getTime() < Date.now()) return { status: "expired" };
    let fare = hit.fare;
    // Opt-in scenario so price-change handling can be exercised end-to-end in demos.
    if (process.env.DEMO_SIMULATE_PRICE_CHANGE === "1" && !fare.repriced) {
      const bump = round2(fare.price.fare * 0.04);
      const total = round2(fare.price.total + bump);
      fare = {
        ...fare,
        repriced: true,
        price: { ...fare.price, fare: round2(fare.price.fare + bump), total, perTraveller: round2(total / fare.passengerIds.length) },
        providerTotal: round2(Number(fare.providerTotal) + bump).toFixed(2),
      };
    }
    return { status: "ok", data: { itinerary: hit.itinerary, fare, extras: demoExtras(hit.itinerary, fare) } };
  },

  async createOrder(args) {
    await new Promise((r) => setTimeout(r, 450));
    return {
      providerOrderId: `demo_${args.reference}`,
      pnr: null,
      ticketNumbers: [],
      status: "simulated",
      paymentStatus: "simulated",
    };
  },

  async quoteCancellation({ fare, paidAirline }) {
    const c = fare.conditions.refund;
    if (!c.allowed)
      return { allowed: false, refundAmount: 0, currency: fare.price.currency, note: "This fare is non-refundable. Cancelling releases the booking but returns no fare." };
    const refund = round2(Math.max(0, paidAirline - (c.fee ?? 0)));
    return { allowed: true, refundAmount: refund, currency: fare.price.currency, note: c.fee ? `Airline cancellation fee of ${c.fee.toFixed(2)} deducted. Our service fee is non-refundable.` : "Fully refundable airline fare. Our service fee is non-refundable." };
  },

  async confirmCancellation({ quote }) {
    return { refundAmount: quote.refundAmount };
  },

  async lowestFares(q, dates) {
    const out: Record<string, number | null> = {};
    const base = q.legs[0].date;
    for (const date of dates) {
      if (date < addDays(todayISO(), 0)) {
        out[date] = null;
        continue;
      }
      const delta = dayDelta(base, date);
      const shifted: SearchQuery = { ...q, legs: q.legs.map((l) => ({ ...l, date: addDays(l.date, delta) })) };
      const its = await demoSearch(shifted);
      out[date] = its.length ? Math.min(...its.map((i) => i.fares[0].price.total)) : null;
    }
    return out;
  },
};
