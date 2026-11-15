import { and, desc, eq, isNotNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, paymentIntents, refundRequests, webhookEvents } from "@/db/schema";
import { alertOps, deliverOutbox, money, sendEmail } from "@/lib/email-service";
import { getProvider } from "./providers";
import { callbackUrl, paymentProvider, providerById } from "./payments";
import { fromMinor, toMinor } from "./payments/types";
import type { PaymentProvider } from "./payments/types";
import { round2 } from "./pricing";
import { decryptJson, log } from "./security";
import type { BookingEvent, ExtraOption, Fare, PassengerInput } from "./types";

/**
 * The money path.
 *
 * The rule this file exists to enforce: **a booking is never confirmed because a
 * browser said so.** Confirmation comes from a signed provider webhook, a matched
 * amount, and a successful airline order. Everything else is a pending state.
 *
 * Lifecycle
 *   booking:  requested (unpaid) ──▶ paid+fulfilled ──▶ simulated | confirmed | ticketed
 *                    │                       └──▶ failed (refunded)
 *                    └──▶ cancelled (expired, never paid)
 *   intent:   created ──▶ pending ──▶ captured ──▶ fulfilment done | failed ──▶ refunded
 */

type BookingRow = typeof bookings.$inferSelect;
interface SecureData {
  passengers: PassengerInput[];
  phone: string;
}
const event = (label: string, detail?: string): BookingEvent => ({ at: new Date().toISOString(), label, detail });

export class PaymentError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------ intents -- */

export interface IntentView {
  id: string;
  status: string;
  fulfilmentStatus: string;
  amountMinor: number;
  currency: string;
  provider: string;
  redirectUrl: string | null;
  failureReason: string | null;
}

/**
 * Create (or reuse) the payment for a booking.
 *
 * Reuse matters: a traveller who double-clicks "Pay", or reloads the provider page,
 * must not be charged twice. There is at most one open intent per booking.
 */
export async function createIntent(reference: string): Promise<IntentView> {
  const provider = paymentProvider();
  if (!provider) {
    throw new PaymentError(503, "PAYMENT_NOT_CONFIGURED", "Card payments are not enabled on this deployment. Nothing has been charged.");
  }

  const [booking] = await db.select().from(bookings).where(eq(bookings.reference, reference)).limit(1);
  if (!booking) throw new PaymentError(404, "NOT_FOUND", "We could not find that booking.");
  if (booking.status === "cancelled") throw new PaymentError(409, "BOOKING_CANCELLED", "This booking was cancelled.");
  if (booking.paymentStatus === "paid") throw new PaymentError(409, "ALREADY_PAID", "This booking is already paid for.");

  const existing = await db
    .select()
    .from(paymentIntents)
    .where(and(eq(paymentIntents.bookingId, booking.id), eq(paymentIntents.status, "pending")))
    .orderBy(desc(paymentIntents.createdAt))
    .limit(1);

  const amountMinor = toMinor(Number(booking.totalAmount), booking.currency);

  if (existing[0]) {
    // Re-initialise: hosted checkout URLs expire, and a stale one is a dead end.
    const init = await safeInitialize(provider, booking, amountMinor);
    await db
      .update(paymentIntents)
      .set({ providerRef: init.providerRef, metadata: { ...existing[0].metadata, redirectUrl: init.redirectUrl }, updatedAt: new Date() })
      .where(eq(paymentIntents.id, existing[0].id));
    return viewOf({ ...existing[0], providerRef: init.providerRef }, init.redirectUrl);
  }

  const init = await safeInitialize(provider, booking, amountMinor);
  const [row] = await db
    .insert(paymentIntents)
    .values({
      bookingId: booking.id,
      reference: booking.reference,
      provider: provider.id,
      providerRef: init.providerRef,
      amountMinor,
      currency: booking.currency,
      status: "pending",
      fulfilmentStatus: "none",
      // One open intent per booking: the booking id is the natural idempotency key.
      idempotencyKey: `booking:${booking.id}:${provider.id}`,
      metadata: { redirectUrl: init.redirectUrl },
    })
    .onConflictDoNothing({ target: paymentIntents.idempotencyKey })
    .returning();

  if (!row) {
    const [again] = await db.select().from(paymentIntents).where(eq(paymentIntents.idempotencyKey, `booking:${booking.id}:${provider.id}`)).limit(1);
    if (again) return viewOf(again, init.redirectUrl);
    throw new PaymentError(500, "INTENT_FAILED", "Could not open a payment for this booking.");
  }

  await db
    .update(bookings)
    .set({
      paymentStatus: "unpaid",
      events: [...booking.events, event("Payment opened", `${fromMinor(amountMinor, booking.currency).toFixed(2)} ${booking.currency} via ${provider.label}`)],
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, booking.id));

  log("info", "payment.intent", { reference, provider: provider.id, amountMinor });
  return viewOf(row, init.redirectUrl);
}

async function safeInitialize(provider: PaymentProvider, booking: BookingRow, amountMinor: number) {
  try {
    return await provider.initialize({
      reference: booking.reference,
      amountMinor,
      currency: booking.currency,
      email: booking.contactEmail,
      callbackUrl: callbackUrl(booking.reference),
      metadata: { bookingId: booking.id },
    });
  } catch (e) {
    log("error", "payment.initialize_failed", { reference: booking.reference, message: e instanceof Error ? e.message : String(e) });
    throw new PaymentError(502, "PAYMENT_PROVIDER_ERROR", "The payment provider did not accept the request. Nothing has been charged.", {
      reason: e instanceof Error ? e.message : undefined,
    });
  }
}

function viewOf(row: typeof paymentIntents.$inferSelect, redirectUrl: string | null): IntentView {
  return {
    id: row.id,
    status: row.status,
    fulfilmentStatus: row.fulfilmentStatus,
    amountMinor: row.amountMinor,
    currency: row.currency,
    provider: row.provider,
    redirectUrl: (row.metadata?.redirectUrl as string | undefined) ?? redirectUrl,
    failureReason: row.failureReason,
  };
}

/** Latest payment state for a booking — used by the customer's status page. */
export async function paymentFor(reference: string) {
  const rows = await db
    .select()
    .from(paymentIntents)
    .where(eq(paymentIntents.reference, reference))
    .orderBy(desc(paymentIntents.createdAt))
    .limit(1);
  const intent = rows[0];
  if (!intent) return null;
  return {
    status: intent.status,
    fulfilmentStatus: intent.fulfilmentStatus,
    provider: intent.provider,
    amountMinor: intent.amountMinor,
    currency: intent.currency,
    failureReason: intent.failureReason,
    capturedAt: intent.capturedAt?.toISOString() ?? null,
    refundedMinor: intent.refundedMinor,
  };
}

/* ----------------------------------------------------------------- webhooks -- */

export interface WebhookOutcome {
  status: number;
  body: { ok: boolean; code?: string; message?: string };
}

/**
 * Verify → record → act. In that order, always.
 *
 * The event is stored before processing so a crash mid-fulfilment leaves evidence,
 * and the unique (provider, event_id) index makes a provider retry a no-op rather
 * than a second airline order.
 */
export async function processWebhook(
  providerId: string,
  rawBody: string,
  headers: Record<string, string | undefined>,
): Promise<WebhookOutcome> {
  const provider = providerById(providerId);
  if (!provider) return { status: 404, body: { ok: false, code: "UNKNOWN_PROVIDER", message: "No such payment provider." } };

  const parsed = await provider.parseWebhook(rawBody, headers);
  if (!parsed.ok) {
    log("warn", "payment.webhook_rejected", { provider: providerId, reason: parsed.reason });
    return { status: 401, body: { ok: false, code: "BAD_SIGNATURE", message: "Signature verification failed." } };
  }

  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider: providerId,
      eventId: parsed.eventId,
      type: parsed.type,
      payload: JSON.parse(rawBody) as Record<string, unknown>,
      status: "received",
    })
    .onConflictDoNothing({ target: [webhookEvents.provider, webhookEvents.eventId] })
    .returning({ id: webhookEvents.id });

  if (!inserted[0]) {
    log("info", "payment.webhook_duplicate", { provider: providerId, eventId: parsed.eventId });
    return { status: 200, body: { ok: true, message: "Already processed." } };
  }
  const eventRowId = inserted[0].id;

  try {
    if (parsed.type !== "charge.success" && parsed.type !== "checkout.session.completed" && parsed.type !== "payment_intent.succeeded") {
      await db.update(webhookEvents).set({ status: "ignored", processedAt: new Date() }).where(eq(webhookEvents.id, eventRowId));
      return { status: 200, body: { ok: true, message: "Ignored." } };
    }

    const outcome = await capture(parsed.reference, parsed.amountMinor, parsed.currency, parsed.providerRef, provider);
    await db
      .update(webhookEvents)
      .set({
        status: outcome.body.ok ? "processed" : "failed",
        error: outcome.body.ok ? null : (outcome.body.message ?? null),
        processedAt: new Date(),
      })
      .where(eq(webhookEvents.id, eventRowId));
    return outcome;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.update(webhookEvents).set({ status: "failed", error: message, processedAt: new Date() }).where(eq(webhookEvents.id, eventRowId));
    log("error", "payment.webhook_failed", { provider: providerId, eventId: parsed.eventId, message });
    // 500 makes the provider retry, which is what we want for a transient failure.
    return { status: 500, body: { ok: false, code: "PROCESSING_FAILED", message } };
  }
}

/**
 * Mark the intent captured and fulfil it, or record why it could not be fulfilled.
 * Returns 200 even when fulfilment fails: the payment itself succeeded, and asking the
 * provider to retry would risk charging twice. Reconciliation owns the aftermath.
 */
async function capture(
  reference: string,
  amountMinor: number,
  currency: string,
  providerRef: string,
  provider: PaymentProvider,
): Promise<WebhookOutcome> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.reference, reference)).limit(1);
  if (!booking) {
    log("error", "payment.orphan_webhook", { reference, provider: provider.id });
    return { status: 200, body: { ok: false, code: "ORPHAN", message: "No booking matches this payment." } };
  }

  const [intent] = await db
    .select()
    .from(paymentIntents)
    .where(and(eq(paymentIntents.bookingId, booking.id), eq(paymentIntents.status, "pending")))
    .orderBy(desc(paymentIntents.createdAt))
    .limit(1);

  if (!intent) {
    const [settled] = await db
      .select()
      .from(paymentIntents)
      .where(and(eq(paymentIntents.bookingId, booking.id), isNotNull(paymentIntents.capturedAt)))
      .limit(1);
    if (settled) return { status: 200, body: { ok: true, message: "Already captured." } };
    return { status: 200, body: { ok: false, code: "NO_INTENT", message: "No open payment for this booking." } };
  }

  // Amount must match what we asked for. A mismatch is a fraud signal, not a rounding bug.
  if (amountMinor !== intent.amountMinor) {
    await db
      .update(paymentIntents)
      .set({ status: "failed", failureReason: `amount_mismatch:${amountMinor}!=${intent.amountMinor}`, updatedAt: new Date() })
      .where(eq(paymentIntents.id, intent.id));
    log("error", "payment.amount_mismatch", { reference, expected: intent.amountMinor, received: amountMinor });
    return { status: 200, body: { ok: false, code: "AMOUNT_MISMATCH", message: "Payment amount did not match the booking." } };
  }
  if (currency.toUpperCase() !== intent.currency.toUpperCase()) {
    await db
      .update(paymentIntents)
      .set({ status: "failed", failureReason: `currency_mismatch:${currency}!=${intent.currency}`, updatedAt: new Date() })
      .where(eq(paymentIntents.id, intent.id));
    return { status: 200, body: { ok: false, code: "CURRENCY_MISMATCH", message: "Payment currency did not match the booking." } };
  }

  await db
    .update(paymentIntents)
    .set({ status: "captured", capturedAt: new Date(), providerRef: providerRef || intent.providerRef, fulfilmentStatus: "pending", updatedAt: new Date() })
    .where(eq(paymentIntents.id, intent.id));

  await db
    .update(bookings)
    .set({
      paymentStatus: "paid",
      events: [...booking.events, event("Payment received", `${fromMinor(amountMinor, intent.currency).toFixed(2)} ${intent.currency}`)],
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, booking.id));

  // Tell the customer the moment money lands and the ticket does not yet exist. Most travel
  // mail skips this message; it is the one that prevents "why was I charged?" later.
  await sendEmail({
    kind: "booking.ticketing_pending",
    to: booking.contactEmail,
    bookingId: booking.id,
    reference,
    dedupeKey: `booking.ticketing_pending:${reference}`,
    payload: {
      reference,
      firstName: firstNameOf(booking),
      amount: money(fromMinor(amountMinor, intent.currency), intent.currency),
      route: sliceLine(booking.itinerary),
    },
  });

  const result = await fulfilBooking({ ...booking, paymentStatus: "paid" }, intent.id);
  return {
    status: 200,
    body: { ok: result.ok, code: result.ok ? undefined : "FULFILMENT_FAILED", message: result.message },
  };
}

/* --------------------------------------------------------------- fulfilment -- */

/**
 * Turn a paid booking into an airline order.
 *
 * Idempotent: guarded on the intent's fulfilment status and the booking's own status,
 * so a retry after a partial failure cannot create a second reservation.
 */
export async function fulfilBooking(booking: BookingRow, intentId: string): Promise<{ ok: boolean; message?: string }> {
  const [intent] = await db.select().from(paymentIntents).where(eq(paymentIntents.id, intentId)).limit(1);
  if (!intent) return { ok: false, message: "Missing payment intent." };
  if (intent.fulfilmentStatus === "done") return { ok: true, message: "Already fulfilled." };
  if (booking.status !== "requested") {
    await db.update(paymentIntents).set({ fulfilmentStatus: "done", updatedAt: new Date() }).where(eq(paymentIntents.id, intentId));
    return { ok: true, message: "Booking was already resolved." };
  }

  const provider = getProvider();
  const fare = booking.itinerary.fares[0] as Fare;
  const secure = decryptJson<SecureData>(booking.secureData);
  const options = booking.extrasSnapshot as ExtraOption[];
  const byId = new Map(options.map((o) => [o.id, o]));

  const selected = booking.extras
    .map((s) => {
      const option = byId.get(s.optionId);
      return option ? { option, passenger: s.passenger, qty: s.qty } : null;
    })
    .filter((x): x is { option: ExtraOption; passenger: number; qty: number } => x !== null);

  const providerExtras = round2(
    selected.filter((s) => s.option.providerServiceId).reduce((a, s) => a + s.option.price * s.qty, 0),
  );

  try {
    const order = await provider.createOrder({
      fare,
      itinerary: booking.itinerary,
      passengers: secure.passengers,
      contact: { email: booking.contactEmail, phone: secure.phone },
      extras: selected,
      providerAmount: (Number(fare.providerTotal) + providerExtras).toFixed(2),
      reference: booking.reference,
      idempotencyKey: booking.idempotencyKey,
    });

    const events: BookingEvent[] = [
      ...booking.events,
      ...(order.status === "simulated"
        ? [event("Simulated booking", "No airline reservation exists")]
        : [event("Airline reservation created", order.pnr ?? undefined)]),
      ...(order.status === "ticketed" ? [event("Ticket issued", order.ticketNumbers.join(", "))] : []),
    ];

    await db
      .update(bookings)
      .set({
        status: order.status,
        providerOrderId: order.providerOrderId,
        pnr: order.pnr,
        ticketNumbers: order.ticketNumbers,
        events,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));

    await db.update(paymentIntents).set({ fulfilmentStatus: "done", updatedAt: new Date() }).where(eq(paymentIntents.id, intentId));
    log("info", "booking.fulfilled", { reference: booking.reference, status: order.status });

    const firstName = secure.passengers[0]?.givenName;
    if (order.status === "ticketed") {
      await sendEmail({
        kind: "booking.ticketed",
        to: booking.contactEmail,
        bookingId: booking.id,
        reference: booking.reference,
        dedupeKey: `booking.ticketed:${booking.reference}`,
        payload: {
          reference: booking.reference,
          firstName,
          pnr: order.pnr ?? undefined,
          tickets: order.ticketNumbers,
          amount: money(Number(booking.totalAmount), booking.currency),
          route: sliceLine(booking.itinerary),
          departDate: booking.itinerary.slices[0]?.segments[0]?.departLocal,
        },
      });
    } else {
      // Simulated/sandbox order: say so in the mail rather than implying a ticket exists.
      await sendEmail({
        kind: "booking.received",
        to: booking.contactEmail,
        bookingId: booking.id,
        reference: booking.reference,
        dedupeKey: `booking.settled:${booking.reference}`,
        payload: {
          reference: booking.reference,
          firstName,
          amount: money(Number(booking.totalAmount), booking.currency),
          route: sliceLine(booking.itinerary),
          departDate: booking.itinerary.slices[0]?.segments[0]?.departLocal,
        },
      });
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const attempts = Number(intent.metadata?.attempts ?? 0) + 1;
    await db
      .update(paymentIntents)
      .set({
        fulfilmentStatus: "failed",
        failureReason: message,
        metadata: { ...intent.metadata, attempts },
        updatedAt: new Date(),
      })
      .where(eq(paymentIntents.id, intentId));
    await db
      .update(bookings)
      .set({ events: [...booking.events, event("Fulfilment failed — we are on it", message)], updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));
    log("error", "booking.fulfilment_failed", { reference: booking.reference, attempt: attempts, message });
    return { ok: false, message };
  }
}

/* ------------------------------------------------------------ reconciliation -- */

const MAX_FULFILMENT_ATTEMPTS = 3;

/**
 * The job that makes the money path survivable.
 *
 * Finds payments that succeeded while fulfilment did not — the single worst state a
 * travel booking can sit in — retries them, and refunds anything that cannot be
 * fulfilled. Safe to run every few minutes; every step is idempotent.
 */
export async function reconcile(): Promise<{
  retried: number;
  refunded: number;
  abandoned: number;
  expiredIntents: number;
  refundsExecuted: number;
  refundsFailed: number;
  mailQueued: number;
}> {
  const stale = await db
    .select({ intent: paymentIntents, booking: bookings })
    .from(paymentIntents)
    .innerJoin(bookings, eq(paymentIntents.bookingId, bookings.id))
    .where(
      and(
        eq(paymentIntents.status, "captured"),
        ne(paymentIntents.fulfilmentStatus, "done"),
        lt(paymentIntents.updatedAt, new Date(Date.now() - 60_000)),
      ),
    )
    .limit(50);

  let retried = 0;
  let refunded = 0;
  let abandoned = 0;

  for (const { intent, booking } of stale) {
    const attempts = Number(intent.metadata?.attempts ?? 0);
    if (attempts >= MAX_FULFILMENT_ATTEMPTS) {
      const provider = providerById(intent.provider);
      const result = provider
        ? await provider.refund({ providerRef: intent.providerRef ?? "", amountMinor: intent.amountMinor, reason: "fulfilment_failed" })
        : { ok: false, refundRef: "", reason: "no_provider" };
      await db
        .update(paymentIntents)
        .set({
          status: result.ok ? "refunded" : "failed",
          fulfilmentStatus: "failed",
          refundRef: result.refundRef || null,
          refundedMinor: result.ok ? intent.amountMinor : null,
          failureReason: result.ok ? "auto_refund_after_failed_fulfilment" : `refund_failed:${result.reason}`,
          updatedAt: new Date(),
        })
        .where(eq(paymentIntents.id, intent.id));
      if (result.ok) {
        refunded += 1;
        await db
          .update(bookings)
          .set({
            status: "failed",
            paymentStatus: "refunded",
            refundAmount: fromMinor(intent.amountMinor, intent.currency).toFixed(2),
            events: [...booking.events, event("Refunded automatically", "We could not issue the ticket, so you have been refunded in full")],
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, booking.id));
        await sendEmail({
          kind: "refund.executed",
          to: booking.contactEmail,
          bookingId: booking.id,
          reference: booking.reference,
          dedupeKey: `refund.auto:${booking.reference}`,
          payload: {
            reference: booking.reference,
            firstName: firstNameOf(booking),
            refundAmount: money(fromMinor(intent.amountMinor, intent.currency), intent.currency),
            reason: "The airline could not confirm this ticket, so we refunded it in full without waiting to be asked.",
          },
        });
      } else {
        abandoned += 1;
        log("error", "reconcile.refund_failed", { reference: booking.reference, reason: result.reason });
      }
      continue;
    }

    const result = await fulfilBooking(booking, intent.id);
    if (result.ok) retried += 1;
    else
      await alertOps(
        "ops.paid_not_ticketed",
        {
          reference: booking.reference,
          amount: money(fromMinor(intent.amountMinor, intent.currency), intent.currency),
          message: result.message ?? "fulfilment failed",
          stuckSince: intent.updatedAt.toISOString(),
        },
        `ops.stuck:${booking.reference}:${attempts}`,
        booking.id,
        booking.reference,
      );
  }

  // Abandoned checkouts: an unpaid booking older than 60 minutes is not a booking.
  const expired = await db
    .update(bookings)
    .set({
      status: "cancelled",
      events: sql`${bookings.events} || ${JSON.stringify([event("Expired", "Payment was not completed")])}::jsonb`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookings.status, "requested"),
        eq(bookings.paymentStatus, "unpaid"),
        lt(bookings.createdAt, new Date(Date.now() - 60 * 60_000)),
      ),
    )
    .returning({ id: bookings.id, reference: bookings.reference, contactEmail: bookings.contactEmail });

  for (const row of expired) {
    await sendEmail({
      kind: "booking.expired",
      to: row.contactEmail,
      bookingId: row.id,
      reference: row.reference,
      dedupeKey: `booking.expired:${row.reference}`,
      payload: { reference: row.reference, reason: "The payment was not completed within the hold window." },
    });
  }

  if (retried || refunded || abandoned || expired.length) {
    log("info", "reconcile.done", { retried, refunded, abandoned, expiredIntents: expired.length });
  }
  const queue = await processRefundQueue();
  const mail = await deliverOutbox(25);
  return { retried, refunded, abandoned, expiredIntents: expired.length, ...queue, mailQueued: mail.sent + mail.failed + mail.skipped };
}

/**
 * Execute refunds a human has approved.
 *
 * Kept separate from approval so a provider outage cannot lose a decision, and so no
 * single button press can move money without a recorded judgement behind it.
 */
export async function processRefundQueue(): Promise<{ refundsExecuted: number; refundsFailed: number }> {
  const approved = await db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.status, "approved"))
    .limit(20);

  let refundsExecuted = 0;
  let refundsFailed = 0;

  for (const req of approved) {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, req.bookingId)).limit(1);
    if (!booking) {
      await db.update(refundRequests).set({ status: "failed", failureReason: "booking_missing" }).where(eq(refundRequests.id, req.id));
      refundsFailed += 1;
      continue;
    }

    const result = await refundBooking(req.reference, req.amountMinor);
    if (!result.ok) {
      await db
        .update(refundRequests)
        .set({ status: "failed", failureReason: `refund_failed:${result.reason}`, executedAt: new Date() })
        .where(eq(refundRequests.id, req.id));
      await db
        .update(bookings)
        .set({ events: [...booking.events, event("Refund failed", result.reason)], updatedAt: new Date() })
        .where(eq(bookings.id, booking.id));
      refundsFailed += 1;
      log("error", "refund.failed", { reference: req.reference, reason: result.reason });
      continue;
    }

    await db
      .update(refundRequests)
      .set({ status: "executed", providerRef: result.refundRef ?? null, executedAt: new Date() })
      .where(eq(refundRequests.id, req.id));
    await db
      .update(bookings)
      .set({
        paymentStatus: "refunded",
        refundAmount: fromMinor(req.amountMinor, req.currency).toFixed(2),
        events: [...booking.events, event("Refund paid", `${fromMinor(req.amountMinor, req.currency).toFixed(2)} ${req.currency} — ${req.reason}`)],
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));
    await sendEmail({
      kind: "refund.executed",
      to: booking.contactEmail,
      bookingId: booking.id,
      reference: req.reference,
      dedupeKey: `refund.executed:${req.id}`,
      payload: {
        reference: req.reference,
        firstName: firstNameOf(booking),
        refundAmount: money(fromMinor(req.amountMinor, req.currency), req.currency),
        reason: req.reason,
      },
    });
    refundsExecuted += 1;
    log("info", "refund.executed", { reference: req.reference, amountMinor: req.amountMinor });
  }

  return { refundsExecuted, refundsFailed };
}

/** Refund a captured payment deliberately (operator action, not reconciliation). */
export async function refundBooking(reference: string, amountMinor?: number): Promise<{ ok: boolean; refundRef?: string; reason?: string }> {
  const [intent] = await db
    .select()
    .from(paymentIntents)
    .where(eq(paymentIntents.reference, reference))
    .orderBy(desc(paymentIntents.createdAt))
    .limit(1);
  if (!intent) return { ok: false, reason: "no_payment" };
  if (intent.status !== "captured") return { ok: false, reason: `not_captured:${intent.status}` };

  const provider = providerById(intent.provider);
  if (!provider) return { ok: false, reason: "no_provider" };

  const amount = amountMinor ?? intent.amountMinor;
  const result = await provider.refund({ providerRef: intent.providerRef ?? "", amountMinor: amount, reason: "operator" });

  await db
    .update(paymentIntents)
    .set({
      status: result.ok ? (amount < intent.amountMinor ? "captured" : "refunded") : intent.status,
      refundRef: result.refundRef || null,
      refundedMinor: result.ok ? amount : null,
      failureReason: result.ok ? null : `refund_failed:${result.reason}`,
      updatedAt: new Date(),
    })
    .where(eq(paymentIntents.id, intent.id));

  return result;
}

/** "Lagos → London" for a mail header. */
function sliceLine(itinerary: BookingRow["itinerary"]): string {
  const segs = itinerary.slices.flatMap((sl) => sl.segments);
  if (!segs.length) return "your itinerary";
  const label = (ref: { code: string; city?: string }) => ref.city ?? ref.code;
  return `${label(segs[0].origin)} → ${label(segs[segs.length - 1].destination)}`;
}

/** The given name is inside the encrypted blob; decrypt only for a mail greeting. */
function firstNameOf(booking: BookingRow): string | undefined {
  try {
    return decryptJson<SecureData>(booking.secureData).passengers[0]?.givenName;
  } catch {
    return undefined;
  }
}
