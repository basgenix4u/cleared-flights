import Image from "next/image";
import Link from "next/link";
import { getPlace } from "@/lib/airports";
import { DESTINATIONS, ROUTES, estimateFlight, type Destination } from "@/lib/destinations";
import { fmtDuration } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import { IconArrow, IconCheck, IconLock, IconShield } from "@/components/ui/icons";
import { Sign } from "@/components/ui/marks";
import { ButtonLink } from "@/components/ui/ui";

const wrap = "mx-auto max-w-[1320px] px-4 md:px-8";

/* ───────── Price anatomy ───────── */
export function PriceAnatomy() {
  const rows: [string, string][] = [
    ["Airline fare", "$318.00"],
    ["Taxes & carrier surcharges", "$86.40"],
    ["Cleared service fee · 1 traveller", "$5.00"],
  ];
  return (
    <section className={`${wrap} py-20`} aria-labelledby="anatomy-h">
      <div className="grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="eyebrow">Price anatomy</p>
          <h2 id="anatomy-h" className="serif mt-3 text-[clamp(1.9rem,3vw,2.7rem)] leading-[1.08] tracking-[-0.02em]">
            A fare is three numbers. We show you the sum first, and the parts when you ask.
          </h2>
          <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-ink-2">
            The figure in the results list is the figure you pay for the flight. Bags, seats and meals are separate, optional and never pre-selected, so a cheap-looking fare can’t quietly become an expensive one at the last step.
          </p>
          <ul className="mt-6 space-y-2.5 text-[14.5px] text-ink-2">
            {["Total shown for all travellers, with a per-traveller figure beside it", "Open any result to see the fare, taxes and fee as separate lines", "Extras appear as their own lines, only if you add them"].map((t) => (
              <li key={t} className="flex gap-2.5">
                <IconCheck className="mt-0.5 shrink-0 text-go" width={17} height={17} />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-6 lg:col-start-7">
          <div className="relative border-[1.5px] border-ink bg-card shadow-[6px_6px_0_0_var(--color-ink)]">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="flex items-center gap-2.5">
                <Sign code="LHR" size="sm" />
                <IconArrow width={16} height={16} />
                <Sign code="JFK" size="sm" />
              </div>
              <span className="inline-flex items-stretch border border-ink">
                <span className="hazard w-2" aria-hidden />
                <span className="px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em]">Illustrative example</span>
              </span>
            </div>
            <div className="px-6 py-5">
              <p className="text-[13px] text-ink-3">1 adult · Economy Standard · Return</p>
              <dl className="mt-4 space-y-3">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-2">
                    <dt className="text-[14.5px]">{k}</dt>
                    <span className="leader" aria-hidden />
                    <dd className="num font-mono text-[14.5px]">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {/* perforation */}
            <div className="relative px-0">
              <div className="border-t-[1.5px] border-dashed border-ink" />
              <span aria-hidden className="absolute -left-[11px] -top-[11px] h-5 w-5 rounded-full border-[1.5px] border-ink bg-paper" />
              <span aria-hidden className="absolute -right-[11px] -top-[11px] h-5 w-5 rounded-full border-[1.5px] border-ink bg-paper" />
            </div>
            <div className="px-6 pb-6 pt-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="eyebrow">Total in results</p>
                  <p className="mt-1 text-[13px] text-ink-3">What you see is what you pay for the flight</p>
                </div>
                <p className="num code text-[56px] tracking-[-0.01em]">$409.40</p>
              </div>
              <div className="mt-5 grid gap-2 border-t border-line pt-4 text-[13.5px] sm:grid-cols-2">
                <p className="flex justify-between gap-2"><span className="text-ink-3">Checked bag · optional</span><span className="num font-mono">+ $41.00</span></p>
                <p className="flex justify-between gap-2"><span className="text-ink-3">Seat choice · optional</span><span className="num font-mono">+ $14.00</span></p>
              </div>
            </div>
          </div>
          <p className="mt-4 font-mono text-[11px] text-ink-3">Example amounts to show structure. They are not a quote or a live fare.</p>
        </div>
      </div>
    </section>
  );
}

/* ───────── Routes: a timetable, not cards ───────── */
export function RoutesTable() {
  return (
    <section className="border-y border-line bg-paper-2/60 py-20" aria-labelledby="routes-h">
      <div className={wrap}>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">Popular routes</p>
            <h2 id="routes-h" className="mt-3 text-[clamp(1.6rem,2.4vw,2.2rem)] font-bold tracking-[-0.03em]">Start from a route, pick your dates.</h2>
          </div>
          <p className="max-w-sm text-[13px] text-ink-3">
            Flight times are estimates from distance. Real schedules and fares appear when you search; we don’t show a price without one.
          </p>
        </div>

        <div className="mt-10 border-t-[1.5px] border-ink">
          <div className="hidden grid-cols-[180px_1.1fr_190px_1.6fr_auto] gap-6 border-b border-line py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3 md:grid">
            <span>Route</span><span>Cities</span><span>Est. flight</span><span>Worth knowing</span><span className="w-28" />
          </div>
          <ul>
            {ROUTES.map((r) => {
              const f = estimateFlight(r.from, r.to);
              const a = getPlace(r.from);
              const b = getPlace(r.to);
              return (
                <li key={r.from + r.to} className="border-b border-line">
                  <Link
                    href={`/?from=${r.from}&to=${r.to}#search`}
                    className="group grid items-center gap-x-6 gap-y-2 py-4 transition-colors hover:bg-card md:grid-cols-[180px_1.1fr_190px_1.6fr_auto]"
                  >
                    <span className="flex items-center gap-2">
                      <Sign code={r.from} size="md" />
                      <IconArrow width={15} height={15} className="text-ink-3" />
                      <Sign code={r.to} size="md" />
                    </span>
                    <span className="text-[15px] font-semibold tracking-tight">{a?.city} <span className="font-normal text-ink-3">to</span> {b?.city}</span>
                    <span className="num font-mono text-[13px]">≈ {fmtDuration(f.min)} <span className="text-ink-3">· {f.km.toLocaleString("en-US")} km</span></span>
                    <span className="text-[13.5px] text-ink-2">{r.note}</span>
                    <span className="nudge inline-flex items-center gap-2 text-[13.5px] font-semibold md:w-28 md:justify-end">
                      Search <IconArrow className="arrow" width={15} height={15} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ───────── Destination mosaic ───────── */
function Tile({ d, className, aspect }: { d: Destination; className?: string; aspect: string }) {
  const f = estimateFlight(d.from, d.code);
  return (
    <article className={cn("group", className)}>
      <Link href={`/?from=${d.from}&to=${d.code}#search`} className="block" aria-label={`Search flights to ${d.city} from ${d.fromCity}`}>
        <div className={cn("relative overflow-hidden border border-ink bg-paper-2", aspect)}>
          <Image src={d.image} alt={`${d.city}, ${d.country}`} fill sizes="(min-width:1024px) 45vw, 100vw" className="scale-[1.02] object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
          <span className="absolute left-3 top-3"><Sign code={d.code} size="sm" dark /></span>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto] items-start gap-x-6 gap-y-1">
          <div>
            <h3 className="serif text-[28px] leading-none tracking-[-0.02em]">{d.city}</h3>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-3">{d.country} · Best {d.best}</p>
          </div>
          <span className="nudge hidden items-center gap-1.5 pt-1 text-[13px] font-semibold sm:inline-flex">
            From {d.fromCity} <IconArrow className="arrow" width={14} height={14} />
          </span>
          <p className="col-span-2 max-w-[56ch] text-[14px] leading-relaxed text-ink-2">{d.note}</p>
          <p className="col-span-2 font-mono text-[11.5px] text-ink-3">≈ {fmtDuration(f.min)} from {d.fromCity} (estimate)</p>
        </div>
      </Link>
    </article>
  );
}

export function DestinationMosaic() {
  const [lis, tyo, mex, cpt, rak, kef] = DESTINATIONS;
  return (
    <section className={`${wrap} py-24`} aria-labelledby="dest-h">
      <div className="max-w-2xl">
        <p className="eyebrow">Destination notes</p>
        <h2 id="dest-h" className="serif mt-3 text-[clamp(1.9rem,3vw,2.7rem)] leading-[1.08] tracking-[-0.02em]">
          Six places worth a seat, and what to know before you book.
        </h2>
      </div>
      <div className="mt-12 grid gap-x-8 gap-y-14 lg:grid-cols-12">
        <Tile d={lis} className="lg:col-span-5 lg:row-span-2" aspect="aspect-[4/5]" />
        <Tile d={tyo} className="lg:col-span-7" aspect="aspect-[16/9]" />
        <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:col-span-7">
          <Tile d={mex} aspect="aspect-[4/3]" />
          <Tile d={cpt} aspect="aspect-[4/3]" />
        </div>
        <Tile d={rak} className="lg:col-span-4" aspect="aspect-[3/4]" />
        <Tile d={kef} className="lg:col-span-8 lg:mt-16" aspect="aspect-[16/10]" />
      </div>
    </section>
  );
}

/* ───────── Principles ───────── */
const PRINCIPLES = [
  { t: "The whole price, first", b: "Taxes, carrier-imposed surcharges and our fee are in the number you compare. There is no later step where the total quietly grows." },
  { t: "Rules on the card", b: "Cabin bag, checked bag, change and refund terms sit on every result in plain words. When the airline didn’t state something, we say so instead of guessing." },
  { t: "Layovers, called out", b: "Connections under 60 minutes, over five hours or overnight are flagged. A change of airport is named. You see the risk before you pick." },
  { t: "Re-checked before you pay", b: "Fares expire. We re-check yours when you open checkout and again before booking. If the price moved, you see both totals and decide." },
  { t: "No account to book", b: "Book as a guest. Your reference and a passenger surname get you back to your trip, including a cancellation quote that states the refund first." },
];

export function Principles() {
  return (
    <section className="border-t border-line py-24" aria-labelledby="why-h">
      <div className={`${wrap} grid gap-12 lg:grid-cols-12`}>
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow">How Cleared works</p>
            <h2 id="why-h" className="mt-3 text-[clamp(1.6rem,2.4vw,2.2rem)] font-bold leading-[1.1] tracking-[-0.03em]">
              Five commitments, each visible in the product.
            </h2>
            <p className="mt-4 text-[14.5px] leading-relaxed text-ink-3">We list behaviours you can check on the screen, not statistics about ourselves.</p>
          </div>
        </div>
        <ol className="border-t-[1.5px] border-ink lg:col-span-8">
          {PRINCIPLES.map((p, i) => (
            <li key={p.t} className="grid gap-4 border-b border-line py-7 sm:grid-cols-[72px_1fr_1.4fr]">
              <span className="font-mono text-[13px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="text-[19px] font-semibold leading-snug tracking-[-0.02em]">{p.t}</h3>
              <p className="text-[14.5px] leading-relaxed text-ink-2">{p.b}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ───────── Trust ───────── */
export function Trust() {
  const steps = [
    { n: "1", t: "Requested", b: "We hold your order and details. Nothing is promised by the airline yet." },
    { n: "2", t: "Reserved", b: "The airline has created a reservation and a booking reference." },
    { n: "3", t: "Ticketed", b: "Ticket numbers exist. We only say “ticketed” when we hold them." },
  ];
  const facts = [
    { i: IconLock, t: "Passenger data, encrypted", b: "Passport and phone details are encrypted at rest. We collect passport data only for international trips, and say why." },
    { i: IconShield, t: "No stored card numbers", b: "Card entry belongs with a hosted payment provider. Until one is connected, checkout is clearly simulated." },
    { i: IconCheck, t: "Operating airline named", b: "Every segment shows who actually flies it, not just who sold it." },
  ];
  return (
    <section className="on-dark bg-ink py-24 text-paper" aria-labelledby="trust-h">
      <div className={wrap}>
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="eyebrow !text-paper/55">Trust &amp; confidence</p>
            <h2 id="trust-h" className="serif mt-3 text-[clamp(1.9rem,3vw,2.7rem)] leading-[1.08] tracking-[-0.02em]">
              A booking has three states. We tell you which one yours is in.
            </h2>
            <ol className="mt-10 grid gap-0 border-y border-paper/20">
              {steps.map((s, i) => (
                <li key={s.t} className="grid grid-cols-[48px_1fr] gap-4 border-b border-paper/15 py-5 last:border-b-0">
                  <span className={cn("grid h-9 w-9 place-items-center rounded-sm font-mono text-[13px] font-medium", i === 2 ? "bg-signal text-ink" : "border border-paper/40")}>{s.n}</span>
                  <div>
                    <p className="text-[17px] font-semibold tracking-tight">{s.t}</p>
                    <p className="mt-0.5 text-[14px] text-paper/70">{s.b}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid content-start gap-px bg-paper/15 lg:col-span-5 lg:col-start-8">
            {facts.map((f) => (
              <div key={f.t} className="bg-ink py-6 pr-2">
                <f.i className="text-signal" width={22} height={22} />
                <p className="mt-3 text-[17px] font-semibold tracking-tight">{f.t}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-paper/70">{f.b}</p>
              </div>
            ))}
            <div className="bg-ink pt-6">
              <p className="text-[14px] text-paper/70">Questions about a booking? <Link href="/help#contact" className="font-semibold text-signal underline underline-offset-4">Contact support</Link> with your reference.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Final CTA ───────── */
export function FinalCta() {
  return (
    <section className="relative mt-24 -mb-20 border-y-[1.5px] border-ink bg-signal" aria-label="Search flights">
      <div className={`${wrap} flex flex-col items-start justify-between gap-6 py-10 md:flex-row md:items-center`}>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em]">Cleared for departure</p>
          <p className="mt-2 max-w-xl text-[clamp(1.4rem,2.4vw,2rem)] font-bold leading-tight tracking-[-0.03em]">Pick a route. See the total. Decide with the rules in front of you.</p>
        </div>
        <ButtonLink href="/#search" variant="primary" size="lg">
          Search flights <IconArrow className="arrow" />
        </ButtonLink>
      </div>
    </section>
  );
}
