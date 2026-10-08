// Customer portal (#/client): a signed-in customer with no business yet searches
// for a business and taps Connect. Supabase and /api are mocked.
//   node scripts/e2e/client-connect.cjs http://127.0.0.1:5181
const OUT = require("path").join(require("os").tmpdir(), "crewboss-e2e"); require("fs").mkdirSync(OUT, { recursive: true });
const { chromium } = require("playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:5181";
const REF = "boaqaihymgmrhnjtiqrs", KEY = `sb-${REF}-auth-token`;
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "c0ffee00-2222-4333-8444-555555555555"; const now = Math.floor(Date.now() / 1000);
const EMAIL = "newcustomer@example.com";
const jwt = b64u({ alg: "HS256", typ: "JWT" }) + "." + b64u({ sub: UID, email: EMAIL, role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now }) + ".sig";
const user = { id: UID, aud: "authenticated", role: "authenticated", email: EMAIL, app_metadata: { provider: "email" }, user_metadata: {} };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r", user };
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const vp of [{ n: "mobile", w: 390, h: 844, m: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.m, hasTouch: !!vp.m });
    const calls = []; let connected = false;
    await ctx.route(new RegExp(REF + "\\.supabase\\.co"), async route => {
      const req = route.request(); const p = new URL(req.url()).pathname;
      const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
      if (p.startsWith("/auth/v1/token")) return j(session);
      if (p.startsWith("/auth/v1/user")) return j(user);
      if (p.startsWith("/realtime")) return route.abort();
      calls.push("sb " + req.method() + " " + p);
      if (p.endsWith("/employees")) return j([]);           // not staff
      return j([]);
    });
    await ctx.route("**/api/**", async route => {
      let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch {}
      calls.push("api " + (b.action || route.request().url()));
      const j = (o, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(o) });
      if (b.action === "search_businesses") return j({ businesses: String(b.query).toLowerCase().includes("smock") ? [{ ownerId: "9b7cab5e-c10e-4c71-9c41-bfc15b3e53c9", companyName: "Smock's Pressure Washing", companyPhone: "(717) 555-0100" }] : [] });
      if (b.action === "request_customer_link") { connected = true; return j({ success: true }); }
      if (b.action === "get_customer_portal_data") return j({ accounts: connected ? [{ customer: { id: "11111111-2222-4333-8444-555555555555", owner_id: "9b7cab5e-c10e-4c71-9c41-bfc15b3e53c9", email: EMAIL, firstName: "New", lastName: "Customer", pipelineStage: "lead", addresses: [] }, jobs: [], estimates: [], settings: { companyName: "Smock's Pressure Washing" } }] : [] });
      return j({});
    });
    await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http")) localStorage.setItem(k, v); } catch {} }, [KEY, JSON.stringify(session)]);
    const page = await ctx.newPage(); const errs = [];
    page.on("pageerror", e => errs.push(e.message.slice(0, 150)));
    page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 150)); });
    await page.goto(BASE + "/#/client"); await page.waitForTimeout(5000);
    const step1 = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 160);
    const input = page.locator('input[placeholder^="Search by business"]');
    const hasSearch = await input.count() > 0;
    let afterSearch = "", afterConnect = "";
    if (hasSearch) {
      await input.pressSequentially("Smocks", { delay: 80 }); await page.waitForTimeout(2500);
      afterSearch = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").match(/Find a business.{0,220}/)?.[0] || "";
      const btn = page.locator("button", { hasText: "Connect" }).first();
      if (await btn.count()) { await btn.click(); await page.waitForTimeout(4000); afterConnect = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 400); await page.reload(); await page.waitForTimeout(4000); afterConnect += " || AFTER RELOAD: " + (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 300); }
    }
    await page.screenshot({ path: `${OUT}/client-connect-${vp.n}.png` });
    console.log(JSON.stringify({ step1, hasSearch, afterSearch, afterConnect, calls: [...new Set(calls)], errs: [...new Set(errs)].slice(0, 6) }, null, 1));
    await ctx.close();
  }
  await browser.close();
})();
