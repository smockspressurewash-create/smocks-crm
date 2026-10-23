// A Google-linked owner on #/customers: when the tab comes back into focus
// Supabase re-confirms the session (reported as SIGNED_IN). The app must
// stay on Customers, not jump to the Google page. Supabase is mocked.
//   node scripts/e2e/google-no-jump.cjs http://127.0.0.1:5181
const { chromium } = require("playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:5181";
const REF = "boaqaihymgmrhnjtiqrs", KEY = `sb-${REF}-auth-token`;
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "11111111-2222-4333-8444-555555555555"; const now = Math.floor(Date.now() / 1000);
const EMAIL = "owner@example.com";
const jwt = b64u({ alg: "HS256", typ: "JWT" }) + "." + b64u({ sub: UID, email: EMAIL, role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now }) + ".sig";
const user = { id: UID, aud: "authenticated", role: "authenticated", email: EMAIL, app_metadata: { provider: "google", providers: ["google"] }, user_metadata: {}, identities: [{ provider: "google", id: "g1", user_id: UID }] };
// When the tab comes back into focus Supabase re-announces this still-valid session as SIGNED_IN.
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r", user, provider_token: "ya29.x" };
const owner = { id: "owner_" + EMAIL, role: "owner", owner_id: UID, user_id: UID, status: "active", email: EMAIL, firstName: "Will", permissions: {} };
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(new RegExp(REF + "\.supabase\.co"), async route => {
    const req = route.request(); const p = new URL(req.url()).pathname; const accept = req.headers()["accept"] || "";
    const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
    if (p.startsWith("/auth/v1/token")) return j({ ...session, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 });
    if (p.startsWith("/auth/v1/user")) return j(user);
    if (p.startsWith("/realtime")) return route.abort();
    if (p.endsWith("/employees") && req.method() === "GET") return accept.includes("pgrst.object") ? j(owner) : j([owner]);
    if (accept.includes("pgrst.object")) return j({ code: "PGRST116" }, 406);
    return j([]);
  });
  await ctx.route("**/api/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http") && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); localStorage.setItem("smocks.lastOwnerSession", "1"); sessionStorage.setItem("seeded", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
  const page = await ctx.newPage();
  const events = []; page.on("console", m => { if (/SIGNED_IN|auth state/i.test(m.text())) events.push(m.text().slice(0, 80)); });
  await page.goto(BASE + "/#/customers"); await page.waitForTimeout(6000);
  const before = await page.evaluate(() => location.hash);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(2500);
  }
  const after = await page.evaluate(() => location.hash);
  const mainText = await page.evaluate(() => (document.querySelector("main")?.innerText || document.body.innerText).replace(/\s+/g, " ").slice(0, 120)); const onGoogle = /Google Workspace|Connection health|Connected as/i.test(mainText);
  console.log(JSON.stringify({ before, after, onGooglePage: onGoogle, mainText }));
  await browser.close();
  process.exit(after.startsWith("#/customers") && !onGoogle ? 0 : 1);
})();
