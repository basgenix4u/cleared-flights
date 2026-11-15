import { index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { BookingEvent, ExtraOption, ExtraSelection, Itinerary, SearchQuery } from "@/lib/types";

/** A persisted search: normalized itineraries so checkout can re-find the exact fare the traveller chose. */
export const searchSessions = pgTable(
  "search_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    query: jsonb("query").$type<SearchQuery>().notNull(),
    mode: text("mode").notNull(),
    itineraries: jsonb("itineraries").$type<Itinerary[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("search_sessions_expires_idx").on(t.expiresAt)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: text("reference").notNull().unique(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    mode: text("mode").notNull(), // demo | sandbox | live
    status: text("status").notNull(), // simulated | requested | confirmed | ticketed | cancelled | failed
    paymentStatus: text("payment_status").notNull(), // none | simulated | paid | refunded | failed
    currency: text("currency").notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    priceBreakdown: jsonb("price_breakdown").$type<Record<string, number | string>>().notNull(),
    providerOrderId: text("provider_order_id"),
    pnr: text("pnr"),
    ticketNumbers: jsonb("ticket_numbers").$type<string[]>().notNull().default([]),
    itinerary: jsonb("itinerary").$type<Itinerary>().notNull(),
    offerId: text("offer_id").notNull(),
    extras: jsonb("extras").$type<ExtraSelection[]>().notNull().default([]),
    /**
     * The priced options the traveller chose, captured at booking time. Fulfilment
     * happens *after* payment, by which point the search session may have expired, so
     * the provider-facing prices must be stored with the booking rather than re-looked-up.
     */
    extrasSnapshot: jsonb("extras_snapshot").$type<ExtraOption[]>().notNull().default([]),
    contactEmail: text("contact_email").notNull(),
    /** AES-256-GCM encrypted JSON: passengers (incl. passport data) + phone */
    secureData: text("secure_data").notNull(),
    passengerCount: integer("passenger_count").notNull(),
    events: jsonb("events").$type<BookingEvent[]>().notNull().default([]),
    refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("bookings_email_idx").on(t.contactEmail)],
);

export const bookingRequests = pgTable("booking_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id),
  type: text("type").notNull(), // change | cancel | support
  topic: text("topic"),
  message: text("message").notNull(),
  contactEmail: text("contact_email"),
  status: text("status").notNull().default("received"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Payment attempts. One booking may have several (a failed card, then a retry), and
 * exactly one may ever reach `captured`.
 *
 * The important column is `fulfilmentStatus`: it separates "we have the customer's
 * money" from "the airline has issued the ticket". Those are different facts, and the
 * gap between them is where travel businesses lose trust and cash.
 */
export const paymentIntents = pgTable(
  "payment_intents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(), // booking reference, for operator lookup
    provider: text("provider").notNull(), // paystack | stripe | mock
    providerRef: text("provider_ref"),
    amountMinor: integer("amount_minor").notNull(), // smallest currency unit
    currency: text("currency").notNull(),
    status: text("status").notNull().default("created"), // created | pending | captured | failed | refunded
    /** none | pending | done | failed — the airline side of the transaction. */
    fulfilmentStatus: text("fulfilment_status").notNull().default("none"),
    failureReason: text("failure_reason"),
    refundRef: text("refund_ref"),
    refundedMinor: integer("refunded_minor"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("payment_intents_booking_idx").on(t.bookingId), index("payment_intents_status_idx").on(t.status, t.fulfilmentStatus)],
);

/**
 * Every webhook delivery, stored before it is acted on. Providers retry; they also
 * duplicate. Keeping the raw event lets a disputed charge be reconstructed months
 * later, and the unique provider event id makes processing exactly-once.
 */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("received"), // received | processed | ignored | failed
    error: text("error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("webhook_events_unique").on(t.provider, t.eventId)],
);

/**
 * Refunds are approved by a person and executed by a machine.
 *
 * The desk writes the decision; a worker performs the provider call. They are separate
 * steps on purpose: an operator should not be able to press a button that fires an
 * irreversible API call before anyone has checked the booking, and a provider outage
 * must not lose the decision.
 */
export const refundRequests = pgTable(
  "refund_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    reason: text("reason").notNull(),
    /** requested | approved | declined | executed | failed */
    status: text("status").notNull().default("requested"),
    requestedBy: text("requested_by"),
    decidedBy: text("decided_by"),
    note: text("note"),
    providerRef: text("provider_ref"),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
  },
  (t) => [index("refund_requests_status_idx").on(t.status), index("refund_requests_booking_idx").on(t.bookingId)],
);

/**
 * The email outbox.
 *
 * Mail is queued before it is sent, for the same reason refunds are: a provider outage, a
 * redeploy or a rate limit must not silently lose a message a customer is waiting for. The
 * row stores *what happened* (kind + payload), not pre-rendered HTML, so the template can be
 * fixed and old messages re-rendered and resent.
 *
 * `status = skipped` with `failure_reason = no_email_provider` is the honest state when no
 * mail provider is configured: the message exists, it was not delivered, and both the
 * customer's trip page and the desk say so.
 */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    reference: text("reference"),
    kind: text("kind").notNull(),
    toEmail: text("to_email").notNull(),
    /** queued | sent | failed | skipped */
    status: text("status").notNull().default("queued"),
    provider: text("provider"),
    providerRef: text("provider_ref"),
    attempts: integer("attempts").notNull().default(0),
    failureReason: text("failure_reason"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    dedupeKey: text("dedupe_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("email_outbox_status_idx").on(t.status), index("email_outbox_booking_idx").on(t.bookingId)],
);

/**
 * Durable rate limiting.
 *
 * The in-process map is useless on serverless: each instance and region gets its own
 * budget, so a limit of "40 a minute" becomes "40 a minute per lambda". One row per key,
 * incremented atomically, makes the limit the limit.
 */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
});

/**
 * Per-minute service metrics, aggregated rather than per-request.
 *
 * One upsert per request would turn a load test into a write storm; instead the process
 * accumulates in memory and flushes on a timer, on the cron tick, and when the buffer is
 * large. The trade is explicit: a hard crash can lose up to a minute of counters.
 */
export const serviceMetrics = pgTable(
  "service_metrics",
  {
    route: text("route").notNull(),
    bucket: timestamp("bucket", { withTimezone: true }).notNull(), // truncated to the minute
    requests: integer("requests").notNull().default(0),
    errors: integer("errors").notNull().default(0),
    clientErrors: integer("client_errors").notNull().default(0),
    slow: integer("slow").notNull().default(0),
    totalMs: integer("total_ms").notNull().default(0),
    maxMs: integer("max_ms").notNull().default(0),
    p50: integer("p50").notNull().default(0),
    p95: integer("p95").notNull().default(0),
    p99: integer("p99").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.route, t.bucket] }), index("service_metrics_bucket_idx").on(t.bucket)],
);
