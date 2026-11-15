import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../env.js";
import * as schema from "./schema.js";

/**
 * Neon is a pooled Postgres. A small pool per instance is correct behind Render's
 * load balancer, and `max` stays low so several instances cannot exhaust Neon's
 * connection limit between them.
 */
// Neon requires TLS; a local Postgres refuses it. Infer from the host so the same
// build works in both places, with PGSSL=1 / PGSSL=0 to force a choice.
const isLocal = /(^|@)(localhost|127\.0\.0\.1|::1)/.test(env.DATABASE_URL);
const useSsl = process.env.PGSSL === "1" || (process.env.PGSSL !== "0" && !isLocal);

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: Number(process.env.PGPOOL_MAX ?? 8),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

pool.on("error", (err) => console.error("[db] idle client error", err.message));

export const db = drizzle(pool, { schema });
export { pool };
