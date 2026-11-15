import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
for (const [name, path] of JSON.parse(process.argv[2])) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/tmp/shots/${name}.png`, fullPage: false });
  await ctx.close();
}
await browser.close();
console.log("done");
