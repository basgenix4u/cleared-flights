import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bookingView, getBookingRow } from "@/lib/booking-service";
import { authorizedRefs } from "@/lib/security";
import { emailsForBooking } from "@/lib/email-service";
import { EmailLog } from "@/components/trips/EmailLog";
import { fmtDateTimeUtc, fmtDay, fmtMoney } from "@/lib/format";
import { Details, Tone } from "@/components/results/FlightCard";
import { bagText, changeText, refundText } from "@/components/results/fare-text";
import { LookupForm } from "@/components/trips/LookupForm";
import { ManagePanel } from "@/components/trips/ManagePanel";
import { BeforeYouFly } from "@/components/trips/BeforeYouFly";
import { CopyButton } from "@/components/trips/CopyButton";
import { STATUS_COPY, StatusTracker } from "@/components/trips/StatusTracker";
import { IconArrow } from "@/components/ui/icons";
import { ModeBadge, Sign } from "@/components/ui/marks";
import { Banner } from "@/components/ui/ui";

export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TripPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { reference } = await params;
  const sp = await searchParams;
  const ref = reference.toUpperCase();
  const allowed = (await authorizedRefs()).includes(ref);
  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-14">
        <h1 className="text-[26px] font-bold tracking-[-0.03em]">Confirm it’s your trip</h1>
        <p className="mt-2 text-[14.5px] text-ink-3">For privacy we ask for a passenger surname before showing booking {ref}.</p>
        <div className="mt-6 rounded-md border-[1.5px] border-ink bg-card p-6"><LookupForm reference={ref} /></div>
      </div>
    );
  }
  const row = await getBookingRow(ref);
  if (!row) notFound();
  const b = await bookingView(row);
  const emails = await emailsForBooking(row.id).catch(() => []);
  const copy = STATUS_COPY[b.status];
  const cur = b.currency;
  const p = b.price as Record<string, number>;
  const firstDep = b.itinerary.slices[0].departLocal.slice(0, 10);
  const departed = firstDep < new Date().toISOString().slice(0, 10);
  const manageable = ["simulated", "confirmed", "ticketed"].includes(b.status) && !departed;
  const reason = b.status === "cancelled" ? "This booking is already cancelled." : departed ? "This trip has already started, so it can’t be changed online. Contact support if you need help." : "This booking can’t be changed yet.";
  const isNew = sp.new === "1";
  const operators = [...new Set(b.itinerary.slices.flatMap((s) => s.segments.map((g) => g.operatingCarrier.name)))];

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-20 pt-8 md:px-8">
      <header className="rise">
        <div className="flex flex-wrap items-center gap-3">
          <p className="eyebrow">{isNew ? "Booking recorded" : "Your booking"}</p>
          <ModeBadge mode={b.mode} />
        </div>
        <h1 className="mt-3 text-[clamp(1.8rem,3vw,2.6rem)] font-bold tracking-[-0.035em]">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-2">{copy.body}</p>
      </header>

      {isNew && b.mode !== "live" && (
        <Banner tone="warn" className="mt-6" title={b.mode === "demo" ? "This is not a real booking" : "Test-environment booking"}>
          {b.mode === "demo" ? "It was created in demo mode, so no airline holds a seat for you." : "Created in the provider’s sandbox; it doesn’t exist with a real airline."} Email confirmations aren’t connected in this build either; save this reference.
        </Banner>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          <section className="rounded-md border border-line-2 bg-card p-6" aria-label="Status">
            <StatusTracker status={b.status} />
            {b.ticketNumbers.length > 0 && (
              <div className="mt-6 border-t border-line pt-4">
                <p className="eyebrow">Ticket numbers</p>
                <ul className="mt-2 space-y-1 font-mono text-[14px]">{b.ticketNumbers.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            )}
            {b.status === "confirmed" && b.ticketNumbers.length === 0 && <p className="mt-5 border-t border-line pt-4 text-[13.5px] text-ink-2">Ticket numbers have not been issued yet. This is normal for a short period after booking; reload this page to check.</p>}
          </section>

          <section aria-labelledby="it-h">
            <h2 id="it-h" className="mb-4 flex flex-wrap items-center gap-3 text-[20px] font-semibold tracking-tight">
              Itinerary
              <span className="flex items-center gap-1.5">{b.itinerary.slices.map((s, i) => <span key={i} className="flex items-center gap-1.5"><Sign code={s.origin.code} size="sm" /><IconArrow width={13} height={13} className="text-ink-3" /><Sign code={s.destination.code} size="sm" /></span>)}</span>
            </h2>
            <div className="rounded-md border border-line-2 bg-card p-6">
              <Details it={b.itinerary} />
              <p className="mt-6 border-t border-line pt-4 text-[12.5px] text-ink-3">Operated by {operators.join(", ")}. Times are local to each airport. Arrive at the airport according to the airline’s check-in guidance.</p>
            </div>
          </section>

          <BeforeYouFly booking={b} />

          <section aria-labelledby="pax-h" className="rounded-md border border-line-2 bg-card p-6">
            <h2 id="pax-h" className="text-[18px] font-semibold tracking-tight">Passengers</h2>
            <ul className="mt-3 divide-y divide-line">
              {b.passengers.map((x, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-[14px]">
                  <span className="font-semibold">{x.title.toUpperCase()} {x.givenName} {x.familyName}</span>
                  <span className="text-ink-3 capitalize">{x.type}{x.passport ? ` · passport ${x.passport}` : ""}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-ink-3">{b.contactEmail} · {b.contactPhone}</p>
          </section>

          <section aria-labelledby="fr-h" className="rounded-md border border-line-2 bg-card p-6">
            <h2 id="fr-h" className="text-[18px] font-semibold tracking-tight">Fare rules · {b.fare.brand}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">{[bagText(b.fare), changeText(b.fare), refundText(b.fare)].map((r, i) => <li key={i}><Tone tone={r.tone}>{r.text}</Tone></li>)}</ul>
          </section>

          <section aria-labelledby="mail-h" className="no-print rounded-md border border-line-2 bg-card p-6">
            <h2 id="mail-h" className="text-[18px] font-semibold tracking-tight">Emails for this booking</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
              Exactly what we sent, and what happened to each message — including messages we could not deliver.
            </p>
            <EmailLog reference={b.reference} initial={emails.map((e) => ({
              id: e.id,
              kind: e.kind,
              status: e.status,
              failureReason: e.failureReason,
              createdAt: String(e.createdAt),
              sentAt: e.sentAt ? String(e.sentAt) : null,
            }))} />
          </section>

          <section aria-labelledby="ev-h">
            <h2 id="ev-h" className="mb-3 text-[18px] font-semibold tracking-tight">Activity</h2>
            <ol className="border-l-[1.5px] border-ink pl-5">
              {b.events.map((e, i) => (
                <li key={i} className="relative pb-4 last:pb-0">
                  <span aria-hidden className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-[1.5px] border-ink bg-card" />
                  <p className="text-[14px] font-semibold">{e.label}</p>
                  <p className="font-mono text-[11.5px] text-ink-3">{fmtDateTimeUtc(e.at)}{e.detail ? ` · ${e.detail}` : ""}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start" aria-label="Booking details">
          <div className="rounded-md border-[1.5px] border-ink bg-card p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
            <p className="eyebrow">Cleared reference</p>
            <div className="mt-1 flex items-center justify-between gap-3"><p className="font-mono text-[22px] font-medium tracking-wide">{b.reference}</p><CopyButton value={b.reference} label="Copy booking reference" /></div>
            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[13.5px]">
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Airline reference (PNR)</dt><dd className="font-mono">{b.pnr ?? (b.status === "simulated" ? "None (demo)" : "Pending")}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Payment</dt><dd className={b.paymentStatus === "simulated" ? "" : "capitalize"}>{b.paymentStatus === "simulated" ? "Simulated, nothing charged" : b.paymentStatus}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Booked</dt><dd>{fmtDateTimeUtc(b.createdAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Departs</dt><dd>{fmtDay(firstDep)}</dd></div>
            </dl>
            <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-[13.5px]">
              <div className="flex justify-between"><dt className="text-ink-2">Airline fare</dt><dd className="num font-mono">{fmtMoney(p.fare, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">Taxes &amp; surcharges</dt><dd className="num font-mono">{fmtMoney(p.taxes, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-2">Service fee</dt><dd className="num font-mono">{fmtMoney(p.serviceFee, cur)}</dd></div>
              {p.extras > 0 && <div className="flex justify-between"><dt className="text-ink-2">Extras</dt><dd className="num font-mono">{fmtMoney(p.extras, cur)}</dd></div>}
              <div className="flex items-end justify-between border-t-[1.5px] border-ink pt-3"><dt className="eyebrow">Total</dt><dd className="num code text-[30px] font-semibold">{fmtMoney(b.total, cur)}</dd></div>
              {b.refundAmount !== null && <div className="flex justify-between text-go"><dt>Refund{b.mode === "demo" ? " (simulated)" : ""}</dt><dd className="num font-mono">{fmtMoney(b.refundAmount, cur)}</dd></div>}
            </dl>
          </div>
          <div className="no-print rounded-md border border-line-2 bg-card p-5">
            <h2 className="mb-4 text-[16px] font-semibold tracking-tight">Manage booking</h2>
            <ManagePanel reference={b.reference} manageable={manageable} reason={reason} currency={cur} existing={b.requests} mode={b.mode} />
            <p className="mt-5 border-t border-line pt-4 text-[13px] text-ink-3">Need a person? <a className="font-semibold text-ink underline underline-offset-4" href="/help#contact">Contact support</a> and quote {b.reference}.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
