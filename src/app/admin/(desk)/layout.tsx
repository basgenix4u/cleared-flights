import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/Shell";
import { currentAdmin } from "@/lib/server/platform";

/**
 * The guard for the whole desk. Server-side check on every request: the API is the
 * only authority on whether a session is valid, and an expired cookie must bounce to
 * the login page rather than render an empty shell.
 */
export const metadata: Metadata = {
  title: { default: "Desk", template: "%s · Cleared desk" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const user = await currentAdmin();
  if (!user) redirect("/admin/login");
  return <AdminShell user={user}>{children}</AdminShell>;
}
