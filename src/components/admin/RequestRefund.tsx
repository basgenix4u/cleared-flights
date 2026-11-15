"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Raise a refund. Anyone on the desk can ask; only an owner or admin can approve. */
export function RequestRefund({ reference, maxLabel, disabled }: { reference: string; maxLabel: string; disabled: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const submit = async () => {
    if (reason.trim().length < 3) {
      setMsg({ kind: "err", text: "Give a reason of at least 3 characters." });
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/platform/admin/bookings/${encodeURIComponent(reference)}/refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setMsg({ kind: "err", text: json?.error?.message ?? "Could not raise the refund." });
      return;
    }
    setMsg({ kind: "ok", text: "Refund requested. It needs approval before any money moves." });
    setReason("");
    router.refresh();
  };

  if (disabled) {
    return (
      <p className="rounded-sm border border-line-2 bg-paper-2/60 px-3 py-2 text-[12.5px] leading-relaxed text-ink-2">
        There is no captured payment on this booking, so there is nothing to refund through the provider. Refund any
        airline-side amount once the airline settles.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={`Reason, e.g. "customer cancelled, airline refunded in full"`}
        className="input !h-11 md:!h-9 w-full !text-[12.5px]"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] text-ink-3">Up to {maxLabel} · requires a second approval</p>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="h-8 rounded-xs border border-ink px-3 text-[12px] font-semibold hover:bg-ink hover:text-paper disabled:opacity-50"
        >
          {busy ? "Requesting…" : "Request refund"}
        </button>
      </div>
      {msg && (
        <p role="status" className={`rounded-sm border px-3 py-2 text-[12px] ${msg.kind === "ok" ? "border-[#9cc9b0] bg-go-bg text-go" : "border-[#e0a49f] bg-stop-bg text-[#7d1a14]"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
