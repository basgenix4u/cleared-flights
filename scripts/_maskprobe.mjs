import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
const p = await ctx.newPage();
await p.goto("http://localhost:3000/admin/login",{waitUntil:"networkidle"});
await p.fill('input[type="email"]',"owner@cleared.test");
await p.fill('input[type="password"]',"Cleared-Desk-2026!");
await Promise.all([p.waitForURL(u=>!u.pathname.includes("login")).catch(()=>{}), p.click('button[type="submit"]')]);
for (const [name,url] of [["admin","http://localhost:3000/admin"],["flights","http://localhost:3000/flights?from=LOS&to=LHR&depart=2026-12-20&trip=oneway&adults=1&children=0&infants=0&cabin=economy"]]) {
  await p.goto(url,{waitUntil:"networkidle"});
  const out = await p.evaluate(() => [...document.querySelectorAll(".rail")].map(el => {
    const cs = getComputedStyle(el);
    return { cls: el.className.slice(0,40), overflowX: cs.overflowX, mask: (cs.maskImage||"").slice(0,60), w: Math.round(el.getBoundingClientRect().width), sw: el.scrollWidth };
  }));
  console.log(name, JSON.stringify(out, null, 1));
}
await b.close();
