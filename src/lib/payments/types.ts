/** Provider-agnostic payment contract. Implementations must be idempotent and never trust the client. */

export interface InitInput {
  /** Our booking reference. Echoed back by the provider so a webhook can be matched. */
  reference: string;
  amountMinor: number;
  currency: string;
  email: string;
  /** Where the provider sends the customer after payment. */
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface InitResult {
  redirectUrl: string;
  providerRef: string;
}

export interface WebhookResult {
  ok: boolean;
  /** Provider's own event id — the uniqueness key that makes processing exactly-once. */
  eventId: string;
  type: string;
  reference: string;
  amountMinor: number;
  currency: string;
  providerRef: string;
  reason?: string;
}

export interface RefundInput {
  providerRef: string;
  amountMinor: number;
  reason?: string;
}

export interface PaymentProvider {
  id: "paystack" | "stripe" | "mock";
  label: string;
  /** True when the provider can actually move money. */
  live: boolean;
  initialize(input: InitInput): Promise<InitResult>;
  /** Verify a webhook signature against the *raw* body. Never parse before verifying. */
  parseWebhook(rawBody: string, headers: Record<string, string | undefined>): Promise<WebhookResult>;
  refund(input: RefundInput): Promise<{ ok: boolean; refundRef: string; reason?: string }>;
}

/** Amounts are stored in the smallest currency unit. Most currencies use 2 decimals. */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "XAF", "XOF", "XPF", "UGX", "RWF"]);

export function toMinor(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
}

export function fromMinor(minor: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? minor : minor / 100;
}
