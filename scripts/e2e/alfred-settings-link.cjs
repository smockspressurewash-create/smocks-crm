// Alfred → model picker → "Manage API keys" opens Settings on the Alfred
// (AI keys) tab — it used to open My Profile. A plain Settings open still
// starts on My Profile afterwards. Supabase mocked.
//   node scripts/e2e/alfred-settings-link.cjs http://127.0.0.1:5193
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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
  await ctx.route("**/api/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http") && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); localStorage.setItem("smocks.lastOwnerSession", "1"); sessionStorage.setItem("seeded", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message.slice(0, 160)));
  await page.goto(BASE + "/#/alfred"); await page.waitForTimeout(7000);
  for (const t of ["Not now", "Skip", "Maybe later", "Skip setup", "Got it", "Dismiss", "Later"]) { const b = page.locator(`.fixed.inset-0 button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); }
  const r = {};
  await page.locator("button", { hasText: /Claude|Gemini|GPT|Groq|NVIDIA|OpenRouter|Model/ }).first().click(); await page.waitForTimeout(500);
  await page.locator('button:has-text("Manage API keys")').click(); await page.waitForTimeout(1200);
  r.opensAiKeys = /AI Models & Failover/.test(await page.evaluate(() => document.body.innerText));
  await page.screenshot({ path: `${OUT}/manage-api-keys.png` });
  await page.locator('button:has-text("Cancel")').first().click().catch(() => {}); await page.waitForTimeout(800);
  await page.locator('button:has-text("Settings")').first().click(); await page.waitForTimeout(1200);
  r.plainSettingsStartsOnProfile = /Your Name/.test(await page.evaluate(() => document.body.innerText)) && !/AI Models & Failover/.test(await page.evaluate(() => document.body.innerText));
  console.log(JSON.stringify({ r, errs }, null, 1));
  const ok = Object.values(r).every(Boolean) && !errs.length;
  console.log(ok ? "PASS" : "FAIL");
  await browser.close(); process.exit(ok ? 0 : 1);
})();
