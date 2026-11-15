import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const N = 16384;
const KEYLEN = 64;

/** Hash a password with scrypt. Format: scrypt$N$salt$hash (hex). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN);
  return `scrypt$${N}$${salt.toString("hex")}$${key.toString("hex")}`;
}

/** Constant-time verification. Returns false for unknown formats rather than throwing. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[2], "hex");
  const expected = Buffer.from(parts[3], "hex");
  const key = await scrypt(password, salt, expected.length);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Password policy: length is the only rule that genuinely helps. */
export function passwordProblems(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < 10) out.push("Use at least 10 characters.");
  if (/^(password|123456|qwerty)/i.test(pw)) out.push("Too common.");
  return out;
}
