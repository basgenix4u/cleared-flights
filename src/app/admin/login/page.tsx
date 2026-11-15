import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { Logo } from "@/components/ui/marks";
import { currentAdmin } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await currentAdmin()) redirect("/admin");

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_480px]">
      <div className="hidden flex-col justify-between bg-ink p-10 text-paper lg:flex">
        <Logo inverted />
        <div className="max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal">Operations desk</p>
          <h1 className="mt-4 text-[34px] font-bold leading-[1.06] tracking-[-0.03em]">
            Publish the reasoning,<br /> not just the fares.
          </h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-paper/70">
            Content, media and runtime settings all live behind one session. Every change is recorded with who made it and when.
          </p>
        </div>
        <p className="font-mono text-[11px] text-paper/40">Cleared · platform API on Render · Neon Postgres · Cloudinary</p>
      </div>

      <div className="flex items-center justify-center px-5 py-14">
        <div className="w-full max-w-sm">
          <div className="lg:hidden"><Logo /></div>
          <h2 className="mt-6 text-[24px] font-bold tracking-[-0.03em]">Sign in</h2>
          <p className="mt-1 text-[14px] text-ink-3">Staff access only.</p>
          <div className="mt-7">
            <LoginForm next={next && next.startsWith("/admin") ? next : "/admin"} />
          </div>
        </div>
      </div>
    </div>
  );
}
