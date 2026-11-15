/* Provider payloads are handled as `any` at the HTTP boundary and narrowed immediately
   into our own types; @typescript-eslint/no-explicit-any is not enabled in this config,
   so the old blanket eslint-disable here was dead code. */
import type { Mode } from "../config";
import { buildPrice, round2 } from "../pricing";
import { isoDurationToMin, localToUtcMs } from "../time";
import type {
  AirportRef,
  Cabin,
  Carrier,
  Fare,
  FareExtras,
  ExtraOption,
  Itinerary,
  Layover,
  SearchQuery,
  Segment,
  Slice,
} from "../types";
import { log } from "../security";
import { ProviderError, type FlightProvider, type GetFareResult } from "./types";

/**
 * Duffel adapter, written against the public API reference (Duffel-Version: v2).
 * NOTE: not exercised against a live token in this build – validate in the sandbox before go-live.
 */
const BASE = "https://api.duffel.com";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T = any>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown; query?: Record<string, string>; retry?: boolean } = {},
  attempt = 0,
): Promise<T> {
  const token = process.env.DUFFEL_ACCESS_TOKEN;
  if (!token) throw new ProviderError("NOT_CONFIGURED", "Flight provider is not configured", false, 503);
  const qs = opts.query ? `?${new URLSearchParams(opts.query)}` : "";
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs}`, {
      method: opts.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Duffel-Version": "v2",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: opts.body ? JSON.stringify({ data: opts.body }) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
  } catch (e) {
    if (opts.retry && attempt < 2) {
      await sleep(400 * 2 ** attempt);
      return call<T>(path, opts, attempt + 1);
    }
    throw new ProviderError("PROVIDER_UNREACHABLE", "The flight provider did not respond", true, 504);
  }

  if ((res.status === 429 || res.status >= 500) && opts.retry && attempt < 2) {
    const reset = Number(res.headers.get("ratelimit-reset"));
    const wait = res.status === 429 && reset ? Math.min(Math.max(reset * 1000 - Date.now(), 500), 4000) : 400 * 2 ** attempt;
    log("warn", "duffel.retry", { path, status: res.status, attempt });
    await sleep(wait);
    return call<T>(path, opts, attempt + 1);
  }

  const json: any = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json?.errors?.[0];
    log("warn", "duffel.error", { path, status: res.status, code: err?.code, type: err?.type });
    if (res.status === 429) throw new ProviderError("RATE_LIMITED", "The provider is busy. Try again in a moment.", true, 429);
    if (err?.code === "offer_no_longer_available" || err?.code === "offer_expired")
      throw new ProviderError("FARE_EXPIRED", "This fare is no longer available", false, 410);
    if (err?.code === "high_fraud_risk") throw new ProviderError("REJECTED", "This booking could not be accepted", false, 422);
    if (res.status === 404) throw new ProviderError("NOT_FOUND", "Not found", false, 404);
    throw new ProviderError(res.status >= 500 ? "PROVIDER_ERROR" : "PROVIDER_REJECTED", err?.message ?? "Provider error", res.status >= 500, res.status >= 500 ? 502 : 422);
  }
  return json.data as T;
}

/* ---------- mapping ---------- */
const carrierOf = (c: any): Carrier => ({ code: c?.iata_code ?? "??", name: c?.name ?? "Airline", logoUrl: c?.logo_symbol_url });
const airportOf = (a: any): AirportRef => ({
  code: a.iata_code,
  name: a.name,
  city: a.city_name ?? a.city?.name ?? a.iata_code,
  cc: a.iata_country_code ?? "",
  tz: a.time_zone ?? "UTC",
});
const mins = (a: string, b: string, atz: string, btz: string) =>
  Math.round((localToUtcMs(b.slice(0, 16), btz) - localToUtcMs(a.slice(0, 16), atz)) / 60000);

function mapSlice(sl: any): Slice {
  const segments: Segment[] = sl.segments.map((s: any) => {
    const origin = airportOf(s.origin);
    const destination = airportOf(s.destination);
    const departLocal = String(s.departing_at).slice(0, 16);
    const arriveLocal = String(s.arriving_at).slice(0, 16);
    return {
      id: s.id,
      carrier: carrierOf(s.marketing_carrier),
      operatingCarrier: carrierOf(s.operating_carrier ?? s.marketing_carrier),
      flightNumber: String(s.marketing_carrier_flight_number ?? ""),
      aircraft: s.aircraft?.name,
      origin,
      destination,
      departLocal,
      arriveLocal,
      durationMin: isoDurationToMin(s.duration) || mins(departLocal, arriveLocal, origin.tz, destination.tz),
    } satisfies Segment;
  });
  const layovers: Layover[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i];
    const b = segments[i + 1];
    const d = mins(a.arriveLocal, b.departLocal, a.destination.tz, b.origin.tz);
    const flags: Layover["flags"] = [];
    if (d < 60) flags.push("short");
    if (d >= 300) flags.push("long");
    if (d >= 480) flags.push("overnight");
    if (a.destination.code !== b.origin.code) flags.push("airport_change");
    layovers.push({ airport: a.destination, durationMin: d, flags });
  }
  const first = segments[0];
  const last = segments[segments.length - 1];
  return {
    id: sl.id,
    origin: first.origin,
    destination: last.destination,
    departLocal: first.departLocal,
    arriveLocal: last.arriveLocal,
    durationMin: mins(first.departLocal, last.arriveLocal, first.origin.tz, last.destination.tz),
    segments,
    layovers,
  };
}

const signature = (offer: any) =>
  offer.slices
    .map((sl: any) => sl.segments.map((s: any) => `${s.marketing_carrier?.iata_code}${s.marketing_carrier_flight_number}@${s.departing_at}`).join(">"))
    .join("|");

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

function mapFare(offer: any, q: Pick<SearchQuery, "adults" | "children" | "infants">, cabin: Cabin): Fare {
  const seg0 = offer.slices[0].segments[0];
  const pax0 = seg0.passengers?.[0];
  const bags: any[] | undefined = pax0?.baggages;
  const qty = (t: string) => (bags && bags.length ? Number(bags.find((b) => b.type === t)?.quantity ?? 0) : null);
  const cond = offer.conditions ?? {};
  const rb = cond.refund_before_departure;
  const cb = cond.change_before_departure;
  const price = buildPrice(q, offer.total_currency, Number(offer.base_amount), Number(offer.tax_amount));
  return {
    offerId: offer.id,
    brand: offer.slices[0].fare_brand_name ?? pax0?.cabin_class_marketing_name ?? "Fare",
    cabin: (pax0?.cabin_class as Cabin) ?? cabin,
    baggage: { cabin: qty("carry_on"), checked: qty("checked"), checkedKg: null },
    conditions: {
      refund: { allowed: rb ? (rb.allowed ?? null) : null, fee: rb ? num(rb.penalty_amount) : null },
      change: { allowed: cb ? (cb.allowed ?? null) : null, fee: cb ? num(cb.penalty_amount) : null },
      seat: "unknown",
    },
    perks: [],
    price,
    expiresAt: offer.expires_at,
    providerTotal: offer.total_amount,
    providerCurrency: offer.total_currency,
    passengerIds: (offer.passengers ?? []).map((p: any) => ({ id: p.id, type: p.type === "adult" ? "adult" : p.type === "child" ? "child" : "infant" })),
  };
}

function mapOffers(offers: any[], q: SearchQuery): Itinerary[] {
  const groups = new Map<string, any[]>();
  for (const o of offers) {
    const key = signature(o);
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  const out: Itinerary[] = [];
  let i = 0;
  for (const group of groups.values()) {
    const slices = group[0].slices.map(mapSlice);
    const fares = group.map((o) => mapFare(o, q, q.cabin)).sort((a, b) => a.price.total - b.price.total);
    out.push({
      id: `it_${i++}_${group[0].owner?.iata_code ?? "XX"}`,
      owner: carrierOf(group[0].owner),
      slices,
      fares,
      stops: Math.max(...slices.map((s: Slice) => s.segments.length - 1)),
      durationMin: slices.reduce((a: number, s: Slice) => a + s.durationMin, 0),
    });
  }
  return out;
}

export function duffelProvider(mode: Mode): FlightProvider {
  return {
    mode,
    supportsCalendar: false,

    async search(q) {
      const data = await call<any>("/air/offer_requests", {
        method: "POST",
        query: { return_offers: "true", supplier_timeout: "15000" },
        retry: true,
        body: {
          slices: q.legs.map((l) => ({ origin: l.from, destination: l.to, departure_date: l.date })),
          passengers: [
            ...Array.from({ length: q.adults }, () => ({ type: "adult" })),
            ...Array.from({ length: q.children }, () => ({ type: "child" })),
            ...Array.from({ length: q.infants }, () => ({ type: "infant_without_seat" })),
          ],
          cabin_class: q.cabin,
          max_connections: 2,
        },
      });
      return mapOffers(data.offers ?? [], q);
    },

    async getFare(offerId, stored): Promise<GetFareResult> {
      const known = stored.find((it) => it.fares.some((f) => f.offerId === offerId));
      if (!known) return { status: "unavailable" };
      let offer: any;
      try {
        offer = await call<any>(`/air/offers/${encodeURIComponent(offerId)}`, { query: { return_available_services: "true" }, retry: true });
      } catch (e) {
        if (e instanceof ProviderError && (e.code === "FARE_EXPIRED" || e.code === "NOT_FOUND")) return { status: "expired" };
        throw e;
      }
      const pax = known.fares[0].passengerIds;
      const q = {
        adults: pax.filter((p) => p.type === "adult").length,
        children: pax.filter((p) => p.type === "child").length,
        infants: pax.filter((p) => p.type === "infant").length,
      };
      const slices = offer.slices.map(mapSlice);
      const fare = mapFare(offer, q, known.fares[0].cabin);
      const itinerary: Itinerary = { ...known, slices, fares: [fare] };

      const options: ExtraOption[] = [];
      for (const svc of offer.available_services ?? []) {
        if (svc.type !== "baggage") continue; // seats/meals need seat-map & services endpoints – not implemented
        const paxIdx = (offer.passengers ?? []).findIndex((p: any) => p.id === svc.passenger_ids?.[0]);
        const sliceIdx = offer.slices.findIndex((sl: any) => sl.segments.some((s: any) => svc.segment_ids?.includes(s.id)));
        const kind = svc.metadata?.type === "carry_on" ? "Cabin bag" : "Checked bag";
        const kg = svc.metadata?.maximum_weight_kg;
        options.push({
          id: svc.id,
          kind: "baggage",
          label: `${kind}${kg ? ` · ${kg} kg` : ""}${sliceIdx >= 0 ? ` · ${slices[sliceIdx].origin.code} → ${slices[sliceIdx].destination.code}` : ""}`,
          price: round2(Number(svc.total_amount)),
          passengerIndex: paxIdx >= 0 ? paxIdx : undefined,
          sliceIndex: sliceIdx >= 0 ? sliceIdx : undefined,
          providerServiceId: svc.id,
          max: Math.max(1, Number(svc.maximum_quantity ?? 1)),
        });
      }
      const extras: FareExtras = { currency: offer.total_currency, options };
      return { status: "ok", data: { itinerary, fare, extras } };
    },

    async createOrder(args) {
      const { fare, passengers, contact, extras } = args;
      const adults = passengers.map((p, i) => ({ p, i })).filter((x) => x.p.type === "adult");
      const infants = passengers.map((p, i) => ({ p, i })).filter((x) => x.p.type === "infant");
      const slots: Record<string, string[]> = {
        adult: fare.passengerIds.filter((x) => x.type === "adult").map((x) => x.id),
        child: fare.passengerIds.filter((x) => x.type === "child").map((x) => x.id),
        infant: fare.passengerIds.filter((x) => x.type === "infant").map((x) => x.id),
      };
      const idFor = new Map<number, string>();
      const used = { adult: 0, child: 0, infant: 0 };
      passengers.forEach((p, i) => idFor.set(i, slots[p.type][used[p.type]++]));
      const body = {
        type: "instant",
        selected_offers: [fare.offerId],
        passengers: passengers.map((p, i) => ({
          id: idFor.get(i),
          title: p.title,
          given_name: p.givenName,
          family_name: p.familyName,
          born_on: p.bornOn,
          gender: p.gender,
          email: contact.email,
          phone_number: contact.phone,
          ...(p.type === "adult" && infants[adults.findIndex((a) => a.i === i)]
            ? { infant_passenger_id: idFor.get(infants[adults.findIndex((a) => a.i === i)].i) }
            : {}),
          ...(p.passportNumber
            ? { identity_documents: [{ type: "passport", unique_identifier: p.passportNumber, expires_on: p.passportExpiry, issuing_country_code: p.passportCountry }] }
            : {}),
        })),
        services: extras.filter((e) => e.option.providerServiceId).map((e) => ({ id: e.option.providerServiceId, quantity: e.qty })),
        payments: [{ type: "balance", currency: fare.providerCurrency, amount: args.providerAmount }],
        metadata: { cleared_reference: args.reference, idempotency_key: args.idempotencyKey },
      };
      // No automatic retry: a replayed POST could double-book. Idempotency is enforced by our DB key.
      const order = await call<any>("/air/orders", { method: "POST", body });
      const tickets: string[] = (order.documents ?? []).filter((d: any) => d.type === "electronic_ticket").map((d: any) => String(d.unique_identifier));
      return {
        providerOrderId: order.id,
        pnr: order.booking_reference ?? null,
        ticketNumbers: tickets,
        status: tickets.length ? "ticketed" : "confirmed",
        paymentStatus: "paid",
      };
    },

    async quoteCancellation({ providerOrderId, fare }) {
      if (!providerOrderId) throw new ProviderError("NOT_FOUND", "No provider order", false, 404);
      const q = await call<any>("/air/order_cancellations", { method: "POST", body: { order_id: providerOrderId } });
      const amount = Number(q.refund_amount ?? 0);
      return {
        allowed: true,
        refundAmount: round2(amount),
        currency: q.refund_currency ?? fare.providerCurrency,
        providerQuoteId: q.id,
        note: amount > 0 ? "Refund is quoted by the airline. Our service fee is non-refundable." : "The airline quotes no refund for this booking.",
      };
    },

    async confirmCancellation({ quote }) {
      if (!quote.providerQuoteId) throw new ProviderError("NOT_FOUND", "No cancellation quote", false, 404);
      const c = await call<any>(`/air/order_cancellations/${quote.providerQuoteId}/actions/confirm`, { method: "POST" });
      return { refundAmount: round2(Number(c.refund_amount ?? quote.refundAmount)) };
    },

    async lowestFares() {
      return {};
    },
  };
}
