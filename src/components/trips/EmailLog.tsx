"use client";

import { useState } from "react";

export interface EmailRow {
  id: string;
  kind: string;
  status: string;
  failureReason: string | null;
  createdAt: string;
  sentAt: string | null;
}

const LABEL: Record<string, string> = {
  "booking.received": "Booking received",
  "booking.ticketing_pending": "Payment received — ticket pending",
  "booking.ticketed": "Ticket issued",
  "booking.cancelled": "Booking cancelled",
  "booking.expired": "Held itinerary released",
  "refund.approved": "Refund approved",
  "refund.executed": "Refund confirmed",
  "request.received": "Request received",
  "request.resolved": "Reply to your request",
  "ops.paid_not_ticketed": "Internal operations alert",
};

const TONE: Record<string, string> = {
  sent: "border-[#9cc9b0] bg-go-bg text-go",
  queued: "border-[#d6b24a] bg-warn-bg text-warn",
  failed: "border-[#e0a49f] bg-stop-bg text-stop",
  skipped: "border-line-2 bg-paper-2 text-ink-3",
};

const WHY: Record<string, string> = {
  no_email_provider: "No mail provider is configured on this deployment, so this was recorded and not delivered.",
  unknown_template: "We no longer have a template for this message.",
};

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * The customer's mail record. Deliberately shows "not delivered" states too: a booking page
 * that claims an email was sent when it was not is exactly the kind of small lie this product
 * exists to avoid.
 */
export function EmailLog({ reference, initial }: { reference: string; initial: EmailRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resend = async (id: string) => {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/trips/${reference}/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Could not resend that message.");
      return;
    }
    const refreshed = await fetch(`/api/trips/${reference}/emails`).then((r) => r.json()).catch(() => null);
    if (refreshed?.emails) {
      setRows(
        refreshed.emails.map((e: { id: string; kind: string; status: string; failureReason: string | null; createdAt: string; sentAt: string | null }) => ({
          id: e.id,
          kind: e.kind,
          status: e.status,
          failureReason: e.failureReason,
          createdAt: e.createdAt,
          sentAt: e.sentAt,
        })),
      );
    }
  };

  if (rows.length === 0) {
    return <p className="mt-3 text-[13.5px] text-ink-3">No messages on file yet for this booking.</p>;
  }

  return (
    <div className="mt-4">
      <ul className="divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium">{LABEL[r.kind] ?? r.kind}</p>
              <p className="font-mono text-[11px] text-ink-3">
                {r.sentAt ? `sent ${when(r.sentAt)}` : `queued ${when(r.createdAt)}`}
                {r.failureReason ? ` · ${WHY[r.failureReason] ?? r.failureReason}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-xs border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] ${TONE[r.status] ?? "border-line-2"}`}>
                {r.status === "skipped" ? "not sent" : r.status}
              </span>
              {r.status !== "sent" && (
                <button
                  type="button"
                  onClick={() => resend(r.id)}
                  disabled={busy === r.id}
                  className="h-7 rounded-xs border border-line-2 px-2 text-[11.5px] font-semibold text-ink-2 hover:border-ink hover:text-ink disabled:opacity-50"
                >
                  {busy === r.id ? "Trying…" : "Retry"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-[12px] text-stop">{error}</p>}
    </div>
  );
}
