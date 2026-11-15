"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { Logo } from "@/components/ui/marks";
import type { AdminUserView } from "@/lib/server/platform";

const NAV: { href: string; label: string; hint: string }[] = [
  { href: "/admin", label: "Overview", hint: "Numbers and recent activity" },
  { href: "/admin/bookings", label: "Bookings", hint: "Live reservations" },
  { href: "/admin/requests", label: "Requests", hint: "Customer messages" },
  { href: "/admin/refunds", label: "Refunds", hint: "Approvals and exceptions" },
  { href: "/admin/emails", label: "Emails", hint: "Templates and delivery" },
  { href: "/admin/health", label: "Health", hint: "Error budget and latency" },
  { href: "/admin/posts", label: "Journal", hint: "Write and publish" },
  { href: "/admin/media", label: "Media", hint: "Images on Cloudinary" },
  { href: "/admin/settings", label: "Settings", hint: "Runtime switches" },
];

/** The active section, shown in the desk top bar so a phone always knows where it is. */
function sectionLabel(path: string): string {
  const hit = [...NAV].sort((a, b) => b.href.length - a.href.length).find((n) => path === n.href || path.startsWith(`${n.href}/`));
  return hit?.label ?? "Overview";
}

export function AdminShell({ user, children }: { user: AdminUserView; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  const signOut = async () => {
    setBusy(true);
    await fetch("/api/platform/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-paper">
      <div className="border-b border-ink bg-ink text-paper">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between gap-3 px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <Logo inverted />
            <span className="rounded-xs border border-paper/25 px-1.5 py-[2px] font-mono text-[10px] uppercase tracking-[0.1em] text-paper/70">
              Desk
            </span>
            <span aria-hidden className="text-paper/25">/</span>
            <span className="truncate text-[13px] font-semibold text-paper/85">{sectionLabel(path)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="hidden text-[13px] text-paper/70 underline-offset-4 hover:text-signal hover:underline sm:block">
              View site
            </Link>
            <span className="hidden font-mono text-[11.5px] text-paper/50 md:block">
              {user.name} · {user.role}
            </span>
            <button
              type="button"
              onClick={signOut}
              disabled={busy}
              className="h-11 rounded-sm border border-paper/30 px-2.5 text-[12.5px] font-semibold text-paper hover:border-signal hover:text-signal disabled:opacity-50 md:h-9 md:px-3"
            >
              {busy ? "…" : "Sign out"}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1320px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-4 md:px-8 md:py-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Admin" className="min-w-0 -mx-4 border-b border-line px-4 pb-2 md:mx-0 md:px-0 lg:sticky lg:top-8 lg:self-start lg:border-0 lg:pb-0">
          <ul className="rail rail-fade flex gap-1.5 overflow-x-auto pb-0.5 pr-8 lg:flex-col lg:gap-1 lg:overflow-visible lg:pr-0 lg:[mask-image:none]">
            {NAV.map((n) => (
              <li key={n.href} className="shrink-0 lg:w-full">
                <Link
                  href={n.href}
                  aria-current={active(n.href) ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center rounded-sm border px-3 transition-colors lg:block lg:min-h-0 lg:py-2.5",
                    active(n.href) ? "border-ink bg-ink text-paper" : "border-line-2 bg-card hover:border-ink lg:border-transparent lg:bg-transparent lg:hover:border-line-2 lg:hover:bg-card",
                  )}
                >
                  <span className="whitespace-nowrap text-[13px] font-semibold lg:text-[14px]">{n.label}</span>
                  <span className={cn("hidden text-[11.5px] lg:block", active(n.href) ? "text-paper/60" : "text-ink-3")}>{n.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main" className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
