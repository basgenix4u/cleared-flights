import { cookies } from "next/headers";

/**
 * Server-side client for the platform API.
 *
 * Used by server components and route handlers only. On failure it returns a typed
 * error object instead of throwing, so a content-service outage degrades the blog to
 * "nothing published yet" rather than taking down the flight search with it.
 */

const BASE = process.env.PLATFORM_API_URL ?? "http://127.0.0.1:8080";
export const ADMIN_COOKIE = "cw_admin";

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  tags: string[];
  readingMinutes: number;
  authorName: string;
  publishedAt: string | null;
}
export interface PostDetail extends PostSummary {
  bodyMd: string;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}
export interface AdminUserView {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "editor";
}
export interface MediaAsset {
  id: string;
  publicId: string;
  url: string;
  format: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  folder: string;
  alt: string;
  createdAt: string;
}
export interface PostRow extends PostDetail {
  status: "draft" | "published" | "archived";
  coverPublicId: string | null;
}

async function call<T>(
  path: string,
  init: RequestInit & { forwardCookies?: boolean } = {},
): Promise<{ ok: true; data: T } | { ok: false; status: number; code: string; message: string }> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (init.forwardCookies) {
    const jar = await cookies();
    const token = jar.get(ADMIN_COOKIE)?.value;
    if (token) headers.set("cookie", `${ADMIN_COOKIE}=${token}`);
  }

  try {
    const res = await fetch(`${BASE.replace(/\/$/, "")}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        code: json?.error?.code ?? "UPSTREAM",
        message: json?.error?.message ?? "The content service returned an error.",
      };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 503, code: "PLATFORM_UNREACHABLE", message: "The content service is unavailable." };
  }
}

/* ---------------------------------------------------------------- public ---- */

export async function listPosts(opts: { limit?: number; page?: number; tag?: string } = {}) {
  const qs = new URLSearchParams();
  if (opts.limit) qs.set("limit", String(opts.limit));
  if (opts.page) qs.set("page", String(opts.page));
  if (opts.tag) qs.set("tag", opts.tag);
  const res = await call<{ posts: PostSummary[]; total: number }>(`/public/posts?${qs}`);
  return res.ok ? res.data : { posts: [] as PostSummary[], total: 0 };
}

export async function getPost(slug: string) {
  const res = await call<{ post: PostDetail }>(`/public/posts/${encodeURIComponent(slug)}`);
  return res.ok ? res.data.post : null;
}

export async function listTags() {
  const res = await call<{ tags: { tag: string; n: number }[] }>("/public/posts/meta/tags");
  return res.ok ? res.data.tags : [];
}

/* ----------------------------------------------------------------- admin ---- */

export async function currentAdmin() {
  const res = await call<{ user: AdminUserView }>("/auth/me", { forwardCookies: true });
  return res.ok ? res.data.user : null;
}

export async function adminListPosts(q: { page?: number; perPage?: number; q?: string; status?: string } = {}) {
  const qs = new URLSearchParams();
  if (q.page) qs.set("page", String(q.page));
  if (q.perPage) qs.set("perPage", String(q.perPage));
  if (q.q) qs.set("q", q.q);
  if (q.status) qs.set("status", q.status);
  return call<{ posts: PostRow[]; total: number; page: number; perPage: number }>(`/admin/posts?${qs}`, { forwardCookies: true });
}

export async function adminGetPost(id: string) {
  return call<{ post: PostRow }>(`/admin/posts/${id}`, { forwardCookies: true });
}

export async function adminStats() {
  return call<{
    posts: { total: number; published: number; drafts: number; scheduled: number };
    media: { total: number; bytes: number };
    bookings: { total: number; last7: number; revenue: number } | null;
    recentActivity: { id: string; action: string; actorEmail: string | null; createdAt: string; entity: string | null }[];
    drafts: { id: string; title: string; updatedAt: string }[];
  }>("/admin/stats", { forwardCookies: true });
}

export async function adminListMedia(limit = 40) {
  return call<{ media: MediaAsset[] }>(`/admin/media?limit=${limit}`, { forwardCookies: true });
}

export async function adminListSettings() {
  return call<{ settings: { key: string; value: unknown; updatedAt: string }[] }>("/admin/settings", { forwardCookies: true });
}

export type PlatformResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string };
export type { call as platformCall };

/* -------------------------------------------------------------- operations ---- */

export interface DeskBooking {
  reference: string;
  status: string;
  payment_status: string;
  currency: string;
  total_amount: string;
  mode: string;
  created_at: string;
  pnr: string | null;
  email: string;
  payment_state: string | null;
  fulfilment_state: string | null;
  open_refunds: string;
  updated_at?: string;
}
export interface DeskRefund {
  id: string;
  reference: string;
  amount_minor: number;
  currency: string;
  reason: string;
  status: string;
  requested_by: string | null;
  decided_by: string | null;
  note: string | null;
  failure_reason: string | null;
  created_at: string;
  decided_at: string | null;
  executed_at: string | null;
  booking_status?: string;
}

export async function adminListBookings(q: { status?: string; q?: string; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (q.status) qs.set("status", q.status);
  if (q.q) qs.set("q", q.q);
  if (q.limit) qs.set("limit", String(q.limit));
  return call<{ bookings: DeskBooking[]; counts: Record<string, number> }>(`/admin/bookings?${qs}`, { forwardCookies: true });
}

export async function adminGetBooking(reference: string) {
  return call<{
    booking: DeskBooking & { id: string; ticket_numbers: string[]; events: { at: string; label: string; detail?: string }[]; passenger_count: number; refund_amount: string | null };
    payments: { id: string; provider: string; status: string; fulfilment_status: string; amount_minor: number; currency: string; failure_reason: string | null; captured_at: string | null; created_at: string }[];
    refunds: DeskRefund[];
    requests: { id: string; type: string; topic: string | null; message: string; contact_email: string | null; status: string; created_at: string }[];
  }>(`/admin/bookings/${encodeURIComponent(reference)}`, { forwardCookies: true });
}

export async function adminRefundQueue() {
  return call<{ refunds: DeskRefund[] }>("/admin/bookings/refunds/queue", { forwardCookies: true });
}

export async function adminStuckPayments() {
  return call<{ stuck: { reference: string; fulfilment_status: string; failure_reason: string | null; amount_minor: number; currency: string; updated_at: string; booking_status: string }[] }>(
    "/admin/bookings/attention/paid-not-ticketed",
    { forwardCookies: true },
  );
}

export interface DeskRequest {
  id: string;
  type: string;
  topic: string | null;
  message: string;
  contact_email: string | null;
  notify_email: string | null;
  status: string;
  created_at: string;
  reference: string | null;
  booking_status: string | null;
}

export async function adminRequestQueue() {
  return call<{ requests: DeskRequest[] }>("/admin/bookings/requests/queue", { forwardCookies: true });
}

export async function adminResolveRequest(id: string, note: string) {
  return call<{ ok: boolean; mailQueued: boolean }>(`/admin/bookings/requests/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ note }),
    forwardCookies: true,
  });
}
