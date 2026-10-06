// A Cockpit preview link (https://cockpit-xxxx.smocks-crm.pages.dev/?th=…&go=/customers):
// signs in from the one-time token, opens on the right screen, no first-run pop-ups,
// shows the Preview bar. Supabase is mocked. The preview hostname is mapped to the
// local dev server via cockpit-*.localhost:
//   npx vite --port 5182 --host 127.0.0.1
//   node scripts/e2e/cockpit-preview.cjs 5182
const OUT = require("path").join(require("os").tmpdir(), "crewboss-e2e"); require("fs").mkdirSync(OUT, { recursive: true });
const { chromium } = require("playwright-core");
const PORT = process.argv[2] || "5182";
// *.smocks-crm.pages.dev is HTTPS-only (HSTS), so locally the app also treats cockpit-*.localhost as a preview.
const HOST = "cockpit-test1234.localhost";
const REF = "boaqaihymgmrhnjtiqrs";
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "11111111-2222-4333-8444-555555555555"; const now = Math.floor(Date.now() / 1000);
const EMAIL = "smockspressurewash@gmail.com";
const jwt = b64u({ alg: "HS256", typ: "JWT" }) + "." + b64u({ sub: UID, email: EMAIL, role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now }) + ".sig";
const user = { id: UID, aud: "authenticated", role: "authenticated", email: EMAIL, app_metadata: { provider: "email" }, user_metadata: {} };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r", user };
const owner = { id: "owner_" + EMAIL, role: "owner", owner_id: UID, user_id: UID, status: "active", email: EMAIL, firstName: "Will", permissions: {} };
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const vp of [{ n: "desktop", w: 1280, h: 860 }, { n: "mobile", w: 390, h: 844, m: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.m, hasTouch: !!vp.m });
    let verified = 0;
    await ctx.route(new RegExp(REF + "\\.supabase\\.co"), async route => {
      const req = route.request(); const p = new URL(req.url()).pathname; const accept = req.headers()["accept"] || "";
      const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
      if (p.startsWith("/auth/v1/verify")) { verified++; return j(session); }
      if (p.startsWith("/auth/v1/logout")) return route.fulfill({ status: 204, body: "" });
      if (p.startsWith("/auth/v1/token")) return j(session);
      if (p.startsWith("/auth/v1/user")) return j(user);
      if (p.startsWith("/realtime")) return route.abort();
      if (p.endsWith("/employees") && req.method() === "GET") return accept.includes("pgrst.object") ? j(owner) : j([owner]);
      // A brand-new-looking account, so first-run pop-ups would normally show.
      if (p.endsWith("/app_settings") && req.method() === "GET") return j([{ owner_id: UID, data: { onboardingComplete: false, productTourPending: true } }]);
      if (accept.includes("pgrst.object")) return j({ code: "PGRST116" }, 406);
      return j([]);
    });
    await ctx.route("**/api/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message.slice(0, 120)));
    await page.goto(`http://${HOST}:${PORT}/?th=test-token-hash&go=%2Fcustomers`); await page.waitForTimeout(7000);
    const url = page.url();
    const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
    const modals = await page.evaluate(() => [...document.querySelectorAll(".fixed.inset-0")].filter(e => e.getBoundingClientRect().height > 200).length);
    await page.screenshot({ path: `${OUT}/cockpit-preview-${vp.n}.png` });
    console.log(JSON.stringify({ vp: vp.n, tokenRedeemed: verified > 0, url: url.replace(`http://${HOST}:${PORT}`, ""), tokenGoneFromUrl: !url.includes("th="), onCustomers: /Customers/.test(text.slice(0, 600)), previewBar: /Preview/.test(text) && /Back to Cockpit/.test(text), fullScreenOverlays: modals, errs }));
    await ctx.close();
  }
  await browser.close();
})();
