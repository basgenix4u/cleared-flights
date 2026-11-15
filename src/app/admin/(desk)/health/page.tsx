import { ERROR_BUDGET, flushMetrics, healthSnapshot } from "@/lib/metrics";
import { cn } from "@/components/ui/cn";

export const dynamic = "force-dynamic";

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${n}ms`);

export default async function HealthPage() {
  await flushMetrics().catch(() => 0);
  let snapshot;
  try {
    snapshot = await healthSnapshot();
  } catch {
    return (
      <div className="rounded-md border border-[#e0a49f] bg-stop-bg p-6 text-[#7d1a14]">
        <h1 className="text-[18px] font-semibold">Metrics unavailable</h1>
        <p className="mt-1 text-[14px]">The metrics table could not be read. Check the database connection.</p>
      </div>
    );
  }

  const { totals, routes } = snapshot;
  const overBudget = totals.errorRate > ERROR_BUDGET.objective;
  const budgetPct = Math.min(100, totals.budgetUsed * 100);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Operations</p>
        <h1 className="mt-1.5 text-[26px] font-bold tracking-[-0.03em]">Service health</h1>
        <p className="mt-1 text-[13px] text-ink-3">
          Last {ERROR_BUDGET.windowHours} hours · objective is a 5xx rate under {pct(ERROR_BUDGET.objective)}.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className={cn("rounded-md border p-5", overBudget ? "border-[#e0a49f] bg-stop-bg" : "border-line-2 bg-card")}>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">Error budget used</p>
          <p className={cn("num mt-1 text-[28px] font-bold tracking-[-0.03em]", overBudget ? "text-stop" : "text-ink")}>{budgetPct.toFixed(1)}%</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div className={cn("h-full", overBudget ? "bg-stop" : "bg-go")} style={{ width: `${budgetPct}%` }} />
          </div>
          <p className="mt-2 text-[11.5px] text-ink-3">{pct(totals.errorRate)} of {totals.requests.toLocaleString()} requests failed</p>
        </div>
        <div className="rounded-md border border-line-2 bg-card p-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">5xx errors</p>
          <p className="num mt-1 text-[28px] font-bold tracking-[-0.03em]">{totals.errors}</p>
          <p className="mt-2 text-[11.5px] text-ink-3">A 4xx is the product refusing, not failing — counted separately below.</p>
        </div>
        <div className="rounded-md border border-line-2 bg-card p-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">Slow requests (&gt;2s)</p>
          <p className="num mt-1 text-[28px] font-bold tracking-[-0.03em]">{routes.reduce((a, r) => a + r.slow, 0)}</p>
          <p className="mt-2 text-[11.5px] text-ink-3">Latency is measured server-side, per route, at the p95 below.</p>
        </div>
      </section>

      {routes.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-2 bg-card/60 px-6 py-12 text-center text-[13.5px] text-ink-3">
          No traffic recorded in this window yet. Metrics flush every 30 seconds and on the cron tick.
        </p>
      ) : (
        <>
        {/* Phone: one row per route, the four numbers that decide whether to page someone. */}
        <ul className="space-y-2 md:hidden">
          {routes.map((r) => (
            <li key={r.route} className="rounded-md border border-line-2 bg-card p-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate font-mono text-[12.5px] font-semibold">{r.route}</p>
                <p className={cn("num shrink-0 font-mono text-[11.5px]", r.errorRate > ERROR_BUDGET.objective ? "text-stop" : "text-ink-3")}>
                  {pct(r.errorRate)} err
                </p>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[
                  ["req", r.requests.toLocaleString()],
                  ["5xx", String(r.errors)],
                  ["p95", ms(r.p95)],
                  ["max", ms(r.maxMs)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-3">{k}</p>
                    <p className={cn("num font-mono text-[12px]", k === "5xx" && r.errors > 0 && "text-stop")}>{v}</p>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto rounded-md border border-line-2 bg-card md:block">
          <table className="w-full min-w-[720px] text-left">
            <caption className="sr-only">Per-route service health</caption>
            <thead>
              <tr className="border-b border-line bg-paper-2/40">
                {["Route", "Requests", "5xx", "4xx", "p50", "p95", "max", "Error rate"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r.route} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-mono text-[12px] font-semibold">{r.route}</td>
                  <td className="num px-4 py-2.5 font-mono text-[12px]">{r.requests.toLocaleString()}</td>
                  <td className={cn("num px-4 py-2.5 font-mono text-[12px]", r.errors > 0 && "text-stop")}>{r.errors}</td>
                  <td className="num px-4 py-2.5 font-mono text-[12px] text-ink-3">{r.clientErrors}</td>
                  <td className="num px-4 py-2.5 font-mono text-[12px]">{ms(r.avgMs)}</td>
                  <td className="num px-4 py-2.5 font-mono text-[12px]">{ms(r.p95)}</td>
                  <td className="num px-4 py-2.5 font-mono text-[12px] text-ink-3">{ms(r.maxMs)}</td>
                  <td className={cn("num px-4 py-2.5 font-mono text-[12px]", r.errorRate > ERROR_BUDGET.objective && "text-stop")}>{pct(r.errorRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      <p className="text-[12px] leading-relaxed text-ink-3">
        The same numbers are public at <span className="font-mono">/api/status</span>. Percentiles are computed from the
        samples each instance holds and merged by taking the worse of each flush — an honest approximation, not a promise
        of five-nines precision.
      </p>
    </div>
  );
}
