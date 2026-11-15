import express from "express";
import { env, isProd } from "./env.js";
import { errorHandler } from "./lib/http.js";
import { requireAuth } from "./lib/session.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { mediaRouter } from "./routes/media.js";
import { bookingsRouter } from "./routes/bookings.js";
import { adminPostsRouter } from "./routes/posts.js";
import { publicRouter } from "./routes/public.js";
import { settingsRouter } from "./routes/settings.js";
import { statsRouter } from "./routes/stats.js";

export function createApp() {
  const app = express();

  // Behind Render's proxy, so the client IP arrives in x-forwarded-for and cookies
  // marked Secure must survive a TLS-terminating hop.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  // The web app calls this service server-to-server, so CORS only matters for
  // direct browser calls during development. Allowlist, never "*" with credentials.
  const allowed = new Set([env.WEB_ORIGIN, "http://localhost:3000"]);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowed.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.use((req, res, next) => {
    const t = Date.now();
    res.on("finish", () => {
      if (req.path !== "/health") console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t}ms`);
    });
    next();
  });

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/public", publicRouter);

  // Everything below requires a session.
  app.use("/admin/posts", requireAuth, adminPostsRouter);
  app.use("/admin/media", requireAuth, mediaRouter);
  app.use("/admin/settings", requireAuth, settingsRouter);
  app.use("/admin/stats", requireAuth, statsRouter);
  app.use("/admin/bookings", requireAuth, bookingsRouter);

  app.use((_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "No such endpoint." } }));
  app.use(errorHandler);
  return app;
}

const app = createApp();
const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`[api] listening on :${env.PORT} (${isProd ? "production" : "development"})`);
});

/** Render sends SIGTERM on deploy: stop accepting, drain, then exit. */
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
