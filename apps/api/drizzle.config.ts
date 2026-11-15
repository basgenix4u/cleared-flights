import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Run against the Neon connection string. Use the *pooled* host for the app and the
// *direct* host for migrations; see docs/07-platform-deployment.md.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
