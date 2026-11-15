import { ERROR_BUDGET, flushMetrics, healthSnapshot } from "@/lib/metrics";
import { route } from "@/lib/route";
import { json } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Public service health: error budget and latency per route.
 *
 * Deliberately public. A travel product that asks people to trust it with money should be
 * willing to say how it is behaving, and an uptime page that only exists during an incident is
 * marketing. No personal data and no per-customer detail is exposed here.
 */
export const GET = route("status", "status", async () => {
  await flushMetrics();
  const snapshot = await healthSnapshot();
  return json({
    ok: snapshot.totals.errorRate <= ERROR_BUDGET.objective,
    objective: { maxErrorRate: ERROR_BUDGET.objective, windowHours: ERROR_BUDGET.windowHours },
    budget: {
      used: Number(snapshot.totals.budgetUsed.toFixed(4)),
      remaining: Number((1 - snapshot.totals.budgetUsed).toFixed(4)),
    },
    totals: snapshot.totals,
    routes: snapshot.routes,
    since: snapshot.since,
    checkedAt: new Date().toISOString(),
  });
});
