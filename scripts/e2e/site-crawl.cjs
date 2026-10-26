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


// Owner pages, each loaded on desktop and phone with demo data (Supabase and
// /api mocked): crashes, console errors, an error screen, sideways overflow,
// and how long the page takes to show.
//   node scripts/e2e/site-crawl.cjs http://127.0.0.1:5193 [out.json]
const PAGES = ["dashboard","alfred","inbox","notifications","jobs","customers","estimates","invoices","trash-cans","workorders","calendar","crew","intake","sops","pipeline","automations","campaigns","reviews","social","promotions","referrals","goals","expenses","reports","analytics","budget","chemicals","fleet","employees","hiring","training","accountability","personal","feedback","google","cockpit"];
const hex = n => n.toString(16).padStart(12, "0");
const now2 = new Date();
const d = k => { const x = new Date(now2); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };
const customers = Array.from({ length: 40 }, (_, i) => ({ id: `c0000000-0000-4000-8000-${hex(i)}`, owner_id: UID, firstName: "Cust", lastName: String(i), phone: `717555${String(1000 + i)}`, email: `c${i}@example.com`, address: `${i} Main St, York PA`, tags: i % 3 ? [] : ["VIP"], totalSpent: i * 40, createdAt: d(-i), pipelineStage: i % 7 === 0 ? "lead" : null }));
const jobs = Array.from({ length: 30 }, (_, i) => ({ id: `j0000000-0000-4000-8000-${hex(i)}`, owner_id: UID, customerId: customers[i % 40].id, customerName: `Cust ${i % 40}`, address: customers[i % 40].address, status: ["scheduled", "in_progress", "completed"][i % 3], scheduledDate: d((i % 9) - 4), scheduledTime: "09:00", amount: 150 + i, crew: [], checklist: [], photos: [], commLog: [], chemicalsUsed: [], equipment: [], tags: [], serviceCategory: i % 4 ? "wash" : "trash_can", createdAt: d(-10) }));
const estimates = Array.from({ length: 12 }, (_, i) => ({ id: `e0000000-0000-4000-8000-${hex(i)}`, owner_id: UID, customerId: customers[i].id, status: ["draft", "sent", "approved", "paid"][i % 4], invoiced: i % 2 === 0, total: 200 + i * 10, subtotal: 200 + i * 10, lineItems: [{ id: "l" + i, description: "House wash", quantity: 1, unitPrice: 200 + i * 10 }], createdAt: d(-i), validUntil: d(20) }));
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const report = [];
  for (const [label, viewport, mobile] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
    await ctx.route(new RegExp(REF + "\.supabase\.co"), async route => {
      const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const accept = req.headers()["accept"] || ""; const m = req.method();
      const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
      if (p.startsWith("/auth/v1/token")) return j(session);
      if (p.startsWith("/auth/v1/user")) return j(user);
      if (p.startsWith("/realtime")) return route.abort();
      if (p.endsWith("/employees") && m === "GET") return accept.includes("pgrst.object") ? j(owner) : j([owner]);
      if (p.endsWith("/app_settings") && m === "GET") return accept.includes("pgrst.object") ? j({ data: settings }) : j([{ data: settings }]);
      if (m === "GET" && p.endsWith("/customers")) return j(Number(u.searchParams.get("offset") || 0) ? [] : customers);
      if (m === "GET" && p.endsWith("/jobs")) return j(Number(u.searchParams.get("offset") || 0) ? [] : jobs);
      if (m === "GET" && p.endsWith("/estimates")) return j(Number(u.searchParams.get("offset") || 0) ? [] : estimates);
      if (accept.includes("pgrst.object")) return j({ code: "PGRST116" }, 406);
      return j([]);
    });
    await ctx.route("**/api/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http") && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); localStorage.setItem("smocks.lastOwnerSession", "1"); sessionStorage.setItem("seeded", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
    const page = await ctx.newPage();
    let current = { pageErrors: [], consoleErrors: [] };
    page.on("pageerror", e => current.pageErrors.push(e.message.slice(0, 200)));
    page.on("console", m => { if (m.type() === "error") { const t = m.text(); if (!/Failed to load resource|net::ERR|favicon|realtime|WebSocket/i.test(t)) current.consoleErrors.push(t.slice(0, 200)); } });
    await page.goto(BASE + "/#/dashboard"); await page.waitForTimeout(7000);
    for (const t of ["Not now", "Skip", "Maybe later", "Skip setup", "Got it", "Dismiss", "Later"]) { const b = page.locator(`.fixed.inset-0 button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); }
    for (const pg of PAGES) {
      current = { pageErrors: [], consoleErrors: [] };
      const t0 = Date.now();
      await page.evaluate(h => { location.hash = h; }, "#/" + pg);
      await page.waitForTimeout(2200);
      const info = await page.evaluate(() => ({ text: document.body.innerText.slice(0, 4000), overflow: document.documentElement.scrollWidth - window.innerWidth, hash: location.hash }));
      const crashed = /Something went wrong|Unexpected Application Error|Cannot read properties|is not a function|Minified React error/i.test(info.text);
      report.push({ viewport: label, page: pg, landedOn: info.hash, crashed, overflowPx: info.overflow > 2 ? info.overflow : 0, pageErrors: current.pageErrors, consoleErrors: Array.from(new Set(current.consoleErrors)).slice(0, 4), ms: Date.now() - t0 });
      if (crashed || current.pageErrors.length) await page.screenshot({ path: `${OUT}/crawl-${label}-${pg}.png` });
    }
    await ctx.close();
  }
  await browser.close();
  const bad = report.filter(r => r.crashed || r.pageErrors.length || r.consoleErrors.length || r.overflowPx);
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 1));
  console.log(JSON.stringify(bad, null, 1));
  console.log(`${report.length} page loads, ${bad.length} with problems`);
})();
