import { sql } from "drizzle-orm";
import { db } from "@/db";
import { log } from "./security";

/**
 * Durable, multi-window rate limiting.
 *
 * Two windows per surface — a burst and a sustained rate — because one number cannot express
 * both. Postgres is the counter store so the limit survives instances, regions and deploys.
 *
 * Availability beats strictness: if the database cannot answer, the caller is allowed through
 * and the fact is logged. Refusing every request because the counter store is down would turn
 * a database blip into a total outage; the burst limiter in memory still applies.
 */
export interface RatePolicy {
  name: string;
  /** [limit, windowMs] pairs, all enforced. */
  windows: [limit: number, windowMs: number][];
}

export interface RateResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetSec: number;
  retryAfterSec: number;
  /** Which window tripped, for logs. */
  window?: number;
  degraded?: boolean;
}

const memory = new Map<string, { n: number; reset: number }>();

function memoryTake(key: string, limit: number, windowMs: number): { ok: boolean; count: number; resetMs: number } {
  const now = Date.now();
  if (memory.size > 20_000) for (const [k, b] of memory) if (b.reset < now) memory.delete(k);
  const entry = memory.get(key);
  if (!entry || entry.reset < now) {
    memory.set(key, { n: 1, reset: now + windowMs });
    return { ok: true, count: 1, resetMs: now + windowMs };
  }
  entry.n += 1;
  return { ok: entry.n <= limit, count: entry.n, resetMs: entry.reset };
}

/** One atomic upsert per window: no read-modify-write race between instances. */
async function durableTake(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; count: number; resetMs: number } | null> {
  try {
    const { rows } = await db.execute<{ count: number; window_start: Date }>(sql`
      insert into rate_limits (key, window_start, count)
      values (${key}, now(), 1)
      on conflict (key) do update set
        count = case when rate_limits.window_start < now() - (${windowMs}::int * interval '1 millisecond') then 1 else rate_limits.count + 1 end,
        window_start = case when rate_limits.window_start < now() - (${windowMs}::int * interval '1 millisecond') then now() else rate_limits.window_start end
      returning count, window_start
    `);
    const row = rows[0];
    if (!row) return null;
    const resetMs = new Date(row.window_start).getTime() + windowMs;
    return { ok: Number(row.count) <= limit, count: Number(row.count), resetMs };
  } catch (error) {
    log("warn", "ratelimit.degraded", { key: key.split(":")[0], error: (error as Error).message });
    return null;
  }
}

/**
 * Check every window in a policy. All must pass; the one closest to its limit sets the headers.
 *
 * The windows are evaluated in parallel: they are two independent upserts, and doing them in
 * sequence added a whole extra round-trip to every request on the hot path.
 */
export async function take(scope: string, identity: string, policy: RatePolicy): Promise<RateResult> {
  const checks = await Promise.all(
    policy.windows.map(async ([limit, windowMs]) => {
      const key = `${scope}:${identity}:${windowMs}`;
      const durable = await durableTake(key, limit, windowMs);
      if (durable) return { limit, windowMs, ...durable, degraded: false };
      const memoryResult = memoryTake(key, limit, windowMs);
      return { limit, windowMs, ok: memoryResult.ok, count: memoryResult.count, resetMs: memoryResult.resetMs, degraded: true };
    }),
  );

  const degraded = checks.some((c) => c.degraded);
  const blocked = checks.find((c) => !c.ok);
  if (blocked) {
    const retryAfterSec = Math.max(1, Math.ceil((blocked.resetMs - Date.now()) / 1000));
    const resetSec = Math.max(0, Math.ceil(blocked.resetMs / 1000 - Date.now() / 1000));
    return { ok: false, limit: blocked.limit, remaining: 0, resetSec, retryAfterSec, window: blocked.windowMs, degraded };
  }

  // Report the window with the least headroom: that is the one a client should watch.
  const tightest = checks.reduce((a, b) => (b.limit - b.count < a.limit - a.count ? b : a));
  return {
    ok: true,
    limit: tightest.limit,
    remaining: Math.max(0, tightest.limit - tightest.count),
    resetSec: Math.max(0, Math.ceil(tightest.resetMs / 1000 - Date.now() / 1000)),
    retryAfterSec: 0,
    window: tightest.windowMs,
    degraded,
  };
}

/** The standard header set so clients can back off before they are refused. */
export function rateHeaders(r: RateResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(r.limit),
    "RateLimit-Remaining": String(r.remaining),
    "RateLimit-Reset": String(r.resetSec),
    ...(r.ok ? {} : { "Retry-After": String(r.retryAfterSec) }),
  };
}

/**
 * Policies, in one place so they can be read against each other.
 *
 * The `trips/retrieve` limit is the most security-relevant one here: a reference is 6
 * characters, so retrieval is guessable in principle and must be rate-limited hard as well
 * as requiring a surname.
 */
export const POLICIES = {
  // A burst window exists to stop scripts, not people. Anything a person plausibly does twice
  // in a second — submit, then double-click; quote, then confirm — has to pass, or the limiter
  // starts refusing the very behaviour idempotency was built to handle.
  search: { name: "search", windows: [[4, 1_000], [40, 60_000]] },
  searchDates: { name: "searchDates", windows: [[2, 1_000], [20, 60_000]] },
  offers: { name: "offers", windows: [[6, 1_000], [80, 60_000]] },
  // The sustained window is the real anti-abuse cap: nobody books eight flights in ten minutes.
  bookings: { name: "bookings", windows: [[4, 5_000], [8, 600_000]] },
  paymentsIntent: { name: "paymentsIntent", windows: [[3, 5_000], [20, 60_000]] },
  // Polling while a payment settles is expected behaviour, so this budget is separate and
  // generous — it must not eat the budget for opening an intent.
  paymentsStatus: { name: "paymentsStatus", windows: [[8, 5_000], [180, 60_000]] },
  paymentsMock: { name: "paymentsMock", windows: [[3, 5_000], [20, 60_000]] },
  // Security-relevant: a reference is six characters, so retrieval is guessable in principle.
  trips: { name: "trips", windows: [[2, 2_000], [12, 60_000]] },
  manage: { name: "manage", windows: [[6, 5_000], [20, 60_000]] },
  support: { name: "support", windows: [[1, 5_000], [6, 3_600_000]] },
  // Reading the mail record is harmless and people refresh; *resending* is the abuse vector.
  emailRead: { name: "emailRead", windows: [[6, 5_000], [120, 3_600_000]] },
  emailRetry: { name: "emailRetry", windows: [[2, 10_000], [12, 3_600_000]] },
  status: { name: "status", windows: [[2, 1_000], [60, 60_000]] },
} satisfies Record<string, RatePolicy>;
