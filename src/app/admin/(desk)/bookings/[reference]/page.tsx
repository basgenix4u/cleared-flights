import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestRefund } from "@/components/admin/RequestRefund";
import { RefundDecision } from "@/components/admin/RefundControls";
import { adminGetBooking } from "@/lib/server/platform";
import { cn } from "@/components/ui/cn";

export const dynamic = "force-dynamic";

const money = (amount: string | number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount));
const minor = (n: number, currency: string) => money(n / 100, currency);
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function BookingDetail({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const res = await adminGetBooking(reference.toUpperCase());
  if (!res.ok) notFound();

  const { booking, payments, refunds, requests } = res.data;
  const captured = payments.find((p) => p.status === "captured");
  const stuck = captured && captured.fulfilment_status !== "done";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/bookings" className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-3 hover:text-ink">← Bookings</Link>
          <h1 className="mt-2 font-mono text-[24px] font-bold tracking-[-0.02em]">{booking.reference}</h1>
          <p className="mt-1 text-[13px] text-ink-3">{booking.email} · {booking.passenger_count} passenger(s) · {booking.mode}</p>
        </div>
        <div className="text-right">
          <p className="num text-[24px] font-bold tracking-[-0.03em]">{money(booking.total_amount, booking.currency)}</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">{booking.status} · {booking.payment_status}</p>
        </div>
      </header>

      {stuck && (
        <div role="alert" className="rounded-md border border-[#e0a49f] bg-stop-bg p-4 text-[#7d1a14]">
          <p className="text-[14px] font-semibold">Paid but not ticketed</p>
          <p className="mt-1 text-[13px] leading-relaxed">
            This payment was captured but the airline order has not completed. Reconciliation retries automatically and refunds
            automatically after three failed attempts. Check the provider dashboard before intervening manually.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-md border border-line-2 bg-card p-5">
            <h2 className="text-[15px] font-semibold">Timeline</h2>
            <ol className="mt-3 space-y-0">
              {booking.events.map((e, i) => (
                <li key={i} className="flex gap-3 border-l border-line pb-4 pl-4 last:pb-0">
                  <span className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-ink" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium">{e.label}</span>
                    {e.detail && <span className="block text-[12px] text-ink-3">{e.detail}</span>}
                    <span className="block font-mono text-[10.5px] text-ink-3">{when(e.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-md border border-line-2 bg-card p-5">
            <h2 className="text-[15px] font-semibold">Payments</h2>
            {payments.length === 0 ? (
              <p className="mt-2 text-[13px] text-ink-3">No payment has been opened for this booking.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span>
                      <span className="font-mono text-[12.5px]">{minor(p.amount_minor, p.currency)}</span>
                      <span className="ml-2 font-mono text-[11px] text-ink-3">{p.provider}</span>
                      {p.failure_reason && <p className="mt-0.5 font-mono text-[10.5px] text-stop">{p.failure_reason}</p>}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={cn("rounded-xs border px-1.5 py-0.5 font-mono text-[10.5px] uppercase", p.status === "captured" ? "border-[#9cc9b0] bg-go-bg text-go" : "border-line-2 bg-paper-2 text-ink-3")}>{p.status}</span>
                      <span className="font-mono text-[10.5px] text-ink-3">{p.fulfilment_status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {requests.length > 0 && (
            <section className="rounded-md border border-line-2 bg-card p-5">
              <h2 className="text-[15px] font-semibold">Customer requests</h2>
              <ul className="mt-3 space-y-3">
                {requests.map((r) => (
                  <li key={r.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                    <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">{r.type}{r.topic ? ` · ${r.topic}` : ""} · {r.status}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{r.message}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-md border border-line-2 bg-card p-5">
            <h2 className="text-[15px] font-semibold">Refunds</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
              Raising a refund records the request. An owner or admin approves it, then the payment worker executes it against
              the provider — no button here moves money on its own.
            </p>
            <div className="mt-3">
              <RequestRefund
                reference={booking.reference}
                maxLabel={captured ? minor(captured.amount_minor, captured.currency) : "—"}
                disabled={!captured}
              />
            </div>
            {refunds.length > 0 && (
              <ul className="mt-4 divide-y divide-line border-t border-line pt-3">
                {refunds.map((r) => (
                  <li key={r.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px]">{minor(r.amount_minor, r.currency)}</span>
                      <RefundDecision id={r.id} reference={r.reference} status={r.status} amountLabel={minor(r.amount_minor, r.currency)} />
                    </div>
                    <p className="mt-1 text-[11.5px] text-ink-2">{r.reason}</p>
                    <p className="font-mono text-[10.5px] text-ink-3">
                      {r.requested_by ?? "—"}{r.decided_by ? ` → ${r.decided_by}` : ""}
                      {r.failure_reason ? ` · ${r.failure_reason}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-md border border-line-2 bg-card p-5">
            <h2 className="text-[15px] font-semibold">Reference</h2>
            <dl className="mt-2 space-y-1 font-mono text-[11.5px] text-ink-2">
              <div className="flex justify-between gap-2"><dt className="text-ink-3">PNR</dt><dd>{booking.pnr ?? "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-3">Tickets</dt><dd>{booking.ticket_numbers?.join(", ") || "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-3">Created</dt><dd>{when(booking.created_at)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-3">Updated</dt><dd>{booking.updated_at ? when(booking.updated_at) : "—"}</dd></div>
            </dl>
            <Link href={`/trips/${booking.reference}`} className="mt-3 inline-block text-[12px] font-semibold underline underline-offset-4">Customer view ↗</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
