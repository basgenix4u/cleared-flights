"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "./cn";
import { IconClose } from "./icons";

/** Anchored popover on ≥md, bottom sheet on mobile. The parent must be `relative`. */
export function Popover({
  open,
  onClose,
  children,
  className,
  align = "left",
  title,
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
  title: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const host = ref.current?.parentElement;
      if (host && !host.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    if (mobile) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-ink/45 md:hidden" style={{ zIndex: "var(--z-popover)" }} onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-label={label}
        style={{ zIndex: "calc(var(--z-popover) + 1)" }}
        className={cn(
          "pop fixed inset-x-0 bottom-0 max-h-[88dvh] overflow-auto rounded-t-xl border border-ink bg-card shadow-pop md:absolute md:inset-x-auto md:bottom-auto md:top-full md:mt-2 md:max-h-none md:rounded-md",
          align === "right" ? "md:right-0" : "md:left-0",
          className,
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-card px-4 py-3 md:hidden">
          <span className="text-[15px] font-semibold">{title}</span>
          <button type="button" onClick={onClose} className="rounded-sm px-2 py-1 text-[14px] font-semibold underline underline-offset-4">
            Done
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

/** Modal built on native <dialog>: focus trap, Esc and inert background for free. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  side = "right",
  wide,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: "right" | "responsive";
  wide?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.body.style.overflow = "hidden";
    }
    if (!open && d.open) d.close();
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={() => {
        document.body.style.overflow = "";
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn("sheet open:flex open:flex-col", side === "right" ? "from-right" : "responsive", wide && "wide")}
      style={{ zIndex: "var(--z-modal)" }}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-sm hover:bg-paper-2">
          <IconClose />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{open ? children : null}</div>
      {footer && <div className="border-t border-line bg-card px-5 py-3">{footer}</div>}
    </dialog>
  );
}
