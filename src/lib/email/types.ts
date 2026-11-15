/** A rendered message, ready for any provider. */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  /** Provider-side tag for analytics; never personal data. */
  tag?: string;
}

export interface EmailSendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface EmailProvider {
  id: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/** Everything a template needs. Deliberately plain JSON — payloads live in Postgres. */
export interface EmailPayload {
  reference?: string;
  firstName?: string;
  amount?: string;
  currency?: string;
  route?: string;
  departDate?: string;
  pnr?: string;
  tickets?: string[];
  refundAmount?: string;
  reason?: string;
  note?: string;
  message?: string;
  paymentUrl?: string;
  tripUrl?: string;
  supportUrl?: string;
  decidedBy?: string;
  stuckSince?: string;
  [key: string]: unknown;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}
