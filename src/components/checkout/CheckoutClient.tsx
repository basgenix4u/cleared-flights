"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Mode } from "@/lib/config";
import { fmtDay, fmtMoney, fmtDateTimeUtc, todayISO } from "@/lib/format";
import { round2 } from "@/lib/pricing";
import { contactSchema, passengerContextIssues, passengerSchema, travelContextOf } from "@/lib/schemas";
import type { Fare, FareExtras, Itinerary, PassengerInput, SearchQuery } from "@/lib/types";
import { bagText, changeText, refundText, Tone } from "@/components/results/FlightCard";
import { cn } from "@/components/ui/cn";
import { IconArrow, IconCheck, IconLock } from "@/components/ui/icons";
import { ModeBadge } from "@/components/ui/marks";
import { Sheet } from "@/components/ui/overlays";
import { Banner, Button, ButtonLink, EmptyState, Field, Skeleton } from "@/components/ui/ui";
import { ExtrasStep, selKey } from "./ExtrasStep";
import { emptyPax, PassengerForm, type PaxForm } from "./PassengerForm";
import { SummaryBody, type ExtraLine } from "./SummaryPanel";

interface Lookup {
  itinerary: Itinerary;
  fare: Fare;
  extras: FareExtras;
  previousTotal: number;
  changed: boolean;
  mode: Mode;
  query: SearchQuery;
  checkedAt: string;
  paymentsAvailable: boolean;
}
interface ApiErr {
  code: string;
  message: string;
  fields?: { path: string; message: string }[];
  retryable?: boolean;
  retryAfter?: number;
}
type Load = { status: "loading" } | { status: "ready"; data: Lookup } | { status: "error"; error: ApiErr };

const STEPS = ["Passengers", "Extras", "Review & pay"];
const normalizePhone = (s: string) => s.replace(/[\s\-().]/g, "");
const TYPE_LABEL = { adult: "Adult", child: "Child", infant: "Infant" };

export function CheckoutClient({ sessionId, offerId }: { sessionId: string; offerId: string }) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [accepted, setAccepted] = useState(true);
  const [step, setStep] = useState(0);
  const [pax, setPax] = useState<PaxForm[]>([]);
  const [contact, setContact] = useState({ email: "", phone: "" });
  const [sel, setSel] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState({ terms: false, names: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiErr | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const keyRef = useRef("");
  const top = useRef<HTMLDivElement>(null);

  const fetchOffer = useCallback(async (): Promise<Lookup> => {
    const r = await fetch(`/api/offers/${encodeURIComponent(offerId)}?session=${sessionId}`, { cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw j?.error ?? { code: "ERROR", message: "We couldn’t re-check this fare." };
    return j as Lookup;
  }, [offerId, sessionId]);

  useEffect(() => {
    let live = true;
    fetchOffer()
      .then((data) => {
        if (!live) return;
        setLoad({ status: "ready", data });
        setAccepted(!data.changed);
        setPax((p) => (p.length ? p : data.fare.passengerIds.map((x) => emptyPax(x.type))));
      })
      .catch((e) => live && setLoad({ status: "error", error: e?.message ? e : { code: "NETWORK", message: "We couldn’t reach the server. Check your connection and try again." } }));
    return () => {
      live = false;
    };
  }, [fetchOffer]);

  const d = load.status === "ready" ? load.data : null;
  const ctx = useMemo(() => (d ? travelContextOf(d.itinerary) : null), [d]);
  const names = pax.map((p, i) => (p.givenName ? `${p.givenName.trim().split(" ")[0]} ${p.familyName}`.trim() : `Passenger ${i + 1} · ${TYPE_LABEL[p.type]}`));

  const lines: ExtraLine[] = useMemo(() => {
    if (!d) return [];
    const byId = new Map(d.extras.options.map((o) => [o.id, o]));
    return Object.entries(sel).flatMap(([k, qty]) => {
      const [oid, p] = k.split("|");
      const o = byId.get(oid);
      return o ? [{ label: `${o.label}${qty > 1 ? ` × ${qty}` : ""}`, who: names[+p] ?? "", amount: round2(o.price * qty) }] : [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, sel, pax]);
  const extrasTotal = round2(lines.reduce((a, l) => a + l.amount, 0));
  const total = d ? round2(d.fare.price.total + extrasTotal) : 0;

  const scrollTop = () => top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const focusFirstError = () => requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());

  const validate = (): boolean => {
    if (!ctx) return false;
    const errs: Record<string, string> = {};
    pax.forEach((p, i) => {
      const r = passengerSchema.safeParse(p);
      if (!r.success)
        for (const is of r.error.issues) {
          const f = String(is.path[0]);
          if (!errs[`p${i}.${f}`]) errs[`p${i}.${f}`] = is.message;
        }
      for (const [k, v] of Object.entries(passengerContextIssues(p as unknown as PassengerInput, ctx))) if (!errs[`p${i}.${k}`]) errs[`p${i}.${k}`] = v;
    });
    const c = contactSchema.safeParse({ email: contact.email, phone: normalizePhone(contact.phone) });
    if (!c.success) for (const is of c.error.issues) errs[`contact.${String(is.path[0])}`] = is.message;
    setErrors(errs);
    if (Object.keys(errs).length) {
      focusFirstError();
      return false;
    }
    return true;
  };

  const recheck = async () => {
    setRechecking(true);
    try {
      const data = await fetchOffer();
      setLoad({ status: "ready", data });
      setAccepted(!data.changed);
    } catch (e) {
      setLoad({ status: "error", error: (e as ApiErr)?.message ? (e as ApiErr) : { code: "NETWORK", message: "We couldn’t re-check this fare." } });
    } finally {
      setRechecking(false);
    }
  };

  const go = (n: number) => {
    setStep(n);
    setSubmitError(null);
    scrollTop();
  };

  const submit = async () => {
    if (!d) return;
    if (!consent.terms || !consent.names) {
      setErrors((e) => ({ ...e, consent: "Please confirm both statements to continue." }));
      return;
    }
    setErrors((e) => {
      const { consent: _c, ...rest } = e;
      void _c;
      return rest;
    });
    setSubmitting(true);
    setSubmitError(null);
    if (!keyRef.current) keyRef.current = crypto.randomUUID();
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: keyRef.current,
          sessionId,
          offerId,
          acceptedTotal: total,
          contact: { email: contact.email.trim(), phone: normalizePhone(contact.phone) },
          passengers: pax.map((p) => ({ ...p, givenName: p.givenName.trim(), familyName: p.familyName.trim(), passportNumber: p.passportNumber.toUpperCase() })),
          extras: Object.entries(sel).map(([k, qty]) => ({ optionId: k.split("|")[0], passenger: +k.split("|")[1], qty })),
          consents: { terms: true, names: true },
        }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok) {
        if (j?.paymentRequired && j?.paymentToken) {
          // Nothing is reserved with the airline until the payment clears.
          router.push(`/checkout/pay?ref=${encodeURIComponent(j.reference)}&token=${encodeURIComponent(j.paymentToken)}`);
        } else {
          router.push(`/trips/${j.reference}?new=1`);
        }
        return; // stay in submitting state until navigation completes
      }
      const err: ApiErr = j?.error ?? { code: "ERROR", message: "Something went wrong. Nothing was charged." };
      if (err.code !== "IN_PROGRESS") keyRef.current = "";
      if (err.code === "PRICE_CHANGED") {
        await recheck();
        setSubmitError({ code: err.code, message: "The price changed while you were booking. Nothing was charged. Review the new total and confirm again." });
      } else if (err.fields?.length) {
        const m: Record<string, string> = {};
        for (const f of err.fields) {
          const mm = /^passengers\.(\d+)\.(\w+)$/.exec(f.path);
          if (mm) m[`p${mm[1]}.${mm[2]}`] = f.message;
          else if (f.path.startsWith("contact.")) m[f.path] = f.message;
        }
        setErrors(m);
        setSubmitError(err);
        setStep(0);
        scrollTop();
        focusFirstError();
      } else {
        setSubmitError(err);
      }
      setSubmitting(false);
    } catch {
      setSubmitError({ code: "NETWORK", message: "We couldn’t confirm whether your booking went through. Press confirm again: the request carries the same ID, so you can’t be charged twice." });
      setSubmitting(false);
    }
  };

  /* ---------- states ---------- */
  if (load.status === "loading")
    return (
      <div className="mx-auto max-w-[1320px] px-4 py-10 md:px-8" aria-busy>
        <p className="eyebrow mb-4">Re-checking your fare with the airline…</p>
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /><Skeleton className="h-40" /></div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );

  if (load.status === "error") {
    const gone = ["SESSION_EXPIRED", "FARE_EXPIRED", "OFFER_NOT_FOUND"].includes(load.error.code);
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState title={gone ? "This fare is no longer available" : "We couldn’t load your checkout"} actions={<>
          <Button variant="signal" onClick={() => router.back()}>Back to results</Button>
          {!gone && <Button variant="outline" onClick={() => location.reload()}>Try again</Button>}
          <ButtonLink href="/" variant="ghost">New search</ButtonLink>
        </>}>
          {load.error.message} {gone ? "Fares expire quickly; going back will run a fresh search. Nothing was charged." : ""}
        </EmptyState>
      </div>
    );
  }

  const { fare, itinerary, extras, mode } = load.data;
  const cur = fare.price.currency;
  const diff = round2(fare.price.total - load.data.previousTotal);
  const canPay = load.data.paymentsAvailable;

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-32 pt-6 md:px-8 lg:pb-16" ref={top}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => router.back()} className="text-[13.5px] font-semibold underline underline-offset-4">← Back to results</button>
        <ModeBadge mode={mode} />
      </div>
      <h1 className="mt-4 text-[clamp(1.6rem,2.6vw,2.2rem)] font-bold tracking-[-0.03em]">Complete your booking</h1>

      <ol className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Checkout progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <button type="button" disabled={i > step} onClick={() => go(i)} aria-current={i === step ? "step" : undefined} className={cn("flex items-center gap-2 rounded-sm border px-3 py-1.5 text-[13.5px] font-semibold transition-colors", i === step ? "border-ink bg-ink text-paper" : i < step ? "border-ink hover:bg-paper-2" : "border-line-2 text-ink-3")}>
              <span className={cn("grid h-5 w-5 place-items-center rounded-full font-mono text-[11px]", i < step ? "bg-go text-white" : i === step ? "bg-signal text-ink" : "border border-line-2")}>{i < step ? <IconCheck width={12} height={12} /> : i + 1}</span>
              {s}
            </button>
            {i < STEPS.length - 1 && <span className="hidden h-px w-6 bg-line-2 sm:block" aria-hidden />}
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11.5px] text-ink-3">
            <span className="inline-flex items-center gap-1.5 text-go"><IconCheck width={13} height={13} /> Fare re-checked {new Date(load.data.checkedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
            <span>Fare valid until {fmtDateTimeUtc(fare.expiresAt)}</span>
            <button type="button" onClick={recheck} disabled={rechecking} className="underline underline-offset-4 disabled:opacity-50">{rechecking ? "Checking…" : "Re-check price"}</button>
          </p>

          {mode !== "live" && (
            <Banner tone="info" title={mode === "demo" ? "Demo booking: nothing is charged and no ticket is issued" : "Test booking in the provider sandbox"}>
              {mode === "demo" ? "Fares and carriers are synthetic. Your booking is recorded so you can try managing it." : "The provider simulates the order. No real ticket is issued and no money moves."}
            </Banner>
          )}

          {!accepted && (
            <Banner
              tone={diff > 0 ? "warn" : "info"}
              title={diff > 0 ? `The fare went up by ${fmtMoney(diff, cur)}` : `The fare went down by ${fmtMoney(Math.abs(diff), cur)}`}
              action={<div className="flex flex-wrap gap-2"><Button size="sm" variant="primary" onClick={() => setAccepted(true)}>Accept {fmtMoney(fare.price.total, cur)}</Button><Button size="sm" variant="outline" onClick={() => router.back()}>Back</Button></div>}
            >
              It was {fmtMoney(load.data.previousTotal, cur)} when you searched and is {fmtMoney(fare.price.total, cur)} now. Airlines update prices continuously. You decide whether to continue.
            </Banner>
          )}

          {Object.keys(errors).filter((k) => k !== "consent").length > 0 && step === 0 && (
            <Banner tone="error" title="Please check the highlighted fields">Some details are missing or don’t look right. The names must match the travel documents exactly.</Banner>
          )}

          <fieldset disabled={!accepted} className={cn("min-w-0 space-y-6", !accepted && "opacity-50")}>
            {step === 0 && ctx && (
              <>
                <section aria-labelledby="pax-h" className="space-y-4">
                  <div>
                    <h2 id="pax-h" className="text-[20px] font-semibold tracking-tight">Who’s travelling?</h2>
                    <p className="text-[13.5px] text-ink-3">We only ask for what the airline and border authorities require{ctx.international ? ", including passport details because this trip is international" : ". No passport details needed for this domestic trip"}.</p>
                  </div>
                  {pax.map((p, i) => (
                    <PassengerForm key={i} index={i} value={p} onChange={(np) => { setPax((a) => a.map((x, j) => (j === i ? np : x))); }} errors={errors} international={ctx.international} lastDeparture={ctx.lastDeparture} today={todayISO()} />
                  ))}
                </section>
                <section aria-labelledby="contact-h" className="rounded-md border border-line-2 bg-card p-5">
                  <h2 id="contact-h" className="text-[16px] font-semibold tracking-tight">Contact details</h2>
                  <p className="text-[12.5px] text-ink-3">For your confirmation and any airline schedule change. No account is created.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Email" htmlFor="contact-email" error={errors["contact.email"]}>
                      <input id="contact-email" type="email" inputMode="email" autoComplete="email" className="input" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} aria-invalid={errors["contact.email"] ? true : undefined} aria-describedby={errors["contact.email"] ? "contact-email-err" : undefined} />
                    </Field>
                    <Field label="Mobile phone" htmlFor="contact-phone" error={errors["contact.phone"]} hint="With country code, e.g. +14155550123">
                      <input id="contact-phone" type="tel" inputMode="tel" autoComplete="tel" className="input" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} aria-invalid={errors["contact.phone"] ? true : undefined} aria-describedby={errors["contact.phone"] ? "contact-phone-err" : "contact-phone-hint"} />
                    </Field>
                  </div>
                </section>
                <div className="flex justify-end">
                  <Button variant="signal" size="lg" onClick={() => validate() && go(1)}>Continue to extras <IconArrow className="arrow" /></Button>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div><h2 className="text-[20px] font-semibold tracking-tight">Add extras</h2><p className="text-[13.5px] text-ink-3">Prices are added to your total. Skip anything you don’t need.</p></div>
                <ExtrasStep extras={extras} itinerary={itinerary} names={names} sel={sel} onChange={setSel} />
                <div className="flex flex-wrap justify-between gap-3">
                  <Button variant="outline" size="lg" onClick={() => go(0)}>Back</Button>
                  <Button variant="signal" size="lg" onClick={() => go(2)}>{extrasTotal ? `Review · ${fmtMoney(total, cur)}` : "Continue without extras"} <IconArrow className="arrow" /></Button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-[20px] font-semibold tracking-tight">Review and pay</h2>

                <section className="rounded-md border border-line-2 bg-card p-5" aria-labelledby="rv-pax">
                  <div className="flex items-center justify-between"><h3 id="rv-pax" className="text-[15px] font-semibold">Passengers</h3><button type="button" onClick={() => go(0)} className="text-[13px] font-semibold underline underline-offset-4">Edit</button></div>
                  <ul className="mt-3 divide-y divide-line">
                    {pax.map((p, i) => (
                      <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-[14px]">
                        <span className="font-semibold">{p.title.toUpperCase()} {p.givenName} {p.familyName}</span>
                        <span className="text-ink-3">{TYPE_LABEL[p.type]} · born {fmtDay(p.bornOn, "short")} {p.bornOn.slice(0, 4)}{p.passportNumber ? ` · passport •••• ${p.passportNumber.slice(-3)}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[13px] text-ink-3">{contact.email} · {normalizePhone(contact.phone)}</p>
                </section>

                <section className="rounded-md border border-line-2 bg-card p-5" aria-labelledby="rv-rules">
                  <h3 id="rv-rules" className="text-[15px] font-semibold">Fare rules for {fare.brand}</h3>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                    {[bagText(fare), changeText(fare), refundText(fare)].map((r, i) => <li key={i}><Tone tone={r.tone}>{r.text}</Tone></li>)}
                  </ul>
                  <p className="mt-3 text-[12.5px] text-ink-3">Our service fee ({fmtMoney(fare.price.serviceFee, cur)}) is non-refundable. Airline rules are as supplied by the airline.</p>
                </section>

                <div className="lg:hidden rounded-md border border-ink bg-card p-5"><SummaryBody itinerary={itinerary} fare={fare} extras={lines} extrasTotal={extrasTotal} total={total} /></div>

                <section className="rounded-md border border-line-2 bg-card p-5" aria-labelledby="rv-pay">
                  <h3 id="rv-pay" className="flex items-center gap-2 text-[15px] font-semibold"><IconLock width={16} height={16} /> Payment</h3>
                  {canPay ? (
                    <div className="mt-3 space-y-2">
                      <label className="flex items-start gap-3 rounded-sm border border-ink bg-signal-soft p-4">
                        <input type="radio" checked readOnly className="mt-1" />
                        <span>
                          <span className="block text-[14.5px] font-semibold">Card, on the provider&apos;s secure page</span>
                          <span className="block text-[13px] text-ink-2">
                            You will be sent to a hosted checkout to pay {fmtMoney(total, cur)}. Your card details never touch this site.
                            The airline reservation is only made once the payment is confirmed.
                          </span>
                        </span>
                      </label>
                      <p className="text-[12px] text-ink-3">
                        Nothing is charged until you confirm on the next screen. If the payment fails, the booking stays unpaid and expires automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3"><Banner tone="error" title="Card payments aren’t enabled on this deployment">We can’t take a real booking yet because no payment provider is connected, and we won’t pretend to charge a card.</Banner></div>
                  )}
                </section>

                <section className="space-y-3" aria-label="Confirmations">
                  <label className="flex cursor-pointer items-start gap-3 text-[14px]"><input type="checkbox" className="mt-1 h-4 w-4" checked={consent.terms} onChange={(e) => setConsent({ ...consent, terms: e.target.checked })} /><span>I accept the <Link className="font-semibold underline underline-offset-4" href="/help#terms" target="_blank">terms of service</Link>, <Link className="font-semibold underline underline-offset-4" href="/help#privacy" target="_blank">privacy policy</Link> and the fare rules shown above.</span></label>
                  <label className="flex cursor-pointer items-start gap-3 text-[14px]"><input type="checkbox" className="mt-1 h-4 w-4" checked={consent.names} onChange={(e) => setConsent({ ...consent, names: e.target.checked })} /><span>Every name matches the traveller’s passport or ID exactly. I understand corrections after booking can cost money or be impossible.</span></label>
                  {errors.consent && <p role="alert" className="text-[13px] font-medium text-stop">{errors.consent}</p>}
                </section>

                {submitError && (
                  <Banner tone="error" title={submitError.code === "PRICE_CHANGED" ? "Price changed" : submitError.code === "NETWORK" ? "Connection problem" : "We couldn’t complete the booking"}
                    action={submitError.code === "FARE_EXPIRED" || submitError.code === "SESSION_EXPIRED" ? <Button size="sm" variant="outline" onClick={() => router.back()}>Back to results</Button> : undefined}>
                    {submitError.message}{submitError.retryAfter ? ` Try again in ${submitError.retryAfter}s.` : ""}
                  </Banner>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button variant="outline" size="lg" onClick={() => go(1)} disabled={submitting}>Back</Button>
                  <Button variant="signal" size="lg" loading={submitting} disabled={!canPay || !accepted} onClick={submit} className="min-w-[260px]">
                    {submitting ? "Checking…" : canPay ? `Continue to payment · ${fmtMoney(total, cur)}` : "Booking unavailable"}
                  </Button>
                </div>
                <p className="text-[12.5px] text-ink-3">
                  Your booking is created as <strong>pending payment</strong>, then becomes reserved or ticketed once the airline confirms it — exactly as the airline reports it.
                </p>
              </>
            )}
          </fieldset>
        </div>

        <aside className="hidden lg:block" aria-label="Booking summary">
          <div className="sticky top-24 rounded-md border-[1.5px] border-ink bg-card p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
            <p className="eyebrow mb-4">Your trip</p>
            <SummaryBody itinerary={itinerary} fare={fare} extras={lines} extrasTotal={extrasTotal} total={total} />
          </div>
        </aside>
      </div>

      {/* Mobile total bar */}
      <div className="fixed inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-ink bg-paper px-4 py-3 lg:hidden" style={{ zIndex: "var(--z-nav)" }}>
        <div><p className="eyebrow">Total</p><p className="num code text-[26px] font-semibold">{fmtMoney(total, cur)}</p></div>
        <Button variant="outline" size="sm" onClick={() => setSummaryOpen(true)}>Price details</Button>
      </div>
      <Sheet open={summaryOpen} onClose={() => setSummaryOpen(false)} title="Your trip" side="responsive">
        <div className="p-5"><SummaryBody itinerary={itinerary} fare={fare} extras={lines} extrasTotal={extrasTotal} total={total} /></div>
      </Sheet>
    </div>
  );
}
