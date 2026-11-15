// Interaction shots: tap the compare chips on two cards, then capture the phone stack
// (sticky summary + list + compare tray + filter bar + tab bar) as one composition.
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const URL_ = `${BASE}/flights?from=LOS&to=LHR&depart=2026-12-20&trip=oneway&adults=1&children=0&infants=0&cabin=economy`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(URL_, { waitUntil: "load", timeout: 45000 });
await page.waitForTimeout(800);

await page.waitForSelector("article", { timeout: 45000 });
const chips = page.locator("article button[aria-pressed]:visible");
console.log("compare chips:", await chips.count());
await chips.nth(0).click();
await chips.nth(1).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/shots/d-compare.png" });

// the tray must sit above the filter bar and the tab bar, with nothing overlapping content
const box = await page.evaluate(() => {
  const bar = document.querySelector('button[aria-pressed="true"]')?.closest("article")?.getBoundingClientRect();
  const tray = [...document.querySelectorAll("div")].find((d) => d.className.includes?.("bg-ink") && d.textContent?.includes("of 3 selected"));
  const r = tray?.getBoundingClientRect();
  return {
    trayBottom: r ? Math.round(r.bottom) : null,
    trayTop: r ? Math.round(r.top) : null,
    viewport: window.innerHeight,
    label: tray?.textContent?.replace(/\s+/g, " ").trim(),
    cardTop: bar ? Math.round(bar.top) : null,
  };
});
console.log(JSON.stringify(box));
await page.click('button[aria-label^="Compare the"]').catch((e) => console.log("tray click failed", e.message));
await page.waitForTimeout(700);
await page.screenshot({ path: "/tmp/shots/d-compare-open.png" });
await browser.close();
