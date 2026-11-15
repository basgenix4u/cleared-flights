import { describe, expect, it } from "vitest";
import { excerptFrom, renderMarkdown } from "@/lib/markdown";

/**
 * Article bodies render as HTML, so this renderer is an XSS boundary. The tests below
 * are written from the attacker's side: if any of them passes with live markup, the
 * blog is a stored-XSS vector for anyone who can reach the editor.
 */
describe("renderMarkdown — escaping", () => {
  it("escapes raw HTML instead of passing it through", () => {
    const html = renderMarkdown('<script>alert("xss")</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes attribute-breaking payloads inside emphasis", () => {
    const html = renderMarkdown("**bold <img src=x onerror=alert(1)>** inside**");
    expect(html).not.toMatch(/<img[^>]*onerror/i);
    expect(html).toContain("&lt;img");
  });

  it("refuses javascript: and data: link targets", () => {
    for (const href of ["javascript:alert(1)", "data:text/html;base64,PHNjcmlwdD4=", "vbscript:msgbox"]) {
      const html = renderMarkdown(`[click](${href})`);
      expect(html).not.toContain("href=");
      expect(html).toContain("click");
    }
  });

  it("refuses non-http image sources", () => {
    const html = renderMarkdown("![alt](javascript:alert(1))");
    expect(html).not.toContain("<img");
  });

  it("keeps relative links, which are first-party", () => {
    const html = renderMarkdown("[fares](/flights?from=LOS&to=LHR)");
    expect(html).toContain('href="/flights?from=LOS&amp;to=LHR"');
  });

  it("marks external links noopener noreferrer nofollow and opens them safely", () => {
    const html = renderMarkdown("[Duffel](https://duffel.com)");
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
  });

  it("escapes quotes so an escaped payload cannot close an attribute", () => {
    const html = renderMarkdown('`<a href="x">`');
    expect(html).toContain("&quot;");
  });
});

describe("renderMarkdown — structure", () => {
  it("renders headings, lists, code and emphasis", () => {
    const html = renderMarkdown(
      [
        "## Heading",
        "",
        "A paragraph with **bold** and *italic*.",
        "",
        "- one",
        "- two",
        "",
        "1. first",
        "2. second",
        "",
        "```",
        "const x = 1;",
        "```",
      ].join("\n"),
    );
    expect(html).toContain("<h2>Heading</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toMatch(/<ul>[\s\S]*<li>one<\/li>[\s\S]*<\/ul>/);
    expect(html).toMatch(/<ol>[\s\S]*<li>first<\/li>[\s\S]*<\/ol>/);
    expect(html).toContain("<pre><code>const x = 1;</code></pre>");
  });

  it("escapes code blocks rather than formatting them", () => {
    const html = renderMarkdown("```\n<script>bad()</script>\n**not bold**\n```");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<strong>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("closes an unterminated code fence instead of leaking the rest of the page", () => {
    const html = renderMarkdown("intro\n```\nunclosed");
    expect(html).toContain("<pre>");
    expect(html.match(/<pre>/g)?.length).toBe(1);
  });

  it("handles empty input without throwing", () => {
    expect(renderMarkdown("")).toBe("");
  });
});

describe("excerptFrom", () => {
  it("strips markup and truncates to the requested length", () => {
    const md = "## Title\n\n" + "word ".repeat(100);
    const out = excerptFrom(md, 40);
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out).not.toContain("<h2>");
    expect(out.startsWith("Title")).toBe(true);
  });

  it("does not cut mid-word where it can avoid it", () => {
    const out = excerptFrom("supercalifragilistic ".repeat(10), 25);
    expect(out.endsWith("…") || out.length <= 25).toBe(true);
  });

  it("returns an empty string for empty markdown", () => {
    expect(excerptFrom("")).toBe("");
  });
});
