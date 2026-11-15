"use client";

import { fmtDuration, fmtMoneyWhole } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import { activeFilterCount, DEFAULT_FILTERS, WINDOWS, type DepWindow, type Filters, type facetsOf } from "./utils";

type Facets = ReturnType<typeof facetsOf>;

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-line py-5 first:pt-0">
      <legend className="eyebrow mb-3 !text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-[14px]">
      <span className="flex items-center gap-2.5">
        <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4" />
        {label}
      </span>
      {hint && <span className="num font-mono text-[12px] text-ink-3">{hint}</span>}
    </label>
  );
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function FilterPanel({ value, onChange, facets, currency, shown, total }: { value: Filters; onChange: (f: Filters) => void; facets: Facets; currency: string; shown: number; total: number }) {
  const n = activeFilterCount(value);
  const price = value.maxPrice ?? facets.maxPrice;
  const dur = value.maxDuration ?? facets.maxDuration;
  const lay = value.maxLayover ?? facets.maxLayover;
  const stopLabels = ["Nonstop", "1 stop", "2+ stops"];
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold tracking-tight">Filters</h2>
        <button type="button" disabled={!n} onClick={() => onChange(DEFAULT_FILTERS)} className="text-[13px] font-semibold underline underline-offset-4 disabled:no-underline disabled:opacity-40">
          Reset{n ? ` (${n})` : ""}
        </button>
      </div>
      <p className="mb-4 text-[12.5px] text-ink-3" aria-live="polite">Showing {shown} of {total} itineraries</p>

      <Group title="Stops">
        {stopLabels.map((l, i) =>
          facets.stops[i] !== undefined ? (
            <Check key={l} label={l} checked={value.stops.includes(i)} onChange={() => onChange({ ...value, stops: toggle(value.stops, i) })} hint={`from ${fmtMoneyWhole(facets.stops[i], currency)}`} />
          ) : null,
        )}
      </Group>

      <Group title="Fare">
        <Check label="Checked bag included" checked={value.bags} onChange={() => onChange({ ...value, bags: !value.bags })} />
        <Check label="Refundable" checked={value.refundable} onChange={() => onChange({ ...value, refundable: !value.refundable })} />
      </Group>

      <Group title="Price (total)">
        <input type="range" aria-label="Maximum price" min={facets.minPrice} max={facets.maxPrice} step={5} value={price} onChange={(e) => onChange({ ...value, maxPrice: +e.target.value >= facets.maxPrice ? null : +e.target.value })} className="w-full" />
        <p className="num mt-1 flex justify-between font-mono text-[12px] text-ink-2"><span>{fmtMoneyWhole(facets.minPrice, currency)}</span><span>Up to {fmtMoneyWhole(price, currency)}</span></p>
      </Group>

      <Group title="Outbound departure">
        <div className="grid grid-cols-2 gap-2">
          {WINDOWS.map((w) => {
            const on = value.windows.includes(w.id);
            return (
              <button key={w.id} type="button" aria-pressed={on} onClick={() => onChange({ ...value, windows: toggle<DepWindow>(value.windows, w.id) })} className={cn("rounded-sm border px-2.5 py-2 text-left transition-colors", on ? "border-ink bg-ink text-paper" : "border-line-2 hover:border-ink")}>
                <span className="block text-[13px] font-semibold">{w.label}</span>
                <span className={cn("font-mono text-[11px]", on ? "text-paper/70" : "text-ink-3")}>{w.hours}</span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Journey time">
        <input type="range" aria-label="Maximum journey time" min={Math.floor(facets.minDuration / 15) * 15} max={Math.ceil(facets.maxDuration / 15) * 15} step={15} value={dur} onChange={(e) => onChange({ ...value, maxDuration: +e.target.value >= Math.ceil(facets.maxDuration / 15) * 15 ? null : +e.target.value })} className="w-full" />
        <p className="num mt-1 font-mono text-[12px] text-ink-2">Up to {fmtDuration(dur)} each way</p>
      </Group>

      {facets.maxLayover > 0 && (
        <Group title="Longest layover">
          <input type="range" aria-label="Maximum layover" min={60} max={Math.max(120, Math.ceil(facets.maxLayover / 15) * 15)} step={15} value={Math.min(lay, Math.max(120, Math.ceil(facets.maxLayover / 15) * 15))} onChange={(e) => onChange({ ...value, maxLayover: +e.target.value >= Math.max(120, Math.ceil(facets.maxLayover / 15) * 15) ? null : +e.target.value })} className="w-full" />
          <p className="num mt-1 font-mono text-[12px] text-ink-2">Up to {fmtDuration(lay)}</p>
        </Group>
      )}

      <Group title="Airlines">
        <div className="max-h-64 overflow-auto">
          {facets.airlines.map((a) => (
            <Check key={a.code} label={a.name} checked={value.airlines.includes(a.code)} onChange={() => onChange({ ...value, airlines: toggle(value.airlines, a.code) })} hint={fmtMoneyWhole(a.min, currency)} />
          ))}
        </div>
      </Group>
    </div>
  );
}
