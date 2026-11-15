"use client";

import { CABIN_LABEL, plural } from "@/lib/format";
import type { Cabin } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import { IconAlert, IconMinus, IconPlus } from "@/components/ui/icons";
import { Popover } from "@/components/ui/overlays";

export interface PaxState {
  adults: number;
  children: number;
  infants: number;
  cabin: Cabin;
}

function Stepper({ label, sub, value, min, max, onChange }: { label: string; sub: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const btn = "grid h-11 w-11 place-items-center rounded-sm border border-ink md:h-9 md:w-9 transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:border-line-2 disabled:text-line-2 disabled:hover:bg-transparent disabled:hover:text-line-2";
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-[14.5px] font-semibold">{label}</p>
        <p className="text-[12.5px] text-ink-3">{sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className={btn} aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <IconMinus width={16} height={16} />
        </button>
        <span className="num w-5 text-center text-[16px] font-semibold" aria-live="polite" aria-label={`${value} ${label.toLowerCase()}`}>
          {value}
        </span>
        <button type="button" className={btn} aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <IconPlus width={16} height={16} />
        </button>
      </div>
    </div>
  );
}

export function TravellersField({
  id,
  value,
  onChange,
  open,
  onOpenChange,
  error,
  size = "lg",
}: {
  id: string;
  value: PaxState;
  onChange: (v: PaxState) => void;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  error?: string;
  size?: "lg" | "md";
}) {
  const total = value.adults + value.children + value.infants;
  const paying = value.adults + value.children;
  const set = (p: Partial<PaxState>) => {
    const next = { ...value, ...p };
    if (next.infants > next.adults) next.infants = next.adults;
    onChange(next);
  };
  const cabins = Object.keys(CABIN_LABEL) as Cabin[];

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={error ? `${id}-err` : undefined}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "block w-full rounded-sm border bg-card px-3.5 text-left transition-[border-color,box-shadow] duration-150",
          size === "lg" ? "min-h-[72px] py-2.5" : "min-h-[60px] py-2",
          error ? "border-stop" : open ? "border-ink" : "border-line-2 hover:border-ink",
          open && "shadow-[0_0_0_3px_var(--color-signal)]",
        )}
      >
        <span className="eyebrow block">Travellers · Cabin</span>
        <span className={cn("mt-1 block truncate font-semibold tracking-tight", size === "lg" ? "text-[16px]" : "text-[14px]")}>
          {plural(total, "traveller")} · {CABIN_LABEL[value.cabin]}
        </span>
      </button>
      {error && (
        <p id={`${id}-err`} className="mt-1 flex items-start gap-1 text-[12.5px] font-medium text-stop">
          <IconAlert width={14} height={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}
      <Popover open={open} onClose={() => onOpenChange(false)} title="Travellers & cabin" label="Travellers and cabin" align="right" className="md:w-[360px]">
        <div className="px-5 pb-5 pt-2">
          <div className="divide-y divide-line">
            <Stepper label="Adults" sub="12 years and over" value={value.adults} min={1} max={Math.min(9 - value.children, 9)} onChange={(n) => set({ adults: n })} />
            <Stepper label="Children" sub="2–11 years" value={value.children} min={0} max={9 - value.adults} onChange={(n) => set({ children: n })} />
            <Stepper label="Infants" sub="Under 2, on an adult’s lap" value={value.infants} min={0} max={Math.min(value.adults, 4)} onChange={(n) => set({ infants: n })} />
          </div>
          {paying >= 9 && <p className="mt-1 text-[12.5px] text-ink-3">Bookings cover up to 9 seated travellers. For larger groups, make separate bookings.</p>}
          <fieldset className="mt-4">
            <legend className="eyebrow mb-2">Cabin</legend>
            <div role="radiogroup" aria-label="Cabin class" className="grid grid-cols-2 gap-2">
              {cabins.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={value.cabin === c}
                  onClick={() => set({ cabin: c })}
                  className={cn(
                    "rounded-sm border px-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors",
                    value.cabin === c ? "border-ink bg-ink text-paper" : "border-line-2 hover:border-ink",
                  )}
                >
                  {CABIN_LABEL[c]}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="button" onClick={() => onOpenChange(false)} className="mt-5 hidden h-10 w-full rounded-sm bg-ink text-[14px] font-semibold text-paper hover:bg-ink-2 md:block">
            Apply
          </button>
        </div>
      </Popover>
    </div>
  );
}
