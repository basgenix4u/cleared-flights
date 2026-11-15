// Element-level overflow probe: `scrollWidth` lies when the page sets overflow-x: clip,
// so this walks the DOM and reports every element whose box escapes the viewport.
// Usage: node scripts/_overflow.mjs '[["name","/path"],…]'
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const targets = JSON.parse(process.argv[2]);
const W = Number(process.env.W ?? 390);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

// sign in so /admin routes render instead of redirecting
if (targets.some(([, p]) => p.startsWith("/admin"))) {
  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', process.env.SEED_ADMIN_EMAIL ?? "owner@cleared.test");
  await page.fill('input[type="password"]', process.env.SEED_ADMIN_PASSWORD ?? "");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
}

for (const [name, path] of targets) {
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(400);
  const bad = await page.evaluate((vw) => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" || cs.display === "none" || cs.visibility === "hidden") continue;
      // anything inside a horizontal scroller is meant to sit off-screen
      let scroller = false;
      for (let a = el.parentElement; a; a = a.parentElement) {
        const ocs = getComputedStyle(a);
        if (ocs.overflowX === "auto" || ocs.overflowX === "scroll") { scroller = true; break; }
      }
      if (scroller) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const over = Math.round(Math.max(r.right - vw, -r.left));
      if (over > 1) {
        out.push({
          over,
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 70),
          text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 34),
        });
      }
    }
    return out.sort((a, b) => b.over - a.over).slice(0, 8);
  }, W);
  console.log(`\n== ${name} ${path}  ${bad.length ? bad.length + " overflow(s)" : "clean"}`);
  for (const b of bad) console.log(`   +${String(b.over).padStart(4)}px  <${b.tag} class="${b.cls}">  ${b.text}`);
}
await browser.close();
