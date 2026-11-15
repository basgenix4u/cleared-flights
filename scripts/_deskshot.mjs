// Desktop regression check: the phone work must not have moved the desk layout at 1440.
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const W = Number(process.env.W ?? 1440);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const shots = [["d-home", "/"], ["d-results", "/flights?from=LOS&to=LHR&depart=2026-12-20&trip=oneway&adults=1&children=0&infants=0&cabin=economy"]];
for (const [n, u] of shots) { await p.goto(BASE + u, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(900); await p.screenshot({ path: `/tmp/shots/${n}.png` }); }
await p.goto(`${BASE}/admin/login`, { waitUntil: "domcontentloaded" });
await p.fill('input[type="email"]', process.env.SEED_ADMIN_EMAIL ?? "owner@cleared.test");
await p.fill('input[type="password"]', process.env.SEED_ADMIN_PASSWORD ?? "");
await Promise.all([p.waitForURL(u=>!u.pathname.includes("login"),{timeout:30000}).catch(()=>{}), p.click('button[type="submit"]')]);
for (const [n,u] of [["d-desk","/admin"],["d-bookings","/admin/bookings"],["d-editor","/admin/posts/new"]]) { await p.goto(BASE+u,{waitUntil:"domcontentloaded"}); await p.waitForTimeout(700); await p.screenshot({ path: `/tmp/shots/${n}.png` }); }
await b.close(); console.log("desktop shots done");
