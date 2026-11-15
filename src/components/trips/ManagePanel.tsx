"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtMoney } from "@/lib/format";
import { IconCheck, IconDownload, IconPrint } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/overlays";
import { Banner, Button, buttonClass } from "@/components/ui/ui";

interface Quote {
  allowed: boolean;
  refundAmount: number;
  currency: string;
  note: string;
}
interface Req {
  id: string;
  type: string;
  message: string;
  status: string;
  createdAt: string;
}

export function ManagePanel({ reference, manageable, reason, currency, existing, mode }: { reference: string; manageable: boolean; reason?: string; currency: string; existing: Req[]; mode: string }) {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState<"quote" | "confirm" | "change" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [changeMsg, setChangeMsg] = useState("");
  const [changeErr, setChangeErr] = useState<string | null>(null);
  const [changeOk, setChangeOk] = useState(false);
  const [showChange, setShowChange] = useState(false);

  const post = async (path: string, body: unknown) => {
    const r = await fetch(`/api/trips/${reference}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw j?.error ?? { message: "Something went wrong." };
    return j;
  };

  const getQuote = async () => {
    setBusy("quote");
    setErr(null);
    try {
      setQuote((await post("cancel", { action: "quote" })).quote);
    } catch (e) {
      setErr((e as { message: string }).message);
    }
    setBusy(null);
  };

  const confirm = async () => {
    if (!quote) return;
    setBusy("confirm");
    setErr(null);
    try {
      await post("cancel", { action: "confirm", expectedRefund: quote.refundAmount });
      setQuote(null);
      router.refresh();
    } catch (e) {
      const er = e as { message: string; refundAmount?: number };
      setErr(er.message);
      if (typeof er.refundAmount === "number") setQuote({ ...quote, refundAmount: er.refundAmount });
    }
    setBusy(null);
  };

  const sendChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeErr(null);
    if (changeMsg.trim().length < 10) return setChangeErr("Tell us what you’d like to change (at least a sentence).");
    setBusy("change");
    try {
      await post("requests", { type: "change", message: changeMsg });
      setChangeOk(true);
      setChangeMsg("");
      router.refresh();
    } catch (e2) {
      setChangeErr((e2 as { message: string }).message);
    }
    setBusy(null);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <a href={`/api/trips/${reference}/calendar`} className={buttonClass({ variant: "outline", size: "md", className: "w-full justify-start" })}><IconDownload width={16} height={16} /> Add flights to calendar (.ics)</a>
        <button type="button" onClick={() => window.print()} className={buttonClass({ variant: "outline", size: "md", className: "w-full justify-start" })}><IconPrint width={16} height={16} /> Print or save itinerary as PDF</button>
      </div>
      <p className="text-[12px] text-ink-3">{mode === "demo" ? "There are no airline e-ticket documents in demo mode." : "Airline e-ticket documents are issued by the airline; ticket numbers appear on this page once they exist."}</p>

      {!manageable ? (
        <Banner tone="info" title="Changes and cancellation">{reason}</Banner>
      ) : (
        <div className="space-y-3 border-t border-line pt-5">
          <h3 className="text-[15px] font-semibold">Change or cancel</h3>
          {err && <Banner tone="error">{err}</Banner>}
          <Button variant="outline" className="w-full" onClick={() => setShowChange((v) => !v)} aria-expanded={showChange}>Request a change</Button>
          {showChange && (
            <form onSubmit={sendChange} className="rise space-y-2">
              <label htmlFor="chg" className="text-[12.5px] font-semibold text-ink-2">What would you like to change?</label>
              <textarea id="chg" rows={4} className="input !h-auto py-2.5" value={changeMsg} onChange={(e) => setChangeMsg(e.target.value)} aria-invalid={changeErr ? true : undefined} />
              {changeErr && <p role="alert" className="text-[12.5px] font-medium text-stop">{changeErr}</p>}
              {changeOk && <p role="status" className="flex items-center gap-1.5 text-[13px] font-medium text-go"><IconCheck width={14} height={14} /> Request recorded. A support agent reviews change requests; fare rules decide the cost.</p>}
              <Button type="submit" variant="primary" size="sm" loading={busy === "change"}>Send request</Button>
            </form>
          )}
          <Button variant="outline" className="w-full !border-stop !text-stop hover:!bg-stop hover:!text-white" loading={busy === "quote"} onClick={getQuote}>Cancel booking…</Button>
          <p className="text-[12px] text-ink-3">You’ll see the refund amount before anything is cancelled.</p>
        </div>
      )}

      {existing.length > 0 && (
        <div className="border-t border-line pt-5">
          <h3 className="text-[15px] font-semibold">Your requests</h3>
          <ul className="mt-2 space-y-2">
            {existing.map((r) => (
              <li key={r.id} className="rounded-sm border border-line bg-paper-2/50 p-3 text-[13px]">
                <p className="flex justify-between"><span className="font-semibold capitalize">{r.type} request</span><span className="font-mono text-[11px] uppercase text-ink-3">{r.status}</span></p>
                <p className="mt-1 text-ink-2">{r.message.length > 140 ? `${r.message.slice(0, 140)}…` : r.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Sheet open={!!quote} onClose={() => setQuote(null)} title="Cancel this booking?" side="responsive"
        footer={quote && <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setQuote(null)} disabled={busy === "confirm"}>Keep my booking</Button><Button variant="danger" loading={busy === "confirm"} onClick={confirm}>Cancel and {quote.refundAmount > 0 ? `refund ${fmtMoney(quote.refundAmount, quote.currency)}` : "confirm no refund"}</Button></div>}>
        {quote && (
          <div className="space-y-4 p-5">
            {err && <Banner tone="error">{err}</Banner>}
            <div>
              <p className="eyebrow">Refund</p>
              <p className="num code text-[44px] font-semibold">{fmtMoney(quote.refundAmount, currency)}</p>
            </div>
            <Banner tone={quote.allowed && quote.refundAmount > 0 ? "info" : "warn"}>{quote.note}</Banner>
            <p className="text-[13px] text-ink-3">{mode === "demo" ? "This is a demo booking: no money moves and the refund is simulated." : "Cancellation is final once confirmed."}</p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
