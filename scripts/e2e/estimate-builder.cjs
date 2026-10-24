// Quotes → New (estimate builder), desktop + phone, with 1,500 customers and
// the app's normal background syncing running:
//   - pick a customer by searching, add a line item, wait ~10s of syncs →
//     the customer and the line item are still there (they used to snap
//     back to the first customer and get wiped every sync)
//   - Save without a customer / description says why instead of nothing
//   - Save sends the quote for the customer that was picked
// Supabase and /api are mocked — nothing touches production data.
//   node scripts/e2e/estimate-builder.cjs http://127.0.0.1:5193
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
const customers = Array.from({ length: 1500 }, (_, i) => ({ id: `c0000000-0000-4000-8000-${hex(i)}`, owner_id: UID, firstName: i === 1234 ? "Zelda" : "Cust", lastName: i === 1234 ? "Quinterro" : String(i), phone: `717555${String(1000 + (i % 9000)).slice(-4)}`, email: "", address: `${i} Main St`, tags: [], totalSpent: 0, createdAt: "2026-01-01" }));
const TARGET = customers[1234];

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = {}; const errs = [];
  for (const [label, viewport, mobile] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
    const saved = []; let customerFetches = 0;
    await ctx.route(new RegExp(REF + "\\.supabase\\.co"), async route => {
      const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const accept = req.headers()["accept"] || "";
      const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
      if (p.startsWith("/auth/v1/token")) return j(session);
      if (p.startsWith("/auth/v1/user")) return j(user);
      if (p.startsWith("/realtime")) return route.abort();
      if (p.endsWith("/employees") && req.method() === "GET") return accept.includes("pgrst.object") ? j(owner) : j([owner]);
      if (p.endsWith("/estimates") && req.method() === "POST") { const b = JSON.parse(req.postData() || "{}"); (Array.isArray(b) ? b : [b]).forEach(x => saved.push(x)); return j(Array.isArray(b) ? b : [b], 201); }
      if (p.endsWith("/customers") && req.method() === "GET") {
        customerFetches++;
        // Fresh objects every time, like the real server — each sync hands the app a new list.
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
    await page.clock.install(); // lets the test jump past the app's 2-minute background sync
    await page.goto(BASE + "/#/estimates"); await page.waitForTimeout(8000);
    for (const t of ["Not now", "Skip", "Maybe later", "Skip setup", "Got it", "Dismiss", "Later"]) { const b = page.locator(`.fixed.inset-0 button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); }
    const r = {};
    await page.locator("button", { hasText: /^\s*New( Quote| Estimate)?\s*$/ }).first().click(); await page.waitForTimeout(1500);
    // Save with nothing picked → explains.
    await page.locator('[data-builder-save]').click().catch(e => errs.push(label + " save btn: " + e.message.slice(0, 60)));
    await page.waitForTimeout(500);
    r.explainsMissingCustomer = /choose a customer/i.test(await page.evaluate(() => document.body.innerText));
    // Search and pick the customer.
    await page.locator('[data-customer-picker] input').fill("zelda quin"); await page.waitForTimeout(500);
    await page.locator('[data-customer-picker] [data-option]').first().click(); await page.waitForTimeout(400);
    const desc = page.locator('input[placeholder*="escription"]').first();
    await desc.fill("House wash + gutters");
    const price = page.locator('input[type="number"]').nth(1);
    await price.fill("425").catch(() => {});
    const fetchesBefore = customerFetches;
    await page.clock.fastForward("02:10"); await page.waitForTimeout(2500); // one background sync
    await page.clock.fastForward("02:10"); await page.waitForTimeout(2500); // and another
    r.syncedWhileOpen = customerFetches > fetchesBefore;
    r.customerStillPicked = (await page.locator('[data-customer-picker]').innerText().catch(() => "")).includes("Zelda Quinterro");
    r.lineItemKept = (await desc.inputValue().catch(() => "")) === "House wash + gutters";
    await page.screenshot({ path: `${OUT}/estimate-builder-${label}.png` });
    await page.locator('[data-builder-save]').click(); await page.waitForTimeout(2500);
    const est = saved.find(e => e.customerId === TARGET.id);
    r.savedForPickedCustomer = !!est && (est.lineItems || []).some(li => li.description === "House wash + gutters");
    r.overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    results[label] = r;
    await ctx.close();
  }
  console.log(JSON.stringify({ results, errs }, null, 1));
  const ok = Object.values(results).every(r => Object.entries(r).every(([k, v]) => k === "overflow" ? v === false : v === true)) && !errs.length;
  console.log(ok ? "PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
