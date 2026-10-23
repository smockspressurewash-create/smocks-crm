// Customer portal (#/client), desktop + phone:
//   1. Invite link → details pre-filled → choose password → account opens
//   2. Coupons tab lists the unused coupon with its expiry
//   3. Jobs tab shows past jobs
//   4. Signed in with no business yet → search finds the business (best
//      match first) → Connect works, and "already connected" opens it
// Supabase auth and /api/public-data are mocked — nothing touches production.
//   node scripts/e2e/client-portal.cjs http://127.0.0.1:5193
const OUT = require("path").join(require("os").tmpdir(), "crewboss-e2e"); require("fs").mkdirSync(OUT, { recursive: true });
const { chromium } = require("playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:5193";
const REF = "boaqaihymgmrhnjtiqrs";
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const CUST_EMAIL = "jane@example.com";
const CUID = "99999999-2222-4333-8444-555555555555";
const jwt = b64u({ alg: "HS256", typ: "JWT" }) + "." + b64u({ sub: CUID, email: CUST_EMAIL, role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now }) + ".sig";
const user = { id: CUID, aud: "authenticated", role: "authenticated", email: CUST_EMAIL, app_metadata: { provider: "email" }, user_metadata: {} };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r", user };
const OWNER = "11111111-2222-4333-8444-555555555555";
const inFuture = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const customer = { id: "c1", owner_id: OWNER, firstName: "Jane", lastName: "Doe", email: CUST_EMAIL, phone: "(717) 555-0100", address: "412 Oak Ridge Ln", totalSpent: 450, createdAt: "2026-01-01" };
const account = {
  customer, settings: { companyName: "Smock's Pressure Washing" },
  jobs: [
    { id: "j1", customerId: "c1", status: "completed", scheduledDate: "2026-09-12", address: customer.address, amount: 300, serviceType: "House Wash" },
    { id: "j2", customerId: "c1", status: "scheduled", scheduledDate: inFuture(10), address: customer.address, amount: 180 },
  ],
  estimates: [],
  coupons: [{ id: "p1", name: "Birthday — Jane Doe", description: "Birthday coupon", code: "BDAYX7K2Q", discountType: "percent", discountValue: 10, validFrom: inFuture(-1), validTo: inFuture(29), justForYou: true }],
};

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = {}; const errs = [];
  for (const [label, viewport, mobile] of [["desktop", { width: 1280, height: 860 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    for (const flow of ["invite", "connect"]) {
      const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
      const calls = [];
      let connected = false;
      await ctx.route(new RegExp(REF + "\\.supabase\\.co"), async route => {
        const req = route.request(); const p = new URL(req.url()).pathname;
        const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
        if (p.startsWith("/auth/v1/token")) return j(session);
        if (p.startsWith("/auth/v1/user")) return j(user);
        if (p.startsWith("/auth/v1/signup")) return j({ ...session });
        if (p.startsWith("/realtime")) return route.abort();
        return j([]);
      });
      await ctx.route("**/api/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
      await ctx.route("**/api/public-data", async route => {
        const body = JSON.parse(route.request().postData() || "{}"); calls.push(body.action);
        const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
        if (body.action === "get_portal_invite") return j({ firstName: "Jane", lastName: "Doe", email: CUST_EMAIL, phone: "(717) 555-0100", claimed: false, companyName: "Smock's Pressure Washing", logoUrl: "" });
        if (body.action === "portal_signup_with_invite") return j(body.password && body.email === CUST_EMAIL ? { success: true, email: CUST_EMAIL } : { error: "bad" }, body.password ? 200 : 400);
        if (body.action === "claim_portal_invite") return j({ success: true });
        if (body.action === "get_customer_portal_data") return j({ accounts: flow === "invite" || connected ? [account] : [] });
        if (body.action === "search_businesses") return j({ businesses: [{ ownerId: OWNER, companyName: "Smock's Pressure Washing", companyPhone: "(717) 555-0000" }, { ownerId: "x", companyName: "Smockton Lawn", companyPhone: "" }] });
        if (body.action === "request_customer_link") { connected = true; return j({ success: true, alreadyConnected: true }); }
        return j({});
      });
      if (flow === "connect") await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } } catch {} }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);
      const page = await ctx.newPage(); page.on("pageerror", e => errs.push(`${label}/${flow}: ` + e.message.slice(0, 160)));
      const text = () => page.evaluate(() => document.body.innerText);
      const r = {};
      if (flow === "invite") {
        await page.goto(BASE + "/#/client?invite=AbCdEfGhIjKlMnOpQrSt"); await page.waitForTimeout(5000);
        let t = await text();
        r.inviteBanner = /set up your account, Jane/i.test(t);
        r.emailPrefilled = await page.locator('input[type="email"]').inputValue().then(v => v === CUST_EMAIL).catch(() => false);
        await page.screenshot({ path: `${OUT}/portal-invite-${label}.png` });
        await page.locator('input[placeholder="Password"]').fill("hunter22");
        await page.locator('button:has-text("Create Account")').click(); await page.waitForTimeout(3500);
        r.signupCalled = calls.includes("portal_signup_with_invite");
        t = await text();
        r.accountOpen = /Outstanding/i.test(t) && /Coupons/.test(t);
        await page.locator('button:has-text("Coupons")').first().click(); await page.waitForTimeout(600);
        t = await text();
        r.couponShown = /BDAYX7K2Q/.test(t) && /10% off/.test(t) && /Expires/.test(t) && /days left/.test(t);
        await page.screenshot({ path: `${OUT}/portal-coupons-${label}.png`, fullPage: true });
        await page.locator('button:has-text("Jobs")').first().click(); await page.waitForTimeout(600);
        t = await text();
        r.pastJobsShown = /2026-09-12|Sep(tember)? 12/.test(t);
        await page.screenshot({ path: `${OUT}/portal-jobs-${label}.png`, fullPage: true });
      } else {
        await page.goto(BASE + "/#/client"); await page.waitForTimeout(5000);
        await page.locator('input[placeholder^="Search by business"]').fill("smock pressure"); await page.waitForTimeout(1500);
        const firstName = await page.locator('div.text-sm.font-medium.truncate').first().innerText().catch(() => "");
        r.searchBestFirst = firstName === "Smock's Pressure Washing";
        await page.locator('button:has-text("Connect")').first().click(); await page.waitForTimeout(3000);
        r.connectOpensAccount = /Outstanding/i.test(await text());
        await page.screenshot({ path: `${OUT}/portal-connect-${label}.png` });
      }
      r.overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      results[`${label}/${flow}`] = r;
      await ctx.close();
    }
  }
  console.log(JSON.stringify({ results, errs }, null, 1));
  const ok = Object.values(results).every(r => Object.entries(r).every(([k, v]) => k === "overflow" ? v === false : v === true)) && !errs.length;
  console.log(ok ? "PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
