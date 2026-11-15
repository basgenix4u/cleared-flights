/**
 * Runtime modes. `Mode` describes where a piece of data came from, and it is stored
 * on every booking so provenance can never be argued about later.
 *
 * It is deliberately NOT a customer-facing concept any more. See `inventoryState()`
 * below: in production, synthetic data cannot reach a customer at all.
 */
export type Mode = "demo" | "sandbox" | "live";

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const str = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export const IS_PROD = process.env.NODE_ENV === "production";

export const BRAND = {
  name: "Cleared",
  tagline: "Flights, priced all-in.",
  /** No invented contact details: an unset channel is simply not shown. */
  supportEmail: str(process.env.SUPPORT_EMAIL),
  supportPhone: str(process.env.SUPPORT_PHONE),
  /** Digits only, e.g. 2348012345678. Powers the WhatsApp entry point. */
  whatsapp: str(process.env.SUPPORT_WHATSAPP)?.replace(/[^\d]/g, ""),
  siteUrl: str(process.env.NEXT_PUBLIC_SITE_URL) ?? "http://localhost:3000",
  /** Display name of the operating entity, shown in the footer and booking terms. */
  legalName: str(process.env.COMPANY_LEGAL_NAME) ?? "Cleared Travel Ltd",
};

/**
 * Service fee: a percentage of the airline amount, with a floor and a cap per
 * paying traveller. A flat fee cannot survive a supplier that charges a percentage
 * of order value — see docs/04-business-analysis.md §4.
 */
export const FEE = {
  percent: num(process.env.SERVICE_FEE_PERCENT, 2.5),
  min: num(process.env.SERVICE_FEE_MIN, 6),
  max: num(process.env.SERVICE_FEE_MAX, 40),
  /** Legacy flat fee, used only when percent is 0 (kept for older deployments). */
  flat: num(process.env.SERVICE_FEE_PER_TRAVELLER, 0),
};

/** Provider mode is derived from the token. No token = synthetic inventory. */
export function providerMode(): Mode {
  const t = process.env.DUFFEL_ACCESS_TOKEN;
  if (!t) return "demo";
  return t.startsWith("duffel_live_") ? "live" : "sandbox";
}

/** Synthetic inventory is a development and staging fixture, never a product. */
export function syntheticInventoryAllowed(): boolean {
  if (!IS_PROD) return true;
  return process.env.ALLOW_SYNTHETIC_INVENTORY === "1" || process.env.ALLOW_SYNTHETIC_INVENTORY === "true";
}

/**
 * Can this deployment show flights to a customer?
 * - a provider token is present, or
 * - synthetic inventory is explicitly permitted (staging / smoke tests).
 */
export function inventoryAvailable(): boolean {
  return Boolean(process.env.DUFFEL_ACCESS_TOKEN) || syntheticInventoryAllowed();
}

/** Can this deployment take money? Placeholder until the payment path exists. */
export function paymentsAvailable(mode: Mode = providerMode()): boolean {
  return mode === "demo" || mode === "sandbox";
}

/**
 * The honest, single-value summary the UI binds to. `closed` means the site must
 * not pretend to sell: it says so and offers support instead of invented flights.
 */
export type InventoryState = "live" | "test" | "preview" | "closed";

export function inventoryState(): InventoryState {
  const mode = providerMode();
  if (mode === "live") return "live";
  if (mode === "sandbox") return "test";
  return syntheticInventoryAllowed() ? "preview" : "closed";
}

/** Shown to operators and to testers — never rendered in a live sale. */
export const MODE_COPY: Record<Mode, { label: string; short: string; detail: string }> = {
  demo: {
    label: "Preview inventory",
    short: "PREVIEW",
    detail:
      "This environment runs on preview inventory: schedules and prices are generated, no airline holds a seat, and nothing is charged.",
  },
  sandbox: {
    label: "Test inventory",
    short: "TEST",
    detail:
      "Connected to the provider's test environment. Orders are simulated by the provider; no real tickets are issued and no money moves.",
  },
  live: { label: "Live", short: "LIVE", detail: "Connected to live airline inventory." },
};

export const SEARCH_TTL_MS = 30 * 60 * 1000;

/** Display currency for prices we own (fees, refunds we control). */
export const DISPLAY_CURRENCY = "USD";
