// Settings → AI Models shows the model watch (health, swaps, new free
// models, free providers to connect), and a new watch event lands in the bell.
// /api/model-watch and Supabase mocked.
//   node scripts/e2e/model-watch-ui.cjs http://127.0.0.1:5193
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
  const status = { health: { checkedAt: new Date().toISOString(), slots: { gemini: { provider: "google", model: "gemini-3.0-flash", ok: true, kind: "ok", ms: 800, since: "" }, groq: { provider: "groq", model: "openai/gpt-oss-120b", ok: false, kind: "key", since: "" } }, events: [{ at: new Date().toISOString(), kind: "key", text: "Your groq AI key stopped working — paste a fresh one in Settings → AI Models." }], suggestions: [{ provider: "cerebras", name: "Cerebras", url: "https://cloud.cerebras.ai", why: "Free tier, very fast" }] }, overrides: { gemini: { model: "gemini-3.0-flash", was: "gemini-2.5-flash", reason: "the provider no longer offers it", at: new Date().toISOString() } }, nvidiaWorking: [], openrouterFree: [], newFree: [{ provider: "openrouter", model: "b/brand-new:free", firstSeen: new Date().toISOString() }], checkedAt: new Date().toISOString() };
  await ctx.route("**/api/**", r => r.request().url().includes("/api/model-watch") ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(status) }) : r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http") && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); localStorage.setItem("smocks.lastOwnerSession", "1"); localStorage.setItem("crm.modelWatchSeenAt", "2020-01-01T00:00:00.000Z"); sessionStorage.setItem("seeded", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message.slice(0, 160)));
  await page.goto(BASE + "/#/dashboard"); await page.waitForTimeout(8000);
  for (const t of ["Not now", "Skip", "Maybe later", "Skip setup", "Got it", "Dismiss", "Later"]) { const b = page.locator(`.fixed.inset-0 button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); }
  const bell = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("smocks.notifications") || "[]"); } catch { return []; } });
  await page.locator('button:has-text("Settings")').first().click(); await page.waitForTimeout(1200);
  await page.locator('button:has-text("Alfred")').last().click().catch(() => {}); await page.waitForTimeout(1500);
  const panel = page.locator('text=Automatic model watch').first();
  await panel.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);
  const t = await page.evaluate(() => document.body.innerText);
  await page.screenshot({ path: `${OUT}/model-watch-panel.png` });
  const r = { bellNotification: bell.some(n => /groq AI key stopped working/.test(n.text)), panelShown: /Automatic model watch/.test(t), swapShown: /gemini-2\.5-flash → gemini-3\.0-flash/.test(t), healthShown: /groq — openai\/gpt-oss-120b · key not working/.test(t), suggestionShown: /Cerebras/.test(t), newFreeShown: /b\/brand-new:free/.test(t) };
  console.log(JSON.stringify({ r, errs }, null, 1));
  const ok = Object.values(r).every(Boolean) && !errs.length;
  console.log(ok ? "PASS" : "FAIL");
  await browser.close(); process.exit(ok ? 0 : 1);
})();
