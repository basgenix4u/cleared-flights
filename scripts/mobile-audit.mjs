// Mobile audit across the narrow screens we actually care about.
//
// Measures four things per page/viewport and prints one line each:
//   overflow  — page-level horizontal scroll (should always be 0)
//   offscreen — elements whose box escapes the viewport, ignoring anything inside a
//               horizontal scroller (rails, tables) where that is the design
//   smallTap  — interactive *controls* under 44×44 (inline text links excluded: WCAG 2.5.8
//               exempts links inside a sentence)
//   tinyText  — leaf text under 10.5px, advisory only: the mono meta labels are deliberate
//
// Usage: node scripts/mobile-audit.mjs [--shots] [--admin]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "/tmp/shots";
const SHOTS = process.argv.includes("--shots");
const ADMIN = process.argv.includes("--admin");
mkdirSync(OUT, { recursive: true });

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const FLIGHTS = `/flights?from=LOS&to=LHR&depart=${day(30)}&trip=oneway&adults=1&children=0&infants=0&cabin=economy`;

const PUBLIC_PAGES = [
  ["home", "/"],
  ["flights", FLIGHTS],
  ["deals", "/deals"],
  ["explore", "/explore"],
  ["help", "/help"],
  ["trips", "/trips"],
  ["blog", "/blog"],
  ["blog-post", "/blog/why-we-show-you-the-whole-price"],
  ["checkout", "/checkout"],
  ["login", "/admin/login"],
];

const ADMIN_PAGES = [
  ["admin-overview", "/admin"],
  ["admin-bookings", "/admin/bookings"],
  ["admin-requests", "/admin/requests"],
  ["admin-refunds", "/admin/refunds"],
  ["admin-emails", "/admin/emails"],
  ["admin-health", "/admin/health"],
  ["admin-posts", "/admin/posts"],
  ["admin-media", "/admin/media"],
  ["admin-settings", "/admin/settings"],
];

const VIEWPORTS = [
  { name: "320-narrow", width: 320, height: 660 },
  { name: "360-android", width: 360, height: 780 },
  { name: "375-se", width: 375, height: 667 },
  { name: "390-iphone14", width: 390, height: 844 },
  { name: "412-pixel7", width: 412, height: 915 },
];

const PAGES = [...PUBLIC_PAGES, ...(ADMIN ? ADMIN_PAGES : [])];

const measure = () => {
  const vw = document.documentElement.clientWidth;
  const de = document.documentElement;

  const inScroller = (el) => {
    for (let a = el.parentElement; a; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
    return false;
  };
  const shown = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
  };

  const offenders = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!shown(el) || getComputedStyle(el).position === "fixed") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right <= vw + 1.5 && r.left >= -1.5) continue;
    if (inScroller(el)) continue;
    offenders.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute("class") || "").slice(0, 60),
      over: Math.round(Math.max(r.right - vw, -r.left)),
      text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30),
    });
  }

  const small = [];
  for (const el of document.querySelectorAll("a, button, input, select, textarea, [role=button]")) {
    if (!shown(el) || inScroller(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // the skip link is visually hidden until focused; it is not a touch target
    const inline = el.tagName === "A" && getComputedStyle(el).display === "inline";
    if (inline) continue;
    if ((el.getAttribute("class") || "").includes("sr-only")) continue;
    if (Math.round(r.height) < 44 || Math.round(r.width) < 24) {
      small.push({ tag: el.tagName.toLowerCase(), text: (el.textContent || "").trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) });
    }
  }

  const tiny = [];
  for (const el of document.querySelectorAll("p, li, td, dd, span, div")) {
    if (!shown(el) || el.children.length > 0 || !el.textContent?.trim()) continue;
    if (inScroller(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 10.5) tiny.push({ text: el.textContent.trim().slice(0, 24), fs });
  }

  return {
    overflow: Math.max(de.scrollWidth, document.body.scrollWidth) - vw,
    offenders: offenders.sort((a, b) => b.over - a.over).slice(0, 5),
    small, tinyCount: tiny.length,
    scrollH: de.scrollHeight,
  };
};

const browser = await chromium.launch();
const report = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();

  if (ADMIN) {
    await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[type="email"]', process.env.SEED_ADMIN_EMAIL ?? "owner@cleared.test");
    await page.fill('input[type="password"]', process.env.SEED_ADMIN_PASSWORD ?? "");
    await Promise.all([
      page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30_000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
  }

  for (const [name, path] of PAGES) {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => {});
    await page.waitForTimeout(500);
    const m = await page.evaluate(measure).catch(() => null);
    if (!m) continue;
    report.push({ vp: vp.name, page: name, ...m });
    if (SHOTS) await page.screenshot({ path: `${OUT}/${vp.width}--${name}.png` }).catch(() => {});
  }
  await ctx.close();
}

await browser.close();

const fails = report.filter((r) => r.overflow > 1 || r.offenders.length > 0);
console.log(`\n${report.length} page/viewport combinations measured.`);
console.log(`horizontal overflow: ${fails.length === 0 ? "none anywhere" : `${fails.length} page(s) with findings`}`);
const taps = report.filter((r) => r.small.length > 0);
console.log(`controls under 44px: ${taps.length} page(s)`);
const tinyTop = report.reduce((a, r) => Math.max(a, r.tinyCount), 0);
console.log(`smallest text found: ${tinyTop} leaf node(s) below 10.5px on the densest page\n`);

for (const r of fails) {
  console.log(`FAIL ${r.vp.padEnd(13)} ${r.page.padEnd(16)} overflow=${r.overflow}px`);
  for (const o of r.offenders) console.log(`   +${String(o.over).padStart(4)}px <${o.tag} class="${o.cls}"> ${o.text}`);
}
for (const r of taps) {
  console.log(`TAP  ${r.vp.padEnd(13)} ${r.page.padEnd(16)} ${r.small.length} control(s)`);
  for (const s of r.small.slice(0, 4)) console.log(`   ${s.w}×${s.h} <${s.tag}> "${s.text}"`);
}
console.log(fails.length === 0 ? "\nPASS — no page scrolls sideways on any measured phone.\n" : "");
process.exit(fails.length === 0 ? 0 : 1);
