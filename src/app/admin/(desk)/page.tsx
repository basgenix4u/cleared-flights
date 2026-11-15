import Link from "next/link";
import { adminStats, currentAdmin } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

const money = (n: number, cur = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
const bytes = (n: number) => (n > 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : n > 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Local time in Lagos City, so "good morning" means morning where the desk sits. */
const hourAtDesk = () => Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Lagos" }).format(new Date()));
const greeting = () => (hourAtDesk() < 12 ? "Good morning" : hourAtDesk() < 17 ? "Good afternoon" : "Good evening");
const todayLabel = () =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" }).format(new Date());

export default async function Overview() {
  const res = await adminStats();
  const me = await currentAdmin();
  const userFirstName = (me?.name ?? me?.email ?? "there").split(/[\s@]/)[0];
  if (!res.ok) {
    return (
      <div className="rounded-md border border-[#e0a49f] bg-stop-bg p-6 text-[#7d1a14]">
        <h1 className="text-[18px] font-semibold">The content service is not reachable</h1>
        <p className="mt-1 text-[14px]">{res.message}</p>
        <p className="mt-3 font-mono text-[12px]">Check PLATFORM_API_URL and that the Render service is awake.</p>
      </div>
    );
  }

  const d = res.data;
  const cards = [
    { label: "Published", value: String(d.posts.published), sub: `${d.posts.total} total · ${d.posts.drafts} drafts`, href: "/admin/posts" },
    { label: "Bookings", value: d.bookings ? String(d.bookings.total) : "—", sub: d.bookings ? `${d.bookings.last7} in the last 7 days` : "travel tables not reachable", href: "/trips" },
    { label: "Revenue", value: d.bookings ? money(d.bookings.revenue) : "—", sub: "excluding cancelled", href: null },
    { label: "Media", value: String(d.media.total), sub: bytes(d.media.bytes), href: "/admin/media" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Overview</p>
        <h1 className="mt-1.5 text-[24px] font-bold tracking-[-0.03em] md:mt-2 md:text-[28px]">{greeting()}, {userFirstName}</h1>
        <p className="mt-1 text-[13px] text-ink-3">Today at a glance — {todayLabel()}.</p>
      </header>

      {/* Four numbers a phone can read at once, not four screens of one number each. */}
      <div className="grid grid-cols-2 gap-2.5 md:gap-4 xl:grid-cols-4">
        {cards.map((c) => {
          const inner = (
            <>
              <p className="eyebrow text-[10px] md:text-[11px]">{c.label}</p>
              <p className="num mt-1.5 text-[24px] font-bold leading-none tracking-[-0.03em] md:mt-2 md:text-[30px]">{c.value}</p>
              <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-ink-3 md:mt-2 md:text-[12.5px]">{c.sub}</p>
            </>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="block rounded-md border border-line-2 bg-card p-3.5 transition-colors hover:border-ink md:p-5">
              {inner}
            </Link>
          ) : (
            <div key={c.label} className="rounded-md border border-line-2 bg-card p-3.5 md:p-5">{inner}</div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border border-line-2 bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">Unfinished drafts</h2>
            <Link href="/admin/posts?status=draft" className="inline-flex min-h-11 items-center text-[12.5px] font-semibold underline underline-offset-4 md:min-h-0">All drafts</Link>
          </div>
          {d.drafts.length === 0 ? (
            <p className="mt-4 text-[13.5px] text-ink-3">Nothing in progress.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {d.drafts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/posts/${p.id}`} className="truncate text-[14px] font-medium hover:underline">{p.title}</Link>
                  <span className="shrink-0 font-mono text-[11px] text-ink-3">{when(p.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-line-2 bg-card p-5">
          <h2 className="text-[16px] font-semibold">Recent activity</h2>
          {d.recentActivity.length === 0 ? (
            <p className="mt-4 text-[13.5px] text-ink-3">No changes recorded yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {d.recentActivity.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block font-mono text-[12px] font-medium">{a.action}</span>
                    <span className="block truncate text-[11.5px] text-ink-3">{a.actorEmail ?? "system"}{a.entity ? ` · ${a.entity}` : ""}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-3">{when(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-md border border-ink bg-signal-soft p-5">
        <h2 className="text-[15px] font-semibold">What this desk does not do yet</h2>
        <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-2">
          Bookings, refunds and support tickets are still handled in the travel app. Bringing them here — with a real
          queue, refund approvals and customer messaging — is the next stage. Nothing on this page pretends otherwise.
        </p>
      </section>
    </div>
  );
}
