import { chromium } from "playwright";
const url = process.argv[2];
const sels = JSON.parse(process.argv[3]);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
await page.waitForTimeout(500);
for (const sel of sels) {
  const info = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return { sel: s, missing: true };
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { sel: s, fs: cs.fontSize, ws: cs.whiteSpace, disp: cs.display, h: Math.round(r.height), w: Math.round(r.width), text: (el.textContent || "").trim().slice(0, 40) };
  }, sel);
  console.log(JSON.stringify(info));
}
await browser.close();
