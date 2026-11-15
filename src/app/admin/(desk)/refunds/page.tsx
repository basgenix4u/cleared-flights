import Link from "next/link";
import { RefundDecision } from "@/components/admin/RefundControls";
import { adminRefundQueue, adminStuckPayments } from "@/lib/server/platform";
import { cn } from "@/components/ui/cn";

export const dynamic = "force-dynamic";

const money = (n: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n / 100);
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const TONE: Record<string, string> = {
  requested: "border-[#d6b24a] bg-warn-bg text-warn",
  approved: "border-[#9cc9b0] bg-go-bg text-go",
  executed: "border-[#9cc9b0] bg-go-bg text-go",
  failed: "border-[#e0a49f] bg-stop-bg text-stop",
  declined: "border-line-2 bg-paper-2 text-ink-3",
};

export default async function RefundsPage() {
  const [queueRes, stuckRes] = await Promise.all([adminRefundQueue(), adminStuckPayments()]);
  const refunds = queueRes.ok ? queueRes.data.refunds : [];
  const stuck = stuckRes.ok ? stuckRes.data.stuck : [];
  const waiting = refunds.filter((r) => r.status === "requested").length;

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Operations</p>
        <h1 className="mt-1.5 text-[26px] font-bold tracking-[-0.03em]">Refunds &amp; exceptions</h1>
        <p className="mt-1 text-[13px] text-ink-3">
          {waiting === 0 ? "Nothing waiting on approval." : `${waiting} request${waiting === 1 ? "" : "s"} waiting on approval.`}
        </p>
      </header>

      {!queueRes.ok && (
        <p className="rounded-sm border border-[#e0a49f] bg-stop-bg px-3 py-2 text-[13px] text-[#7d1a14]">{queueRes.message}</p>
      )}

      <section className="overflow-hidden rounded-md border border-line-2 bg-card">
        <div className="border-b border-line bg-paper-2/40 px-4 py-2.5">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">Refund queue</h2>
        </div>
        {refunds.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13.5px] text-ink-3">No refund requests. That is the good outcome.</p>
        ) : (
          <ul className="divide-y divide-line">
            {refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/bookings/${r.reference}`} className="inline-flex min-h-11 items-center font-mono text-[12.5px] font-semibold hover:underline md:min-h-0">{r.reference}</Link>
                    <span className={cn("rounded-xs border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em]", TONE[r.status] ?? "border-line-2")}>{r.status}</span>
                    <span className="num font-mono text-[12px]">{money(r.amount_minor, r.currency)}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{r.reason}</p>
                  <p className="font-mono text-[10.5px] text-ink-3">
                    asked by {r.requested_by ?? "—"} · {when(r.created_at)}
                    {r.decided_by ? ` · decided by ${r.decided_by}` : ""}
                    {r.failure_reason ? ` · ${r.failure_reason}` : ""}
                  </p>
                </div>
                <RefundDecision id={r.id} reference={r.reference} status={r.status} amountLabel={money(r.amount_minor, r.currency)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-md border border-line-2 bg-card">
        <div className="flex items-center justify-between border-b border-line bg-paper-2/40 px-4 py-2.5">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">Paid but not ticketed</h2>
          <span className="font-mono text-[10.5px] text-ink-3">{stuck.length} stuck</span>
        </div>
        {stuck.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13.5px] text-ink-3">
            Nothing is stuck. Every captured payment has a matching airline order.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {stuck.map((s) => (
              <li key={s.reference} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="min-w-0">
                  <Link href={`/admin/bookings/${s.reference}`} className="inline-flex min-h-11 items-center font-mono text-[12.5px] font-semibold hover:underline md:min-h-0">{s.reference}</Link>
                  <p className="mt-0.5 font-mono text-[10.5px] text-stop">{s.failure_reason ?? s.fulfilment_status}</p>
                </span>
                <span className="font-mono text-[10.5px] text-ink-3">since {when(s.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-ink-3">
          Reconciliation runs every few minutes: it retries the airline order, and after three failures refunds the customer
          automatically. This list is the alarm, not the workflow.
        </p>
      </section>
    </div>
  );
}
