import Link from "next/link";
import { ResolveRequest } from "@/components/admin/ResolveRequest";
import { adminRequestQueue } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const TONE: Record<string, string> = {
  change: "border-[#d6b24a] bg-warn-bg text-warn",
  cancel: "border-[#e0a49f] bg-stop-bg text-stop",
  support: "border-line-2 bg-paper-2 text-ink-3",
};

export default async function RequestsPage() {
  const res = await adminRequestQueue();
  const requests = res.ok ? res.data.requests : [];

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Operations</p>
        <h1 className="mt-1.5 text-[26px] font-bold tracking-[-0.03em]">Customer requests</h1>
        <p className="mt-1 text-[13px] text-ink-3">
          {requests.length === 0 ? "Nothing waiting." : `${requests.length} waiting on a person. Oldest first.`}
        </p>
      </header>

      {!res.ok && <p className="rounded-sm border border-[#e0a49f] bg-stop-bg px-3 py-2 text-[13px] text-[#7d1a14]">{res.message}</p>}

      {requests.length === 0 ? (
        <div className="rounded-md border border-dashed border-line-2 bg-card/60 px-6 py-16 text-center">
          <h2 className="text-[19px] font-semibold">The queue is empty</h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-3">
            Every customer message has been answered. Replies are written as mail, not as internal notes — the customer
            receives exactly what is typed here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="rounded-md border border-line-2 bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-xs border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] ${TONE[r.type] ?? "border-line-2"}`}>{r.type}</span>
                    {r.topic && <span className="font-mono text-[11px] text-ink-3">{r.topic}</span>}
                    {r.reference ? (
                      <Link href={`/admin/bookings/${r.reference}`} className="inline-flex min-h-11 items-center font-mono text-[12px] font-semibold hover:underline md:min-h-0">{r.reference}</Link>
                    ) : (
                      <span className="font-mono text-[11px] text-ink-3">no booking attached</span>
                    )}
                    <span className="font-mono text-[10.5px] text-ink-3">{when(r.created_at)}</span>
                  </div>
                  <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-2">{r.message}</p>
                  <p className="mt-1 font-mono text-[10.5px] text-ink-3">
                    {r.notify_email ? `reply goes to ${r.notify_email}` : "no email on file — resolve without sending"}
                  </p>
                </div>
                <ResolveRequest id={r.id} email={r.notify_email} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
