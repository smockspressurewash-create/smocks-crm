// Alfred + a big trash-can client spreadsheet, end to end in the browser:
// attach a 600-row CSV → Alfred gets a short note (not the whole file) →
// prepare_import reads all 600 rows and saves nothing → the owner says yes →
// run_import saves every customer and job in batches. Also: a long pasted
// list is kept aside the same way. The AI and Supabase are mocked —
// nothing touches production or a real model.
//   node scripts/e2e/alfred-import.cjs http://127.0.0.1:5193
const OUT = require("path").join(require("os").tmpdir(), "crewboss-e2e"); require("fs").mkdirSync(OUT, { recursive: true });
const fs = require("fs");
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
const mike = { id: "emp-mike", role: "technician", owner_id: UID, status: "active", email: "mike@example.com", firstName: "Mike", lastName: "Jones", permissions: {} };
const settings = { modelKeys: { claude: "••••••••" }, modelPriority: ["claude"], activeModel: "claude", setupComplete: true, onboardingComplete: true, companyName: "Test Co" };
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const csv = ["Name,Phone,Address,Pickup Day,Price,Cans,Worker,Notes",
  ...Array.from({ length: 600 }, (_, i) => `Client ${i},(717) 555-${String(i).padStart(4, "0")},"${i} Oak St, York PA",${days[i % 5]},${25 + (i % 2) * 5},${1 + (i % 2)},${i % 2 ? "Mike" : ""},${i % 9 ? "" : "Side gate"}`)].join("\n");
const csvPath = require("path").join(OUT, "trash-clients.csv"); fs.writeFileSync(csvPath, csv);

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errs = []; const r = {};
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const saved = { customers: 0, jobs: 0, jobRequests: 0 };
  const modelCalls = [];
  await ctx.route(new RegExp(REF + "\\.supabase\\.co"), async route => {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const accept = req.headers()["accept"] || ""; const m = req.method();
    const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
    if (p.startsWith("/auth/v1/token")) return j(session);
    if (p.startsWith("/auth/v1/user")) return j(user);
    if (p.startsWith("/realtime")) return route.abort();
    if (p.endsWith("/employees") && m === "GET") return accept.includes("pgrst.object") ? j(owner) : /user_id|email|auth_user/.test(u.search) ? j([owner]) : j([owner, mike]);
    if (p.endsWith("/app_settings") && m === "GET") return accept.includes("pgrst.object") ? j({ data: settings }) : j([{ data: settings }]);
    if (p.endsWith("/customers") && (m === "POST" || m === "PATCH")) { const b = JSON.parse(req.postData() || "[]"); saved.customers += Array.isArray(b) ? b.length : 1; return j([]); }
    if (p.endsWith("/jobs") && m === "POST") { const b = JSON.parse(req.postData() || "[]"); const arr = Array.isArray(b) ? b : [b]; saved.jobs += arr.length; saved.jobRequests++; return j(arr.map(x => ({ id: x.id })), 201); }
    if (accept.includes("pgrst.object")) return j({ code: "PGRST116" }, 406);
    return j([]);
  });
  await ctx.route("**/api/**", async route => {
    const req = route.request();
    if (!req.url().includes("/api/call-model")) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    const body = JSON.parse(req.postData() || "{}");
    modelCalls.push(body);
    const msgs = body.messages || [];
    const last = msgs[msgs.length - 1];
    const textOf = c => typeof c === "string" ? c : (Array.isArray(c) ? c.map(b => b.text || (typeof b.content === "string" ? b.content : "")).join("\n") : "");
    const lastText = textOf(last?.content);
    const reply = o => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "", toolUses: [], stopReason: "end_turn", ...o }) });
    const isToolResult = Array.isArray(last?.content) && last.content.some(b => b.type === "tool_result");
    if (isToolResult) {
      if (/"planId"/.test(lastText) && /jobsToCreate/.test(lastText)) return reply({ text: "Ready to import: " + (lastText.match(/"newCustomers":(\d+)/) || [])[1] + " new customers. Say yes to save." });
      return reply({ text: "Done: " + lastText.slice(0, 200) });
    }
    const batch = lastText.match(/batchId "(B-[A-Za-z0-9-]+)"/);
    if (batch) return reply({ toolUses: [{ id: "t1", name: "prepare_import", input: { batchId: batch[1], serviceCategory: "trash_can" } }], stopReason: "tool_use", raw: [{ type: "tool_use", id: "t1", name: "prepare_import", input: { batchId: batch[1], serviceCategory: "trash_can" } }] });
    if (/^\s*yes\b/i.test(lastText)) {
      const all = msgs.map(mm => textOf(mm.content)).join("\n");
      const plan = (all.match(/IMP-[A-Za-z0-9_-]+/g) || []).pop();
      return reply({ toolUses: [{ id: "t2", name: "run_import", input: { planId: plan } }], stopReason: "tool_use", raw: [{ type: "tool_use", id: "t2", name: "run_import", input: { planId: plan } }] });
    }
    return reply({ text: "ok" });
  });
  await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http") && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); localStorage.setItem("smocks.lastOwnerSession", "1"); sessionStorage.setItem("seeded", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
  const page = await ctx.newPage(); page.on("pageerror", e => errs.push(e.message.slice(0, 160))); page.on("dialog", d => d.accept());
  await page.goto(BASE + "/#/alfred"); await page.waitForTimeout(8000);
  for (const t of ["Not now", "Skip", "Maybe later", "Skip setup", "Got it", "Dismiss", "Later"]) { const b = page.locator(`.fixed.inset-0 button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); }

  if (process.env.DEBUG_E2E) { await page.screenshot({ path: `${OUT}/alfred-before.png` }); console.log("URL", page.url(), (await page.evaluate(() => document.body.innerText)).slice(0, 600).replace(/\n/g, " | ")); }
  await page.locator('button[title^="Attach a photo"]').first().click();
  await page.locator('label:has-text("Spreadsheet or list") input[type=file]').setInputFiles(csvPath);
  await page.waitForTimeout(800);
  const composer = page.locator("textarea").last();
  await composer.fill("import these trash can clients");
  await composer.press("Enter");
  await page.waitForTimeout(6000);
  const first = modelCalls[0] || { messages: [] };
  const firstSize = JSON.stringify(first.messages).length;
  r.modelGotNoteNotFile = firstSize < csv.length && /600 rows/.test(JSON.stringify(first.messages));
  r.preparedAll600 = modelCalls.some(c => /recordsRead\\?":600/.test(JSON.stringify(c.messages)));
  r.nothingSavedBeforeYes = saved.customers === 0 && saved.jobs === 0;
  r.summaryShown = /Ready to import: 600 new customers/.test(await page.evaluate(() => document.body.innerText));
  await composer.fill("yes");
  await composer.press("Enter");
  await page.waitForTimeout(8000);
  if (process.env.DEBUG_E2E) console.log("AFTER YES", JSON.stringify(modelCalls.slice(-2).map(c => c.messages.slice(-2))).slice(0, 1500), (await page.evaluate(() => document.body.innerText)).slice(-800));
  r.savedAllCustomers = saved.customers === 600;
  r.savedAllJobs = saved.jobs === 600 && saved.jobRequests <= 7;
  const runResult = modelCalls.map(c => JSON.stringify(c.messages)).find(s => /customersSaved/.test(s)) || "";
  r.workerMatchedNoWarning = !/No employee matches/.test(JSON.stringify(modelCalls.map(c => c.messages)));

  // A long pasted list is kept aside too.
  const callsBefore = modelCalls.length;
  const paste = Array.from({ length: 80 }, (_, i) => `Person ${i} — ${i} Pine Rd, York — ${days[i % 5]}s — 2 cans — $25/mo — Mike — notes for this client go here`).join("\n");
  await composer.fill(paste);
  await composer.press("Enter");
  await page.waitForTimeout(4000);
  const pasteCall = modelCalls[callsBefore];
  r.longPasteKeptAside = !!pasteCall && JSON.stringify(pasteCall.messages).length < JSON.stringify(modelCalls[0].messages).length + paste.length && /Saved as import batch B-/.test(JSON.stringify(pasteCall.messages));
  await page.screenshot({ path: `${OUT}/alfred-import.png` });
  console.log(JSON.stringify({ r, saved, errs, runResult: runResult.slice(0, 300) }, null, 1));
  const ok = Object.values(r).every(Boolean) && !errs.length;
  console.log(ok ? "PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
