import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblems, randomToken, sha256, verifyPassword } from "./crypto.js";

/**
 * Authentication rests on these three functions. If a hash format drifts or the
 * comparison stops being constant-time, nothing else in the desk matters.
 */
describe("hashPassword / verifyPassword", () => {
  it("produces the documented scrypt$N$salt$hash format", async () => {
    const hash = await hashPassword("Correct-Horse-9!");
    const parts = hash.split("$");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("scrypt");
    expect(Number(parts[1])).toBeGreaterThanOrEqual(16384);
    expect(parts[2]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[3]).toMatch(/^[0-9a-f]{128}$/);
  });

  it("salts every hash so the same password never lands twice", async () => {
    const a = await hashPassword("Correct-Horse-9!");
    const b = await hashPassword("Correct-Horse-9!");
    expect(a).not.toBe(b);
    expect(await verifyPassword("Correct-Horse-9!", b)).toBe(true);
  });

  it("accepts the right password and rejects everything else", async () => {
    const hash = await hashPassword("Cleared-Desk-2026!");
    expect(await verifyPassword("Cleared-Desk-2026!", hash)).toBe(true);
    expect(await verifyPassword("cleared-desk-2026!", hash)).toBe(false);
    expect(await verifyPassword("Cleared-Desk-2026! ", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("fails closed on a malformed stored hash instead of throwing", async () => {
    for (const bad of ["", "not-a-hash", "scrypt$1$2", "bcrypt$16384$aa$bb", "scrypt$16384$zz$zz"]) {
      await expect(verifyPassword("anything", bad)).resolves.toBe(false);
    }
  });

  it("refuses a truncated hash rather than accepting a prefix", async () => {
    const hash = await hashPassword("Cleared-Desk-2026!");
    const truncated = hash.slice(0, hash.length - 8);
    await expect(verifyPassword("Cleared-Desk-2026!", truncated)).resolves.toBe(false);
  });
});

describe("passwordProblems", () => {
  it("accepts a strong passphrase", () => {
    expect(passwordProblems("Cleared-Desk-2026!")).toEqual([]);
  });

  it("rejects short passwords and well-known ones", () => {
    expect(passwordProblems("Ab1!")).not.toEqual([]);
    expect(passwordProblems("password123")).not.toEqual([]);
    expect(passwordProblems("12345678901234")).not.toEqual([]);
  });

  it("is length-first by design, so a long passphrase without symbols is allowed", () => {
    // NIST 800-63B: length helps, composition rules mostly do not. Documented, not accidental.
    expect(passwordProblems("alllowercaseletters")).toEqual([]);
    expect(passwordProblems("correct horse battery staple")).toEqual([]);
  });

  it("never returns a message containing the password itself", () => {
    const pw = "Secr3tV4lue!";
    for (const problem of passwordProblems(pw)) expect(problem).not.toContain(pw);
  });
});

describe("randomToken / sha256", () => {
  it("produces url-safe tokens of stable length", () => {
    const t = randomToken(32);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(42);
  });

  it("does not repeat across calls", () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomToken(16)));
    expect(seen.size).toBe(50);
  });

  it("hashes deterministically for lookup keys", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).toHaveLength(64);
    expect(sha256("abc")).not.toBe(sha256("abd"));
  });
});
