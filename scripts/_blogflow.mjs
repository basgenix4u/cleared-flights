// Feature completeness check: can an editor actually create, publish and revise an
// article from the desk — on a phone viewport, which is where the desk was audited?
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const stamp = Date.now().toString(36).slice(-5);
const title = `Mobile desk check ${stamp}`;
const slug = `mobile-desk-check-${stamp}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const step = (ok, msg) => console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);

await page.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"]', process.env.SEED_ADMIN_EMAIL ?? "owner@cleared.test");
await page.fill('input[type="password"]', process.env.SEED_ADMIN_PASSWORD ?? "");
await Promise.all([page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 30000 }).catch(() => {}), page.click('button[type="submit"]')]);
step(page.url().includes("/admin"), "signed in at 390px");

await page.goto(`${BASE}/admin/posts/new`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[placeholder^="Why we show"]', { timeout: 20000 });
await page.fill('input[placeholder^="Why we show"]', title);
await page.fill('textarea[placeholder^="## A heading"]', "## What this tests\n\nA full create → publish → revise loop, driven from a phone-sized viewport.");
await page.fill('textarea[placeholder^="One sentence"]', "Proving the desk is a publishing tool, not a read-only dashboard.");
await page.fill('input[placeholder="fares, refunds"]', "product, transparency");
await page.screenshot({ path: "/tmp/shots/e-editor.png" });

const saveBtn = page.locator('button:has-text("Save draft"), button:has-text("Save")').first();
await saveBtn.click();
await page.waitForTimeout(2500);
const afterSave = page.url();
step(/\/admin\/posts\/[0-9a-f-]{8}/.test(afterSave), `draft saved, editor at ${afterSave.replace(BASE, "")}`);

const publishBtn = page.locator('button:has-text("Publish")').first();
const hasPublish = await publishBtn.count();
if (hasPublish) {
  await publishBtn.click();
  await page.waitForTimeout(2500);
  step(true, "publish action ran");
} else {
  step(false, "no publish control found");
}

// the public page must render it
const pub = await ctx.newPage();
const res = await pub.goto(`${BASE}/blog/${slug}`, { waitUntil: "domcontentloaded" });
step(res?.status() === 200, `public article /blog/${slug} → ${res?.status()}`);
const body = await pub.evaluate(() => document.body.innerText);
step(body.includes("full create"), "public page shows the body that was typed");
step(body.includes(title), "public page shows the title");
await pub.screenshot({ path: "/tmp/shots/e-blog-public.png" });

// revise it: change the title, save, and confirm the public page follows
await page.goto(`${BASE}/admin/posts`, { waitUntil: "domcontentloaded" });
const row = page.locator(`a:has-text("${title}")`).first();
step(await row.count() > 0, "article appears in the desk list");
await row.click();
await page.waitForSelector('input[placeholder^="Why we show"]', { timeout: 20000 });
await page.fill('input[placeholder^="Why we show"]', `${title} (revised)`);
await page.locator('button:has-text("Save"), button:has-text("Publish")').first().click();
await page.waitForTimeout(2500);
await pub.reload({ waitUntil: "domcontentloaded" });
const revised = await pub.evaluate(() => document.body.innerText);
step(revised.includes("(revised)"), "revision reached the public page");

await ctx.close();
await browser.close();
