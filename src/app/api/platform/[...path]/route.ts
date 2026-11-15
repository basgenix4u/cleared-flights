import { NextResponse, type NextRequest } from "next/server";

/**
 * Backend-for-frontend proxy.
 *
 * The admin API lives on Render; this route makes it same-origin from the browser's
 * point of view. That buys three things:
 *   1. The session cookie is same-site, so there is no cross-site cookie negotiation
 *      and no `SameSite=None` weakness.
 *   2. The CSP stays `connect-src 'self'`: the browser never talks to Render directly.
 *   3. The API host is a server-side secret rather than a public endpoint baked into
 *      the client bundle.
 *
 * It forwards only what it needs to, and refuses anything that is not an admin path.
 */

const UPSTREAM = process.env.PLATFORM_API_URL ?? "http://127.0.0.1:8080";
const ALLOWED_PREFIXES = ["auth/", "admin/", "public/", "health"];

// Headers that must not be copied between hops.
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
  "host",
]);

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = path.join("/");

  if (!ALLOWED_PREFIXES.some((p) => target === p || target.startsWith(p))) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown platform route." } }, { status: 404 });
  }

  const url = new URL(req.url);
  const upstreamUrl = `${UPSTREAM.replace(/\/$/, "")}/${target}${url.search}`;

  const headers = new Headers();
  for (const [k, v] of req.headers.entries()) {
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    if (k.toLowerCase() === "host") continue;
    headers.set(k, v);
  }
  // The API sees the web origin so its CORS and cookie policy stay coherent.
  headers.set("x-forwarded-host", url.host);
  // Forward the *operator's* address, not this server's. Without this every desk user behind
  // the proxy shares one identity and one rate-limit budget — so one busy operator would lock
  // the rest out of the login.
  const caller = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (caller) headers.set("x-forwarded-for", caller);

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? await req.text() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return NextResponse.json(
      { error: { code: "PLATFORM_UNREACHABLE", message: "The content service is unavailable. Nothing was changed." } },
      { status: 503 },
    );
  }

  const out = new Headers();
  for (const [k, v] of upstream.headers.entries()) {
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    out.set(k, v);
  }
  // Set-Cookie must be appended one by one or the browser collapses them.
  for (const cookie of upstream.headers.getSetCookie?.() ?? []) out.append("set-cookie", cookie);
  out.set("cache-control", "no-store");

  return new NextResponse(upstream.status === 204 ? null : await upstream.text(), { status: upstream.status, headers: out });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
export const dynamic = "force-dynamic";
