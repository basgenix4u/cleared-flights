import { pool } from "../db/index.js";

/**
 * Durable rate limiting for the API.
 *
 * Shares the `rate_limits` table with the web app, so a login attempt and a search cost the
 * same counter system and survive a restart or a second instance. The in-process map stays as
 * the fallback when the database is unreachable: allowing traffic is the better failure mode
 * for a login form than locking every operator out of the desk.
 */
const memory = new Map<string, { n: number; reset: number }>();

async function durable(key: string, limit: number, windowMs: number): Promise<{ n: number; resetMs: number } | null> {
  try {
    const { rows } = await pool.query<{ count: number; window_start: Date }>(
      `insert into rate_limits (key, window_start, count) values ($1, now(), 1)
       on conflict (key) do update set
         count = case when rate_limits.window_start < now() - ($2::int * interval '1 millisecond') then 1 else rate_limits.count + 1 end,
         window_start = case when rate_limits.window_start < now() - ($2::int * interval '1 millisecond') then now() else rate_limits.window_start end
       returning count, window_start`,
      [key, windowMs],
    );
    const row = rows[0];
    return row ? { n: Number(row.count), resetMs: new Date(row.window_start).getTime() + windowMs } : null;
  } catch {
    return null;
  }
}

async function readOnly(key: string, windowMs: number): Promise<{ n: number; resetMs: number } | null> {
  try {
    const { rows } = await pool.query<{ count: number; window_start: Date }>(
      `select count, window_start from rate_limits where key = $1 and window_start >= now() - ($2::int * interval '1 millisecond')`,
      [key, windowMs],
    );
    const row = rows[0];
    return row ? { n: Number(row.count), resetMs: new Date(row.window_start).getTime() + windowMs } : null;
  } catch {
    return null;
  }
}

function memoryRead(key: string, windowMs: number) {
  const now = Date.now();
  const b = memory.get(key);
  if (!b || b.reset < now) {
    memory.set(key, { n: 0, reset: now + windowMs });
    return { n: 0, resetMs: now + windowMs };
  }
  return { n: b.n, resetMs: b.reset };
}

/** Charge one unit and report the new state. */
export async function take(key: string, limit: number, windowMs: number) {
  const measured = (await durable(key, limit, windowMs)) ?? (() => {
    const local = memoryRead(key, windowMs);
    memory.set(key, { n: local.n + 1, reset: local.resetMs });
    return { n: local.n + 1, resetMs: local.resetMs };
  })();
  const retryAfter = Math.max(1, Math.ceil((measured.resetMs - Date.now()) / 1000));
  return { ok: measured.n <= limit, remaining: Math.max(0, limit - measured.n), retryAfter, count: measured.n };
}

/** Check without charging — used so only *failed* logins spend the failure budget. */
export async function peek(key: string, limit: number, windowMs: number) {
  const measured = (await readOnly(key, windowMs)) ?? memoryRead(key, windowMs);
  return {
    ok: measured.n < limit,
    remaining: Math.max(0, limit - measured.n),
    retryAfter: Math.max(1, Math.ceil((measured.resetMs - Date.now()) / 1000)),
    count: measured.n,
  };
}
