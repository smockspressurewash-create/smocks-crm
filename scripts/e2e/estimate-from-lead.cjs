// Lead Intake → "Convert to Estimate" opens the quote builder for that lead,
// and a different customer can still be picked. Desktop + phone.
// Supabase and /api are mocked — nothing touches production data.
//   node scripts/e2e/estimate-from-lead.cjs http://127.0.0.1:5193
const OUT = require("path").join(require("os").tmpdir(), "crewboss-e2e"); require("fs").mkdirSync(OUT, { recursive: true });
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
const hex = n => n.toString(16).padStart(12, "0");
const customers = Array.from({ length: 300 }, (_, i) => ({ id: `c0000000-0000-4000-8000-${hex(i)}`, owner_id: UID, firstName: i === 42 ? "Lena" : "Cust", lastName: i === 42 ? "Leadwell" : String(i), phone: `717555${String(1000 + i).slice(-4)}`, email: "", address: `${i} Main St`, tags: [], totalSpent: 0, createdAt: "2026-01-01", pipelineStage: i === 42 ? "lead" : null }));

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = {}; const errs = [];
  for (const [label, viewport, mobile] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
    await ctx.route(new RegExp(REF + "\\.supabase\\.co"), async route => {
      const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const accept = req.headers()["accept"] || "";
      const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
      if (p.startsWith("/auth/v1/token")) return j(session);
      if (p.startsWith("/auth/v1/user")) return j(user);
      if (p.startsWith("/realtime")) return route.abort();
      if (p.endsWith("/employees") && req.method() === "GET") return accept.includes("pgrst.object") ? j(owner) : j([owner]);
      if (p.endsWith("/customers") && req.method() === "GET") {
        const off = Number(u.searchParams.get("offset") || 0); const range = req.headers()["range"]; let from = off, to = off + 999;
        if (range) { const m = range.match(/(\d+)-(\d+)/); if (m) { from = +m[1]; to = +m[2]; } }
        return j(JSON.parse(JSON.stringify(customers.slice(from, to + 1))));
      }
      if (accept.includes("pgrst.object")) return j({ code: "PGRST116" }, 406);
      return j([]);
    });
    await ctx.route("**/api/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http") && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); localStorage.setItem("smocks.lastOwnerSession", "1"); sessionStorage.setItem("seeded", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
    const page = await ctx.newPage(); page.on("pageerror", e => errs.push(label + ": " + e.message.slice(0, 160))); page.on("dialog", d => d.accept());
    await page.goto(BASE + "/#/intake"); await page.waitForTimeout(8000);
    for (const t of ["Not now", "Skip", "Maybe later", "Skip setup", "Got it", "Dismiss", "Later"]) { const b = page.locator(`.fixed.inset-0 button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); }
    const r = {};
    await page.locator('button[title="Convert to Estimate"]').first().click().catch(e => errs.push(label + " convert: " + e.message.slice(0, 80)));
    await page.waitForTimeout(2500);
    const picker = () => page.locator('[data-customer-picker]').innerText().catch(() => "");
    r.openedForLead = (await picker()).includes("Lena Leadwell");
    await page.waitForTimeout(1500);
    r.stillForLead = (await picker()).includes("Lena Leadwell");
    await page.locator('[data-customer-picker] button').first().click().catch(e => errs.push(label + " change: " + e.message.slice(0, 80)));
    await page.waitForTimeout(400);
    await page.locator('[data-customer-picker] input').fill("cust 7").catch(e => errs.push(label + " fill: " + e.message.slice(0, 80)));
    await page.waitForTimeout(400);
    await page.locator('[data-customer-picker] [data-option]').first().click().catch(e => errs.push(label + " pick: " + e.message.slice(0, 80)));
    await page.waitForTimeout(400);
    r.switched = /Cust 7/.test(await picker()) && !(await picker()).includes("Lena");
    await page.screenshot({ path: `${OUT}/estimate-from-lead-${label}.png` });
    results[label] = r;
    await ctx.close();
  }
  console.log(JSON.stringify({ results, errs }, null, 1));
  const ok = Object.values(results).every(r => Object.values(r).every(v => v === true)) && !errs.length;
  console.log(ok ? "PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
