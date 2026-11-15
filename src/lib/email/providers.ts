import type { EmailMessage, EmailProvider, EmailSendResult } from "./types";

/**
 * Resend. Chosen first because it needs one key and one verified domain, and returns a
 * message id we can store as proof of handoff.
 */
export function resendProvider(apiKey: string, from: string): EmailProvider {
  // EMAIL_API_BASE exists so a test double or a self-hosted relay can stand in for the
  // provider. It is never set in production.
  const base = (process.env.EMAIL_API_BASE ?? "https://api.resend.com").replace(/\/$/, "");
  return {
    id: "resend",
    async send(message: EmailMessage): Promise<EmailSendResult> {
      const res = await fetch(`${base}/emails`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) return { ok: false, error: `resend_${res.status}:${body.message ?? "unknown"}` };
      return { ok: true, id: body.id };
    },
  };
}

/** Postmark. Alternative for teams already on it for deliverability. */
export function postmarkProvider(serverToken: string, from: string): EmailProvider {
  return {
    id: "postmark",
    async send(message: EmailMessage): Promise<EmailSendResult> {
      const res = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: { "X-Postmark-Server-Token": serverToken, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          From: from,
          To: message.to,
          Subject: message.subject,
          HtmlBody: message.html,
          TextBody: message.text,
          ReplyTo: message.replyTo,
          MessageStream: "outbound",
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as { MessageID?: string; Message?: string; ErrorCode?: number };
      if (!res.ok || (body.ErrorCode && body.ErrorCode !== 0)) return { ok: false, error: `postmark_${res.status}:${body.Message ?? "unknown"}` };
      return { ok: true, id: body.MessageID };
    },
  };
}

/**
 * No provider configured. It does not pretend to send — the caller records the message as
 * skipped so the customer-facing record stays truthful.
 */
export const nullProvider: EmailProvider = {
  id: "none",
  async send() {
    return { ok: false, error: "no_email_provider" };
  },
};
