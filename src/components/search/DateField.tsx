"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, fmtDay, todayISO } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import { IconAlert, IconChevron } from "@/components/ui/icons";
import { Popover } from "@/components/ui/overlays";

const monthKey = (d: string) => d.slice(0, 7);
function addMonths(ym: string, n: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
function cells(ym: string): (string | null)[] {
  const [y, m] = ym.split("-").map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];
}
const fullLabel = (d: string) => fmtDay(d, "long");

function Calendar({
  mode,
  start,
  end,
  onPick,
  min,
  max,
}: {
  mode: "range" | "single";
  start: string;
  end: string;
  onPick: (d: string) => void;
  min: string;
  max: string;
}) {
  const initial = start && start >= min ? start : min;
  const [view, setView] = useState(monthKey(initial));
  const [focus, setFocus] = useState(initial);
  const root = useRef<HTMLDivElement>(null);
  const months = [view, addMonths(view, 1)];
  const today = useMemo(() => todayISO(), []);

  useEffect(() => {
    root.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus({ preventScroll: true });
  }, [focus, view]);

  const move = (d: string) => {
    const next = d < min ? min : d > max ? max : d;
    setFocus(next);
    const k = monthKey(next);
    if (k < months[0]) setView(k);
    else if (k > months[1]) setView(addMonths(k, -1));
  };

  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, () => string> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      PageUp: () => `${addMonths(monthKey(focus), -1)}-${focus.slice(8)}`,
      PageDown: () => `${addMonths(monthKey(focus), 1)}-${focus.slice(8)}`,
      Home: () => addDays(focus, -((new Date(`${focus}T00:00:00Z`).getUTCDay() + 6) % 7)),
      End: () => addDays(focus, 6 - ((new Date(`${focus}T00:00:00Z`).getUTCDay() + 6) % 7)),
    };
    if (map[e.key]) {
      e.preventDefault();
      move(map[e.key]());
    }
  };

  const canPrev = months[0] > monthKey(min);
  const canNext = months[1] < monthKey(max);

  return (
    <div ref={root} className="p-4" onKeyDown={onKey}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Previous month" disabled={!canPrev} onClick={() => setView(addMonths(view, -1))} className="grid h-11 w-11 place-items-center rounded-sm hover:bg-paper-2 disabled:opacity-30 md:h-9 md:w-9">
          <IconChevron className="rotate-90" />
        </button>
        <p className="eyebrow">{mode === "range" ? (!start || end ? "Pick departure" : "Pick return") : "Pick a date"}</p>
        <button type="button" aria-label="Next month" disabled={!canNext} onClick={() => setView(addMonths(view, 1))} className="grid h-11 w-11 place-items-center rounded-sm hover:bg-paper-2 disabled:opacity-30 md:h-9 md:w-9">
          <IconChevron className="-rotate-90" />
        </button>
      </div>
      <div className="flex flex-col gap-6 md:flex-row">
        {months.map((ym, mi) => (
          <div key={ym} className={cn("w-full md:w-[280px]", mi === 1 && "hidden md:block")}>
            <p className="mb-2 text-center text-[14px] font-semibold" id={`cal-${ym}`}>
              {fmtDay(`${ym}-01`, "month")}
            </p>
            <div role="grid" aria-labelledby={`cal-${ym}`} className="grid grid-cols-7">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <span key={d} role="columnheader" className="pb-1 text-center font-mono text-[10.5px] uppercase text-ink-3">
                  {d}
                </span>
              ))}
              {cells(ym).map((d, i) => {
                if (!d) return <span key={`e${i}`} role="gridcell" />;
                const disabled = d < min || d > max;
                const isStart = d === start;
                const isEnd = d === end;
                const inRange = mode === "range" && start && end && d > start && d < end;
                return (
                  <span key={d} role="gridcell" className={cn("relative", inRange && "bg-signal-soft", isStart && end && "rounded-l-sm bg-signal-soft", isEnd && "rounded-r-sm bg-signal-soft")}>
                    <button
                      type="button"
                      data-date={d}
                      tabIndex={d === focus ? 0 : -1}
                      disabled={disabled}
                      aria-label={fullLabel(d)}
                      aria-pressed={isStart || isEnd}
                      onClick={() => onPick(d)}
                      className={cn(
                        "num relative h-11 w-full rounded-sm text-[14px] transition-colors md:h-10",
                        isStart || isEnd ? "bg-ink font-semibold text-paper" : "hover:bg-paper-2",
                        disabled && "cursor-not-allowed text-ink-3/40 hover:bg-transparent",
                      )}
                    >
                      {+d.slice(8)}
                      {d === today && <span className="absolute bottom-1 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-current" aria-hidden />}
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DateField({
  id,
  mode,
  start,
  end,
  onChange,
  open,
  onOpenChange,
  error,
  startLabel = "Depart",
  endLabel = "Return",
  oneWay,
  minDate,
  size = "lg",
}: {
  id: string;
  mode: "range" | "single";
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  error?: string;
  startLabel?: string;
  endLabel?: string;
  oneWay?: boolean;
  minDate?: string;
  size?: "lg" | "md";
}) {
  const min = minDate && minDate > todayISO() ? minDate : todayISO();
  const max = addDays(todayISO(), 330);

  const pick = (d: string) => {
    if (mode === "single") {
      onChange(d, "");
      onOpenChange(false);
      return;
    }
    if (!start || end || d < start) {
      onChange(d, "");
      if (oneWay) onOpenChange(false);
    } else {
      onChange(start, d);
      onOpenChange(false);
    }
  };

  const showEnd = mode === "range" && !oneWay;
  const cell = (label: string, v: string, empty: string) => (
    <span className="block min-w-0">
      <span className="eyebrow block">{label}</span>
      <span className={cn("mt-1 block truncate font-semibold tracking-tight", v ? "text-ink" : "text-ink-3", size === "lg" ? "text-[16px]" : "text-[14px]")}>
        {v ? fmtDay(v) : empty}
      </span>
    </span>
  );

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${showEnd ? "Travel dates" : startLabel}: ${start ? fmtDay(start, "long") : "not selected"}${showEnd && end ? ` to ${fmtDay(end, "long")}` : ""}`}
        aria-describedby={error ? `${id}-err` : undefined}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex w-full items-center gap-4 rounded-sm border bg-card px-3.5 text-left transition-[border-color,box-shadow] duration-150",
          size === "lg" ? "min-h-[72px] py-2.5" : "min-h-[60px] py-2",
          error ? "border-stop" : open ? "border-ink" : "border-line-2 hover:border-ink",
          open && "shadow-[0_0_0_3px_var(--color-signal)]",
        )}
      >
        {cell(startLabel, start, "Add date")}
        {showEnd && (
          <>
            <span className="h-8 w-px shrink-0 bg-line" aria-hidden />
            {cell(endLabel, end, "Add date")}
          </>
        )}
      </button>
      {error && (
        <p id={`${id}-err`} className="mt-1 flex items-start gap-1 text-[12.5px] font-medium text-stop">
          <IconAlert width={14} height={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}
      <Popover open={open} onClose={() => onOpenChange(false)} title="Choose dates" label="Calendar" className="md:w-max">
        <Calendar mode={mode} start={start} end={showEnd ? end : ""} onPick={pick} min={min} max={max} />
      </Popover>
    </div>
  );
}
