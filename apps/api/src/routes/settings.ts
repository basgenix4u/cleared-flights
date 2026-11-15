import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { settings } from "../db/schema.js";
import { audit } from "../lib/audit.js";
import { wrap } from "../lib/http.js";
import { requireRole } from "../lib/session.js";

export const settingsRouter = Router();

/**
 * Small key/value store for things an operator must change without a deploy:
 * announcement banners, support hours, whether search is open, featured routes.
 */
const KEY = z.string().min(2).max(60).regex(/^[a-z0-9_.-]+$/, "Use lowercase letters, digits, dot, dash or underscore.");

settingsRouter.get(
  "/",
  requireRole("owner", "admin", "editor"),
  wrap(async (_req, res) => {
    const rows = await db.select().from(settings).orderBy(desc(settings.updatedAt));
    res.json({ settings: rows });
  }),
);

settingsRouter.put(
  "/:key",
  requireRole("owner", "admin"),
  wrap(async (req, res) => {
    const key = KEY.parse(req.params.key);
    const body = z.object({ value: z.unknown() }).parse(req.body);
    const row = await db
      .insert(settings)
      .values({ key, value: body.value as never, updatedBy: req.user?.id ?? null })
      .onConflictDoUpdate({ target: settings.key, set: { value: body.value as never, updatedBy: req.user?.id ?? null, updatedAt: new Date() } })
      .returning();
    await audit(req, "setting.updated", "setting", key, { value: body.value });
    res.json({ setting: row[0] });
  }),
);

settingsRouter.delete(
  "/:key",
  requireRole("owner", "admin"),
  wrap(async (req, res) => {
    const key = KEY.parse(req.params.key);
    await db.delete(settings).where(eq(settings.key, key));
    await audit(req, "setting.deleted", "setting", key);
    res.json({ ok: true });
  }),
);
