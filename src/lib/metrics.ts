import { and, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { serviceMetrics } from "@/db/schema";
import { log } from "./security";

/**
 * Latency and error accounting.
 *
 * Kept in memory per instance and flushed to Postgres on a timer, on the cron tick, and when
 * the buffer grows. Storing percentiles rather than raw samples keeps the table small enough
 * to query on a phone: each flush writes one row per route per minute with real p50/p95/p99
 * computed from the samples held in memory.
 */
type Acc = { ms: number[]; errors: number; clientErrors: number; slow: number };

const buckets = new Map<string, Acc>();
const FLUSH_EVERY_MS = 30_000;
let lastFlush = Date.now();
let pending = 0;

export function record(route: string, status: number, ms: number): void {
  const minute = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  const key = `${route}|${minute}`;
  let acc = buckets.get(key);
  if (!acc) {
    acc = { ms: [], errors: 0, clientErrors: 0, slow: 0 };
    buckets.set(key, acc);
  }
  acc.ms.push(ms);
  if (status >= 500) acc.errors += 1;
  else if (status >= 400) acc.clientErrors += 1;
  if (ms > 2_000) acc.slow += 1;
  pending += 1;

  if (pending >= 100 || Date.now() - lastFlush > FLUSH_EVERY_MS) void flushMetrics();
}

const percentile = (sorted: number[], p: number) =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];

export async function flushMetrics(): Promise<number> {
  if (buckets.size === 0) return 0;
  const snapshot = [...buckets.entries()];
  buckets.clear();
  pending = 0;
  lastFlush = Date.now();

  try {
    for (const [key, acc] of snapshot) {
      const [route, minute] = key.split("|");
      const sorted = [...acc.ms].sort((a, b) => a - b);
      const totalMs = sorted.reduce((a, b) => a + b, 0);
      await db
        .insert(serviceMetrics)
        .values({
          route,
          bucket: new Date(minute),
          requests: sorted.length,
          errors: acc.errors,
          clientErrors: acc.clientErrors,
          slow: acc.slow,
          totalMs,
          maxMs: sorted[sorted.length - 1] ?? 0,
          p50: percentile(sorted, 50),
          p95: percentile(sorted, 95),
          p99: percentile(sorted, 99),
        })
        .onConflictDoUpdate({
          target: [serviceMetrics.route, serviceMetrics.bucket],
          set: {
            requests: sql`${serviceMetrics.requests} + excluded.requests`,
            errors: sql`${serviceMetrics.errors} + excluded.errors`,
            clientErrors: sql`${serviceMetrics.clientErrors} + excluded.client_errors`,
            slow: sql`${serviceMetrics.slow} + excluded.slow`,
            totalMs: sql`${serviceMetrics.totalMs} + excluded.total_ms`,
            maxMs: sql`greatest(${serviceMetrics.maxMs}, excluded.max_ms)`,
            // Percentiles across flushes are approximate by construction; take the worse.
            p50: sql`greatest(${serviceMetrics.p50}, excluded.p50)`,
            p95: sql`greatest(${serviceMetrics.p95}, excluded.p95)`,
            p99: sql`greatest(${serviceMetrics.p99}, excluded.p99)`,
          },
        });
    }
    return snapshot.length;
  } catch (error) {
    log("warn", "metrics.flush_failed", { error: (error as Error).message });
    return 0;
  }
}

export interface RouteHealth {
  route: string;
  requests: number;
  errors: number;
  clientErrors: number;
  slow: number;
  avgMs: number;
  maxMs: number;
  p95: number;
  errorRate: number;
}

/**
 * The error budget: a service is healthy while its 5xx rate stays under the objective.
 * 4xx are reported separately — a burst of 429s is the limiter working, not an outage.
 */
export const ERROR_BUDGET = { objective: 0.005, windowHours: 24 };

export async function healthSnapshot(hours = ERROR_BUDGET.windowHours): Promise<{
  routes: RouteHealth[];
  totals: { requests: number; errors: number; errorRate: number; budgetUsed: number };
  since: string;
}> {
  const since = new Date(Date.now() - hours * 3_600_000);
  const rows = await db
    .select({
      route: serviceMetrics.route,
      requests: sql<number>`sum(${serviceMetrics.requests})::int`,
      errors: sql<number>`sum(${serviceMetrics.errors})::int`,
      clientErrors: sql<number>`sum(${serviceMetrics.clientErrors})::int`,
      slow: sql<number>`sum(${serviceMetrics.slow})::int`,
      totalMs: sql<number>`sum(${serviceMetrics.totalMs})::int`,
      maxMs: sql<number>`max(${serviceMetrics.maxMs})::int`,
      p95: sql<number>`max(${serviceMetrics.p95})::int`,
    })
    .from(serviceMetrics)
    .where(and(gte(serviceMetrics.bucket, since)))
    .groupBy(serviceMetrics.route)
    .orderBy(sql`sum(${serviceMetrics.requests}) desc`);

  const routes: RouteHealth[] = rows.map((r) => ({
    route: r.route,
    requests: Number(r.requests),
    errors: Number(r.errors),
    clientErrors: Number(r.clientErrors),
    slow: Number(r.slow),
    avgMs: Number(r.requests) ? Math.round(Number(r.totalMs) / Number(r.requests)) : 0,
    maxMs: Number(r.maxMs),
    p95: Number(r.p95),
    errorRate: Number(r.requests) ? Number(r.errors) / Number(r.requests) : 0,
  }));

  const requests = routes.reduce((a, r) => a + r.requests, 0);
  const errors = routes.reduce((a, r) => a + r.errors, 0);
  const errorRate = requests ? errors / requests : 0;
  return {
    routes,
    totals: { requests, errors, errorRate, budgetUsed: ERROR_BUDGET.objective ? Math.min(1, errorRate / ERROR_BUDGET.objective) : 0 },
    since: since.toISOString(),
  };
}

/** Old rows are pruned by the cron; metrics are operational, not archival. */
export async function pruneMetrics(days = 14): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const { rowCount } = await db.execute(sql`delete from service_metrics where bucket < ${cutoff.toISOString()}`);
  await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
  return rowCount ?? 0;
}
