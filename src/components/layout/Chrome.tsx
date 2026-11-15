"use client";

import { usePathname } from "next/navigation";
import { ModeBadge } from "@/components/ui/marks";
import type { Mode } from "@/lib/config";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { MobileTabBar } from "@/components/layout/MobileTabBar";

/**
 * The marketing frame — announcement strip, header, footer, phone tab bar — belongs to
 * the booking journey, not to the operations desk. On a phone those three bars cost
 * ~132px of every desk screen before a single row of data, and "Deals / Trips / Help"
 * are customer destinations.
 *
 * These are thin client shells around server components so the frame can opt out by
 * route without turning the root layout into a client component. The markup is still
 * server-rendered — only the visibility decision happens in the browser.
 */
const isDesk = (path: string | null) => Boolean(path?.startsWith("/admin"));

export function SiteAnnouncement({ mode }: { mode: Mode }) {
  const path = usePathname();
  if (isDesk(path)) return null;
  return (
    <div className="no-print bg-ink text-paper">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-3 px-4 py-1 md:px-8">
        <p className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10.5px] leading-none tracking-[0.04em] text-paper/70">
          Every price includes taxes, carrier surcharges and our fee.
        </p>
        <div className="shrink-0 origin-right scale-90 md:scale-100">
          <ModeBadge mode={mode} />
        </div>
      </div>
    </div>
  );
}

export function SiteHeader() {
  const path = usePathname();
  return isDesk(path) ? null : <Header />;
}

export function SiteFooter() {
  const path = usePathname();
  return isDesk(path) ? null : <Footer />;
}

export function SiteTabBar() {
  const path = usePathname();
  return isDesk(path) ? null : <MobileTabBar />;
}
