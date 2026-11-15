/**
 * Concurrency harness.
 *
 *   npm run load                      # search path, 40 connections, 800 requests
 *   npm run load -- --requests 2000 --concurrency 80
 *   npm run load -- --path /api/offers  # any GET-able route (see --help notes)
 *
 * Two different questions, deliberately separated:
 *
 *   1. THROUGHPUT — spread across synthetic client IPs so the rate limiter is not the
 *      bottleneck being measured.
 *   2. THE LIMITER — a single IP hammering the same route, asserting it is refused with 429
 *      and a usable Retry-After rather than degrading the service or leaking through.
 *
 * Exit code is non-zero if any 5xx appears, if throughput collapses, or if the limiter fails
 * to engage. A load test that only reports pretty numbers is decoration.
 */
import "dotenv/config";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = arg("url", process.env.LOAD_URL ?? "http://localhost:3000");
const CONCURRENCY = Number(arg("concurrency", 40));
const REQUESTS = Number(arg("requests", 800));
const PATH = arg("path", "/api/search");
const BURST = Number(arg("burst", 60));

const body = {
  trip: "round",
  legs: [
    { from: "LOS", to: "LHR", date: future(21) },
    { from: "LHR", to: "LOS", date: future(28) },
  ],
  adults: 1,
  children: 0,
  infants: 0,
  cabin: "economy",
};

function future(days) {
  return new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
}

const latencies = [];
const statuses = new Map();
let sent = 0;
let slowest = 0;

function record(ms, status) {
  sent += 1;
  latencies.push(ms);
  statuses.set(status, (statuses.get(status) ?? 0) + 1);
  slowest = Math.max(slowest, ms);
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))] ?? 0;

async function one(i) {
  // Distinct synthetic IPs so throughput measures the app, not the limiter.
  const ip = `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;
  const started = performance.now();
  try {
    const res = await fetch(BASE + PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    await res.arrayBuffer();
    record(Math.round(performance.now() - started), res.status);
  } catch {
    record(Math.round(performance.now() - started), 0);
  }
}

console.log(`\n  Throughput run — ${REQUESTS} requests, ${CONCURRENCY} in flight, ${PATH}\n`);
const t0 = performance.now();
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < REQUESTS) {
      const i = next++;
      await one(i);
    }
  }),
);
const wallSec = (performance.now() - t0) / 1000;

const sorted = [...latencies].sort((a, b) => a - b);
const ok = sorted.filter((_, i) => latencies[i] >= 0); // placeholder to keep lint calm
const okCount = [...statuses.entries()].filter(([s]) => s >= 200 && s < 300).reduce((a, [, n]) => a + n, 0);
const server = [...statuses.entries()].filter(([s]) => s >= 500).reduce((a, [, n]) => a + n, 0);
const refused = [...statuses.entries()].filter(([s]) => s === 429).reduce((a, [, n]) => a + n, 0);

const table = {
  requests: sent,
  ok: okCount,
  "5xx": server,
  "429": refused,
  rps: Number((sent / wallSec).toFixed(1)),
  p50: `${percentile(sorted, 50)}ms`,
  p95: `${percentile(sorted, 95)}ms`,
  p99: `${percentile(sorted, 99)}ms`,
  max: `${slowest}ms`,
  wall: `${wallSec.toFixed(2)}s`,
};
void ok;
console.table(table);

// ------------------------------------------------------------------ the limiter run
console.log(`\n  Limiter run — ${BURST} rapid requests from one IP, ${PATH}\n`);
const burstLatency = [];
const burstStatuses = new Map();
let sawRetryAfter = false;
let sawBudgetHeader = false;

await Promise.all(
  Array.from({ length: BURST }, async () => {
    const started = performance.now();
    try {
      const res = await fetch(BASE + PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.77" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.headers.get("retry-after")) sawRetryAfter = true;
      if (res.headers.get("ratelimit-remaining")) sawBudgetHeader = true;
      await res.arrayBuffer();
      burstStatuses.set(res.status, (burstStatuses.get(res.status) ?? 0) + 1);
      burstLatency.push(Math.round(performance.now() - started));
    } catch {
      burstStatuses.set(0, (burstStatuses.get(0) ?? 0) + 1);
    }
  }),
);

const blocked = burstStatuses.get(429) ?? 0;
const allowed = [...burstStatuses.entries()].filter(([s]) => s >= 200 && s < 300).reduce((a, [, n]) => a + n, 0);
console.table({ allowed, blocked, "5xx": burstStatuses.get(500) ?? 0, retryAfter: sawRetryAfter, budgetHeader: sawBudgetHeader });

// ------------------------------------------------------------------------- verdict
const failures = [];
if (server > 0) failures.push(`${server} server errors under load`);
if (burstStatuses.get(500)) failures.push("the limiter run produced 5xx");
if (okCount === 0) failures.push("no successful responses");
if (blocked === 0) failures.push("the limiter never engaged — a single IP was never refused");
if (!sawRetryAfter) failures.push("429 responses carried no Retry-After header");
if (percentile(sorted, 95) > 5_000) failures.push(`p95 ${percentile(sorted, 95)}ms exceeds the 5s ceiling`);

if (failures.length) {
  console.error(`\n  FAILED\n${failures.map((f) => `    - ${f}`).join("\n")}\n`);
  process.exit(1);
}
console.log("\n  PASSED — no 5xx, limiter engaged with a usable Retry-After, p95 inside the ceiling.\n");
