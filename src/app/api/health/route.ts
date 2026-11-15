import { sql } from "drizzle-orm";
import { db } from "@/db";
import { checkEnv } from "@/lib/env";
import { inventoryState } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Liveness + readiness in one endpoint.
 *
 * Returns 200 when the process can serve traffic, 503 when it cannot. The body is
 * intentionally explicit about *why* a deployment cannot sell: a health check that
 * only says "ok" hides the most expensive class of production incident — a site
 * that is up, taking traffic, and unable to complete a booking.
 */
export async function GET() {
  const started = Date.now();
  const report = checkEnv();
  const inv = inventoryState();

  let dbOk = false;
  let dbMs: number | null = null;
  try {
    const t = Date.now();
    await db.execute(sql`select 1`);
    dbMs = Date.now() - t;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const fatal = !dbOk || !report.ok;
  const body = {
    ok: !fatal,
    sellable: report.sellable && dbOk,
    checks: {
      database: dbOk ? { ok: true, ms: dbMs } : { ok: false },
      config: { ok: report.ok },
      inventory: { state: inv, canShowFlights: inv !== "closed" },
    },
    errors: report.errors,
    warnings: report.warnings,
    version: process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.npm_package_version ?? "dev",
    checkedInMs: Date.now() - started,
  };

  return Response.json(body, { status: fatal ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
