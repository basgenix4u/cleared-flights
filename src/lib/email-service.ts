import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, emailOutbox } from "@/db/schema";
import { emailConfigured, emailProvider, opsAddress } from "@/lib/email";
import { renderEmail } from "@/lib/email/templates";
import type { EmailPayload } from "@/lib/email/types";
import { log } from "@/lib/security";

const MAX_ATTEMPTS = 5;

export type EmailKind = keyof typeof import("./email/templates").templates | string;

/**
 * Queue a message. Nothing is sent here.
 *
 * The dedupe key is the idempotency guarantee: a webhook retried four times still produces
 * one booking confirmation, because the fourth insert hits the unique index and is skipped.
 */
export async function queueEmail(input: {
  kind: string;
  to: string | null | undefined;
  payload: EmailPayload;
  dedupeKey: string;
  bookingId?: string | null;
  reference?: string | null;
}): Promise<void> {
  if (!input.to) {
    log("warn", "email.no_recipient", { kind: input.kind, reference: input.reference ?? null });
    return;
  }
  try {
    await db
      .insert(emailOutbox)
      .values({
        kind: input.kind,
        toEmail: input.to,
        payload: input.payload as Record<string, unknown>,
        dedupeKey: input.dedupeKey,
        bookingId: input.bookingId ?? null,
        reference: input.reference ?? null,
        status: "queued",
      })
      .onConflictDoNothing({ target: emailOutbox.dedupeKey });
  } catch (error) {
    // Mail must never break the money path. A lost queue row is visible on the trip page
    // and recoverable; a thrown error inside a webhook handler is not.
    log("error", "email.queue_failed", { kind: input.kind, error: (error as Error).message });
  }
}

/** Deliver one queued row. Marks `sent`, `failed` (retryable) or `skipped` (no provider). */
async function deliverRow(row: typeof emailOutbox.$inferSelect): Promise<"sent" | "failed" | "skipped"> {
  const provider = emailProvider();
  if (provider.id === "none") {
    await db
      .update(emailOutbox)
      .set({ status: "skipped", failureReason: "no_email_provider" })
      .where(eq(emailOutbox.id, row.id));
    return "skipped";
  }

  const rendered = renderEmail(row.kind, row.payload as EmailPayload);
  if (!rendered) {
    await db.update(emailOutbox).set({ status: "failed", failureReason: "unknown_template" }).where(eq(emailOutbox.id, row.id));
    return "failed";
  }

  const result = await provider
    .send({ to: row.toEmail, ...rendered, tag: row.kind })
    .catch((error: Error) => ({ ok: false as const, error: error.message }));
  const attempts = row.attempts + 1;

  if (result.ok) {
    await db
      .update(emailOutbox)
      .set({ status: "sent", provider: provider.id, providerRef: result.id ?? null, attempts, sentAt: new Date(), failureReason: null })
      .where(eq(emailOutbox.id, row.id));
    return "sent";
  }

  await db
    .update(emailOutbox)
    .set({
      status: attempts >= MAX_ATTEMPTS ? "failed" : "queued",
      provider: provider.id,
      attempts,
      failureReason: result.error ?? "send_failed",
    })
    .where(eq(emailOutbox.id, row.id));
  return "failed";
}

/**
 * Drain the outbox. Called by the cron and eagerly after queueing on the request path, so a
 * customer normally gets their mail within the same second rather than at the next tick.
 */
export async function deliverOutbox(limit = 25): Promise<{ sent: number; failed: number; skipped: number }> {
  const rows = await db
    .select()
    .from(emailOutbox)
    .where(and(eq(emailOutbox.status, "queued"), lt(emailOutbox.attempts, MAX_ATTEMPTS)))
    .orderBy(emailOutbox.createdAt)
    .limit(limit);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of rows) {
    const outcome = await deliverRow(row);
    if (outcome === "sent") sent += 1;
    else if (outcome === "failed") failed += 1;
    else skipped += 1;
  }
  if (sent || failed) log("info", "email.delivered", { sent, failed, skipped });
  return { sent, failed, skipped };
}

/** Queue and try to deliver immediately. Safe to call from any handler; never throws. */
export async function sendEmail(input: Parameters<typeof queueEmail>[0]): Promise<void> {
  await queueEmail(input);
  try {
    await deliverOutbox(5);
  } catch (error) {
    log("error", "email.deliver_failed", { error: (error as Error).message });
  }
}

/** Mail a customer's booking history shows them, newest first. */
export async function emailsForBooking(bookingId: string) {
  return db.select().from(emailOutbox).where(eq(emailOutbox.bookingId, bookingId)).orderBy(sql`${emailOutbox.createdAt} desc`).limit(50);
}

/** Re-queue a previously skipped or failed message — used by the desk and the trip page. */
export async function retryEmail(id: string): Promise<boolean> {
  const [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, id)).limit(1);
  if (!row || row.status === "sent") return false;
  await db.update(emailOutbox).set({ status: "queued", attempts: 0, failureReason: null }).where(eq(emailOutbox.id, id));
  await deliverOutbox(3);
  return true;
}

/** Alert the operations inbox. Skipped entirely, never rerouted, when OPS_EMAIL is unset. */
export async function alertOps(kind: string, payload: EmailPayload, dedupeKey: string, bookingId?: string | null, reference?: string | null) {
  const to = opsAddress();
  if (!to) return;
  await sendEmail({ kind, to, payload, dedupeKey, bookingId, reference });
}

/** Convenience for templates: the human amount string used in every email. */
export function money(amount: number | string, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount));
}

export { emailConfigured };

/** Count of undelivered mail — surfaced on the desk so silence is never mistaken for success. */
export async function outboxHealth() {
  const rows = await db
    .select({ status: emailOutbox.status, n: sql<number>`count(*)::int` })
    .from(emailOutbox)
    .where(inArray(emailOutbox.status, ["queued", "failed", "skipped", "sent"]))
    .groupBy(emailOutbox.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}
