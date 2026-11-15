import { NextResponse, type NextRequest } from "next/server";

/**
 * Vercel Cron heartbeat.
 *
 * Two jobs, both cheap: keep the Render API awake during traffic dips (a free/starter
 * instance that sleeps makes the first admin request of the day take 30 seconds), and
 * give uptime monitoring a single endpoint that reports both tiers.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Vercel signs cron invocations; a manual call needs the bearer secret.
  const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
  const secret = process.env.CRON_SECRET;
  if (!isVercelCron && secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Cron only." } }, { status: 401 });
  }

  const base = process.env.PLATFORM_API_URL;
  let api: { ok: boolean; latencyMs: number } = { ok: false, latencyMs: 0 };
  if (base) {
    const t = Date.now();
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/health`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      api = { ok: res.ok, latencyMs: Date.now() - t };
    } catch {
      api = { ok: false, latencyMs: Date.now() - t };
    }
  }

  return NextResponse.json({ ok: true, web: true, api, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
