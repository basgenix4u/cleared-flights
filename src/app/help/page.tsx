import type { Metadata } from "next";
import Link from "next/link";
import { FaqList } from "@/components/home/Interactive";
import { SupportForm } from "@/components/help/SupportForm";
import { BRAND } from "@/lib/config";

export const metadata: Metadata = {
  title: "Help centre",
  description: "Baggage, changes and refunds, documents, payments, fees and how booking status works.",
};

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  { id: "status", title: "How booking status works", body: <><p>A booking passes through up to three states. <strong>Requested</strong>: we hold your order. <strong>Reserved</strong>: the airline has created a reservation and a booking reference (PNR). <strong>Ticketed</strong>: ticket numbers have been issued.</p><p>We only show “Ticketed” when ticket numbers exist, and only show an airline reference when the airline has issued one. In demo mode a booking is labelled <strong>Simulated</strong> and none of these happen.</p></> },
  { id: "baggage", title: "Baggage", body: <><p>Allowances are set by the airline and the fare, so two fares on the same flight can differ. We show the cabin bag and checked bag for every fare as the airline supplied them. If the airline didn’t say, we show “not stated”.</p><p>Extra bags are offered in checkout when the provider supports them. Prices for bags added at the airport are usually higher.</p></> },
  { id: "refunds", title: "Changes and refunds", body: <><p>Rules depend on the fare: some are refundable, some allow changes for a fee, and some allow neither. They appear on the fare, in checkout and on your booking page.</p><p>To cancel, open your booking and choose “Cancel booking…”. You’ll see the refund amount first and nothing happens until you confirm. Our service fee is non-refundable. Change requests are reviewed by support; the fare rules decide the cost.</p></> },
  { id: "documents", title: "Passports and visas", body: <><p>We ask for passport details only when a trip crosses a border, because border authorities and airlines need them before travel. Names must match the document exactly.</p><p>Entry rules (visas, passport validity, transit requirements) are set by governments and change. Check the official guidance for every country on your route; many require at least six months’ passport validity.</p></> },
  { id: "payments", title: "Payments", body: <><p>We never store card numbers. Card entry is intended to be handled by a hosted payment provider. In this build checkout is a clearly labelled simulation and nothing is charged. A live deployment will not accept bookings until a payment provider is connected.</p></> },
  { id: "fees", title: "Fees and pricing", body: <><p>The price on a result includes the airline fare, taxes, carrier-imposed surcharges and the Cleared service fee ({`$5.00 per paying traveller by default`}). Infants on a lap don’t pay our fee. Extras are optional and separate.</p></> },
  { id: "privacy", title: "Privacy and your data", body: <><p>We collect what a booking needs: names, dates of birth, contact details and, for international trips, passport details. Passport and phone data are encrypted at rest and shown masked. Access to a booking requires its reference and a passenger surname.</p><p>Searches are stored briefly (30 minutes) so we can re-check the exact fare you chose.</p></> },
  { id: "terms", title: "Terms of service (summary)", body: <><p>You contract with the airline for carriage; its conditions of carriage apply. Cleared arranges the booking and charges the stated service fee. Fares can change until booked and we re-check the price before you pay.</p><p><em>These are summary terms for this build. The operating entity must supply final legal terms before launch.</em></p></> },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-10 pt-12 md:px-8">
      <p className="eyebrow">Help centre</p>
      <h1 className="mt-3 text-[clamp(1.9rem,3.4vw,2.9rem)] font-bold leading-[1.06] tracking-[-0.035em]">Plain answers, before and after you book.</h1>
      <p className="mt-4 max-w-xl text-[16px] text-ink-2">Looking for a booking? <Link href="/trips" className="font-semibold text-ink underline underline-offset-4">Find your trip</Link> with a reference and surname.</p>

      <div className="mt-12 grid gap-12 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Help topics" className="hidden lg:block">
          <ul className="sticky top-28 space-y-1 border-l border-line">
            {[...SECTIONS.map((s) => [s.id, s.title]), ["faq", "Common questions"], ["contact", "Contact us"]].map(([id, t]) => (
              <li key={id}><a href={`#${id}`} className="-ml-px block border-l-2 border-transparent px-4 py-1.5 text-[13.5px] text-ink-2 hover:border-ink hover:text-ink">{t}</a></li>
            ))}
          </ul>
        </nav>
        <div className="space-y-14">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-28">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{s.title}</h2>
              <div className="mt-3 max-w-[68ch] space-y-3 text-[15px] leading-relaxed text-ink-2">{s.body}</div>
            </section>
          ))}
          <section id="faq" className="scroll-mt-28">
            <h2 className="mb-5 text-[22px] font-semibold tracking-[-0.02em]">Common questions</h2>
            <FaqList />
          </section>
          <section id="contact" className="scroll-mt-28">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Contact us</h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-3">
              {BRAND.supportEmail && <a className="underline underline-offset-4" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>}
              {BRAND.supportPhone && <a className="underline underline-offset-4" href={`tel:${BRAND.supportPhone.replace(/[^\d+]/g, "")}`}>{BRAND.supportPhone}</a>}
              {BRAND.whatsapp && <a className="underline underline-offset-4" href={`https://wa.me/${BRAND.whatsapp}`} rel="noopener noreferrer" target="_blank">WhatsApp</a>}
            </p>
            <div className="mt-5 max-w-2xl rounded-md border-[1.5px] border-ink bg-card p-6"><SupportForm /></div>
          </section>
        </div>
      </div>
    </div>
  );
}
