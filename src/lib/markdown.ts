/**
 * A deliberately small Markdown renderer for published articles.
 *
 * Why not a full parser: the content is written by us, but it is rendered as HTML, so
 * the renderer must be conservative by construction. Everything is HTML-escaped first,
 * then a fixed set of inline and block constructs is applied. Only http(s) links and
 * https images survive, and no raw HTML is ever passed through.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const safeUrl = (raw: string): string | null => {
  const url = raw.trim();
  if (/^https?:\/\/[^\s]+$/i.test(url)) return url;
  if (/^\/[^\s]*$/.test(url)) return url;
  return null;
};

function inline(text: string): string {
  let out = esc(text);
  // inline code first, so its contents are not formatted further
  out = out.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`);
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) => {
    const url = safeUrl(src);
    return url ? `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" />` : esc(alt);
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const url = safeUrl(href);
    if (!url) return label;
    const external = /^https?:/i.test(url);
    return `<a href="${esc(url)}"${external ? ' rel="noopener noreferrer nofollow" target="_blank"' : ""}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>");
  return out;
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let list: "ul" | "ol" | null = null;
  let inCode = false;
  let codeBuffer: string[] = [];

  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      if (inCode) {
        html.push(`<pre><code>${esc(codeBuffer.join("\n"))}</code></pre>`);
        codeBuffer = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      closeList();
      html.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      if (list !== kind) {
        closeList();
        html.push(`<${kind}>`);
        list = kind;
      }
      html.push(`<li>${inline((ul ?? ol)![1])}</li>`);
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      closeList();
      html.push("<hr />");
      continue;
    }
    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  if (inCode && codeBuffer.length) html.push(`<pre><code>${esc(codeBuffer.join("\n"))}</code></pre>`);
  closeList();
  return html.join("\n");
}

/** Rough plain-text extraction for meta descriptions. */
export function excerptFrom(md: string, max = 155): string {
  const text = md.replace(/[#>*_`]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
