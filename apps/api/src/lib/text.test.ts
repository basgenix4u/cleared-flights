import { describe, expect, it } from "vitest";
import { plainText, readingMinutes, slugify } from "./text.js";

describe("slugify", () => {
  it("produces a lowercase, hyphenated URL key", () => {
    expect(slugify("Why we show you the whole price")).toBe("why-we-show-you-the-whole-price");
  });

  it("strips punctuation, emoji and diacritics rather than encoding them", () => {
    expect(slugify("Café, naïve & 100% honest!")).toBe("cafe-naive-100-honest");
    expect(slugify("✈️ Fares ✈️")).toBe("fares");
  });

  it("collapses separator runs and never starts or ends with one", () => {
    const s = slugify("  --- hello   world ---  ");
    expect(s).toBe("hello-world");
    expect(s.startsWith("-")).toBe(false);
    expect(s.endsWith("-")).toBe(false);
  });

  it("returns an empty string for unusable input, which the caller must default", () => {
    // uniqueSlug() in routes/posts.ts supplies "post" as the fallback; slugify stays pure.
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
  });

  it("is stable for the same input", () => {
    expect(slugify("Multi city fares")).toBe(slugify("Multi city fares"));
  });
});

describe("readingMinutes", () => {
  it("returns at least one minute for any real article", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("short")).toBe(1);
  });

  it("scales with length", () => {
    const long = "word ".repeat(1200);
    expect(readingMinutes(long)).toBeGreaterThan(3);
  });
});

describe("plainText", () => {
  it("strips markdown syntax from an excerpt", () => {
    const out = plainText("## Heading\n\nSome **bold** and [a link](https://x.test) here.", 80);
    expect(out).not.toContain("##");
    expect(out).not.toContain("**");
    expect(out).not.toContain("](");
    expect(out).toContain("Heading");
  });

  it("truncates to the requested length", () => {
    const out = plainText("word ".repeat(200), 40);
    expect(out.length).toBeLessThanOrEqual(41);
  });

  it("does not leave a dangling markdown artefact at the cut", () => {
    const out = plainText("A [long label](https://example.test/path) sentence here", 12);
    expect(out).not.toMatch(/\[|\]\(/);
  });
});
