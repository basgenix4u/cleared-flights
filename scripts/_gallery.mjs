// Final mobile gallery: the same 390×844 phone that the audit uses, deviceScaleFactor 1
// so the files stay small enough to keep in the repo next to docs/11.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "docs/mobile-shots";
mkdirSync(OUT, { recursive: true });
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const FLIGHTS = `/flights?from=LOS&to=LHR&depart=${day(30)}&trip=oneway&adults=1&children=0&infants=0&cabin=economy`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();

for (const [name, path] of [
  ["01-home", "/"],
  ["02-results", FLIGHTS],
  ["03-deals", "/deals"],
  ["04-checkout", "/checkout"],
  ["05-blog", "/blog"],
]) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

// results with the comparison tray filled
await page.goto(BASE + FLIGHTS, { waitUntil: "domcontentloaded" });
await page.waitForSelector("article", { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(600);
const chips = page.locator("article button[aria-pressed]:visible");
if (await chips.count() >= 2) {
  await chips.nth(0).click();
  await chips.nth(1).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/06-results-compare.png` });
  await page.click('button[aria-label^="Compare the"]').catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/07-compare-drawer.png` });
  await page.keyboard.press("Escape");
}

// the desk
await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"]', process.env.SEED_ADMIN_EMAIL ?? "owner@cleared.test");
await page.fill('input[type="password"]', process.env.SEED_ADMIN_PASSWORD ?? "");
await Promise.all([page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 30000 }).catch(() => {}), page.click('button[type="submit"]')]);

for (const [name, path] of [
  ["08-desk-overview", "/admin"],
  ["09-desk-bookings", "/admin/bookings"],
  ["10-desk-health", "/admin/health"],
  ["11-desk-posts", "/admin/posts"],
  ["12-desk-editor", "/admin/posts/new"],
]) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

await browser.close();
console.log("gallery written to", OUT);
