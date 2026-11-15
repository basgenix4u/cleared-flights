"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banner, Button, Field } from "@/components/ui/ui";

export function LookupForm({ reference = "", note }: { reference?: string; note?: string }) {
  const router = useRouter();
  const [ref, setRef] = useState(reference);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ ref?: string; name?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fe: typeof fieldErr = {};
    if (!/^CLR-[A-Za-z0-9]{6}$/.test(ref.trim())) fe.ref = "References look like CLR-7K3M9Q";
    if (!name.trim()) fe.name = "Enter a passenger surname";
    setFieldErr(fe);
    setErr(null);
    if (fe.ref || fe.name) return;
    setBusy(true);
    try {
      const r = await fetch("/api/trips/retrieve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: ref.trim(), lastName: name.trim() }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setErr(j?.error?.message ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      router.push(`/trips/${j.reference}`);
      router.refresh();
    } catch {
      setErr("We couldn’t reach the server. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Retrieve a booking">
      {note && <p className="text-[14px] text-ink-2">{note}</p>}
      {err && <Banner tone="error">{err}</Banner>}
      <Field label="Booking reference" htmlFor="lk-ref" error={fieldErr.ref} hint="Starts with CLR-, on your booking page">
        <input id="lk-ref" className="input font-mono uppercase" value={ref} onChange={(e) => setRef(e.target.value)} autoComplete="off" spellCheck={false} aria-invalid={fieldErr.ref ? true : undefined} aria-describedby={fieldErr.ref ? "lk-ref-err" : "lk-ref-hint"} placeholder="CLR-7K3M9Q" />
      </Field>
      <Field label="Passenger surname" htmlFor="lk-name" error={fieldErr.name} hint="Any passenger on the booking, as entered at checkout">
        <input id="lk-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="family-name" aria-invalid={fieldErr.name ? true : undefined} aria-describedby={fieldErr.name ? "lk-name-err" : "lk-name-hint"} />
      </Field>
      <Button type="submit" variant="signal" size="lg" loading={busy} className="w-full sm:w-auto">Find my trip</Button>
    </form>
  );
}
