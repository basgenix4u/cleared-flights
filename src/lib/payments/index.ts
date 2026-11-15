import { mockProvider } from "./mock";
import { paystackProvider } from "./paystack";
import { stripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export * from "./types";

export type ProviderId = "paystack" | "stripe" | "mock";

const REGISTRY: Record<ProviderId, PaymentProvider> = {
  paystack: paystackProvider,
  stripe: stripeProvider,
  mock: mockProvider,
};

export function configuredProviderId(): ProviderId | null {
  const raw = (process.env.PAYMENTS_PROVIDER ?? "none").toLowerCase();
  return raw === "paystack" || raw === "stripe" || raw === "mock" ? raw : null;
}

/** The active provider, or null when payments are not configured — the honest default. */
export function paymentProvider(): PaymentProvider | null {
  const id = configuredProviderId();
  return id ? REGISTRY[id] : null;
}

export function providerById(id: string): PaymentProvider | null {
  return REGISTRY[id as ProviderId] ?? null;
}

/** Whether this deployment can genuinely take money right now. */
export function paymentsConfigured(): boolean {
  const id = configuredProviderId();
  if (!id) return false;
  if (id === "paystack") return Boolean(process.env.PAYSTACK_SECRET_KEY);
  if (id === "stripe") return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  return id === "mock";
}

export function callbackUrl(reference: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/checkout/pay/callback?ref=${encodeURIComponent(reference)}`;
}
