"use client";

import { useState } from "react";
import { IconCheck } from "@/components/ui/icons";
import { Banner, Button, Field } from "@/components/ui/ui";

const TOPICS = [["booking", "A booking"], ["baggage", "Baggage"], ["refund", "A refund"], ["change", "Changing a flight"], ["payment", "Payment"], ["other", "Something else"]];

export function SupportForm() {
  const [v, setV] = useState({ reference: "", email: "", topic: "booking", message: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [fail, setFail] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(v.email)) er.email = "Enter a valid email address";
    if (v.message.trim().length < 10) er.message = "Tell us a little more (at least a sentence)";
    if (v.reference && !/^CLR-[A-Za-z0-9]{6}$/.test(v.reference.trim())) er.reference = "References look like CLR-7K3M9Q";
    setErrs(er);
    setFail(null);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const r = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...v, reference: v.reference.trim() || undefined }) });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error?.message ?? "Something went wrong");
      setDone(true);
    } catch (e2) {
      setFail((e2 as Error).message);
    }
    setBusy(false);
  };

  if (done)
    return <Banner tone="success" title="Message recorded"><span className="flex items-center gap-1.5"><IconCheck width={14} height={14} /> It’s stored with your details. Email replies aren’t connected in this build, so a reply won’t arrive automatically.</span></Banner>;

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Contact support">
      {fail && <Banner tone="error">{fail}</Banner>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your email" htmlFor="sp-email" error={errs.email}><input id="sp-email" type="email" autoComplete="email" className="input" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} aria-invalid={errs.email ? true : undefined} aria-describedby={errs.email ? "sp-email-err" : undefined} /></Field>
        <Field label="Booking reference (optional)" htmlFor="sp-ref" error={errs.reference}><input id="sp-ref" className="input font-mono uppercase" placeholder="CLR-7K3M9Q" value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} aria-invalid={errs.reference ? true : undefined} aria-describedby={errs.reference ? "sp-ref-err" : undefined} /></Field>
      </div>
      <Field label="Topic" htmlFor="sp-topic"><select id="sp-topic" className="input" value={v.topic} onChange={(e) => setV({ ...v, topic: e.target.value })}>{TOPICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      <Field label="How can we help?" htmlFor="sp-msg" error={errs.message}><textarea id="sp-msg" rows={5} className="input !h-auto py-2.5" value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} aria-invalid={errs.message ? true : undefined} aria-describedby={errs.message ? "sp-msg-err" : undefined} /></Field>
      <Button type="submit" variant="primary" size="lg" loading={busy}>Send message</Button>
    </form>
  );
}
