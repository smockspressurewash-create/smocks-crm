// Employee session on this device + customer opens an invoice link.
// All Supabase traffic is mocked (nothing reaches the real project).
// Usage: node smock-emp.cjs <base> <supabaseRef or "missing-config">
// Screenshots go to the OS temp folder (crewboss-e2e). Uses installed Chrome via playwright-core; Supabase and /api are mocked — nothing touches production data.
const OUT = require("path").join(require("os").tmpdir(), "crewboss-e2e"); require("fs").mkdirSync(OUT, { recursive: true });
const { chromium } = require("playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:5181";
const REF = process.argv[3] || "boaqaihymgmrhnjtiqrs";
const HOST = REF === "missing-config" ? /missing-config\.supabase\.co/ : new RegExp(REF + "\\.supabase\\.co");
const KEY = `sb-${REF}-auth-token`;
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "99999999-2222-4333-8444-555555555555", OWNER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const now = Math.floor(Date.now() / 1000);
const jwt = b64u({ alg: "HS256", typ: "JWT" }) + "." + b64u({ sub: UID, email: "emp@example.com", role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now }) + ".sig";
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "emp@example.com", app_metadata: { provider: "email" }, user_metadata: {} };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r", user };
const empRow = { id: "emp1", role: "employee", owner_id: OWNER, user_id: UID, status: "active", email: "emp@example.com", firstName: "Eddie", lastName: "Emp", permissions: {} };
const cust = { id: "c1", firstName: "Test", lastName: "Customer", email: "t@example.com", address: "1 Test St", owner_id: OWNER };
const inv = { id: "e0000000-0000-4000-8000-00000000000b", customerId: "c1", owner_id: OWNER, status: "approved", invoiced: true, signedAt: "2026-10-01", total: 300, subtotal: 300, tax: 0, lineItems: [{ id: "l1", description: "House wash", quantity: 1, unitPrice: 300 }], createdAt: "2026-10-01" };
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const run = async (label, { logoutFails, viaLogout }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    await ctx.route("**/api/**", async route => {
      let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch {}
      if (b.action === "get_estimate") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ estimate: inv, customer: cust, settings: { companyName: "Test Co" } }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await ctx.route(HOST, async route => {
      const req = route.request(); const p = new URL(req.url()).pathname; const accept = req.headers()["accept"] || "";
      const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
      if (p.startsWith("/auth/v1/logout")) return logoutFails ? route.abort("failed") : route.fulfill({ status: 204, body: "" });
      if (p.startsWith("/auth/v1/token")) return j(session);
      if (p.startsWith("/auth/v1/user")) return j(user);
      if (p.startsWith("/realtime")) return route.abort();
      if (p.endsWith("/employees") && req.method() === "GET") return accept.includes("pgrst.object") ? j(empRow) : j([empRow]);
      if (accept.includes("pgrst.object")) return j({ code: "PGRST116", message: "0 rows" }, 406);
      return j([]);
    });
    await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http") && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
    const page = await ctx.newPage(); const errs = [];
    page.on("pageerror", e => errs.push(e.message.slice(0, 150)));
    const out = { label };
    if (viaLogout) {
      await page.goto(BASE + "/#/portal"); await page.waitForTimeout(5000);
      out.portalBefore = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 80);
      const so = page.locator("button[title=\"Sign out\"]").first();
      if (await so.count()) { await page.evaluate(() => { const b = document.querySelector("button[title=\"Sign out\"]"); if (b) b.click(); }); }
      else { out.note = "sign-out button not visible on first screen; calling app sign-out via menu failed"; }
      await page.waitForTimeout(7500);
      out.tokenAfterLogout = await page.evaluate(k => !!localStorage.getItem(k), KEY);
      out.afterLogout = (await page.evaluate(() => document.body.innerText)).replace(/s+/g, " ").slice(0, 80);
    }
    if (!viaLogout) { await page.goto(BASE + "/#/portal"); await page.waitForTimeout(4000); out.portalBefore = (await page.evaluate(() => document.body.innerText)).replace(/s+/g, " ").slice(0, 60); }
    await page.evaluate(h => { location.hash = h; }, "#/estimate/" + inv.id);
    await page.waitForTimeout(1000);
    await page.reload(); await page.waitForTimeout(5000);
    out.hash = await page.evaluate(() => location.hash);
    out.text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 400);
    out.showsInvoice = /Pay \$300/.test(out.text);
    out.errs = errs;
    await page.screenshot({ path: `${OUT}/emp-${label}.png` });
    console.log(JSON.stringify(out));
    await ctx.close();
  };
  await run("employee-logged-in", {});
  await run("logout-network-fails", { viaLogout: true, logoutFails: true });
  await browser.close();
})();
