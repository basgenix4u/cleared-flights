"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Answer a customer request. The note becomes the email body, so it is written to a person,
 * not into a ticket system's internal log.
 */
export function ResolveRequest({ id, email }: { id: string; email: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    if (note.trim().length < 2) {
      setMsg("Write the reply the customer will read.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/platform/admin/bookings/requests/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note.trim() }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setMsg(json?.error?.message ?? "Could not save that reply.");
      return;
    }
    setMsg(json.mailQueued ? "Replied. The message is queued for delivery." : "Marked as resolved. No email address on file, so nothing was sent.");
    setNote("");
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="w-full sm:w-auto">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-11 rounded-xs border border-ink px-3 text-[12px] font-semibold hover:bg-ink hover:text-paper md:h-8"
        >
          Reply &amp; resolve
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={`Reply to ${email ? "the customer" : "the sender — no address on file"}: what actually happened, and what you did`}
            className="input w-full !text-[12.5px]"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="h-8 rounded-xs border border-ink bg-ink px-3 text-[12px] font-semibold text-paper disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send reply"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-xs border border-line-2 px-3 text-[12px] font-semibold text-ink-2">
              Cancel
            </button>
          </div>
        </div>
      )}
      {msg && <p role="status" className="mt-1.5 text-[11.5px] leading-relaxed text-ink-2">{msg}</p>}
    </div>
  );
}
