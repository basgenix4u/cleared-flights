"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getPlace, searchPlaces, type Place } from "@/lib/airports";
import { countryName } from "@/lib/format";
import { cn } from "@/components/ui/cn";
import { IconAlert, IconSearch } from "@/components/ui/icons";
import { Sign } from "@/components/ui/marks";
import { Popover } from "@/components/ui/overlays";

export function AirportField({
  id,
  label,
  placeholder,
  value,
  onChange,
  open,
  onOpenChange,
  error,
  size = "lg",
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (code: string) => void;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  error?: string;
  size?: "lg" | "md";
}) {
  const uid = useId();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  /** Reset the query when the popover flips open — handled during render, not in an effect,
   *  so the list never paints with the previous search's text. */
  const [lastOpen, setLastOpen] = useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    if (open) {
      setQ("");
      setActive(0);
    }
  }
  const btn = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchPlaces(q), [q]);
  const place = value ? getPlace(value) : undefined;

  useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open]);

  const select = (p: Place) => {
    onOpenChange(false); // close first: onChange may open the next field
    onChange(p.code);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) select(results[active]);
    } else if (e.key === "Escape") {
      onOpenChange(false);
      btn.current?.focus();
    }
  };

  return (
    <div className="relative">
      <button
        ref={btn}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${place ? `${place.city}${place.kind === "airport" ? `, ${place.name}` : ", all airports"}` : "not selected"}`}
        aria-describedby={error ? `${id}-err` : undefined}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "block w-full rounded-sm border bg-card text-left transition-[border-color,box-shadow] duration-150",
          size === "lg" ? "px-3.5 pb-3 pt-2.5" : "px-3 pb-2 pt-2",
          error ? "border-stop" : open ? "border-ink" : "border-line-2 hover:border-ink",
          open && "shadow-[0_0_0_3px_var(--color-signal)]",
        )}
      >
        <span className="eyebrow block">{label}</span>
        <span className={cn("flex items-center gap-3", size === "lg" ? "mt-2" : "mt-1.5")}>
          <Sign code={value || undefined} size={size === "lg" ? "lg" : "md"} />
          <span className="min-w-0">
            <span className={cn("block truncate font-semibold tracking-tight", place ? "text-ink" : "text-ink-3", size === "lg" ? "text-[16px]" : "text-[14px]")}>
              {place ? place.city : placeholder}
            </span>
            <span className="block truncate text-[12.5px] text-ink-3">
              {place ? (place.kind === "metro" ? "All airports" : place.name) : "City or airport"}
            </span>
          </span>
        </span>
      </button>
      {error && (
        <p id={`${id}-err`} className="mt-1 flex items-start gap-1 text-[12.5px] font-medium text-stop">
          <IconAlert width={14} height={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}
      <Popover open={open} onClose={() => onOpenChange(false)} title={label} label={`${label} airport search`} className="md:w-[400px]">
        <div className="border-b border-line p-3">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              ref={input}
              role="combobox"
              aria-expanded="true"
              aria-controls={`${uid}-list`}
              aria-activedescendant={results[active] ? `${uid}-o${active}` : undefined}
              aria-label={`Search ${label.toLowerCase()} city or airport`}
              autoComplete="off"
              spellCheck={false}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              placeholder="City, airport or code"
              className="input pl-10"
            />
          </div>
          {!q && <p className="eyebrow mt-3">Popular</p>}
        </div>
        <ul id={`${uid}-list`} role="listbox" aria-label="Suggestions" className="max-h-[320px] overflow-auto py-1">
          {results.length ? (
            results.map((p, i) => (
              <li
                key={p.code + p.kind}
                id={`${uid}-o${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(p)}
                className={cn("flex cursor-pointer items-center gap-3 px-4 py-2.5", i === active && "bg-signal-soft")}
              >
                <Sign code={p.code} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">
                    {p.city}
                    {p.kind === "metro" && <span className="ml-1.5 font-normal text-ink-3">All airports</span>}
                  </span>
                  <span className="block truncate text-[12.5px] text-ink-3">{p.kind === "metro" ? p.airports.join(" · ") : p.name}</span>
                </span>
                <span className="shrink-0 text-[12px] text-ink-3">{countryName(p.cc)}</span>
              </li>
            ))
          ) : (
            <li role="presentation" className="px-4 py-8 text-center text-[14px] text-ink-3">
              No airports match “{q}”. Try a city name or a 3-letter code.
            </li>
          )}
        </ul>
      </Popover>
    </div>
  );
}
