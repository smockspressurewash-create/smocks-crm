// Employee hours + offline clock (desktop, Eastern time, everything mocked):
//   1. an earlier day this week saved in the shift log counts in "Hours
//      This Week" together with today's ended shift (it used to show only
//      the latest shift)
//   2. Start My Day and End My Day with no signal are kept on the phone,
//      survive a reload, and are sent (employee row + shift log) once the
//      signal is back
//   node scripts/e2e/employee-shifts.cjs http://127.0.0.1:5193
const path = require("path"); const fs = require("fs"); const os = require("os");
const OUT = path.join(os.tmpdir(), "crewboss-e2e"); fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require("playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:5193";
const REF = "boaqaihymgmrhnjtiqrs", KEY = `sb-${REF}-auth-token`;
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "11111111-2222-4333-8444-555555555555"; const now = Math.floor(Date.now() / 1000);
const EMAIL = "owner@example.com";
const jwt = b64u({ alg: "HS256", typ: "JWT" }) + "." + b64u({ sub: UID, email: EMAIL, role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now }) + ".sig";
const user = { id: UID, aud: "authenticated", role: "authenticated", email: EMAIL, app_metadata: { provider: "email" }, user_metadata: {} };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r", user };
const owner = { id: "owner_" + EMAIL, role: "owner", owner_id: UID, user_id: UID, status: "active", email: EMAIL, firstName: "Will", permissions: {} };
const settings = { modelKeys: { claude: "••••••••" }, modelPriority: ["claude"], activeModel: "claude", setupComplete: true, onboardingComplete: true, companyName: "Test Co" };

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errs = []; const r = {};
  const ny = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const shiftDay = (() => { const d = new Date(ny); d.setHours(d.getHours() - 4); return ymd(d); })();
  const weekStartDay = (() => { const d = new Date(ny); d.setDate(d.getDate() - d.getDay()); return ymd(d); })();
  const earlierInWeek = weekStartDay !== shiftDay;
  const emp = { id: "emp-1", role: "technician", owner_id: "owner-x", user_id: UID, status: "active", email: EMAIL, firstName: "Mike", lastName: "Jones", hourlyRate: 20, permissions: {}, dayClockInAt: null, lastShiftHours: 3, lastShiftDate: shiftDay };
  const calls = { empPatches: [], shiftUpserts: [] };
  let blockSaves = false;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "America/New_York" });
  await ctx.route(new RegExp(REF + "\.supabase\.co"), async route => {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const accept = req.headers()["accept"] || ""; const m = req.method();
    const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
    if (p.startsWith("/auth/v1/token")) return j(session);
    if (p.startsWith("/auth/v1/user")) return j(user);
    if (p.startsWith("/realtime")) return route.abort();
    if (p.endsWith("/employees") && m === "PATCH" && blockSaves) return route.abort("internetdisconnected");
    if (p.endsWith("/employees") && m === "PATCH") { const b = JSON.parse(req.postData() || "{}"); calls.empPatches.push(b); Object.assign(emp, b); return j([{ id: "emp-1" }]); }
    if (p.endsWith("/employees") && m === "GET") return accept.includes("pgrst.object") ? j(emp) : j([emp]);
    if (p.endsWith("/employee_shift_days") && m === "GET") return j(earlierInWeek ? [{ employee_id: "emp-1", date: weekStartDay, hours: 5 }] : []);
    if (p.endsWith("/employee_shift_days") && m === "POST") { calls.shiftUpserts.push(JSON.parse(req.postData() || "{}")); return j([], 201); }
    if (p.endsWith("/jobs") && m === "GET") return j([]);
    if (accept.includes("pgrst.object")) return j({ code: "PGRST116" }, 406);
    return j([]);
  });
  await ctx.route("**/api/**", rt => rt.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http") && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
  const page = await ctx.newPage();
  page.on("pageerror", e => errs.push(e.message.slice(0, 160)));
  page.on("dialog", d => d.accept());
  const dismiss = async () => { for (const t of ["Not now", "Skip", "Maybe later", "Got it", "Dismiss", "Later"]) { const b = page.locator(`.fixed.inset-0 button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); } };
  const weekHours = async () => { const t = await page.evaluate(() => document.body.innerText); const m = t.match(/([\d.]+)\s*h?\s*\n\s*Hours This\s*\n?\s*Week/i); return m ? Number(m[1]) : NaN; };
  await page.goto(BASE + "/#/portal"); await page.waitForTimeout(8000); await dismiss();
  if (process.env.DEBUG_E2E) console.log("TEXT", (await page.evaluate(() => document.body.innerText)).slice(0, 700).split("\n").join(" | "));
  r.weekCountsEveryDay = earlierInWeek ? (await weekHours()) === 8 : (await weekHours()) === 3;

  // Offline: Start My Day.
  await ctx.setOffline(true); await page.waitForTimeout(300);
  await page.locator('button:has-text("Start My Day"), button:has-text("Resume")').first().click();
  await page.waitForTimeout(800);
  const pending1 = await page.evaluate(() => JSON.parse(localStorage.getItem("crm.pendingClock.emp-1") || "[]"));
  r.startKeptOffline = pending1.length === 1 && !!pending1[0].patch.dayClockInAt && calls.empPatches.length === 0;
  r.toldNoSignal = /No signal/i.test(await page.evaluate(() => document.body.innerText));
  // Survives a reload: signal back but the database still unreachable for
  // saves (the dev server can't serve the app fully offline the way the
  // installed phone app does).
  await ctx.setOffline(false);
  blockSaves = true;
  await page.reload().catch(() => {}); await page.waitForTimeout(6000); await dismiss();
  r.stillPendingAfterReload = (await page.evaluate(() => JSON.parse(localStorage.getItem("crm.pendingClock.emp-1") || "[]"))).length === 1;
  await ctx.setOffline(true); await page.waitForTimeout(300);
  r.stillClockedInAfterReload = /End My Day|End Day/i.test(await page.evaluate(() => document.body.innerText));
  // Offline: End My Day.
  await page.locator('button:has-text("End My Day"), button:has-text("End Day")').first().click().catch(e => errs.push("end: " + e.message.slice(0, 80)));
  await page.waitForTimeout(1200);
  for (const t of ["End Day", "End My Day", "Yes", "Confirm"]) { const b = page.locator(`.fixed.inset-0 button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); break; } }
  await page.waitForTimeout(800);
  const pending2 = await page.evaluate(() => JSON.parse(localStorage.getItem("crm.pendingClock.emp-1") || "[]"));
  r.endKeptOffline = pending2.length === 2 && pending2[1].patch.dayClockInAt === null && !!pending2[1].shiftDay;
  // Back online: both are sent, in order, plus the day's total.
  blockSaves = false;
  await ctx.setOffline(false);
  for (let i = 0; i < 20 && calls.empPatches.length < 2; i++) await page.waitForTimeout(500);
  await page.waitForTimeout(1000);
  r.syncedInOrder = calls.empPatches.length >= 2 && !!calls.empPatches[0].dayClockInAt && calls.empPatches[1].dayClockInAt === null;
  r.shiftLogSaved = calls.shiftUpserts.some(b => (Array.isArray(b) ? b[0] : b)?.employee_id === "emp-1");
  r.queueEmptied = (await page.evaluate(() => localStorage.getItem("crm.pendingClock.emp-1"))) === null;
  await page.screenshot({ path: `${OUT}/employee-shifts.png` });
  console.log(JSON.stringify({ r, errs, earlierInWeek, calls: { empPatches: calls.empPatches.length, shiftUpserts: calls.shiftUpserts.length } }, null, 1));
  const ok = Object.values(r).every(Boolean) && !errs.length;
  console.log(ok ? "PASS" : "FAIL");
  await browser.close(); process.exit(ok ? 0 : 1);
})();
