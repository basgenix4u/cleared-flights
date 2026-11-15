"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/ui";

/**
 * Opens the provider checkout.
 *
 * For a real provider we hand the browser to its hosted page. For the mock provider we
 * call it in-process, which posts a *signed* webhook back to ourselves — the same path a
 * real provider takes, so the state machine is genuinely exercised.
 */
export function PayNow({
  reference,
  token,
  amountLabel,
  providerLabel,
  isMock,
}: {
  reference: string;
  token: string;
  amountLabel: string;
  providerLabel: string;
  isMock: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, token }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message ?? "Could not open the payment. Nothing was charged.");
        setBusy(false);
        return;
      }

      if (json.provider === "mock") {
        const sim = await fetch(`/api/payments/${encodeURIComponent(reference)}/mock-pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const out = await sim.json().catch(() => null);
        if (!sim.ok) {
          setError(out?.error?.message ?? "The test payment failed.");
          setBusy(false);
          return;
        }
        router.push(`/checkout/pay/callback?ref=${encodeURIComponent(reference)}`);
        return;
      }

      if (typeof json.redirectUrl === "string" && /^https?:\/\//.test(json.redirectUrl)) {
        window.location.href = json.redirectUrl;
        return;
      }
      // Local mock URL (no external host): go through our own callback.
      router.push(`/checkout/pay/callback?ref=${encodeURIComponent(reference)}`);
    } catch {
      setError("Network error. Nothing was charged.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-sm border border-[#e0a49f] bg-stop-bg px-3 py-2 text-[13px] text-[#7d1a14]">{error}</p>
      )}
      <Button variant="signal" size="lg" loading={busy} onClick={pay} className="w-full">
        {busy ? "Opening secure checkout…" : `Pay ${amountLabel} with ${providerLabel}`}
      </Button>
      {isMock && (
        <p className="rounded-sm border border-[#d6b24a] bg-warn-bg px-3 py-2 text-[12px] leading-relaxed text-warn">
          Test mode: no card is requested and no money moves. The payment still travels through the real
          signed-webhook path so the booking state machine behaves exactly as it would in production.
        </p>
      )}
    </div>
  );
}
