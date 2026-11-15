import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const badRequest = (m: string) => new ApiError(400, "BAD_REQUEST", m);
export const unauthorized = (m = "Sign in to continue.") => new ApiError(401, "UNAUTHORIZED", m);
export const forbidden = (m = "You do not have access to that.") => new ApiError(403, "FORBIDDEN", m);
export const notFound = (m = "Not found.") => new ApiError(404, "NOT_FOUND", m);

/** Wrap an async handler so rejected promises reach the error middleware. */
export const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) =>
    void fn(req, res).catch(next);

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Some fields need attention.",
        fields: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error("[api] unhandled", message);
  return res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong on our side." } });
}

export const clientIp = (req: Request) =>
  (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";

/** Minimal in-memory limiter. Single instance only — swap for Redis before scaling out. */
const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 20_000) for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.n += 1;
  if (b.n > limit) return { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}

/**
 * Check a budget without spending from it.
 *
 * Needed for anything that must be refused *before* doing expensive work but only *charged*
 * when something goes wrong — a failed login. Counting successes here locks out legitimate
 * people; not checking first lets a script run unthrottled.
 */
export function rateLimitPeek(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) return { ok: true, retryAfter: 0, count: 0, limit };
  return {
    ok: b.n < limit,
    retryAfter: b.n >= limit ? Math.ceil((b.reset - now) / 1000) : 0,
    count: b.n,
    limit,
    windowMs: b.reset - now,
  };
}

/** Spend one unit from a budget. */
export function rateLimitHit(key: string, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) buckets.set(key, { n: 1, reset: now + windowMs });
  else b.n += 1;
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}
