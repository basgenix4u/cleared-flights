import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { adminSessions, adminUsers } from "../db/schema.js";
import { audit } from "../lib/audit.js";
import { hashPassword, passwordProblems, verifyPassword } from "../lib/crypto.js";
import { ApiError, clientIp, readCookie, unauthorized, wrap } from "../lib/http.js";
import { COOKIE, createSession, currentUser, destroySession, loginAttempts, loginFailureCheck, loginFailureHit } from "../lib/session.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().min(3).max(200),
  password: z.string().min(1).max(200),
});

authRouter.post(
  "/login",
  wrap(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const ip = clientIp(req);
    const key = `${ip}|${email.toLowerCase()}`;
    // Traffic budget first (cheap, generous), then the failure budget (strict).
    const attempts = await loginAttempts(ip);
    if (!attempts.ok) throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Try again shortly.", { retryAfter: attempts.retryAfter });
    const failures = await loginFailureCheck(key);
    if (!failures.ok) throw new ApiError(429, "RATE_LIMITED", "Too many failed attempts on this account. Try again in a few minutes.", { retryAfter: failures.retryAfter });

    const lookup = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email.toLowerCase().trim()))
      .limit(1);
    const user = lookup[0];

    // Same response and similar timing whether or not the account exists.
    const ok = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, "scrypt$16384$00$00");
    if (!user || !ok || !user.active) {
      // Spend the failure budget only when authentication actually fails.
      await loginFailureHit(key);
      throw unauthorized("Those details did not match an account.");
    }

    req.user = user;
    const { expiresAt } = await createSession(user.id, req, res);
    await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, user.id));
    await audit(req, "auth.login", "admin_user", user.id);

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      expiresAt,
    });
  }),
);

authRouter.post(
  "/logout",
  wrap(async (req, res) => {
    const user = await currentUser(req);
    if (user) {
      req.user = user;
      await audit(req, "auth.logout", "admin_user", user.id);
    }
    await destroySession(req, res);
    res.json({ ok: true });
  }),
);

authRouter.get(
  "/me",
  wrap(async (req, res) => {
    const user = await currentUser(req);
    if (!user) throw unauthorized();
    req.user = user;
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  }),
);

authRouter.post(
  "/password",
  wrap(async (req, res) => {
    const body = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(1) }).parse(req.body);
    const user = await currentUser(req);
    if (!user) throw unauthorized();
    req.user = user;
    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) throw unauthorized("Your current password is wrong.");
    const problems = passwordProblems(body.newPassword);
    if (problems.length) throw new ApiError(400, "WEAK_PASSWORD", problems.join(" "));

    await db.update(adminUsers).set({ passwordHash: await hashPassword(body.newPassword) }).where(eq(adminUsers.id, user.id));
    // Changing a password invalidates every session, including this one: a stolen
    // cookie must not survive the action taken to revoke it.
    await db.delete(adminSessions).where(eq(adminSessions.userId, user.id));
    await audit(req, "auth.password_changed", "admin_user", user.id);
    res.clearCookie(COOKIE, { path: "/" });
    res.json({ ok: true, reauth: true, hadSession: Boolean(readCookie(req, COOKIE)) });
  }),
);
