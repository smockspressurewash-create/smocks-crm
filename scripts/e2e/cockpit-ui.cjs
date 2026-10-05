// Restored owner session for smockspressurewash@gmail.com (mocked Supabase) → is Developer → Alfred Cockpit visible? Screens desktop + phone.
// Screenshots go to the OS temp folder (crewboss-e2e). Uses installed Chrome via playwright-core; Supabase and /api are mocked — nothing touches production data.
const OUT = require("path").join(require("os").tmpdir(), "crewboss-e2e"); require("fs").mkdirSync(OUT, { recursive: true });
const { chromium } = require("playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:5181";
const REF = "boaqaihymgmrhnjtiqrs", KEY = `sb-${REF}-auth-token`;
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "11111111-2222-4333-8444-555555555555"; const now = Math.floor(Date.now() / 1000);
const EMAIL = "smockspressurewash@gmail.com";
const jwt = b64u({ alg: "HS256", typ: "JWT" }) + "." + b64u({ sub: UID, email: EMAIL, role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now }) + ".sig";
const user = { id: UID, aud: "authenticated", role: "authenticated", email: EMAIL, app_metadata: { provider: "email" }, user_metadata: {} };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r", user };
const owner = { id: "owner_" + EMAIL, role: "owner", owner_id: UID, user_id: UID, status: "active", email: EMAIL, firstName: "Will", permissions: {} };
const items = [
  { id: "a1", owner_id: UID, title: "Change the sidebar icon", description: "", type: "idea", status: "in_progress", claude_notes: "[Oct 5, 11:21 AM] QUESTION: What icon would you like instead of the grid? A rocket, a robot, or a steering wheel?", created_at: "2026-10-05T12:00:00Z", updated_at: "2026-10-05T12:00:00Z" },
  { id: "a2", owner_id: UID, title: "Change invoice email wording", description: "", type: "idea", status: "in_progress", claude_notes: "[Oct 5, 1:10 PM] APPROVAL NEEDED: This changes the email every customer gets with their invoice. If something is off, customers could get a confusing email until it is undone. Go ahead?", created_at: "2026-10-04T12:00:00Z", updated_at: "2026-10-05T01:10:00Z" },
  { id: "a3", owner_id: UID, title: "Bigger Pay button on invoices", description: "", type: "idea", status: "in_progress", progress: 45, progress_label: "Making the change", claude_notes: "[Oct 5, 1:20 PM] On it.", created_at: "2026-10-03T12:00:00Z", updated_at: "2026-10-05T01:20:00Z" },
  { id: "a4", owner_id: UID, title: "Dark blue dashboard header", description: "", type: "idea", status: "in_progress", progress: 100, preview_url: "https://cockpit-a4.smocks-crm.pages.dev", claude_notes: "[Oct 5, 1:30 PM] PREVIEW READY: The dashboard header is now dark blue. Open the preview, sign in, and look at the top of the Dashboard. Only someone with this link sees it.", created_at: "2026-10-02T12:00:00Z", updated_at: "2026-10-05T01:30:00Z" },
  { id: "a5", owner_id: UID, title: "Add Export button", description: "", type: "idea", status: "done", claude_notes: "[Oct 5, 2:00 PM] LIVE: Customers page now has an Export button. Tap Undo if you want it back. (merge abc1234)", created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-05T02:00:00Z" },
];
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const vp of [{ n: "desktop", w: 1440, h: 900 }, { n: "mobile", w: 390, h: 844, m: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.m, hasTouch: !!vp.m });
    await ctx.route(new RegExp(REF + "\.supabase\.co"), async route => {
      const req = route.request(); const p = new URL(req.url()).pathname; const accept = req.headers()["accept"] || "";
      const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
      if (p.startsWith("/auth/v1/token")) return j(session);
      if (p.startsWith("/auth/v1/user")) return j(user);
      if (p.startsWith("/realtime")) return route.abort();
      if (p.endsWith("/employees") && req.method() === "GET") return accept.includes("pgrst.object") ? j(owner) : j([owner]);
      if (p.endsWith("/cockpit_items") && req.method() === "GET") return j(items);
      if (accept.includes("pgrst.object")) return j({ code: "PGRST116" }, 406);
      return j([]);
    });
    await ctx.route("**/api/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http")) { localStorage.setItem(k, v); localStorage.setItem("smocks.lastOwnerSession", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
    const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message.slice(0, 120)));
    await page.goto(BASE + "/#/dashboard"); await page.waitForTimeout(6000);
    for (const t of ["Not now", "Skip", "Maybe later"]) { const b = page.locator(`button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); }
    if (vp.m) { await page.locator("header button").first().click().catch(() => {}); await page.waitForTimeout(800); }
    const nav = page.getByText("Alfred Cockpit", { exact: true }).first();
    const found = await nav.count() > 0;
    if (found) await nav.scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: `${OUT}/cockpit-nav-${vp.n}.png` });
    if (found) { await nav.click(); await page.waitForTimeout(2000); }
    else { await page.evaluate(() => { location.hash = "#/cockpit"; }); await page.waitForTimeout(2000); }
    await page.screenshot({ path: `${OUT}/cockpit-${vp.n}.png`, fullPage: true });
    for (const t of ["Change invoice email wording","Dark blue dashboard header"]) { await page.getByText(t).first().click(); await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/cockpit-${vp.n}-${t.split(" ")[0]}.png` }); await page.reload(); await page.waitForTimeout(4000); }
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(vp.n, "menu item visible:", found, "| page text:", (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").match(/Alfred Cockpit.{0,80}/)?.[0], "| overflowX:", ov, "| errs:", errs.length);
    await ctx.close();
  }
  await browser.close();
})();
