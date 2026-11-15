import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { money, sendEmail } from "@/lib/email-service";
import { bookingRequests, bookings, paymentIntents, refundRequests, searchSessions } from "@/db/schema";
import { ApiError } from "./api";
import { SEARCH_TTL_MS, paymentsAvailable, providerMode } from "./config";
import { paymentsConfigured } from "./payments";
import { paymentToken } from "./security";
import { getProvider } from "./providers";
import { priceExtras, round2 } from "./pricing";
import { getAirport } from "./airports";
import { decryptJson, encryptJson, log, newReference } from "./security";
import { passengerContextIssues, travelContextOf, type BookingInput } from "./schemas";
import type { AirportRef, BookingEvent, ExtraSelection, Fare, Itinerary, PassengerInput, SearchQuery } from "./types";

/* ---------------- search sessions ---------------- */
export async function createSession(query: SearchQuery, mode: string, itineraries: Itinerary[]) {
  const expiresAt = new Date(Date.now() + SEARCH_TTL_MS);
  const [row] = await db.insert(searchSessions).values({ query, mode, itineraries, expiresAt }).returning({ id: searchSessions.id });
  // opportunistic cleanup of long-expired sessions
  void db.delete(searchSessions).where(lt(searchSessions.expiresAt, new Date(Date.now() - 3600_000))).catch(() => {});
  return { id: row.id, expiresAt: expiresAt.toISOString() };
}

async function loadSession(id: string) {
  const [s] = await db.select().from(searchSessions).where(eq(searchSessions.id, id)).limit(1);
  if (!s || s.expiresAt.getTime() < Date.now())
    throw new ApiError(410, "SESSION_EXPIRED", "Your search has expired. Fares change often, so please search again.");
  return s;
}

function findFare(its: Itinerary[], offerId: string) {
  for (const it of its) {
    const fare = it.fares.find((f) => f.offerId === offerId);
    if (fare) return { it, fare };
  }
  return null;
}

/** Re-check a fare with the provider. Persists the latest price so later steps compare against truth. */
export async function revalidateOffer(sessionId: string, offerId: string) {
  const session = await loadSession(sessionId);
  const stored = findFare(session.itineraries, offerId);
  if (!stored) throw new ApiError(404, "OFFER_NOT_FOUND", "We can't find that fare in this search.");
  const res = await getProvider().getFare(offerId, session.itineraries);
  if (res.status !== "ok")
    throw new ApiError(410, "FARE_EXPIRED", "This fare is no longer available. Search again to see current prices.");
  const previousTotal = stored.fare.price.total;
  const changed = Math.abs(previousTotal - res.data.fare.price.total) > 0.004;
  if (changed) {
    const updated = session.itineraries.map((it) =>
      it.id === stored.it.id ? { ...it, fares: it.fares.map((f) => (f.offerId === offerId ? res.data.fare : f)) } : it,
    );
    await db.update(searchSessions).set({ itineraries: updated }).where(eq(searchSessions.id, sessionId));
  }
  return {
    ...res.data,
    previousTotal,
    changed,
    mode: session.mode,
    query: session.query,
    checkedAt: new Date().toISOString(),
    paymentsAvailable: paymentsConfigured() || paymentsAvailable(providerMode()),
  };
}

/* ---------------- bookings ---------------- */
type BookingRow = typeof bookings.$inferSelect;
interface SecureData {
  passengers: PassengerInput[];
  phone: string;
}

const event = (label: string, detail?: string): BookingEvent => ({ at: new Date().toISOString(), label, detail });

export async function createBooking(input: BookingInput, secureCookie: boolean) {
  void secureCookie;
  const mode = providerMode();
  /**
   * Payment-first when a provider is configured: the booking is created but nothing is
   * reserved with the airline until a signed webhook confirms the money arrived.
   * Without a payment provider, demo/sandbox keeps the immediate simulated order so the
   * rest of the product stays exercisable.
   */
  const payFirst = paymentsConfigured();
  if (!payFirst && !paymentsAvailable(mode))
    throw new ApiError(503, "PAYMENT_NOT_CONFIGURED", "Card payments are not enabled on this deployment, so we can't take bookings yet.");

  const session = await loadSession(input.sessionId);
  const provider = getProvider();
  const lookup = await provider.getFare(input.offerId, session.itineraries);
  if (lookup.status !== "ok") throw new ApiError(410, "FARE_EXPIRED", "This fare is no longer available. Search again to see current prices.");
  const { fare, itinerary, extras } = lookup.data;

  // Passenger mix must match what was priced.
  const need = (t: string) => fare.passengerIds.filter((p) => p.type === t).length;
  const have = (t: string) => input.passengers.filter((p) => p.type === t).length;
  if (["adult", "child", "infant"].some((t) => need(t) !== have(t)))
    throw new ApiError(422, "PASSENGER_MISMATCH", "Passengers don't match the search. Please start again.");

  const ctx = travelContextOf(itinerary);
  const problems: { path: string; message: string }[] = [];
  input.passengers.forEach((p, i) => {
    for (const [k, v] of Object.entries(passengerContextIssues(p, ctx))) problems.push({ path: `passengers.${i}.${k}`, message: v });
  });
  if (problems.length) throw new ApiError(422, "PASSENGER_INVALID", "Some passenger details need attention", { fields: problems });

  let extrasTotal = 0;
  try {
    extrasTotal = priceExtras(extras.options, input.extras).total;
  } catch (e) {
    throw new ApiError(422, "INVALID_EXTRAS", e instanceof Error ? e.message : "Invalid extras");
  }

  const grand = round2(fare.price.total + extrasTotal);
  if (Math.abs(grand - input.acceptedTotal) > 0.005)
    throw new ApiError(409, "PRICE_CHANGED", "The price changed since you last reviewed it.", {
      newTotal: grand,
      fareTotal: fare.price.total,
      previousTotal: input.acceptedTotal,
    });

  // Reserve the idempotency key BEFORE touching the provider so concurrent replays cannot double-book.
  const reference = newReference();
  const snapshot: Itinerary = { ...itinerary, fares: [fare] };
  const events: BookingEvent[] = [event("Booking requested"), event("Fare re-checked", `Total ${grand.toFixed(2)} ${fare.price.currency}`)];
  const inserted = await db
    .insert(bookings)
    .values({
      reference,
      idempotencyKey: input.idempotencyKey,
      mode,
      status: "requested",
      paymentStatus: payFirst ? "unpaid" : "none",
      currency: fare.price.currency,
      totalAmount: grand.toFixed(2),
      priceBreakdown: { ...fare.price, extras: extrasTotal, grandTotal: grand },
      itinerary: snapshot,
      offerId: fare.offerId,
      extras: input.extras,
      extrasSnapshot: extras.options,
      contactEmail: input.contact.email.toLowerCase(),
      secureData: encryptJson({ passengers: input.passengers, phone: input.contact.phone } satisfies SecureData),
      passengerCount: input.passengers.length,
      events,
    })
    .onConflictDoNothing({ target: bookings.idempotencyKey })
    .returning();

  if (!inserted.length) {
    const [existing] = await db.select().from(bookings).where(eq(bookings.idempotencyKey, input.idempotencyKey)).limit(1);
    // With payment-first, `requested` means "awaiting payment" — a legitimate resting
    // state. Only a legacy in-flight order is a genuine conflict.
    if (existing.status === "requested" && !payFirst)
      throw new ApiError(409, "IN_PROGRESS", "Your booking is still being processed. Please wait a moment.");
    if (payFirst && existing.paymentStatus !== "paid" && existing.status === "requested")
      return {
        reference: existing.reference,
        replay: true,
        paymentRequired: true,
        paymentToken: paymentToken(existing.reference),
        amount: Number(existing.totalAmount),
        currency: existing.currency,
      };
    if (existing.status === "failed") throw new ApiError(409, "PREVIOUS_ATTEMPT_FAILED", "The previous attempt didn't go through. Please try again.", { newKey: true });
    return { reference: existing.reference, replay: true };
  }
  const row = inserted[0];

  // Hand the client a signed token, not just the reference: opening or reading a payment
  // requires proof that this session created the booking.
  if (payFirst) {
    log("info", "booking.pending_payment", { reference, total: grand, currency: fare.price.currency });
    const token = paymentToken(reference);
    await sendEmail({
      kind: "booking.received",
      to: input.contact.email,
      bookingId: row.id,
      reference,
      dedupeKey: `booking.received:${reference}`,
      payload: {
        reference,
        firstName: input.passengers[0]?.givenName,
        route: routeLabel(snapshot),
        departDate: itinerary.slices[0]?.segments[0]?.departLocal ?? undefined,
        amount: money(grand, fare.price.currency),
        paymentUrl: `${siteUrl()}/checkout/pay?ref=${reference}&token=${token}`,
      },
    });
    return {
      reference,
      replay: false,
      paymentRequired: true,
      paymentToken: paymentToken(reference),
      amount: grand,
      currency: fare.price.currency,
    };
  }

  try {
    const selected = priceExtras(extras.options, input.extras).lines.map((l) => ({ option: l.option, passenger: l.passenger, qty: l.qty }));
    const providerExtras = selected.filter((s) => s.option.providerServiceId).reduce((a, s) => a + s.option.price * s.qty, 0);
    const order = await provider.createOrder({
      fare,
      itinerary: snapshot,
      passengers: input.passengers,
      contact: input.contact,
      extras: selected,
      providerAmount: (Number(fare.providerTotal) + providerExtras).toFixed(2),
      reference,
      idempotencyKey: input.idempotencyKey,
    });
    const nextEvents = [
      ...events,
      event(order.paymentStatus === "simulated" ? "Payment simulated" : "Payment accepted", order.paymentStatus === "simulated" ? "No money moved" : undefined),
      ...(order.status === "simulated"
        ? [event("Simulated booking", "No airline reservation exists")]
        : [event("Airline reservation created", order.pnr ?? undefined)]),
      ...(order.status === "ticketed" ? [event("Ticket issued", order.ticketNumbers.join(", "))] : []),
    ];
    await db
      .update(bookings)
      .set({
        status: order.status,
        paymentStatus: order.paymentStatus,
        providerOrderId: order.providerOrderId,
        pnr: order.pnr,
        ticketNumbers: order.ticketNumbers,
        events: nextEvents,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, row.id));
    log("info", "booking.created", { reference, mode, status: order.status, total: grand });
    await sendEmail({
      kind: order.status === "ticketed" ? "booking.ticketed" : "booking.received",
      to: input.contact.email,
      bookingId: row.id,
      reference,
      dedupeKey: `booking.received:${reference}`,
      payload: {
        reference,
        firstName: input.passengers[0]?.givenName,
        route: routeLabel(snapshot),
        departDate: itinerary.slices[0]?.segments[0]?.departLocal ?? undefined,
        amount: money(grand, fare.price.currency),
        pnr: order.pnr ?? undefined,
        tickets: order.ticketNumbers,
      },
    });
    return { reference, replay: false, paymentRequired: false as const };
  } catch (e) {
    await db
      .update(bookings)
      .set({ status: "failed", events: [...events, event("Booking failed", e instanceof Error ? e.message : "Unknown error")], updatedAt: new Date() })
      .where(eq(bookings.id, row.id));
    log("error", "booking.failed", { reference, mode, message: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

/** "Lagos (LOS) → London (LHR)" — the one line every email header needs. */
function routeLabel(itinerary: Itinerary): string {
  const segs = itinerary.slices.flatMap((sl) => sl.segments);
  if (!segs.length) return "your itinerary";
  const first = segs[0];
  const last = segs[segs.length - 1];
  const label = (ref: AirportRef) => (getAirport(ref.code)?.city ?? ref.city ?? ref.code);
  return `${label(first.origin)} (${first.origin.code}) → ${label(last.destination)} (${last.destination.code})`;
}

function firstNameOfBooking(row: { secureData: string }): string | undefined {
  try {
    return decryptJson<{ passengers: { givenName: string }[] }>(row.secureData).passengers[0]?.givenName;
  } catch {
    return undefined;
  }
}

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/* ---------------- reading ---------------- */
const normName = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");

export async function getBookingRow(reference: string) {
  const [row] = await db.select().from(bookings).where(eq(bookings.reference, reference)).limit(1);
  return row ?? null;
}

export async function verifyLastName(row: BookingRow, lastName: string) {
  const { passengers } = decryptJson<SecureData>(row.secureData);
  const n = normName(lastName);
  return n.length > 0 && passengers.some((p) => normName(p.familyName) === n);
}

export async function bookingView(row: BookingRow) {
  const secure = decryptJson<SecureData>(row.secureData);
  const reqs = await db.select().from(bookingRequests).where(eq(bookingRequests.bookingId, row.id));
  const fare = row.itinerary.fares[0] as Fare;
  return {
    reference: row.reference,
    mode: row.mode as "demo" | "sandbox" | "live",
    status: row.status as "simulated" | "requested" | "confirmed" | "ticketed" | "cancelled" | "failed",
    paymentStatus: row.paymentStatus,
    pnr: row.pnr,
    ticketNumbers: row.ticketNumbers,
    currency: row.currency,
    total: Number(row.totalAmount),
    price: row.priceBreakdown,
    refundAmount: row.refundAmount === null ? null : Number(row.refundAmount),
    itinerary: row.itinerary,
    fare,
    extras: row.extras as ExtraSelection[],
    contactEmail: row.contactEmail,
    contactPhone: secure.phone,
    passengers: secure.passengers.map((p) => ({
      type: p.type,
      title: p.title,
      givenName: p.givenName,
      familyName: p.familyName,
      bornOn: p.bornOn,
      passport: p.passportNumber ? `•••• ${p.passportNumber.slice(-3)}` : null,
      // Needed for the six-month validity check. Shown only on a page already gated
      // by the signed trip cookie plus a surname match.
      passportExpiry: p.passportExpiry ?? null,
    })),
    events: row.events,
    requests: reqs.map((r) => ({ id: r.id, type: r.type, message: r.message, status: r.status, createdAt: r.createdAt.toISOString() })),
    createdAt: row.createdAt.toISOString(),
  };
}
export type BookingView = Awaited<ReturnType<typeof bookingView>>;

export async function listBookingSummaries(refs: string[]) {
  if (!refs.length) return [];
  const rows = await Promise.all(refs.map((r) => getBookingRow(r)));
  return rows
    .filter((r): r is BookingRow => !!r && r.status !== "failed")
    .map((r) => ({
      reference: r.reference,
      status: r.status,
      mode: r.mode,
      total: Number(r.totalAmount),
      currency: r.currency,
      slices: r.itinerary.slices.map((s) => ({ from: s.origin.code, to: s.destination.code, date: s.departLocal.slice(0, 10), fromCity: s.origin.city, toCity: s.destination.city })),
    }));
}

/* ---------------- manage ---------------- */
function paidAirline(row: BookingRow) {
  const p = row.priceBreakdown as Record<string, number>;
  return round2(Number(p.fare ?? 0) + Number(p.taxes ?? 0));
}

function assertManageable(row: BookingRow) {
  if (row.status === "cancelled") throw new ApiError(409, "ALREADY_CANCELLED", "This booking is already cancelled.");
  if (row.status === "failed" || row.status === "requested")
    throw new ApiError(409, "NOT_MANAGEABLE", "This booking can't be changed yet.");
  const firstDep = row.itinerary.slices[0].departLocal.slice(0, 10);
  if (firstDep < new Date().toISOString().slice(0, 10)) throw new ApiError(409, "DEPARTED", "This trip has already started.");
}

export async function quoteCancel(reference: string) {
  const row = await getBookingRow(reference);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Booking not found");
  assertManageable(row);
  return getProvider().quoteCancellation({ providerOrderId: row.providerOrderId, fare: row.itinerary.fares[0], paidAirline: paidAirline(row) });
}

export async function confirmCancel(reference: string, expectedRefund: number) {
  const row = await getBookingRow(reference);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Booking not found");
  assertManageable(row);
  const provider = getProvider();
  const quote = await provider.quoteCancellation({ providerOrderId: row.providerOrderId, fare: row.itinerary.fares[0], paidAirline: paidAirline(row) });
  if (Math.abs(quote.refundAmount - expectedRefund) > 0.005)
    throw new ApiError(409, "REFUND_CHANGED", "The refund amount changed. Please review the new amount.", { refundAmount: quote.refundAmount });
  const done = await provider.confirmCancellation({ providerOrderId: row.providerOrderId, quote });
  const events = [...row.events, event("Booking cancelled", `Refund ${done.refundAmount.toFixed(2)} ${row.currency}${row.mode === "demo" ? " (simulated)" : ""}`)];
  await db
    .update(bookings)
    .set({
      status: "cancelled",
      paymentStatus: row.mode === "demo" ? "simulated" : done.refundAmount > 0 ? "refunded" : row.paymentStatus,
      refundAmount: done.refundAmount.toFixed(2),
      cancelledAt: new Date(),
      events,
      updatedAt: new Date(),
    })
    .where(and(eq(bookings.id, row.id), sql`${bookings.status} <> 'cancelled'`));
  log("info", "booking.cancelled", { reference, refund: done.refundAmount });

  // If we captured a card payment, the customer's money is with us, not the airline. Raise
  // the refund request immediately — the desk approves it, the worker executes it. The
  // customer should never have to email us to be given their own money back.
  const [captured] = await db
    .select()
    .from(paymentIntents)
    .where(and(eq(paymentIntents.bookingId, row.id), eq(paymentIntents.status, "captured")))
    .limit(1);
  if (captured) {
    const [existing] = await db
      .select({ id: refundRequests.id })
      .from(refundRequests)
      .where(and(eq(refundRequests.bookingId, row.id), inArray(refundRequests.status, ["requested", "approved"])))
      .limit(1);
    if (!existing)
      await db.insert(refundRequests).values({
        bookingId: row.id,
        reference,
        amountMinor: captured.amountMinor,
        currency: captured.currency,
        reason: `Customer cancellation — airline refund ${done.refundAmount.toFixed(2)} ${row.currency}, provider refund of the full capture`,
        status: "requested",
        requestedBy: "customer:cancel",
      });
  }

  await sendEmail({
    kind: "booking.cancelled",
    to: row.contactEmail,
    bookingId: row.id,
    reference,
    dedupeKey: `booking.cancelled:${reference}`,
    payload: {
      reference,
      firstName: firstNameOfBooking(row),
      refundAmount: done.refundAmount > 0 ? money(done.refundAmount, row.currency) : undefined,
      reason: row.mode === "demo" ? "Simulated booking — no money moved" : undefined,
    },
  });

  return { refundAmount: done.refundAmount, currency: row.currency, refundQueued: Boolean(captured) };
}

export async function addRequest(reference: string | null, type: "change" | "support", message: string, email?: string, topic?: string) {
  let bookingId: string | null = null;
  let contactEmail = email ?? null;
  if (reference) {
    const row = await getBookingRow(reference);
    if (row) {
      bookingId = row.id;
      contactEmail = contactEmail ?? row.contactEmail;
      if (type === "change")
        await db
          .update(bookings)
          .set({ events: [...row.events, event("Change request received", "A support agent will review it")], updatedAt: new Date() })
          .where(eq(bookings.id, row.id));
    }
  }
  const [created] = await db.insert(bookingRequests).values({ bookingId, type, topic, message, contactEmail }).returning();

  await sendEmail({
    kind: "request.received",
    to: contactEmail,
    bookingId,
    reference: reference ?? null,
    dedupeKey: `request.received:${created.id}`,
    payload: {
      reference: reference ?? undefined,
      reason: type === "change" ? "change request" : "message",
      message: message.length > 400 ? `${message.slice(0, 400)}…` : message,
      firstName: reference ? firstNameOfBooking((await getBookingRow(reference))!) : undefined,
    },
  });
}
