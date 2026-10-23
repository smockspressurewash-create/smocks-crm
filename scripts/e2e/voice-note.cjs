// Alfred chat voice note, desktop + phone, with Chrome's fake microphone:
// mic → Voice Note → it records → Stop → transcript shows → Send puts the
// text in the chat. /api/alfred-transcribe is mocked (returns fixed text);
// checks the recording actually reached it (non-empty audio).
//   node scripts/e2e/voice-note.cjs http://127.0.0.1:5193
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
const SAID = "Schedule the Millers for Thursday at nine";

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const results = {}; const errs = [];
  for (const [label, viewport, mobile] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, permissions: ["microphone"] });
    let audioBytes = 0;
    await ctx.route(new RegExp(REF + "\\.supabase\\.co"), async route => {
      const req = route.request(); const p = new URL(req.url()).pathname; const accept = req.headers()["accept"] || "";
      const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
      if (p.startsWith("/auth/v1/token")) return j(session);
      if (p.startsWith("/auth/v1/user")) return j(user);
      if (p.startsWith("/realtime")) return route.abort();
      if (p.endsWith("/employees") && req.method() === "GET") return accept.includes("pgrst.object") ? j(owner) : j([owner]);
      if (accept.includes("pgrst.object")) return j({ code: "PGRST116" }, 406);
      return j([]);
    });
    // Later routes win in Playwright — the catch-all goes first.
    await ctx.route("**/api/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await ctx.route("**/api/alfred-transcribe", async r => { audioBytes = (r.request().postDataBuffer() || Buffer.alloc(0)).length; await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: SAID, via: "mock" }) }); });
    await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http") && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); localStorage.setItem("smocks.lastOwnerSession", "1"); sessionStorage.setItem("seeded", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
    const page = await ctx.newPage(); page.on("pageerror", e => errs.push(label + ": " + e.message.slice(0, 160))); page.on("dialog", d => { errs.push(label + " dialog: " + d.message()); d.dismiss(); });
    await page.goto(BASE + "/#/alfred"); await page.waitForTimeout(7000);
    for (const t of ["Not now", "Skip", "Maybe later", "Skip setup", "Got it", "Dismiss", "Later"]) { const b = page.locator(`.fixed.inset-0 button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); }
    const r = {};
    await page.locator('button[title="Voice options"]').first().click(); await page.waitForTimeout(400);
    await page.locator('button:has-text("Voice Note")').first().click(); await page.waitForTimeout(3000);
    r.recording = await page.locator('[data-voice-note="recording"]').isVisible().catch(() => false);
    await page.screenshot({ path: `${OUT}/voice-recording-${label}.png` });
    await page.locator('[data-voice-note="recording"] button:has-text("Stop")').click().catch(e => errs.push(label + " stop: " + e.message.slice(0, 80)));
    await page.waitForTimeout(2500);
    r.readyAfterStop = await page.locator('[data-voice-note="ready"]').isVisible().catch(() => false);
    r.audioSentToServer = audioBytes > 2000;
    r.transcriptShown = await page.locator('[data-voice-note="ready"] textarea').inputValue().then(v => v === SAID).catch(() => false);
    await page.screenshot({ path: `${OUT}/voice-ready-${label}.png` });
    await page.locator('[data-voice-note="ready"] button:has-text("Send")').click().catch(e => errs.push(label + " send: " + e.message.slice(0, 80)));
    await page.waitForTimeout(1500);
    r.sentToChat = (await page.evaluate(() => document.body.innerText)).includes(SAID);
    r.overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    await page.screenshot({ path: `${OUT}/voice-sent-${label}.png` });
    results[label] = { ...r, audioBytes };
    await ctx.close();
  }
  console.log(JSON.stringify({ results, errs }, null, 1));
  const ok = Object.values(results).every(r => r.recording && r.readyAfterStop && r.audioSentToServer && r.transcriptShown && r.sentToChat && !r.overflow) && !errs.length;
  console.log(ok ? "PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
