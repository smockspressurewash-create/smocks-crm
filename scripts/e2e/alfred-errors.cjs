// Alfred errors go to a pop-up + a bell notification, never into the chat:
//   1. the AI says 429 (rate limit) → "usage limit" pop-up, bell entry, no
//      error text in the conversation; Try again resends and the reply shows
//   2. the AI says 402 (out of credit) → "ran out of credit" pop-up
// AI and Supabase mocked — nothing real is contacted.
//   node scripts/e2e/alfred-errors.cjs http://127.0.0.1:5193
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
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = {}; const errs = [];
  const run = async (label, responses, fn) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const state = { calls: 0 };
    await ctx.route(new RegExp(REF + "\.supabase\.co"), async route => {
      const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const accept = req.headers()["accept"] || ""; const m = req.method();
      const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
      if (p.startsWith("/auth/v1/token")) return j(session);
      if (p.startsWith("/auth/v1/user")) return j(user);
      if (p.startsWith("/realtime")) return route.abort();
      if (p.endsWith("/employees") && m === "GET") return accept.includes("pgrst.object") ? j(owner) : j([owner]);
      if (p.endsWith("/app_settings") && m === "GET") return accept.includes("pgrst.object") ? j({ data: settings }) : j([{ data: settings }]);
      if (accept.includes("pgrst.object")) return j({ code: "PGRST116" }, 406);
      return j([]);
    });
    await ctx.route("**/api/**", async route => {
      if (!route.request().url().includes("/api/call-model")) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      const r = responses[Math.min(state.calls++, responses.length - 1)];
      return route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
    });
    await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http") && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); localStorage.setItem("smocks.lastOwnerSession", "1"); sessionStorage.setItem("seeded", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
    const page = await ctx.newPage(); page.on("pageerror", e => errs.push(label + ": " + e.message.slice(0, 160))); page.on("dialog", d => d.accept());
    await page.goto(BASE + "/#/alfred"); await page.waitForTimeout(7000);
    for (const t of ["Not now", "Skip", "Maybe later", "Skip setup", "Got it", "Dismiss", "Later"]) { const b = page.locator(`.fixed.inset-0 button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); }
    try { results[label] = await fn(page, state); } catch (e) { errs.push(label + ": " + e.message.slice(0, 200)); results[label] = { error: true }; }
    await page.screenshot({ path: `${OUT}/alfred-errors-${label}.png` });
    await ctx.close();
  };
  const chatText = page => page.evaluate(() => Array.from(document.querySelectorAll("textarea")).length ? document.body.innerText : "");
  const bell = page => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("smocks.notifications") || "[]"); } catch { return []; } });

  await run("rate-limit-then-retry", [{ status: 429, body: { error: "HTTP 429: Rate limit reached for requests" } }, { status: 200, body: { text: "Hello from Alfred!", toolUses: [], stopReason: "end_turn" } }], async (page, state) => {
    const box = page.locator('textarea[placeholder="Message Alfred..."]');
    await box.fill("what's on today?"); await box.press("Enter");
    await page.locator('[data-alfred-error="limit"]').waitFor({ timeout: 15000 });
    const popupTitle = /usage limit/i.test(await page.evaluate(() => document.body.innerText));
    const notes = await bell(page);
    const before = await page.evaluate(() => document.body.innerText);
    const noErrorInChat = !/HTTP 429|⚠️|Slash commands still work/.test(before.replace(/Details[\s\S]*$/, ""));
    await page.locator('button:has-text("Try again")').click();
    for (let i = 0; i < 20 && !/Hello from Alfred!/.test(await page.evaluate(() => document.body.innerText)); i++) await page.waitForTimeout(400);
    return { popupShown: popupTitle, bellNotification: notes.some(n => /usage limit/i.test(n.text) && n.page === "alfred"), noErrorInChat, retryWorked: /Hello from Alfred!/.test(await page.evaluate(() => document.body.innerText)), resentOnce: state.calls === 2 };
  });
  await run("out-of-credit", [{ status: 402, body: { error: "HTTP 402: Insufficient credits — add credit to continue" } }], async page => {
    const box = page.locator('textarea[placeholder="Message Alfred..."]');
    await box.fill("hi"); await box.press("Enter");
    await page.locator('[data-alfred-error="credit"]').waitFor({ timeout: 15000 });
    await page.locator('button:has-text("Details")').click();
    const t = await page.evaluate(() => document.body.innerText);
    return { creditPopup: /ran out of credit/i.test(t), detailsShowRaw: /Insufficient credits/.test(t), settingsButton: /AI settings/.test(t) };
  });

  console.log(JSON.stringify({ results, errs }, null, 1));
  const ok = Object.values(results).every(r => Object.values(r).every(v => v === true)) && !errs.length;
  console.log(ok ? "PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
