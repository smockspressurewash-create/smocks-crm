// An employee signed in on #/portal must NOT trigger Alfred's owner-only
// check-in / morning briefing / goal notifications (no /api/alfred-notify call,
// no "Alfred checked in" toast). "Now" is faked to 9:30am so both would fire for an owner.
// Supabase and /api are mocked; nothing touches production.
// Usage: node scripts/e2e/emp-no-alfred.cjs http://127.0.0.1:5181
const { chromium } = require("playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:5181";
const REF = "boaqaihymgmrhnjtiqrs", KEY = `sb-${REF}-auth-token`;
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "99999999-2222-4333-8444-555555555555", OWNER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const now = Math.floor(Date.now() / 1000);
const jwt = b64u({ alg: "HS256", typ: "JWT" }) + "." + b64u({ sub: UID, email: "emp@example.com", role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now }) + ".sig";
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "emp@example.com", app_metadata: { provider: "email" }, user_metadata: {} };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r", user };
const empRow = { id: "emp1", role: "employee", owner_id: OWNER, user_id: UID, status: "active", email: "emp@example.com", firstName: "Eddie", lastName: "Emp", permissions: {} };
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  // Make "now" 9:30am (timers still run normally) so the check-in and briefing windows are open.
  await ctx.addInitScript(() => {
    const R = Date, base = new R(); base.setHours(9, 30, 0, 0); const off = base.getTime() - R.now();
    class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } }
    window.Date = D;
  });
  const alfredCalls = [];
  await ctx.route("**/api/**", async route => {
    let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch {}
    if (route.request().url().includes("alfred-notify")) alfredCalls.push(b.title || "alfred-notify");
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await ctx.route(/boaqaihymgmrhnjtiqrs\.supabase\.co/, async route => {
    const req = route.request(); const p = new URL(req.url()).pathname; const accept = req.headers()["accept"] || "";
    const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
    if (p.startsWith("/auth/v1/token")) return j(session);
    if (p.startsWith("/auth/v1/user")) return j(user);
    if (p.startsWith("/realtime")) return route.abort();
    if (p.endsWith("/employees") && req.method() === "GET") return accept.includes("pgrst.object") ? j(empRow) : j([empRow]);
    if (accept.includes("pgrst.object")) return j({ code: "PGRST116", message: "0 rows" }, 406);
    return j([]);
  });
  await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http")) localStorage.setItem(k, v); } catch {} }, [KEY, JSON.stringify(session)]);
  const page = await ctx.newPage();
  await page.goto(BASE + "/#/portal");
  await page.waitForTimeout(8000);
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
  const result = { screen: text.slice(0, 70), alfredNotifyCalls: alfredCalls, sawCheckinToast: /Alfred checked in|morning briefing is ready/i.test(text) };
  console.log(JSON.stringify(result));
  await browser.close();
  process.exit(result.alfredNotifyCalls.length || result.sawCheckinToast ? 1 : 0);
})();
