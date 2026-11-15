import { ApiError, errorResponse } from "./api";
import { record } from "./metrics";
import { POLICIES, rateHeaders, take, type RatePolicy } from "./ratelimit";
import { clientIp, log } from "./security";

/**
 * Every public route goes through here.
 *
 * One place to assign the request id, enforce the rate limit, time the call, record it for
 * the error budget, and turn a thrown error into the standard envelope *with the request id
 * attached* — so a support conversation can start with "quote the code on the error".
 */
export interface RouteContext<P = Record<string, string>> {
  requestId: string;
  ip: string;
  params(): Promise<P>;
}

const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function newRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 22)}`;
}

/** Accept an inbound id only if it looks like one; never echo arbitrary header bytes back. */
export function normaliseRequestId(inbound: string | null): string {
  return inbound && ID_RE.test(inbound) ? inbound : newRequestId();
}

export function route<P = Record<string, string>>(
  name: string,
  policy: keyof typeof POLICIES | null,
  handler: (req: Request, ctx: RouteContext<P>) => Promise<Response>,
) {
  return async (req: Request, extra?: { params?: Promise<P> }): Promise<Response> => {
    const started = Date.now();
    const requestId = normaliseRequestId(req.headers.get("x-request-id"));
    const ip = clientIp(req);
    let status = 200;

    const finish = (res: Response): Response => {
      const ms = Date.now() - started;
      const headers = new Headers(res.headers);
      headers.set("x-request-id", requestId);
      if (!headers.has("x-response-time")) headers.set("x-response-time", `${ms}ms`);
      status = res.status;
      record(name, status, ms);
      if (status >= 500) log("error", "route.failed", { route: name, status, ms, requestId });
      return new Response(res.body, { status: res.status, headers });
    };

    try {
      if (policy) {
        const result = await take(policy, ip, POLICIES[policy] as RatePolicy);
        if (!result.ok) {
          log("warn", "ratelimit.blocked", { route: name, ip, window: result.window, requestId });
          const limited = errorResponse(
            new ApiError(429, "RATE_LIMITED", "That was a lot of requests. Please wait a moment and try again.", {
              retryAfter: result.retryAfterSec,
            }),
            requestId,
          );
          const headers = new Headers(limited.headers);
          for (const [k, v] of Object.entries(rateHeaders(result))) headers.set(k, v);
          return finish(new Response(limited.body, { status: 429, headers }));
        }
        const res = await handler(req, {
          requestId,
          ip,
          params: async () => ((await extra?.params) ?? ({} as P)),
        });
        const headers = new Headers(res.headers);
        // Remaining budget is useful even on success: clients can slow down before being cut off.
        for (const [k, v] of Object.entries(rateHeaders(result))) headers.set(k, v);
        return finish(new Response(res.body, { status: res.status, headers }));
      }

      const res = await handler(req, {
        requestId,
        ip,
        params: async () => ((await extra?.params) ?? ({} as P)),
      });
      return finish(res);
    } catch (error) {
      const res = errorResponse(error, requestId);
      return finish(res);
    }
  };
}
