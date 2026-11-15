import crypto from "node:crypto";
import { cookies } from "next/headers";

/* ---------- Encryption at rest (AES-256-GCM) ---------- */
function encKey(): Buffer {
  const material = process.env.DATA_ENCRYPTION_KEY ?? `dev-only-key|${process.env.DATABASE_URL ?? ""}`;
  return crypto.createHash("sha256").update(material).digest();
}

export function encryptJson(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptJson<T>(payload: string): T {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1") throw new Error("Unsupported ciphertext version");
  const d = crypto.createDecipheriv("aes-256-gcm", encKey(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  const out = Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]);
  return JSON.parse(out.toString("utf8")) as T;
}

/* ---------- Signed trip-access cookie ---------- */
const sessionSecret = () => process.env.SESSION_SECRET ?? `dev-only-session|${process.env.DATABASE_URL ?? ""}`;
const sign = (v: string) => crypto.createHmac("sha256", sessionSecret()).update(v).digest("base64url");
export const TRIPS_COOKIE = "cleared_trips";

/**
 * A payment token binds a booking reference to the session that created it, so a
 * guessed reference cannot be used to open someone else's payment or read its status.
 * It is not a capability to change a booking — only to pay for it.
 */
export const paymentToken = (reference: string) =>
  crypto.createHmac("sha256", sessionSecret()).update(`pay:${reference}`).digest("base64url").slice(0, 32);

export function verifyPaymentToken(reference: string, token: string | undefined | null): boolean {
  if (!token) return false;
  const expected = paymentToken(reference);
  return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export async function authorizedRefs(): Promise<string[]> {
  const jar = await cookies();
  const raw = jar.get(TRIPS_COOKIE)?.value;
  if (!raw) return [];
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return [];
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return [];
  try {
    const arr = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, 30) : [];
  } catch {
    return [];
  }
}

export async function grantRef(ref: string, secure: boolean) {
  const refs = await authorizedRefs();
  const next = [ref, ...refs.filter((r) => r !== ref)].slice(0, 30);
  const payload = Buffer.from(JSON.stringify(next)).toString("base64url");
  const jar = await cookies();
  jar.set(TRIPS_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export function isSecureRequest(req: Request): boolean {
  return req.headers.get("x-forwarded-proto") === "https" || new URL(req.url).protocol === "https:";
}

/* ---------- Rate limiting (in-memory; swap for Redis when horizontally scaled) ---------- */
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.n += 1;
  return b.n > limit ? { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) } : { ok: true, retryAfter: 0 };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/* ---------- Logging with PII redaction ---------- */
const REDACT = /pass|born|name|email|phone|token|secret|card|document/i;
function redact(v: unknown, depth = 0): unknown {
  if (depth > 4 || v == null) return v;
  if (Array.isArray(v)) return v.slice(0, 10).map((x) => redact(x, depth + 1));
  if (typeof v === "object")
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, REDACT.test(k) ? "[redacted]" : redact(val, depth + 1)]),
    );
  return v;
}
export function log(level: "info" | "warn" | "error", event: string, data: Record<string, unknown> = {}) {
  console[level === "info" ? "log" : level](JSON.stringify({ t: new Date().toISOString(), level, event, ...(redact(data) as object) }));
}

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newReference(): string {
  const bytes = crypto.randomBytes(6);
  return "CLR-" + Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
