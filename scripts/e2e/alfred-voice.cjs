// Alfred voice input in a real Chrome with a fake microphone (a WAV of
// speech-like sound, then silence) — the cases that used to hang on
// "Listening…" forever:
//   A. no built-in speech recognizer (Firefox / iPhone home-screen app):
//      Dictate records and the server's text lands in the box
//   B. the built-in recognizer fails with "network": Dictate switches to
//      recording instead of restarting forever
//   C. Voice Mode with no recognizer: a turn stops by itself after the
//      speaker goes quiet, is transcribed, and is sent to Alfred
//   D. Voice Note: record, stop, Send
// The transcriber, the AI and Supabase are mocked — nothing real is contacted.
//   node scripts/e2e/alfred-voice.cjs http://127.0.0.1:5193
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
const SAID = "hello from the server";

// 16 kHz mono WAV: 0.8s quiet, 1.6s loud warbling tone (reads as talking), 3s quiet.
const wavPath = path.join(OUT, "fake-voice.wav");
{
  const rate = 16000, secs = 5.4, n = Math.floor(rate * secs);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const loud = t > 0.8 && t < 2.4;
    const v = loud ? Math.sin(2 * Math.PI * (220 + 80 * Math.sin(2 * Math.PI * 3 * t)) * t) * 0.6 : (Math.random() - 0.5) * 0.004;
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(wavPath, Buffer.concat([h, data]));
}

const NO_RECOGNIZER = `delete window.SpeechRecognition; delete window.webkitSpeechRecognition; Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true }); Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });`;
const NETWORK_FAILING_RECOGNIZER = `window.__recStarts = 0; class FakeRec { start() { window.__recStarts++; setTimeout(() => { this.onerror && this.onerror({ error: "network" }); setTimeout(() => this.onend && this.onend(), 20); }, 50); } stop() { this.onend && this.onend(); } abort() {} } window.webkitSpeechRecognition = FakeRec; window.SpeechRecognition = FakeRec;`;

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wavPath}`, "--autoplay-policy=no-user-gesture-required"] });
  const results = {}; const errs = [];
  const run = async (label, initScript, fn) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, permissions: ["microphone"] });
    const state = { transcribes: 0, audioBytes: 0, modelTexts: [] };
    await ctx.route(new RegExp(REF + "\\.supabase\\.co"), async route => {
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
      const req = route.request(); const url = req.url();
      if (url.includes("/api/alfred-transcribe")) { state.transcribes++; state.audioBytes = Math.max(state.audioBytes, (req.postDataBuffer() || Buffer.alloc(0)).length); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: SAID, via: "mock" }) }); }
      if (url.includes("/api/call-model")) {
        const body = JSON.parse(req.postData() || "{}");
        state.modelTexts.push(JSON.stringify(body.messages || []));
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "Heard you.", toolUses: [], stopReason: "end_turn" }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http") && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); localStorage.setItem("smocks.lastOwnerSession", "1"); sessionStorage.setItem("seeded", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
    if (initScript) await ctx.addInitScript(initScript);
    const page = await ctx.newPage(); page.on("pageerror", e => errs.push(label + ": " + e.message.slice(0, 160))); page.on("dialog", d => { errs.push(label + " dialog: " + d.message().slice(0, 120)); d.accept(); });
    await page.goto(BASE + "/#/alfred"); await page.waitForTimeout(7000);
    for (const t of ["Not now", "Skip", "Maybe later", "Skip setup", "Got it", "Dismiss", "Later"]) { const b = page.locator(`.fixed.inset-0 button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); }
    try { results[label] = await fn(page, state); } catch (e) { errs.push(label + ": " + e.message.slice(0, 200)); results[label] = { error: true }; }
    await page.screenshot({ path: `${OUT}/alfred-voice-${label}.png` });
    await ctx.close();
  };
  const openMenu = async page => { await page.locator('button[title="Voice options"]').click(); await page.waitForTimeout(300); };

  const dictate = async (page, state) => {
    await openMenu(page);
    await page.locator('button:has-text("Dictate (type by voice)")').click();
    await page.waitForTimeout(3000);
    await page.locator('button[title="Stop listening"]').click();
    await page.waitForTimeout(2500);
    const box = await page.locator('textarea[placeholder="Message Alfred..."]').inputValue();
    return { textLanded: box.includes(SAID), transcribedOnce: state.transcribes === 1, audioSent: state.audioBytes > 800 };
  };
  await run("A-dictate-no-recognizer", NO_RECOGNIZER, dictate);
  await run("B-dictate-network-error", NETWORK_FAILING_RECOGNIZER, async (page, state) => {
    const r = await dictate(page, state);
    const starts = await page.evaluate(() => window.__recStarts);
    const marked = await page.evaluate(() => !!sessionStorage.getItem("crewboss.browserSpeechBroken"));
    return { ...r, noRestartLoop: starts <= 2, markedBroken: marked };
  });
  await run("C-voice-mode-no-recognizer", NO_RECOGNIZER, async (page, state) => {
    await openMenu(page);
    await page.locator('button:has-text("Voice Mode")').first().click();
    // speech 0.8–2.4s, then 1.3s of quiet ends the turn by itself
    for (let i = 0; i < 20 && !state.modelTexts.some(t => t.includes(SAID)); i++) await page.waitForTimeout(500);
    return { stoppedByItself: state.transcribes >= 1, sentToAlfred: state.modelTexts.some(t => t.includes(SAID)) };
  });
  await run("D-voice-note", NO_RECOGNIZER, async (page, state) => {
    await openMenu(page);
    await page.locator('button:has-text("Voice Note")').click();
    await page.waitForTimeout(3000);
    await page.locator('[data-voice-note="recording"] button[title="Stop"]').click();
    await page.locator('[data-voice-note="ready"] textarea').waitFor({ timeout: 10000 });
    await page.locator('[data-voice-note="ready"] button[title="Send to Alfred"]').click();
    for (let i = 0; i < 10 && !state.modelTexts.some(t => t.includes(SAID)); i++) await page.waitForTimeout(500);
    return { sentToAlfred: state.modelTexts.some(t => t.includes(SAID)) };
  });

  console.log(JSON.stringify({ results, errs }, null, 1));
  const ok = Object.values(results).every(r => Object.values(r).every(v => v === true)) && !errs.length;
  console.log(ok ? "PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
