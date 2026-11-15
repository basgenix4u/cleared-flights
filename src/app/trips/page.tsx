import type { Metadata } from "next";
import Link from "next/link";
import { listBookingSummaries } from "@/lib/booking-service";
import { authorizedRefs } from "@/lib/security";
import { fmtDay, fmtMoney } from "@/lib/format";
import { LookupForm } from "@/components/trips/LookupForm";
import { Sign, ModeBadge } from "@/components/ui/marks";
import { IconArrow } from "@/components/ui/icons";
import { EmptyState, ButtonLink } from "@/components/ui/ui";

export const metadata: Metadata = { title: "My trips", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const trips = await listBookingSummaries(await authorizedRefs());
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-12 md:px-8">
      <p className="eyebrow">Sign in · My trips</p>
      <h1 className="mt-3 text-[clamp(1.8rem,3vw,2.6rem)] font-bold tracking-[-0.035em]">Find your trip</h1>
      <p className="mt-3 max-w-xl text-[15px] text-ink-2">There’s no password to remember. Your booking reference and a passenger surname open your trip on any device, the same way an airline’s “manage booking” does.</p>

      <div className="mt-10 grid gap-12 lg:grid-cols-[420px_1fr]">
        <div className="rounded-md border-[1.5px] border-ink bg-card p-6 shadow-[4px_4px_0_0_var(--color-ink)]">
          <LookupForm />
        </div>
        <section aria-labelledby="dev-h">
          <h2 id="dev-h" className="text-[18px] font-semibold tracking-tight">Trips on this device</h2>
          {trips.length === 0 ? (
            <div className="mt-4"><EmptyState title="No trips here yet" actions={<ButtonLink href="/#search" variant="signal">Search flights</ButtonLink>}>Bookings you make or retrieve on this browser appear here.</EmptyState></div>
          ) : (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {trips.map((t) => (
                <li key={t.reference}>
                  <Link href={`/trips/${t.reference}`} className="group flex flex-wrap items-center justify-between gap-4 py-4 transition-colors hover:bg-card">
                    <div>
                      <p className="flex flex-wrap items-center gap-2">
                        {t.slices.map((s, i) => <span key={i} className="flex items-center gap-1.5"><Sign code={s.from} size="sm" /><IconArrow width={13} height={13} className="text-ink-3" /><Sign code={s.to} size="sm" /></span>)}
                      </p>
                      <p className="mt-1.5 text-[13px] text-ink-2">{t.slices[0].fromCity} to {t.slices[0].toCity} · {fmtDay(t.slices[0].date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[13px]">{t.reference}</p>
                      <p className="mt-0.5 flex items-center justify-end gap-2 text-[12.5px] capitalize text-ink-3">{t.status} · {fmtMoney(t.total, t.currency)} {t.mode === "demo" && <ModeBadge mode="demo" />}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
