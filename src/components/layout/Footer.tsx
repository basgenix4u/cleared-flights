import Link from "next/link";
import { BRAND, MODE_COPY, providerMode } from "@/lib/config";
import { Logo } from "@/components/ui/marks";

const COLS: { title: string; links: [string, string][] }[] = [
  {
    title: "Flights",
    links: [
      ["Search flights", "/#search"],
      ["Fare calendar", "/deals"],
      ["Explore destinations", "/explore"],
      ["Multi-city trips", "/#search"],
    ],
  },
  {
    title: "Destinations",
    links: [
      ["Lisbon", "/?from=LON&to=LIS#search"],
      ["Tokyo", "/?from=SFO&to=TYO#search"],
      ["Mexico City", "/?from=NYC&to=MEX#search"],
      ["Cape Town", "/?from=AMS&to=CPT#search"],
    ],
  },
  {
    title: "Travel information",
    links: [
      ["Baggage", "/help#baggage"],
      ["Changes & refunds", "/help#refunds"],
      ["Passport & visas", "/help#documents"],
      ["How booking status works", "/help#status"],
    ],
  },
  {
    title: "Company",
    links: [
      ["Journal", "/blog"],
      ["How we price", "/help#status"],
      ["Sign in to the desk", "/admin"],
      ["Contact us", "/help#contact"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Help centre", "/help"],
      ["Manage a booking", "/trips"],
      ["Contact us", "/help#contact"],
      ["Payments", "/help#payments"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Terms of service", "/help#terms"],
      ["Privacy & your data", "/help#privacy"],
      ["Fees & pricing", "/help#fees"],
    ],
  },
];

export function Footer() {
  const mode = providerMode();
  return (
    <footer className="no-print on-dark mt-12 bg-ink pb-[calc(var(--tabbar-total)+8px)] text-paper md:mt-20 lg:pb-0">
      <div className="hazard h-2" aria-hidden />
      <div className="mx-auto max-w-[1320px] px-4 py-14 md:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_3fr]">
          <div>
            <Logo inverted />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-paper/70">
              A booking instrument for flights. Prices include taxes and fees from the first result, and your booking status always says what is actually true.
            </p>
            <dl className="mt-6 space-y-1 font-mono text-[12px] text-paper/70">
              {BRAND.supportEmail && <div className="flex gap-2"><dt className="text-paper/45">Email</dt><dd><a className="underline-offset-4 hover:text-signal hover:underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a></dd></div>}
              {BRAND.supportPhone && <div className="flex gap-2"><dt className="text-paper/45">Phone</dt><dd><a className="underline-offset-4 hover:text-signal hover:underline" href={`tel:${BRAND.supportPhone.replace(/[^\d+]/g, "")}`}>{BRAND.supportPhone}</a></dd></div>}
              {BRAND.whatsapp && <div className="flex gap-2"><dt className="text-paper/45">WhatsApp</dt><dd><a className="underline-offset-4 hover:text-signal hover:underline" href={`https://wa.me/${BRAND.whatsapp}`} rel="noopener noreferrer" target="_blank">Message us</a></dd></div>}
            </dl>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {COLS.map((c) => (
              <div key={c.title}>
                <h2 className="eyebrow !text-paper/50">{c.title}</h2>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map(([label, href]) => (
                    <li key={label}>
                      <Link href={href} className="text-[14px] text-paper/85 underline-offset-4 hover:text-signal hover:underline">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-paper/15 pt-6 text-[12.5px] text-paper/55 md:flex-row md:items-center md:justify-between">
          <p>© 2026 {BRAND.legalName}. Airline tickets are sold as agent for the operating carrier. Fares, taxes and our fee are itemised on every booking.</p>
          {mode !== "live" ? <p className="font-mono text-signal">{MODE_COPY[mode].detail}</p> : <p className="font-mono text-paper/40">Prices include taxes and our fee.</p>}
        </div>
      </div>
    </footer>
  );
}
