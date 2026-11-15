import { NextResponse, type NextRequest } from "next/server";
import { reconcile } from "@/lib/payment-service";
import { flushMetrics, pruneMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Reconciliation. Run every few minutes.
 *
 * Auth: Vercel Cron signs its invocations; a manual call needs the bearer secret. It is
 * deliberately not public — it moves money.
 */
export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
  const secret = process.env.CRON_SECRET;
  if (!isVercelCron && secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Cron only." } }, { status: 401 });
  }
  try {
    const result = await reconcile();
    // Metrics are operational, not archival: flush what this instance is holding and drop
    // anything older than the retention window, so the tables stay small enough to query.
    const flushed = await flushMetrics();
    const pruned = await pruneMetrics(14);
    return NextResponse.json(
      { ok: true, ...result, metrics: { flushed, pruned } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: { code: "RECONCILE_FAILED", message: e instanceof Error ? e.message : "unknown" } },
      { status: 500 },
    );
  }
}
