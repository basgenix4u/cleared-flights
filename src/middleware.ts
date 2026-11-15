import { NextResponse, type NextRequest } from "next/server";

/**
 * Request identity, assigned once at the edge.
 *
 * Every response carries `x-request-id`, and the same value is forwarded to the route handler
 * so a log line, an error envelope and a support conversation can be joined up. An inbound id
 * is accepted only if it matches a strict pattern — never echo arbitrary header bytes back.
 */
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function requestId(inbound: string | null): string {
  if (inbound && ID_RE.test(inbound)) return inbound;
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 22)}`;
}

export function middleware(req: NextRequest) {
  const id = requestId(req.headers.get("x-request-id"));

  const headers = new Headers(req.headers);
  headers.set("x-request-id", id);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("x-request-id", id);
  return res;
}

export const config = {
  // Static assets and image optimisation do not need an id and should stay cacheable.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt|xml|webmanifest)$).*)"],
};
