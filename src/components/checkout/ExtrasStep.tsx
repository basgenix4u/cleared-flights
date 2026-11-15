"use client";

import { fmtMoney } from "@/lib/format";
import type { ExtraOption, FareExtras, Itinerary } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import { IconBag, IconCheck, IconMinus, IconPlus, IconSeat, IconUser } from "@/components/ui/icons";

const KIND_LABEL: Record<ExtraOption["kind"], string> = { baggage: "Baggage", seat: "Seats", meal: "Meals", assist: "Assistance" };
const KIND_ICON = { baggage: IconBag, seat: IconSeat, meal: IconCheck, assist: IconUser } as const;

export const selKey = (optionId: string, passenger: number) => `${optionId}|${passenger}`;

export function ExtrasStep({
  extras,
  itinerary,
  names,
  sel,
  onChange,
}: {
  extras: FareExtras;
  itinerary: Itinerary;
  names: string[];
  sel: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) {
  const set = (o: ExtraOption, p: number, qty: number) => {
    const next = { ...sel };
    if (qty <= 0) delete next[selKey(o.id, p)];
    else next[selKey(o.id, p)] = Math.min(qty, o.max);
    onChange(next);
  };

  if (!extras.options.filter((o) => o.kind !== "assist").length)
    return (
      <div className="rounded-md border border-line-2 bg-card p-5 text-[14px] text-ink-2">
        <p className="font-semibold text-ink">No paid extras are available for this fare through our provider.</p>
        <p className="mt-1">You can add bags, seats and meals with the airline after booking, where they allow it.</p>
      </div>
    );

  const kinds = (["baggage", "seat", "meal", "assist"] as const).filter((k) => extras.options.some((o) => o.kind === k));
  return (
    <div className="space-y-8">
      <p className="rounded-sm bg-signal-soft px-4 py-3 text-[13.5px]">Everything here is optional and nothing is pre-selected. You can skip this step.</p>
      {kinds.map((k) => {
        const Icon = KIND_ICON[k];
        return (
          <section key={k} aria-labelledby={`x-${k}`}>
            <h3 id={`x-${k}`} className="mb-3 flex items-center gap-2 text-[16px] font-semibold tracking-tight"><Icon width={18} height={18} /> {KIND_LABEL[k]}</h3>
            <ul className="space-y-3">
              {extras.options.filter((o) => o.kind === k).map((o) => {
                const slice = o.sliceIndex !== undefined ? itinerary.slices[o.sliceIndex] : null;
                return (
                  <li key={o.id} className="rounded-md border border-line-2 bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[14.5px] font-semibold">{o.label}</p>
                        {o.description && <p className="text-[12.5px] text-ink-3">{o.description}</p>}
                        {slice && <p className="mt-0.5 font-mono text-[11px] text-ink-3">{slice.origin.city} → {slice.destination.city}</p>}
                      </div>
                      <p className="num font-mono text-[14px]">{o.price ? `+ ${fmtMoney(o.price, extras.currency)}` : "Free"}<span className="text-[11px] text-ink-3"> {o.max > 1 || names.length > 1 ? "each" : ""}</span></p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {names.map((n, p) => {
                        if (o.passengerIndex !== undefined && o.passengerIndex !== p) return null;
                        const q = sel[selKey(o.id, p)] ?? 0;
                        return (
                          <div key={p} className={cn("flex items-center justify-between gap-3 rounded-sm border px-3 py-2", q ? "border-ink bg-signal-soft" : "border-line")}>
                            <span className="truncate text-[13px] font-medium">{n}</span>
                            {o.max === 1 ? (
                              <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
                                <input type="checkbox" className="h-4 w-4" checked={q > 0} onChange={(e) => set(o, p, e.target.checked ? 1 : 0)} aria-label={`${o.label} for ${n}`} />
                                {k === "assist" ? "Request" : "Add"}
                              </label>
                            ) : (
                              <span className="flex items-center gap-2">
                                <button type="button" aria-label={`Remove one ${o.label} for ${n}`} disabled={!q} onClick={() => set(o, p, q - 1)} className="grid h-7 w-7 place-items-center rounded-sm border border-ink disabled:border-line-2 disabled:text-line-2"><IconMinus width={14} height={14} /></button>
                                <span className="num w-4 text-center text-[14px] font-semibold" aria-live="polite">{q}</span>
                                <button type="button" aria-label={`Add one ${o.label} for ${n}`} disabled={q >= o.max} onClick={() => set(o, p, q + 1)} className="grid h-7 w-7 place-items-center rounded-sm border border-ink disabled:border-line-2 disabled:text-line-2"><IconPlus width={14} height={14} /></button>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
