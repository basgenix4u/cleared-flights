import { nullProvider, postmarkProvider, resendProvider } from "./providers";
import type { EmailProvider } from "./types";

/** EMAIL_PROVIDER=none|resend|postmark. `none` is the honest default: mail is queued and marked skipped. */
export function emailProvider(): EmailProvider {
  const from = process.env.EMAIL_FROM ?? "Cleared <bookings@cleared.example>";
  const kind = (process.env.EMAIL_PROVIDER ?? "none").toLowerCase();
  if (kind === "resend" && process.env.RESEND_API_KEY) return resendProvider(process.env.RESEND_API_KEY, from);
  if (kind === "postmark" && process.env.POSTMARK_SERVER_TOKEN) return postmarkProvider(process.env.POSTMARK_SERVER_TOKEN, from);
  return nullProvider;
}

export function emailConfigured(): boolean {
  return emailProvider().id !== "none";
}

/** Where internal ops alerts go. Unset means ops mail is skipped, never sent to a customer. */
export function opsAddress(): string | null {
  return process.env.OPS_EMAIL || null;
}

export * from "./types";
