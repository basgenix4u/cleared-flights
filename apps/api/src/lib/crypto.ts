import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEYLEN = 64;
const DEFAULT_N = 16384;
const MIN_N = 1 << 14;
const MAX_N = 1 << 20;

const SALT_HEX = SALT_BYTES * 2;
const HASH_HEX = KEYLEN * 2;

/**
 * scrypt with an explicit cost, so a hash written with an older N still verifies after
 * the cost is raised. maxmem is derived from the parameters: Node's default ceiling is
 * 32 MB, which a raised N would silently exceed.
 */
function scryptAsync(password: string, salt: Buffer, keylen: number, cost: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, { N: cost, r: 8, p: 1, maxmem: 128 * cost * 8 * 2 }, (err, key) => {
      if (err) reject(err);
      else resolve(key as Buffer);
    });
  });
}

/** Hash a password with scrypt. Format: scrypt$N$saltHex$hashHex. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, KEYLEN, DEFAULT_N);
  return `scrypt$${DEFAULT_N}$${salt.toString("hex")}$${key.toString("hex")}`;
}

/**
 * Constant-time verification. Returns false for anything that is not a well-formed hash
 * rather than throwing.
 *
 * The length checks are not cosmetic. scrypt is a stream KDF: a 60-byte key is the first
 * 60 bytes of the 64-byte key, so a truncated digest would verify. And Buffer.from("zz",
 * "hex") is an empty buffer, so a malformed hash would compare two empty buffers and
 * timingSafeEqual would return true — which is an authentication bypass. Both cases are
 * refused before any comparison happens.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;

  const [, costRaw, saltHex, hashHex] = parts;
  if (!/^[1-9][0-9]*$/.test(costRaw)) return false;
  const cost = Number(costRaw);
  if (!Number.isInteger(cost) || cost < MIN_N || cost > MAX_N || (cost & (cost - 1)) !== 0) return false;

  if (saltHex.length !== SALT_HEX || !/^[0-9a-f]+$/i.test(saltHex)) return false;
  if (hashHex.length !== HASH_HEX || !/^[0-9a-f]+$/i.test(hashHex)) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (salt.length !== SALT_BYTES || expected.length !== KEYLEN) return false;

  const key = await scryptAsync(password, salt, KEYLEN, cost);
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
