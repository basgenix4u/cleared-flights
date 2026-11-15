import Link from "next/link";
import { adminListBookings } from "@/lib/server/platform";
import { cn } from "@/components/ui/cn";

export const dynamic = "force-dynamic";

const money = (amount: string, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount));
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const STATUS_TONE: Record<string, string> = {
  ticketed: "border-[#9cc9b0] bg-go-bg text-go",
  confirmed: "border-[#9cc9b0] bg-go-bg text-go",
  simulated: "border-line-2 bg-paper-2 text-ink-2",
  requested: "border-[#d6b24a] bg-warn-bg text-warn",
  failed: "border-[#e0a49f] bg-stop-bg text-stop",
  cancelled: "border-line-2 bg-paper-2 text-ink-3",
};

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const res = await adminListBookings({ status: sp.status, q: sp.q, limit: 50 });

  if (!res.ok) {
    return (
      <div className="rounded-md border border-[#e0a49f] bg-stop-bg p-6 text-[#7d1a14]">
        <h1 className="text-[18px] font-semibold">Could not load bookings</h1>
        <p className="mt-1 text-[14px]">{res.message}</p>
      </div>
    );
  }

  const { bookings, counts } = res.data;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const filters = ["all", "requested", "confirmed", "ticketed", "cancelled", "failed"];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="mt-1.5 text-[26px] font-bold tracking-[-0.03em]">Bookings</h1>
          <p className="mt-1 text-[13px] text-ink-3">
            {total} total · {Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(" · ")}
          </p>
        </div>
        <form action="/admin/bookings" className="flex gap-2">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Reference or email" className="input !h-11 w-40 !text-[12.5px] md:!h-11 md:!h-9 md:w-56" />
          <button type="submit" className="h-11 rounded-sm border border-ink px-3 text-[12.5px] font-semibold hover:bg-ink hover:text-paper md:h-9">Search</button>
        </form>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/admin/bookings" : `/admin/bookings?status=${f}`}
            className={cn(
              "inline-flex min-h-11 items-center rounded-xs border px-2.5 font-mono text-[11px] uppercase tracking-[0.06em] md:min-h-0 md:py-1",
              (sp.status ?? "all") === f ? "border-ink bg-ink text-paper" : "border-line-2 bg-card text-ink-2 hover:border-ink",
            )}
          >
            {f}
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-md border border-dashed border-line-2 bg-card/60 px-6 py-16 text-center">
          <h2 className="text-[19px] font-semibold">No bookings match</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-ink-3">Try a different status, or clear the search.</p>
        </div>
      ) : (
        <>
          {/* A phone does not get a 820px table it has to drag sideways: it gets the four facts
              that matter, per booking. The full table returns at md where it belongs. */}
          <ul className="space-y-2 md:hidden">
            {bookings.map((b) => (
              <li key={b.reference}>
                <Link
                  href={`/admin/bookings/${b.reference}`}
                  className="block rounded-md border border-line-2 bg-card p-3 active:bg-paper-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[13.5px] font-semibold">{b.reference}</p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-ink-3">{b.email}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="num font-mono text-[15px] font-semibold">{money(b.total_amount, b.currency)}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-ink-3">{when(b.created_at)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={cn("rounded-xs border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em]", STATUS_TONE[b.status] ?? "border-line-2")}>
                      {b.status}
                    </span>
                    <span className="font-mono text-[10.5px] text-ink-3">{b.payment_state ?? b.payment_status}</span>
                    {b.fulfilment_state && b.fulfilment_state !== "none" && <span className="font-mono text-[10.5px] text-ink-3">· {b.fulfilment_state}</span>}
                    {Number(b.open_refunds) > 0 && (
                      <span className="rounded-xs border border-[#d6b24a] bg-warn-bg px-1.5 py-0.5 font-mono text-[10px] uppercase text-warn">refund</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-md border border-line-2 bg-card md:block">
          <table className="w-full min-w-[820px] text-left">
            <caption className="sr-only">Bookings</caption>
            <thead>
              <tr className="border-b border-line bg-paper-2/40">
                {["Reference", "Customer", "Status", "Payment", "Total", "Created"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.reference} className="border-b border-line last:border-0 hover:bg-paper-2/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/bookings/${b.reference}`} className="inline-flex min-h-11 items-center font-mono text-[12.5px] font-semibold hover:underline md:min-h-0">{b.reference}</Link>
                    {Number(b.open_refunds) > 0 && (
                      <span className="ml-2 rounded-xs border border-[#d6b24a] bg-warn-bg px-1.5 py-0.5 font-mono text-[10px] uppercase text-warn">refund</span>
                    )}
                    {b.pnr && <p className="mt-0.5 font-mono text-[10.5px] text-ink-3">PNR {b.pnr}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11.5px] text-ink-2">{b.email}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-xs border px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em]", STATUS_TONE[b.status] ?? "border-line-2")}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink-2">
                    {b.payment_state ?? b.payment_status}
                    {b.fulfilment_state && b.fulfilment_state !== "none" && <span className="text-ink-3"> · {b.fulfilment_state}</span>}
                  </td>
                  <td className="num px-4 py-3 font-mono text-[12.5px]">{money(b.total_amount, b.currency)}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink-3">{when(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}

      <p className="text-[12px] leading-relaxed text-ink-3">
        Customer emails are partially masked. Full passenger and passport data is never shown on the desk — it lives behind
        the traveller&apos;s own verified trip page.
      </p>
    </div>
  );
}
