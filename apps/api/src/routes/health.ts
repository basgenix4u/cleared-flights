import { Router } from "express";
import { pool } from "../db/index.js";
import { cloudinaryConfigured, env } from "../env.js";
import { wrap } from "../lib/http.js";

export const healthRouter = Router();

/**
 * Render restarts a service that fails its health check, so this must be honest but
 * not fussy: the database is the only hard dependency.
 */
healthRouter.get(
  "/",
  wrap(async (_req, res) => {
    const started = Date.now();
    let dbOk = false;
    let dbMs: number | null = null;
    try {
      const t = Date.now();
      await pool.query("select 1");
      dbMs = Date.now() - t;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const body = {
      ok: dbOk,
      service: "cleared-api",
      env: env.NODE_ENV,
      checks: {
        database: dbOk ? { ok: true, ms: dbMs } : { ok: false },
        cloudinary: { configured: cloudinaryConfigured },
      },
      checkedInMs: Date.now() - started,
      time: new Date().toISOString(),
    };
    res.status(dbOk ? 200 : 503).json(body);
  }),
);
