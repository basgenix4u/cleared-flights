"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { IconArrow, IconMenu, IconUser } from "@/components/ui/icons";
import { Logo } from "@/components/ui/marks";
import { Sheet } from "@/components/ui/overlays";
import { ButtonLink } from "@/components/ui/ui";

const NAV = [
  { href: "/#search", label: "Flights", match: "/flights" },
  { href: "/explore", label: "Explore", match: "/explore" },
  { href: "/deals", label: "Deals", match: "/deals" },
  { href: "/blog", label: "Journal", match: "/blog" },
  { href: "/trips", label: "My trips", match: "/trips" },
  { href: "/help", label: "Help", match: "/help" },
];

export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current = (m: string) => path === m || path.startsWith(`${m}/`);

  return (
    <header className="no-print sticky top-0 border-b border-line bg-paper" style={{ zIndex: "var(--z-nav)" }}>
      <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between gap-4 px-4 md:h-16 md:px-8">
        <Link href="/" aria-label="Cleared home" className="-my-2 flex min-h-11 shrink-0 items-center">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={current(n.match) ? "page" : undefined}
              className={cn(
                "relative rounded-sm px-3 py-2 text-[14px] font-semibold text-ink-2 transition-colors hover:text-ink",
                current(n.match) && "text-ink after:absolute after:inset-x-3 after:-bottom-[13px] after:h-[3px] after:bg-signal",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/trips" className="hidden items-center gap-2 rounded-sm px-3 py-2 text-[14px] font-semibold text-ink-2 hover:text-ink md:inline-flex">
            <IconUser width={16} height={16} /> Sign in
          </Link>
          <ButtonLink href="/#search" variant="primary" size="sm" className="hidden md:inline-flex">
            Find a flight
          </ButtonLink>
          <button type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center rounded-sm border border-line-2 active:bg-paper-2 lg:hidden">
            <IconMenu />
          </button>
        </div>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Menu" side="responsive">
        <nav aria-label="Mobile" className="flex flex-col p-3">
          {NAV.concat([{ href: "/trips", label: "Sign in", match: "/__none" }]).map((n) => (
            <Link
              key={n.label}
              href={n.href}
              onClick={() => setOpen(false)}
              className="flex min-h-[52px] items-center justify-between rounded-sm px-3 text-[17px] font-semibold tracking-tight active:bg-paper-2 hover:bg-paper-2"
            >
              {n.label}
              <IconArrow width={16} height={16} className="text-ink-3" />
            </Link>
          ))}
          <ButtonLink href="/#search" variant="signal" size="lg" className="mt-4" onClick={() => setOpen(false)}>
            Find a flight
          </ButtonLink>
        </nav>
      </Sheet>
    </header>
  );
}
