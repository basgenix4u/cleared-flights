import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "./cn";
import { IconAlert, IconCheck, IconInfo } from "./icons";

/* ---------------- Buttons ---------------- */
type Variant = "primary" | "signal" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export function buttonClass({ variant = "primary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  const v: Record<Variant, string> = {
    primary: "bg-ink text-paper border-ink hover:bg-ink-2 active:translate-y-px",
    signal: "bg-signal text-ink border-ink hover:bg-ink hover:text-signal active:translate-y-px",
    outline: "bg-transparent text-ink border-ink hover:bg-ink hover:text-paper active:translate-y-px",
    ghost: "bg-transparent text-ink border-transparent hover:bg-paper-2",
    danger: "bg-stop text-white border-stop hover:bg-[#8f1d17] active:translate-y-px",
  };
  const s: Record<Size, string> = {
    sm: "h-9 px-3 text-[13px]",
    md: "h-11 px-5 text-[14px]",
    lg: "h-[52px] px-7 text-[15px]",
  };
  return cn(
    "nudge inline-flex select-none items-center justify-center gap-2 rounded-sm border font-semibold tracking-[-0.005em] whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
    v[variant],
    s[size],
    className,
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4", className)} viewBox="0 0 24 24" fill="none" aria-hidden style={{ animation: "spin 0.8s linear infinite" }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Button({
  variant,
  size,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, className })}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...rest} className={buttonClass({ variant, size, className })} />;
}

/* ---------------- Banner ---------------- */
type Tone = "info" | "warn" | "error" | "success";
export function Banner({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const styles: Record<Tone, string> = {
    info: "border-line-2 bg-card text-ink-2",
    warn: "border-[#d6b24a] bg-warn-bg text-warn",
    error: "border-[#e0a49f] bg-stop-bg text-[#7d1a14]",
    success: "border-[#9cc9b0] bg-go-bg text-[#14502f]",
  };
  const Icon = tone === "success" ? IconCheck : tone === "info" ? IconInfo : IconAlert;
  return (
    <div
      role={tone === "error" || tone === "warn" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-sm border px-4 py-3 text-[14px] leading-snug", styles[tone], className)}
    >
      <Icon className="mt-0.5 shrink-0" width={17} height={17} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ---------------- Skeleton / Empty ---------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function EmptyState({
  title,
  children,
  actions,
  icon,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-line-2 bg-card/60 px-6 py-12 text-center">
      {icon && <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full border border-line-2 text-ink-2">{icon}</div>}
      <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
      {children && <div className="mx-auto mt-1.5 max-w-md text-[14px] text-ink-3">{children}</div>}
      {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------------- Field ---------------- */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {hint && !error && <p id={`${htmlFor}-hint`} className="mt-1 text-[12px] text-ink-3">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-err`} className="mt-1 flex items-start gap-1 text-[12.5px] font-medium text-stop">
          <IconAlert width={14} height={14} className="mt-[1px] shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("eyebrow", className)}>{children}</p>;
}
