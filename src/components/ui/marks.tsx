import type { Carrier } from "@/lib/types";
import type { Mode } from "@/lib/config";
import { MODE_COPY } from "@/lib/config";
import { cn } from "./cn";

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-sm bg-signal shadow-[inset_0_0_0_1.5px_var(--color-ink)]"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 8h10M8 3.500 12.500 8 8 12.500" stroke="#101214" strokeWidth="2.200" strokeLinecap="square" />
        </svg>
      </span>
      <span className={cn("text-[19px] font-bold tracking-[-0.03em]", inverted ? "text-paper" : "text-ink")}>Cleared</span>
    </span>
  );
}

/** Airport code on a taxiway-style sign plate. */
export function Sign({
  code,
  size = "md",
  dark,
  className,
}: {
  code?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  dark?: boolean;
  className?: string;
}) {
  const sizes = {
    xs: "h-[18px] text-[12px] px-1",
    sm: "h-[22px] text-[14px]",
    md: "h-[30px] text-[20px]",
    lg: "h-[44px] text-[34px] px-2.5",
    xl: "h-[64px] text-[52px] px-3",
  } as const;
  return (
    <span
      className={cn("plate code", dark && "plate-dark", sizes[size], !code && "border border-dashed border-line-2 bg-transparent text-line-2 shadow-none", className)}
      aria-label={code ? `Airport code ${code}` : undefined}
    >
      {code ?? "···"}
    </span>
  );
}

export function AirlineMark({ carrier, size = 28 }: { carrier: Carrier; size?: number }) {
  if (carrier.logoUrl)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={carrier.logoUrl} alt="" width={size} height={size} className="shrink-0 rounded-xs bg-white object-contain" />
    );
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-xs font-mono font-medium tracking-tight text-white"
      style={{ width: size, height: size, background: carrier.color ?? "#2b2b2b", fontSize: size * 0.4 }}
    >
      {carrier.code}
    </span>
  );
}

/** Hazard-striped data-source label: unmistakable, on-brand, never hidden. */
export function ModeBadge({ mode, className }: { mode: Mode; className?: string }) {
  if (mode === "live") return null;
  return (
    <span className={cn("inline-flex shrink-0 items-stretch whitespace-nowrap border border-ink bg-card align-middle", className)} title={MODE_COPY[mode].detail}>
      <span className="hazard w-2.5" aria-hidden />
      <span className="px-2 py-[3px] font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink">
        {MODE_COPY[mode].short}
      </span>
    </span>
  );
}
