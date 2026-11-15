/**
 * Server-side environment contract.
 *
 * Nothing here runs in the browser: the module reads secrets, so it must only be
 * imported from route handlers, server components, or scripts. Client components
 * read public values from `@/lib/config` instead.
 *
 * Design rule: this module never throws at import time. A misconfigured deploy must
 * fail loudly on `/api/health` and at boot (`npm run doctor`) rather than crashing a
 * render at runtime, which would turn a config mistake into a blank page.
 */
import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "1" || v?.toLowerCase() === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /** Absent token = no live inventory. That is a valid state, but it is not a sellable one. */
  DUFFEL_ACCESS_TOKEN: z.string().optional(),

  SESSION_SECRET: z.string().min(24, "SESSION_SECRET must be at least 24 characters"),
  DATA_ENCRYPTION_KEY: z.string().min(24, "DATA_ENCRYPTION_KEY must be at least 24 characters"),

  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),

  /** Percentage fee, applied with a floor and a cap. See docs/04-business-analysis.md §4. */
  SERVICE_FEE_PERCENT: z.coerce.number().min(0).max(50).default(2.5),
  SERVICE_FEE_MIN: z.coerce.number().min(0).default(6),
  SERVICE_FEE_MAX: z.coerce.number().min(0).default(40),
  /** Legacy flat fee. Ignored when SERVICE_FEE_PERCENT > 0. */
  SERVICE_FEE_PER_TRAVELLER: z.coerce.number().min(0).default(0),

  SUPPORT_EMAIL: z.string().optional(),
  SUPPORT_PHONE: z.string().optional(),
  SUPPORT_WHATSAPP: z.string().optional(),

  /**
   * Allows synthetic inventory outside development. This exists so staging and
   * smoke tests can exercise the whole flow. It must be absent in production:
   * with it unset and no provider token, the app refuses to sell rather than
   * showing a customer a flight that does not exist.
   */
  ALLOW_SYNTHETIC_INVENTORY: bool,

  PAYMENTS_PROVIDER: z.enum(["none", "paystack", "stripe", "mock"]).default("none"),
  EMAIL_PROVIDER: z.enum(["none", "resend", "postmark"]).default("none"),
  EMAIL_FROM: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  POSTMARK_SERVER_TOKEN: z.string().optional(),
  OPS_EMAIL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function raw() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DUFFEL_ACCESS_TOKEN: process.env.DUFFEL_ACCESS_TOKEN || undefined,
    SESSION_SECRET: process.env.SESSION_SECRET,
    DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    SERVICE_FEE_PERCENT: process.env.SERVICE_FEE_PERCENT,
    SERVICE_FEE_MIN: process.env.SERVICE_FEE_MIN,
    SERVICE_FEE_MAX: process.env.SERVICE_FEE_MAX,
    SERVICE_FEE_PER_TRAVELLER: process.env.SERVICE_FEE_PER_TRAVELLER,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || undefined,
    SUPPORT_PHONE: process.env.SUPPORT_PHONE || undefined,
    SUPPORT_WHATSAPP: process.env.SUPPORT_WHATSAPP || undefined,
    ALLOW_SYNTHETIC_INVENTORY: process.env.ALLOW_SYNTHETIC_INVENTORY,
    PAYMENTS_PROVIDER: process.env.PAYMENTS_PROVIDER,
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || undefined,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || undefined,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || undefined,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_FROM: process.env.EMAIL_FROM || undefined,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    POSTMARK_SERVER_TOKEN: process.env.POSTMARK_SERVER_TOKEN || undefined,
    OPS_EMAIL: process.env.OPS_EMAIL || undefined,
  };
}

export interface EnvReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** True when the deployment can legitimately take a customer's money. */
  sellable: boolean;
  env: Env | null;
}

/**
 * Validate the environment and report what would stop this deployment from selling.
 * Warnings are things that are legal but will cost money or trust; errors are fatal.
 */
export function checkEnv(): EnvReport {
  const parsed = envSchema.safeParse(raw());
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`);
    return { ok: false, errors, warnings: [], sellable: false, env: null };
  }
  const env = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!env.DUFFEL_ACCESS_TOKEN) {
    if (env.NODE_ENV === "production" && !env.ALLOW_SYNTHETIC_INVENTORY) {
      errors.push(
        "No inventory provider configured: set DUFFEL_ACCESS_TOKEN. Without it the site refuses to sell rather than show invented flights.",
      );
    } else {
      warnings.push("No DUFFEL_ACCESS_TOKEN: running on synthetic inventory (development only).");
    }
  }

  if (env.NODE_ENV === "production" && env.ALLOW_SYNTHETIC_INVENTORY) {
    warnings.push(
      "ALLOW_SYNTHETIC_INVENTORY is set in production: customers can reach invented flights. Unset this before going live.",
    );
  }

  if (env.PAYMENTS_PROVIDER === "none") {
    warnings.push("PAYMENTS_PROVIDER=none: no card can be collected, so no booking can be paid for.");
  }

  if (env.SERVICE_FEE_PERCENT === 0 && env.SERVICE_FEE_PER_TRAVELLER === 0) {
    warnings.push("No service fee configured: every booking will be sold below cost.");
  } else if (env.SERVICE_FEE_PERCENT > 0 && env.SERVICE_FEE_MIN > 0 && env.SERVICE_FEE_PERCENT < 1) {
    warnings.push("Service fee percentage below 1% will not cover provider fees on most tickets.");
  }

  if (env.EMAIL_PROVIDER === "none") {
    warnings.push("EMAIL_PROVIDER=none: confirmations, tickets and refunds are queued but not delivered. No email is faked.");
  } else if (env.EMAIL_PROVIDER === "resend" && !env.RESEND_API_KEY) {
    errors.push("EMAIL_PROVIDER=resend but RESEND_API_KEY is missing.");
  } else if (env.EMAIL_PROVIDER === "postmark" && !env.POSTMARK_SERVER_TOKEN) {
    errors.push("EMAIL_PROVIDER=postmark but POSTMARK_SERVER_TOKEN is missing.");
  }

  if (!env.OPS_EMAIL && env.EMAIL_PROVIDER !== "none") {
    warnings.push("OPS_EMAIL is not set: paid-but-not-ticketed alerts have nowhere to go.");
  }

  if (!env.SUPPORT_EMAIL) warnings.push("SUPPORT_EMAIL is not set: the support and help surfaces will omit a contact address.");

  const hasInventory = Boolean(env.DUFFEL_ACCESS_TOKEN) || env.ALLOW_SYNTHETIC_INVENTORY;
  const sellable = hasInventory && env.PAYMENTS_PROVIDER !== "none" && errors.length === 0;

  return { ok: errors.length === 0, errors, warnings, sellable, env };
}
