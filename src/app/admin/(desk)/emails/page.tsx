import { renderEmail } from "@/lib/email/templates";
import { emailConfigured } from "@/lib/email";
import type { EmailPayload } from "@/lib/email/types";

export const dynamic = "force-dynamic";

const SAMPLE: EmailPayload = {
  reference: "CLR-8KQ2VD",
  firstName: "Ada",
  amount: "£486.20",
  refundAmount: "£486.20",
  route: "Lagos (LOS) → London (LHR)",
  departDate: "2027-02-10T23:45",
  pnr: "7XQ2LM",
  tickets: ["125-8844219903"],
  paymentUrl: "https://cleared.example/checkout/pay?ref=CLR-8KQ2VD&token=sample",
  reason: "customer cancelled inside the 24-hour window",
  note: "We have moved your outbound to the 14 March service and waived the change fee. The new ticket follows in a separate email.",
  message: "Please can I move my outbound flight a day later? Same cabin is fine.",
  decidedBy: "operator@cleared.example",
  stuckSince: new Date().toISOString(),
};

const SECTIONS: { kind: string; title: string; when: string }[] = [
  { kind: "booking.received", title: "Booking received (payment open)", when: "A booking is created and the money has not arrived yet." },
  { kind: "booking.expired", title: "Held itinerary released", when: "An unpaid hold lapses after 60 minutes. Says plainly that nothing was charged." },
  { kind: "booking.ticketing_pending", title: "Paid — ticketing", when: "Money captured, airline has not issued. The message most travel mail skips." },
  { kind: "booking.ticketed", title: "Ticket issued", when: "The airline issued the ticket: record locator and ticket numbers." },
  { kind: "booking.cancelled", title: "Booking cancelled", when: "A cancellation completes, with the money stated explicitly." },
  { kind: "refund.approved", title: "Refund approved", when: "A human approved it. Says approved is not the same as paid." },
  { kind: "refund.executed", title: "Refund confirmed", when: "The provider accepted the refund. Timing is the bank's." },
  { kind: "request.received", title: "Request received", when: "A change or support message arrives." },
  { kind: "request.resolved", title: "Reply to request", when: "A person on the desk answers, and the reply is the email." },
  { kind: "ops.paid_not_ticketed", title: "Operations alert", when: "Internal only. Captured payment with no airline order." },
];

export default function EmailsPage() {
  const live = emailConfigured();
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Operations</p>
        <h1 className="mt-1.5 text-[26px] font-bold tracking-[-0.03em]">Email templates</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-3">
          Every message this product can send, rendered with sample data. Nothing here is delivered — the preview exists so
          no one has to guess what a customer reads.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-xs border border-line-2 bg-card px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-2">
          Delivery
          <span className={live ? "text-go" : "text-warn"}>{live ? "configured" : "not configured — messages are recorded, not sent"}</span>
        </p>
      </header>

      <div className="space-y-4">
        {SECTIONS.map((s) => {
          const rendered = renderEmail(s.kind, { ...SAMPLE, ...(s.kind === "booking.received" ? { paymentUrl: SAMPLE.paymentUrl } : {}) });
          if (!rendered) {
            return (
              <div key={s.kind} className="rounded-md border border-[#e0a49f] bg-stop-bg p-4 text-[13px] text-[#7d1a14]">
                Missing template: <span className="font-mono">{s.kind}</span>
              </div>
            );
          }
          return (
            <section key={s.kind} className="overflow-hidden rounded-md border border-line-2 bg-card">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
                <div>
                  <h2 className="text-[14.5px] font-semibold">{s.title}</h2>
                  <p className="mt-0.5 text-[12.5px] text-ink-3">{s.when}</p>
                </div>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">{s.kind}</span>
              </div>
              <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="border-b border-line p-4 md:border-b-0 md:border-r">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">Subject</p>
                  <p className="mt-1 text-[13.5px] font-semibold">{rendered.subject}</p>
                  <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">Plain text</p>
                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-ink-2">{rendered.text}</pre>
                </div>
                <iframe
                  title={`Preview: ${s.title}`}
                  srcDoc={rendered.html}
                  sandbox=""
                  className="h-[420px] w-full bg-paper"
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
