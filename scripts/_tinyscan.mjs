import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto("http://localhost:3000/admin/login", { waitUntil: "domcontentloaded" });
await p.fill('input[type="email"]', process.env.SEED_ADMIN_EMAIL ?? "owner@cleared.test");
await p.fill('input[type="password"]', process.env.SEED_ADMIN_PASSWORD ?? "");
await Promise.all([p.waitForURL(u=>!u.pathname.includes("login"),{timeout:30000}).catch(()=>{}), p.click('button[type="submit"]')]);
for (const path of ["/admin/health","/admin/posts","/admin/media","/admin/settings","/admin/requests","/admin/refunds","/admeldh".replace("eldh","in/bookings"),"/deals","/explore","/help","/trips","/blog","/checkout"]) {
  await p.goto("http://localhost:3000" + path, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(400);
  const t = await p.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll("p,li,td,dd,span,div")) {
      if (el.children.length || !el.textContent?.trim()) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 10.5) { const k = fs + "px"; out[k] = (out[k] || 0) + 1; if (Object.keys(out).length===0) out.ex = el.textContent.trim().slice(0,30); }
    }
    return out;
  });
  console.log(path, JSON.stringify(t));
}
await b.close();
