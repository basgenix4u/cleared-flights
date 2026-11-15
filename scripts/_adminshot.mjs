// Admin mobile audit: sign in once, then shoot each desk route at 390x844 and report
// horizontal overflow per route. Usage: node scripts/_adminshot.mjs '[[name,path],...]'
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "owner@cleared.test";
const PASS = process.env.SEED_ADMIN_PASSWORD ?? "";
const targets = JSON.parse(process.argv[2]);
mkdirSync("/tmp/shots", { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();

await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASS);
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => {}),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(800);
console.log("after login:", page.url());

for (const [name, path] of targets) {
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    h: document.documentElement.scrollHeight,
    text: document.body.innerText.slice(0, 80).replace(/\n/g, " | "),
  }));
  await page.screenshot({ path: `/tmp/shots/${name}.png`, fullPage: false });
  console.log(`${name.padEnd(18)} ${path.padEnd(28)} overflow=${m.overflow} h=${m.h}  ${m.text}`);
}
await browser.close();
