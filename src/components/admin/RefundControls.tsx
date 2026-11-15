"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Approve or decline a refund request. The decision is recorded; a worker executes it. */
export function RefundDecision({ id, reference, status, amountLabel }: { id: string; reference: string; status: string; amountLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: "approve" | "decline") => {
    setBusy(decision);
    setError(null);
    const res = await fetch(`/api/platform/admin/bookings/refunds/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const json = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) {
      setError(json?.error?.message ?? "That decision did not save.");
      return;
    }
    router.refresh();
  };

  if (status !== "requested") {
    return <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">{status}</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => decide("approve")}
        disabled={busy !== null}
        className="h-11 rounded-xs border border-ink bg-ink px-3 text-[12px] font-semibold text-paper hover:bg-ink-2 disabled:opacity-50 md:h-8"
      >
        {busy === "approve" ? "Approving…" : `Approve ${amountLabel}`}
      </button>
      <button
        type="button"
        onClick={() => decide("decline")}
        disabled={busy !== null}
        className="h-11 rounded-xs border border-line-2 px-3 text-[12px] font-semibold text-ink-2 hover:border-stop hover:text-stop disabled:opacity-50 md:h-8"
      >
        Decline
      </button>
      {error && <span role="alert" className="text-[11.5px] text-stop">{error}</span>}
      <span className="sr-only">{reference}</span>
    </div>
  );
}
