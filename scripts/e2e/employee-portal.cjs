// node scripts/e2e/employee-portal.cjs http://127.0.0.1:5193
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
  // Employee portal smoke test: a crew member's portal loads with today's
  // jobs (evening-safe local date), no crashes or console errors. Mocked.
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errs = []; const results = {};
  for (const [label, viewport, mobile] of [["phone", { width: 390, height: 844 }, true], ["desktop", { width: 1280, height: 860 }, false]]) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, timezoneId: "America/New_York" });
    const emp = { id: "emp-1", role: "technician", owner_id: "owner-x", user_id: UID, status: "active", email: EMAIL, firstName: "Mike", lastName: "Jones", hourlyRate: 20, permissions: {} };
    const local = new Date(); const ds = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
    const job = { id: "job-1", owner_id: "owner-x", customerId: "c1", customerName: "Ann Lee", address: "1 Main St", status: "scheduled", scheduledDate: ds, scheduledTime: "18:00", crew: ["emp-1"], checklist: [], photos: [], commLog: [], chemicalsUsed: [], equipment: [], tags: [], amount: 120 };
    await ctx.route(new RegExp(REF + "\.supabase\.co"), async route => {
      const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const accept = req.headers()["accept"] || ""; const m = req.method();
      const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
      if (p.startsWith("/auth/v1/token")) return j(session);
      if (p.startsWith("/auth/v1/user")) return j(user);
      if (p.startsWith("/realtime")) return route.abort();
      if (p.endsWith("/employees") && m === "GET") return accept.includes("pgrst.object") ? j(emp) : j([emp]);
      if (p.endsWith("/jobs") && m === "GET") return j([job]);
      if (p.endsWith("/customers") && m === "GET") { const c = { id: "c1", owner_id: "owner-x", firstName: "Ann", lastName: "Lee", phone: "7175550100", address: "1 Main St" }; return accept.includes("pgrst.object") ? j(c) : j([c]); }
      if (accept.includes("pgrst.object")) return j({ code: "PGRST116" }, 406);
      return j([]);
    });
    await ctx.route("**/api/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http") && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
    const page = await ctx.newPage();
    page.on("pageerror", e => errs.push(label + ": " + e.message.slice(0, 160)));
    page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR|realtime|WebSocket/i.test(m.text())) errs.push(label + " console: " + m.text().slice(0, 160)); });
    await page.goto(BASE + "/#/portal"); await page.waitForTimeout(8000);
    for (const t of ["Not now", "Skip", "Maybe later", "Got it", "Dismiss", "Later"]) { const b = page.locator(`.fixed.inset-0 button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); }
    const t = await page.evaluate(() => document.body.innerText);
    results[label] = { portalLoaded: /Welcome, Mike|Start My Day|Resume Day/i.test(t), todaysJobShown: /TODAY'S JOBS[\s\S]*1 Main St/i.test(t), noOverflow: await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2) };
    await page.screenshot({ path: `${OUT}/employee-portal-${label}.png` });
    await ctx.close();
  }
  console.log(JSON.stringify({ results, errs }, null, 1));
  const ok = Object.values(results).every(r => Object.values(r).every(Boolean)) && !errs.length;
  console.log(ok ? "PASS" : "FAIL");
  await browser.close(); process.exit(ok ? 0 : 1);
})();
