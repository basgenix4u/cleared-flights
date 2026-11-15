import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { audit } from "../lib/audit.js";
import { ApiError, badRequest, notFound, wrap } from "../lib/http.js";
import { requireRole } from "../lib/session.js";

/**
 * Booking operations for the desk.
 *
 * Read-only access to the travel tables plus the refund *decision* — never a direct
 * provider call. Approving a refund writes a row that the payment worker executes, so a
 * provider outage cannot lose the decision and no button press moves money by itself.
 *
 * Names are masked at the SQL boundary: an operator needs to find a booking, not to
 * browse passports. Full passenger data stays behind the customer's own trip page.
 */
export const bookingsRouter = Router();

const MASK = `left(coalesce(b.contact_email,''), 3) || '•••' || substring(coalesce(b.contact_email,'') from position('@' in coalesce(b.contact_email,'')))`;

bookingsRouter.get(
  "/",
  wrap(async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
    const status = typeof req.query.status === "string" && req.query.status !== "all" ? req.query.status : null;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const params: unknown[] = [];
    const where: string[] = [];
    if (status) {
      params.push(status);
      where.push(`b.status = $${params.length}`);
    }
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      where.push(`(lower(b.reference) like $${params.length} or lower(b.contact_email) like $${params.length})`);
    }

    const sql = `
      select b.reference, b.status, b.payment_status, b.currency, b.total_amount, b.mode,
             b.created_at, b.pnr, ${MASK} as email,
             (select pi.status from payment_intents pi where pi.booking_id = b.id order by pi.created_at desc limit 1) as payment_state,
             (select pi.fulfilment_status from payment_intents pi where pi.booking_id = b.id order by pi.created_at desc limit 1) as fulfilment_state,
             (select count(*) from refund_requests rr where rr.booking_id = b.id and rr.status in ('requested','approved')) as open_refunds
      from bookings b
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by b.created_at desc
      limit ${limit}`;

    const { rows } = await pool.query(sql, params);
    const counts = await pool.query<{ status: string; n: string }>(`select status, count(*)::text as n from bookings group by status`);
    res.json({
      bookings: rows,
      counts: Object.fromEntries(counts.rows.map((r) => [r.status, Number(r.n)])),
    });
  }),
);

bookingsRouter.get(
  "/:reference",
  wrap(async (req, res) => {
    const reference = req.params.reference.toUpperCase();

    const booking = await pool.query(
      `select b.id, b.reference, b.status, b.payment_status, b.currency, b.total_amount, b.mode, b.pnr,
              b.ticket_numbers, b.events, b.refund_amount, b.cancelled_at, b.created_at, b.updated_at,
              b.passenger_count, b.offer_id, ${MASK} as email
       from bookings b where b.reference = $1 limit 1`,
      [reference],
    );
    const row = booking.rows[0];
    if (!row) throw notFound("No booking with that reference.");

    const [payments, refunds, requests] = await Promise.all([
      pool.query(
        `select id, provider, status, fulfilment_status, amount_minor, currency, failure_reason, captured_at, created_at
         from payment_intents where reference = $1 order by created_at desc`,
        [reference],
      ),
      pool.query(`select * from refund_requests where reference = $1 order by created_at desc`, [reference]),
      pool.query(
        `select id, type, topic, message, contact_email, status, created_at from booking_requests where booking_id = $1 order by created_at desc`,
        [row.id],
      ),
    ]);

    res.json({ booking: row, payments: payments.rows, refunds: refunds.rows, requests: requests.rows });
  }),
);

const refundInput = z.object({
  reason: z.string().min(3).max(300),
  amountMinor: z.number().int().positive().optional(),
  note: z.string().max(500).optional(),
});

/** Raise a refund for someone senior to approve. Anyone on the desk can ask. */
bookingsRouter.post(
  "/:reference/refunds",
  requireRole("owner", "admin", "editor"),
  wrap(async (req, res) => {
    const reference = req.params.reference.toUpperCase();
    const body = refundInput.parse(req.body ?? {});

    const found = await pool.query<{ id: string; currency: string; total_amount: string; passenger_count: number }>(
      `select id, currency, total_amount, passenger_count from bookings where reference = $1`,
      [reference],
    );
    const booking = found.rows[0];
    if (!booking) throw notFound("No booking with that reference.");

    const payment = await pool.query<{ amount_minor: number; status: string }>(
      `select amount_minor, status from payment_intents where reference = $1 and status = 'captured' order by created_at desc limit 1`,
      [reference],
    );
    const captured = payment.rows[0];
    if (!captured) throw badRequest("There is no captured payment for this booking, so there is nothing to refund.");

    const amountMinor = body.amountMinor ?? captured.amount_minor;
    if (amountMinor > captured.amount_minor) throw badRequest("A refund cannot exceed the amount captured.");

    const inserted = await pool.query(
      `insert into refund_requests (booking_id, reference, amount_minor, currency, reason, status, requested_by, note)
       values ($1,$2,$3,$4,$5,'requested',$6,$7) returning *`,
      [booking.id, reference, amountMinor, booking.currency, body.reason, req.user?.email ?? null, body.note ?? null],
    );

    await audit(req, "refund.requested", "booking", reference, { amountMinor, reason: body.reason });
    res.status(201).json({ refund: inserted.rows[0] });
  }),
);

/** Approve or decline. Owner/admin only — this is the money gate. */
bookingsRouter.post(
  "/refunds/:id/decide",
  requireRole("owner", "admin"),
  wrap(async (req, res) => {
    const body = z
      .object({ decision: z.enum(["approve", "decline"]), note: z.string().max(500).optional() })
      .parse(req.body ?? {});

    const current = await pool.query(`select status, reference, amount_minor from refund_requests where id = $1`, [req.params.id]);
    const row = current.rows[0] as { status: string; reference: string; amount_minor: number } | undefined;
    if (!row) throw notFound("No such refund request.");
    if (row.status !== "requested") throw badRequest(`This request is already ${row.status}.`);

    const next = body.decision === "approve" ? "approved" : "declined";
    const updated = await pool.query(
      `update refund_requests set status = $1, decided_by = $2, decided_at = now(), note = coalesce($3, note) where id = $4 returning *`,
      [next, req.user?.email ?? null, body.note ?? null, req.params.id],
    );

    // Approval is the customer's signal that the money is on its way; the outbox delivers it.
    if (next === "approved") {
      const target = await pool.query<{ booking_id: string; currency: string; notify_email: string | null }>(
        `select rr.booking_id, rr.currency, b.contact_email as notify_email
         from refund_requests rr join bookings b on b.id = rr.booking_id where rr.id = $1`,
        [req.params.id],
      );
      const info = target.rows[0];
      if (info?.notify_email) {
        await pool.query(
          `insert into email_outbox (booking_id, reference, kind, to_email, payload, dedupe_key, status)
           values ($1, $2, 'refund.approved', $3, $4::jsonb, $5, 'queued')
           on conflict (dedupe_key) do nothing`,
          [
            info.booking_id,
            row.reference,
            info.notify_email,
            JSON.stringify({
              reference: row.reference,
              refundAmount: `${(row.amount_minor / 100).toFixed(2)} ${info.currency}`,
              reason: "Reviewed and approved by our team.",
            }),
            `refund.approved:${req.params.id}`,
          ],
        );
      }
    }

    await audit(req, `refund.${next}`, "booking", row.reference, { refundId: req.params.id, amountMinor: row.amount_minor });
    res.json({ refund: updated.rows[0], executesOnNextCycle: next === "approved" });
  }),
);

/** The queue: everything waiting on a human. */
bookingsRouter.get(
  "/refunds/queue",
  wrap(async (_req, res) => {
    const { rows } = await pool.query(
      `select rr.*, b.status as booking_status, b.total_amount
       from refund_requests rr
       left join bookings b on b.id = rr.booking_id
       where rr.status in ('requested','approved','failed')
       order by case rr.status when 'requested' then 0 when 'failed' then 1 else 2 end, rr.created_at desc
       limit 100`,
    );
    res.json({ refunds: rows });
  }),
);

/** Anything paid but not ticketed — the state that must never be allowed to sit quietly. */
bookingsRouter.get(
  "/attention/paid-not-ticketed",
  wrap(async (_req, res) => {
    const { rows } = await pool.query(
      `select pi.reference, pi.status, pi.fulfilment_status, pi.failure_reason, pi.amount_minor, pi.currency,
              pi.metadata, pi.updated_at, b.status as booking_status
       from payment_intents pi
       join bookings b on b.id = pi.booking_id
       where pi.status = 'captured' and pi.fulfilment_status <> 'done'
         and pi.updated_at < now() - interval '2 minutes'
       order by pi.updated_at asc
       limit 50`,
    );
    res.json({ stuck: rows });
  }),
);

/** Customer requests waiting on a person: changes, messages, support. */
bookingsRouter.get(
  "/requests/queue",
  wrap(async (_req, res) => {
    const { rows } = await pool.query(
      `select br.id, br.type, br.topic, br.message, br.contact_email, br.status, br.created_at,
              b.reference, b.status as booking_status, coalesce(b.contact_email, br.contact_email) as notify_email
       from booking_requests br
       left join bookings b on b.id = br.booking_id
       where br.status = 'received'
       order by br.created_at asc
       limit 100`,
    );
    res.json({ requests: rows });
  }),
);

/**
 * Answer a customer request.
 *
 * The reply is not sent from here: this service owns no mail credentials. It writes the
 * message to the shared outbox, which the payment worker renders and delivers. That keeps
 * one renderer, one sender, and one retry policy for every email in the product.
 */
bookingsRouter.post(
  "/requests/:id/resolve",
  requireRole("owner", "admin", "editor"),
  wrap(async (req, res) => {
    const body = z
      .object({ note: z.string().min(2).max(2000), kind: z.enum(["request.resolved"]).optional() })
      .parse(req.body ?? {});

    const found = await pool.query<{ id: string; reference: string | null; type: string; contact_email: string | null; status: string; notify_email: string | null }>(
      `select br.id, br.type, br.contact_email, br.status, b.reference, coalesce(b.contact_email, br.contact_email) as notify_email
       from booking_requests br left join bookings b on b.id = br.booking_id where br.id = $1`,
      [req.params.id],
    );
    const row = found.rows[0];
    if (!row) throw notFound("No such request.");
    if (row.status !== "received") throw badRequest(`This request is already ${row.status}.`);

    await pool.query(`update booking_requests set status = 'resolved' where id = $1`, [req.params.id]);

    let mailQueued = false;
    if (row.notify_email) {
      await pool.query(
        `insert into email_outbox (booking_id, reference, kind, to_email, payload, dedupe_key, status)
         values ((select booking_id from booking_requests where id = $1), $2, 'request.resolved', $3, $4::jsonb, $5, 'queued')
         on conflict (dedupe_key) do nothing`,
        [
          req.params.id,
          row.reference,
          row.notify_email,
          JSON.stringify({ reference: row.reference, reason: row.type, note: body.note, decidedBy: req.user?.email ?? null }),
          `request.resolved:${req.params.id}`,
        ],
      );
      mailQueued = true;
    }

    await audit(req, "request.resolved", "booking", row.reference ?? req.params.id, { requestId: req.params.id, mailQueued });
    res.json({ ok: true, mailQueued });
  }),
);
