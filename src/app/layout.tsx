import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/newsreader/index.css";
import "@fontsource-variable/newsreader/wght-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { SiteAnnouncement, SiteFooter, SiteHeader, SiteTabBar } from "@/components/layout/Chrome";
import { ModeBadge } from "@/components/ui/marks";
import { providerMode } from "@/lib/config";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Cleared · Flights, priced all-in", template: "%s · Cleared" },
  description:
    "Search and book flights with taxes, carrier surcharges and fees included in every price. Fare rules in plain words and a booking status that tells the truth.",
  openGraph: {
    title: "Cleared · Flights, priced all-in",
    description: "All-in flight prices from the first result, fare rules in plain words, and honest booking status.",
    type: "website",
    images: [{ url: "/images/hero-wing.jpg", width: 848, height: 1264 }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f3f0e8",
  width: "device-width",
  initialScale: 1,
  // Let the page paint into the notch/home-indicator area; safe areas are handled in CSS.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const mode = providerMode();
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-sm focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">
          Skip to content
        </a>
        <SiteAnnouncement mode={mode} />
        <SiteHeader />
        <main id="main">
          {children}
        </main>
        <SiteFooter />
        <SiteTabBar />
      </body>
    </html>
  );
}
