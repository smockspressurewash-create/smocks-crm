// Alfred chat + files, in the browser (AI, Google and Supabase mocked):
//   1. a PDF client list with no message → read in two parts (the first
//      answer ran out of room), recognized as a client list, all 40 rows go
//      to prepare_import — nothing saved
//   2. a receipt photo with no message → "Receipt detected" card with a Log
//      expense button, no extra AI turn
//   3. a Google Sheets link in a message → the sheet is opened by the
//      server and its rows go to prepare_import
//   node scripts/e2e/alfred-attachments.cjs http://127.0.0.1:5193
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
const ROWS = Array.from({ length: 40 }, (_, i) => `Client ${i}\t717555${String(1000 + i)}\t${i} Oak St\tTuesday\t30\t2`);
const pdfPath = path.join(OUT, "clients.pdf"); fs.writeFileSync(pdfPath, "%PDF-1.4\n% fake client list\n");
const jpgPath = path.join(OUT, "receipt.jpg"); fs.writeFileSync(jpgPath, Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64"));

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = {}; const errs = [];
  const run = async (label, fn) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const state = { visionCalls: 0, textCalls: [], prepareResults: [] };
    await ctx.route(new RegExp(REF + "\\.supabase\\.co"), async route => {
      const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const accept = req.headers()["accept"] || ""; const m = req.method();
      const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
      if (p.startsWith("/auth/v1/token")) return j(session);
      if (p.startsWith("/auth/v1/user")) return j(user);
      if (p.startsWith("/realtime")) return route.abort();
      if (p.startsWith("/storage/")) return j({ Key: "x" });
      if (p.endsWith("/employees") && m === "GET") return accept.includes("pgrst.object") ? j(owner) : j([owner]);
      if (p.endsWith("/app_settings") && m === "GET") return accept.includes("pgrst.object") ? j({ data: settings }) : j([{ data: settings }]);
      if (accept.includes("pgrst.object")) return j({ code: "PGRST116" }, 406);
      return j([]);
    });
    await ctx.route("**/api/**", async route => {
      const req = route.request(); const url = req.url();
      const reply = o => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "", toolUses: [], stopReason: "end_turn", ...o }) });
      if (url.includes("/api/sheet-fetch")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ csv: "Name,Phone,Address\nSheet Person,7175559999,1 Elm St\n", via: "public link" }) });
      if (!url.includes("/api/call-model")) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      const body = JSON.parse(req.postData() || "{}"); const msgs = body.messages || [];
      const first = msgs[0]?.content;
      const fileBlock = Array.isArray(first) && first.find(b => b.type === "document" || b.type === "image");
      if (fileBlock && msgs.length === 1) {
        state.visionCalls++;
        const prompt = first.find(b => b.type === "text")?.text || "";
        if (fileBlock.type === "image") return reply({ text: '{"kind":"receipt","title":"Fuel","receipt":{"vendor":"Sheetz","date":"2026-10-20","total":61.2,"category":"fuel"}}\nSheetz fuel $61.20\n<<END>>' });
        if (/ran out of room/.test(prompt)) return reply({ text: ROWS.slice(25).join("\n") + "\n<<END>>" });
        return reply({ text: '{"kind":"client_list","title":"Trash can clients","rowCount":40,"receipt":null}\nName\tPhone\tAddress\tDay\tPrice\tCans\n' + ROWS.slice(0, 25).join("\n") });
      }
      const last = msgs[msgs.length - 1];
      const textOf = c => typeof c === "string" ? c : (Array.isArray(c) ? c.map(b => b.text || (typeof b.content === "string" ? b.content : "")).join("\n") : "");
      const lastText = textOf(last?.content);
      state.textCalls.push(lastText);
      if (Array.isArray(last?.content) && last.content.some(b => b.type === "tool_result")) { state.prepareResults.push(lastText); return reply({ text: "Ready — say yes to import." }); }
      const batch = lastText.match(/batchId "(B-[A-Za-z0-9-]+)"/);
      if (batch) return reply({ toolUses: [{ id: "t1", name: "prepare_import", input: { batchId: batch[1] } }], stopReason: "tool_use", raw: [{ type: "tool_use", id: "t1", name: "prepare_import", input: { batchId: batch[1] } }] });
      return reply({ text: "ok" });
    });
    await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http") && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); localStorage.setItem("smocks.lastOwnerSession", "1"); sessionStorage.setItem("seeded", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
    const page = await ctx.newPage(); page.on("pageerror", e => errs.push(label + ": " + e.message.slice(0, 160))); page.on("dialog", d => d.accept());
    await page.goto(BASE + "/#/alfred"); await page.waitForTimeout(7000);
    for (const t of ["Not now", "Skip", "Maybe later", "Skip setup", "Got it", "Dismiss", "Later"]) { const b = page.locator(`.fixed.inset-0 button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); }
    try { results[label] = await fn(page, state); } catch (e) { errs.push(label + ": " + e.message.slice(0, 200)); results[label] = { error: true }; }
    await page.screenshot({ path: `${OUT}/alfred-attach-${label}.png` });
    await ctx.close();
  };
  const attach = async (page, menuText, file) => {
    await page.locator('button[title^="Attach a photo"]').first().click();
    await page.locator(`label:has-text("${menuText}") input[type=file]`).setInputFiles(file);
    await page.waitForTimeout(800);
  };
  const composer = page => page.locator('textarea[placeholder="Message Alfred..."]');

  await run("pdf-client-list", async (page, state) => {
    await attach(page, "Document (PDF)", pdfPath);
    await composer(page).press("Enter");
    for (let i = 0; i < 30 && !state.prepareResults.length; i++) await page.waitForTimeout(500);
    const res = state.prepareResults.join("\n");
    return { readInTwoParts: state.visionCalls === 2, recognizedAsList: state.textCalls.some(t => /is a client list/.test(t)), allRowsToImport: /recordsRead\\?":40/.test(res), nothingSaved: /NOTHING is saved yet/.test(res) };
  });
  await run("receipt-photo", async (page, state) => {
    await attach(page, "Photo or video", jpgPath);
    await composer(page).press("Enter");
    await page.waitForTimeout(4000);
    const text = await page.evaluate(() => document.body.innerText);
    return { receiptCard: /Receipt detected: Sheetz · \$61\.2/.test(text), logButton: /Log \$61\.2 to Expenses/.test(text), noExtraTurn: state.textCalls.length === 0 };
  });
  await run("google-sheet-link", async (page, state) => {
    await composer(page).fill("import the clients in https://docs.google.com/spreadsheets/d/abc123XYZ/edit#gid=0 please");
    await composer(page).press("Enter");
    for (let i = 0; i < 20 && !state.prepareResults.length; i++) await page.waitForTimeout(500);
    return { sheetOpened: state.textCalls.some(t => /Google Sheet .*1 rows/.test(t)), importPrepared: /recordsRead\\?":1/.test(state.prepareResults.join("\n")) };
  });

  console.log(JSON.stringify({ results, errs }, null, 1));
  const ok = Object.values(results).every(r => Object.values(r).every(v => v === true)) && !errs.length;
  console.log(ok ? "PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
