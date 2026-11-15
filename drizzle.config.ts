import { defineConfig } from "drizzle-kit";
import "dotenv/config";

/**
 * Credentials come from DATABASE_URL so the same config works locally, in CI and in
 * production. Never commit a connection string here.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
