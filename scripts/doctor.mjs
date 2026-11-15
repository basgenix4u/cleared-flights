#!/usr/bin/env node
/**
 * Pre-deploy configuration check.
 *
 * Mirrors `src/lib/env.ts` (which is TypeScript and cannot be imported by a bare
 * node script). If you change the rule set there, change it here too — the point of
 * this script is to fail before a deploy, not after a customer's booking.
 *
 *   npm run doctor
 */
import { existsSync } from "node:fs";
import { config } from "dotenv";

if (existsSync(".env")) config({ quiet: true });

const has = (k) => Boolean(process.env[k] && process.env[k].trim());
const NODE_ENV = process.env.NODE_ENV ?? "development";
const prod = NODE_ENV === "production";

const errors = [];
const warnings = [];

if (!has("DATABASE_URL")) errors.push("DATABASE_URL is missing: the app cannot start or build.");
for (const k of ["SESSION_SECRET", "DATA_ENCRYPTION_KEY"]) {
  if (!has(k)) errors.push(`${k} is missing. Generate one with: openssl rand -base64 32`);
  else if (process.env[k].trim().length < 24) warnings.push(`${k} is shorter than 24 characters; use a 32-byte base64 value.`);
}

const token = process.env.DUFFEL_ACCESS_TOKEN?.trim();
const synthetic = ["1", "true"].includes((process.env.ALLOW_SYNTHETIC_INVENTORY ?? "").toLowerCase());

if (!token) {
  if (prod && !synthetic) {
    errors.push(
      "No inventory provider and ALLOW_SYNTHETIC_INVENTORY is off: search will refuse to serve. Set DUFFEL_ACCESS_TOKEN.",
    );
  } else {
    warnings.push("No DUFFEL_ACCESS_TOKEN: running on synthetic inventory (fine for development, staging and smoke tests).");
  }
}
if (prod && synthetic) {
  errors.push("ALLOW_SYNTHETIC_INVENTORY is on in production: customers could be shown invented flights. Unset it.");
}
if (token && !/^duffel_(test|live)_/.test(token)) warnings.push("DUFFEL_ACCESS_TOKEN does not look like a Duffel token (duffel_test_… / duffel_live_…).");

const payments = process.env.PAYMENTS_PROVIDER ?? "none";
if (payments === "none") warnings.push("PAYMENTS_PROVIDER=none: no card can be collected, so nothing can actually be sold.");

const percent = Number(process.env.SERVICE_FEE_PERCENT ?? 0);
const flat = Number(process.env.SERVICE_FEE_PER_TRAVELLER ?? 0);
if (percent <= 0 && flat <= 0) errors.push("No service fee configured: every booking would be sold below cost.");
else if (percent > 0 && percent < 1) warnings.push("Service fee below 1%: provider fees will exceed it on most tickets.");

if (!has("SUPPORT_EMAIL") && !has("SUPPORT_WHATSAPP")) warnings.push("No support channel configured: customers will have nowhere to go.");
if (!has("NEXT_PUBLIC_SITE_URL")) warnings.push("NEXT_PUBLIC_SITE_URL is unset: metadata and canonical URLs will point at localhost.");

const sellable = Boolean(token || synthetic) && payments !== "none" && errors.length === 0;

const line = (label, ok) => console.log(`  ${ok ? "✓" : "✗"} ${label}`);
console.log(`\nCleared doctor · NODE_ENV=${NODE_ENV}\n`);
line("environment", errors.length === 0);
line("inventory provider", Boolean(token || synthetic));
line("payment collection", payments !== "none");
line(`service fee (${percent || 0}%, floor ${process.env.SERVICE_FEE_MIN ?? "-"}, cap ${process.env.SERVICE_FEE_MAX ?? "-"})`, percent > 0 || flat > 0);
line("support channel", has("SUPPORT_EMAIL") || has("SUPPORT_WHATSAPP"));

if (errors.length) {
  console.log("\nErrors:");
  for (const e of errors) console.log(`  ! ${e}`);
}
if (warnings.length) {
  console.log("\nWarnings:");
  for (const w of warnings) console.log(`  · ${w}`);
}
console.log(`\n${sellable ? "This deployment CAN take money." : "This deployment CANNOT take money yet."}\n`);

process.exit(errors.length ? 1 : 0);
