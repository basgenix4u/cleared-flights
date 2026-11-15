"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { IconArrow, IconBag, IconSearch, IconUser } from "@/components/ui/icons";

/**
 * Thumb navigation.
 *
 * The desktop header hides its links below `lg`, which left the phone with a hamburger and a
 * primary action competing for the same corner. This is the mobile answer: four destinations
 * within reach of a thumb, one active state, and no menu to open before you can leave a page.
 *
 * It sits under the safe-area inset so it never fights the home indicator, and the page
 * reserves space for it via `.pb-tabbar`.
 */
const TABS = [
  { href: "/flights", label: "Search", Icon: IconSearch, match: "/flights" },
  { href: "/deals", label: "Deals", Icon: IconArrow, match: "/deals" },
  { href: "/trips", label: "Trips", Icon: IconBag, match: "/trips" },
  { href: "/help", label: "Help", Icon: IconUser, match: "/help" },
];

export function MobileTabBar() {
  const path = usePathname();
  if (path.startsWith("/admin") || path.startsWith("/checkout/pay")) return null;

  return (
    <nav
      aria-label="Sections"
      data-site-tabbar
      className="site-tabbar no-print fixed inset-x-0 bottom-0 border-t border-line-2 bg-card/95 backdrop-blur-sm lg:hidden"
      style={{ zIndex: "var(--z-nav)", paddingBottom: "var(--safe-b)" }}
    >
      <ul className="mx-auto flex max-w-[640px] items-stretch">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = path === match || path.startsWith(`${match}/`) || (match === "/flights" && path === "/");
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-[58px] flex-col items-center justify-center gap-[3px] text-[10.5px] font-semibold tracking-[0.01em]",
                  active ? "text-ink" : "text-ink-3",
                )}
              >
                {active && <span aria-hidden className="absolute inset-x-4 top-0 h-[2.5px] bg-signal" />}
                <Icon width={19} height={19} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
