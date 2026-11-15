import { and, eq, gt, lt, or } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db } from "../db/index.js";
import { adminSessions, adminUsers, type AdminUser } from "../db/schema.js";
import { env, isProd } from "../env.js";
import { readCookie, unauthorized } from "./http.js";
import { peek, take } from "./ratelimit.js";
import { randomToken, sha256 } from "./crypto.js";

export const COOKIE = "cw_admin";
const TTL_HOURS = 12;

declare global {
  namespace Express {
    interface Request {
      user?: AdminUser;
      sessionId?: string;
    }
  }
}

export async function createSession(userId: string, req: Request, res: Response) {
  const token = `${randomToken()}`;
  const expiresAt = new Date(Date.now() + TTL_HOURS * 3600_000);
  await db.insert(adminSessions).values({
    userId,
    tokenHash: sha256(token),
    ip: (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? null,
    userAgent: (req.headers["user-agent"] ?? "").slice(0, 255) || null,
    expiresAt,
  });
  // Opportunistic cleanup: expired sessions should not accumulate on a free Neon tier.
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));

  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
  return { expiresAt };
}

export async function destroySession(req: Request, res: Response) {
  const token = readCookie(req, COOKIE);
  if (token) await db.delete(adminSessions).where(eq(adminSessions.tokenHash, sha256(token)));
  res.clearCookie(COOKIE, { path: "/", ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}) });
}

/** Resolve the session cookie to a user, or null. Never throws. */
export async function currentUser(req: Request): Promise<AdminUser | null> {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const rows = await db
    .select({ user: adminUsers, sessionId: adminSessions.id })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
    .where(and(eq(adminSessions.tokenHash, sha256(token)), gt(adminSessions.expiresAt, new Date()), eq(adminUsers.active, true)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  req.sessionId = row.sessionId;
  return row.user;
}

/** Express middleware: attach the user or reject. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const user = await currentUser(req);
  if (!user) return next(unauthorized());
  req.user = user;
  next();
}

/** Role gate. `owner` and `admin` may do everything; `editor` writes content only. */
export function requireRole(...roles: AdminUser["role"][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(unauthorized("Your role cannot do that."));
    next();
  };
}

/** Login throttle: 8 attempts per 15 minutes per IP+email. */
/**
 * Two separate budgets, because they defend different things.
 *
 * `loginAttempts` limits total traffic per address (a script). `loginThrottle` limits *failed*
 * attempts per address+account (a password guess). Counting successful logins against the
 * failure budget locks out a person who simply signs in and out a few times, or a team sharing
 * one office address — which is a support ticket, not security.
 */
export function loginAttempts(ip: string) {
  return take(`api:login-ip:${ip}`, 40, 5 * 60_000);
}

const FAILURE_LIMIT = 8;
const FAILURE_WINDOW_MS = 15 * 60_000;

/** Refuse *before* verifying if this account+address has already failed too often. */
export function loginFailureCheck(key: string) {
  return peek(`api:login-fail:${key}`, FAILURE_LIMIT, FAILURE_WINDOW_MS);
}

/** Only ever spent by a wrong password or unknown account. */
export function loginFailureHit(key: string) {
  return take(`api:login-fail:${key}`, FAILURE_LIMIT, FAILURE_WINDOW_MS);
}

export const sessionTtlHours = TTL_HOURS;
export const cookieIsSecure = (): boolean => isProd && env.COOKIE_SECURE;
