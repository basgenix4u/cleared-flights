import type { EmailPayload, RenderedEmail } from "./types";

/**
 * Email templates.
 *
 * Same rules as the product: the number is the number, the state is the state. Every
 * template says what actually happened — including "we have your money and the airline has
 * not issued the ticket yet", which most travel mail deliberately blurs.
 *
 * Table-based layout with inline styles, because that is what mail clients still require.
 */

const INK = "#101214";
const INK_2 = "#3a3d42";
const INK_3 = "#5f636a";
const PAPER = "#f3f0e8";
const CARD = "#fbfaf6";
const LINE = "#d8d3c4";
const GO = "#1f7a4c";
const STOP = "#b3261e";
const WARN = "#7a5200";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface Block {
  /** Short status strip at the top: label + tone. */
  status?: { label: string; tone: "go" | "warn" | "stop" | "neutral" };
  heading: string;
  intro: string;
  /** Key/value rows: the facts of the booking. */
  facts?: [string, string][];
  /** A boxed statement that must not be missed. */
  callout?: { title: string; body: string; tone: "go" | "warn" | "stop" | "neutral" };
  cta?: { label: string; url: string };
  footerNote?: string;
}

function layout(block: Block, preheader: string): string {
  const tone = {
    go: { bg: "#e1f0e7", fg: GO },
    warn: { bg: "#fff1c2", fg: WARN },
    stop: { bg: "#fae4e1", fg: STOP },
    neutral: { bg: "#e9e5d9", fg: INK_3 },
  }[block.status?.tone ?? "neutral"];

  const facts = (block.facts ?? [])
    .map(
      ([k, v], i) => `
      <tr>
        <td style="padding:10px 0;border-top:${i === 0 ? "0" : `1px solid ${LINE}`};font:500 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:${INK_3};text-transform:uppercase;letter-spacing:.06em;">${esc(k)}</td>
        <td align="right" style="padding:10px 0;border-top:${i === 0 ? "0" : `1px solid ${LINE}`};font:600 14px/1.4 'Helvetica Neue',Arial,sans-serif;color:${INK};">${esc(v)}</td>
      </tr>`,
    )
    .join("");

  const callout = block.callout
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
      <tr><td style="background:${tone.bg};border-left:3px solid ${tone.fg};padding:14px 16px;">
        <p style="margin:0 0 4px;font:700 13px/1.4 'Helvetica Neue',Arial,sans-serif;color:${tone.fg};">${esc(block.callout.title)}</p>
        <p style="margin:0;font:400 13px/1.6 'Helvetica Neue',Arial,sans-serif;color:${INK_2};">${esc(block.callout.body)}</p>
      </td></tr>
    </table>`
    : "";

  const cta = block.cta
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 0;">
      <tr><td style="background:${INK};">
        <a href="${esc(block.cta.url)}" style="display:inline-block;padding:13px 22px;font:700 13px/1 'Helvetica Neue',Arial,sans-serif;color:#f3f0e8;text-decoration:none;letter-spacing:.01em;">${esc(block.cta.label)}</a>
      </td></tr>
    </table>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${esc(block.heading)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td style="padding:0 4px 18px;">
        <span style="font:700 15px/1 'Helvetica Neue',Arial,sans-serif;color:${INK};letter-spacing:-.02em;">Cleared.</span>
        <span style="font:500 11px/1 ui-monospace,Menlo,monospace;color:${INK_3};text-transform:uppercase;letter-spacing:.08em;">&nbsp;· the whole price, first</span>
      </td></tr>
      <tr><td style="background:${CARD};border:1px solid ${LINE};padding:28px 26px;">
        ${
          block.status
            ? `<span style="display:inline-block;background:${tone.bg};color:${tone.fg};font:700 10.5px/1 ui-monospace,Menlo,monospace;text-transform:uppercase;letter-spacing:.08em;padding:6px 9px;">${esc(block.status.label)}</span>`
            : ""
        }
        <h1 style="margin:16px 0 0;font:700 22px/1.25 'Helvetica Neue',Arial,sans-serif;color:${INK};letter-spacing:-.02em;">${esc(block.heading)}</h1>
        <p style="margin:10px 0 0;font:400 14px/1.65 'Helvetica Neue',Arial,sans-serif;color:${INK_2};">${esc(block.intro)}</p>
        ${facts ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;">${facts}</table>` : ""}
        ${callout}
        ${cta}
      </td></tr>
      <tr><td style="padding:16px 4px 0;font:400 11.5px/1.7 'Helvetica Neue',Arial,sans-serif;color:${INK_3};">
        ${esc(block.footerNote ?? "You are receiving this because you made a booking with Cleared.")}
        <br>Reply to this message and a person reads it.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const textBody = (lines: (string | undefined | null)[]) => lines.filter(Boolean).join("\n");

const tripUrl = (reference?: string) => (reference ? `${SITE}/trips/${reference}` : `${SITE}/trips`);

export const templates: Record<string, (p: EmailPayload) => RenderedEmail> = {
  "booking.received": (p) => {
    const paid = Boolean(p.paymentUrl) === false && p.amount === undefined;
    const heading = p.paymentUrl ? "Your booking is held, not yet paid" : "We have your booking";
    return {
      subject: `Booking ${p.reference ?? ""} — ${p.paymentUrl ? "payment still open" : "received"}`,
      text: textBody([
        `Hello ${p.firstName ?? "there"},`,
        "",
        p.paymentUrl
          ? `We have held ${p.route ?? "your itinerary"} for you. Nothing is ticketed until the payment completes.`
          : `We have your booking for ${p.route ?? "your itinerary"}.`,
        "",
        p.reference ? `Reference: ${p.reference}` : undefined,
        p.route ? `Route: ${p.route}` : undefined,
        p.departDate ? `Departure: ${p.departDate}` : undefined,
        p.amount ? `Total: ${p.amount}` : undefined,
        p.paymentUrl ? `\nComplete payment: ${p.paymentUrl}` : undefined,
        "",
        "No card details are ever stored by us. Payment is handled by the provider shown at checkout.",
        "",
        "— Cleared",
      ]),
      html: layout(
        {
          status: { label: paid ? "Received" : "Awaiting payment", tone: paid ? "go" : "warn" },
          heading,
          intro: p.paymentUrl
            ? "We have held this itinerary and the price you saw is the price you pay. Nothing is ticketed until your payment completes — so if you are not ready, nothing has been charged."
            : "This is your record of what we received. The price you saw is the price you pay, fees included.",
          facts: [
            p.reference ? ["Reference", p.reference] : ["Reference", "—"],
            ...(p.route ? ([["Route", p.route]] as [string, string][]) : []),
            ...(p.departDate ? ([["Departure", p.departDate]] as [string, string][]) : []),
            ...(p.amount ? ([["Total", p.amount]] as [string, string][]) : []),
          ],
          callout: p.paymentUrl
            ? {
                title: "Nothing is ticketed yet",
                body: "Held bookings expire 60 minutes after they are created. If the payment does not complete, the itinerary is released and you are charged nothing.",
                tone: "warn",
              }
            : undefined,
          cta: p.paymentUrl
            ? { label: "Complete payment", url: p.paymentUrl }
            : p.reference
              ? { label: "Open your trip", url: tripUrl(p.reference) }
              : undefined,
        },
        p.paymentUrl ? "Your itinerary is held. Payment is still open." : "Your booking is on file.",
      ),
    };
  },

  "booking.ticketing_pending": (p) => ({
    subject: `Booking ${p.reference ?? ""} — payment received, ticket being issued`,
    text: textBody([
      `Hello ${p.firstName ?? "there"},`,
      "",
      `We have received your payment${p.amount ? ` of ${p.amount}` : ""}. The airline has not issued the ticket yet.`,
      "",
      "We are not going to call this confirmed until it is. We check automatically and will email you the moment the ticket is issued. If the airline cannot confirm it, we refund you in full without you having to ask.",
      "",
      p.reference ? `Reference: ${p.reference}` : undefined,
      "",
      "— Cleared",
    ]),
    html: layout(
      {
        status: { label: "Paid · ticketing", tone: "warn" },
        heading: "Payment received. Ticket not issued yet.",
        intro:
          "Your money is with us and the airline order is in progress. We will not call this confirmed until the airline has actually issued the ticket.",
        facts: [
          ...(p.reference ? ([["Reference", p.reference]] as [string, string][]) : []),
          ...(p.amount ? ([["Paid", p.amount]] as [string, string][]) : []),
          ["Ticketing", "In progress"],
        ],
        callout: {
          title: "If the airline cannot confirm it",
          body: "We retry automatically. If it still fails, the amount is refunded in full without an email from you asking for it.",
          tone: "warn",
        },
        cta: p.reference ? { label: "Track this booking", url: tripUrl(p.reference) } : undefined,
      },
      "Payment received. The ticket is being issued.",
    ),
  }),

  "booking.ticketed": (p) => ({
    subject: `Ticketed — ${p.reference ?? ""}${p.pnr ? ` · ${p.pnr}` : ""}`,
    text: textBody([
      `Hello ${p.firstName ?? "there"},`,
      "",
      "The airline has issued your ticket. This is the confirmation you can show at the airport.",
      "",
      p.reference ? `Booking reference: ${p.reference}` : undefined,
      p.pnr ? `Airline record locator: ${p.pnr}` : undefined,
      p.route ? `Route: ${p.route}` : undefined,
      p.departDate ? `Departure: ${p.departDate}` : undefined,
      p.tickets?.length ? `Ticket number(s): ${p.tickets.join(", ")}` : undefined,
      p.amount ? `Total paid: ${p.amount}` : undefined,
      "",
      "Check the name spelling matches your passport exactly. Changes are possible but airlines charge for them, and we will always show you that price before you commit.",
      "",
      "— Cleared",
    ]),
    html: layout(
      {
        status: { label: "Ticketed", tone: "go" },
        heading: "Your ticket is issued.",
        intro: "The airline has issued the ticket. This email is your confirmation — the record locator below is what the airport will look for.",
        facts: [
          ...(p.reference ? ([["Booking ref", p.reference]] as [string, string][]) : []),
          ...(p.pnr ? ([["Record locator", p.pnr]] as [string, string][]) : []),
          ...(p.route ? ([["Route", p.route]] as [string, string][]) : []),
          ...(p.departDate ? ([["Departure", p.departDate]] as [string, string][]) : []),
          ...(p.tickets?.length ? ([["Ticket no.", p.tickets.join(", ")]] as [string, string][]) : []),
          ...(p.amount ? ([["Total paid", p.amount]] as [string, string][]) : []),
        ],
        callout: {
          title: "Check the spelling",
          body: "The name on the ticket must match the passport. Tell us within 24 hours if anything is wrong and we will raise a correction with the airline before it becomes a paid change.",
          tone: "neutral",
        },
        cta: p.reference ? { label: "Open your trip", url: tripUrl(p.reference) } : undefined,
      },
      `Ticketed${p.pnr ? ` · ${p.pnr}` : ""}.`,
    ),
  }),

  "refund.approved": (p) => ({
    subject: `Refund approved — ${p.reference ?? ""}`,
    text: textBody([
      `Hello ${p.firstName ?? "there"},`,
      "",
      `We have approved your refund of ${p.refundAmount ?? ""} for booking ${p.reference ?? ""}.`,
      "",
      "Approval means we have agreed to pay it. The provider then processes it, and you get a second email confirming that the money actually moved. We will not call it paid before it is.",
      "",
      "— Cleared",
    ]),
    html: layout(
      {
        status: { label: "Approved", tone: "go" },
        heading: "Your refund is approved.",
        intro: "Someone reviewed this and agreed to it. The next step is the payment provider, and then your bank.",
        facts: [
          ...(p.reference ? ([["Reference", p.reference]] as [string, string][]) : []),
          ["Amount", p.refundAmount ?? "—"],
          ...(p.reason ? ([["Basis", p.reason]] as [string, string][]) : []),
        ],
        callout: {
          title: "Approved is not the same as paid",
          body: "You will get a separate confirmation the moment the provider accepts the refund. We would rather send two honest emails than one optimistic one.",
          tone: "warn",
        },
      },
      `Refund of ${p.refundAmount ?? ""} approved.`,
    ),
  }),

  "booking.expired": (p) => ({
    subject: `Held itinerary released — ${p.reference ?? ""}`,
    text: textBody([
      "Hello,",
      "",
      `The itinerary we held for you (${p.reference ?? "reference pending"}) has been released because the payment was not completed in time.`,
      "",
      "Nothing was charged. No card was touched — we only ever take money at the moment you pay.",
      "",
      "If you still want the trip, search again: fares move, and we would rather show you the current price than a stale one.",
      "",
      "— Cleared",
    ]),
    html: layout(
      {
        status: { label: "Released", tone: "neutral" },
        heading: "Your held itinerary was released.",
        intro: "The payment did not complete inside the hold window, so the itinerary went back to the airline. Nothing was charged.",
        facts: [
          ...(p.reference ? ([["Reference", p.reference]] as [string, string][]) : []),
          ["Charged", "Nothing"],
        ],
        callout: {
          title: "No card was touched",
          body: "We take money only at the moment you pay, and only through the provider shown at checkout. A lapsed hold costs you nothing.",
          tone: "go",
        },
        cta: { label: "Search again", url: `${SITE}/flights` },
      },
      "Your hold expired. Nothing was charged.",
    ),
  }),

  "booking.cancelled": (p) => ({
    subject: `Cancelled — ${p.reference ?? ""}`,
    text: textBody([
      `Hello ${p.firstName ?? "there"},`,
      "",
      `Booking ${p.reference ?? ""} has been cancelled.`,
      p.refundAmount ? `Refund due: ${p.refundAmount}${p.reason ? ` (${p.reason})` : ""}` : "The airline refund on this fare is nil.",
      "",
      p.refundAmount
        ? "Refunds go back to the original payment method. We will email you when the provider confirms it, not before."
        : "We would rather tell you this in money than in language. If anything is recoverable later, we will come back to you.",
      "",
      "— Cleared",
    ]),
    html: layout(
      {
        status: { label: "Cancelled", tone: "neutral" },
        heading: "Your booking is cancelled.",
        intro: "This is your record of the cancellation and what happens to the money.",
        facts: [
          ...(p.reference ? ([["Reference", p.reference]] as [string, string][]) : []),
          ["Refund due", p.refundAmount ?? "Nil"],
          ...(p.reason ? ([["Fare rule", p.reason]] as [string, string][]) : []),
        ],
        callout: p.refundAmount
          ? {
              title: "What happens next",
              body: "The refund returns to the card or account you paid with. Your bank controls the timing — typically 5–10 working days after the provider confirms it. We email you when it is confirmed.",
              tone: "neutral",
            }
          : {
              title: "Why there is no refund",
              body: "This fare is non-refundable after departure of the cancellation window. Taxes that can be recovered are shown above; nothing else is withheld by us.",
              tone: "warn",
            },
      },
      `Booking ${p.reference ?? ""} cancelled.`,
    ),
  }),

  "refund.executed": (p) => ({
    subject: `Refund confirmed — ${p.reference ?? ""}`,
    text: textBody([
      `Hello ${p.firstName ?? "there"},`,
      "",
      `The refund of ${p.refundAmount ?? p.amount ?? ""} for booking ${p.reference ?? ""} has been confirmed by our payment provider.`,
      "",
      "It returns to the original payment method. Your bank decides the final timing, usually 5–10 working days.",
      "",
      "— Cleared",
    ]),
    html: layout(
      {
        status: { label: "Refund confirmed", tone: "go" },
        heading: "Your refund is confirmed.",
        intro: "The provider has accepted the refund. This is the confirmation, not a promise of one.",
        facts: [
          ...(p.reference ? ([["Reference", p.reference]] as [string, string][]) : []),
          ["Amount", p.refundAmount ?? p.amount ?? "—"],
          ...(p.reason ? ([["Reason", p.reason]] as [string, string][]) : []),
        ],
        callout: {
          title: "Timing is the bank's, not ours",
          body: "Once a provider confirms a refund, the money is out of our hands. If it has not arrived after 10 working days, reply to this email and we will chase it with the reference.",
          tone: "neutral",
        },
      },
      `Refund of ${p.refundAmount ?? ""} confirmed.`,
    ),
  }),

  "request.received": (p) => ({
    subject: `We have your ${p.reason ?? "request"}${p.reference ? ` — ${p.reference}` : ""}`,
    text: textBody([
      `Hello ${p.firstName ?? "there"},`,
      "",
      `We received your ${p.reason ?? "request"}${p.reference ? ` about booking ${p.reference}` : ""}. A person reads these — you will get a reply, not an autoresponder loop.`,
      p.message ? `\nWhat you sent:\n"${p.message}"` : undefined,
      "",
      "— Cleared",
    ]),
    html: layout(
      {
        status: { label: "Received", tone: "neutral" },
        heading: `Your ${p.reason ?? "request"} is with us.`,
        intro: "A person reads every one of these. You will get a real reply, usually within one working day.",
        facts: [
          ...(p.reference ? ([["Reference", p.reference]] as [string, string][]) : []),
          ["Type", p.reason ?? "Request"],
        ],
        callout: p.message ? { title: "What you sent", body: p.message, tone: "neutral" } : undefined,
      },
      `We received your ${p.reason ?? "request"}.`,
    ),
  }),

  "request.resolved": (p) => ({
    subject: `Re: ${p.reason ?? "your request"}${p.reference ? ` — ${p.reference}` : ""}`,
    text: textBody([
      `Hello ${p.firstName ?? "there"},`,
      "",
      p.note ?? "We have reviewed your request.",
      "",
      p.reference ? `Booking: ${p.reference}` : undefined,
      p.decidedBy ? `Handled by ${p.decidedBy}.` : undefined,
      "",
      "Reply here if that does not resolve it.",
      "",
      "— Cleared",
    ]),
    html: layout(
      {
        status: { label: "Answered", tone: "go" },
        heading: "Here is where your request landed.",
        intro: p.note ?? "We have reviewed your request.",
        facts: [
          ...(p.reference ? ([["Reference", p.reference]] as [string, string][]) : []),
          ["Type", p.reason ?? "Request"],
          ...(p.decidedBy ? ([["Handled by", p.decidedBy]] as [string, string][]) : []),
        ],
        cta: p.reference ? { label: "Open your trip", url: tripUrl(p.reference) } : undefined,
      },
      "A reply to your request.",
    ),
  }),

  "ops.paid_not_ticketed": (p) => ({
    subject: `[ops] Paid, not ticketed — ${p.reference ?? ""}`,
    text: textBody([
      `Payment captured but the airline order has not completed.`,
      "",
      `Reference: ${p.reference}`,
      `Amount: ${p.amount ?? "—"}`,
      `State: ${p.message ?? "unknown"}`,
      p.stuckSince ? `Stuck since: ${p.stuckSince}` : undefined,
      "",
      "Reconciliation retries automatically and refunds after three failures. Check the provider before intervening by hand.",
    ]),
    html: layout(
      {
        status: { label: "Action", tone: "stop" },
        heading: "Paid, not ticketed.",
        intro: "A captured payment has no matching airline order. Reconciliation is retrying; this is the alarm, not the fix.",
        facts: [
          ...(p.reference ? ([["Reference", p.reference]] as [string, string][]) : []),
          ["Captured", p.amount ?? "—"],
          ["State", p.message ?? "unknown"],
          ...(p.stuckSince ? ([["Since", p.stuckSince]] as [string, string][]) : []),
        ],
        cta: p.reference ? { label: "Open on the desk", url: `${SITE}/admin/bookings/${p.reference}` } : undefined,
        footerNote: "Internal operations alert.",
      },
      "Paid but not ticketed.",
    ),
  }),
};

export function renderEmail(kind: string, payload: EmailPayload): RenderedEmail | null {
  const template = templates[kind];
  if (!template) return null;
  return template(payload);
}
