import "dotenv/config";
import { z } from "zod";

/**
 * The API's environment contract. Fails fast at boot: a Render service that starts
 * with half a configuration is worse than one that refuses to start, because the
 * failure surfaces later as a broken admin login instead of a deploy error.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /** Separate from the web app's SESSION_SECRET: different trust domain. */
  ADMIN_SESSION_SECRET: z.string().min(24, "ADMIN_SESSION_SECRET must be at least 24 characters"),
  /** Origins allowed to call this API directly (the Vercel domain). */
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? process.env.NODE_ENV === "production" : v === "1" || v === "true")),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default("cleared"),

  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  SEED_ADMIN_NAME: z.string().default("Owner"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".") || "env"}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;

export const cloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

export const isProd = env.NODE_ENV === "production";
