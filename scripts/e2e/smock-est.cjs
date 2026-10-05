// Smock's CRM: open public #/estimate/ID links (quote + invoice) with /api mocked.
// Real Supabase writes are blocked (only GETs pass) so production data is never touched.
// Screenshots go to the OS temp folder (crewboss-e2e). Uses installed Chrome via playwright-core; Supabase and /api are mocked — nothing touches production data.
const OUT = require("path").join(require("os").tmpdir(), "crewboss-e2e"); require("fs").mkdirSync(OUT, { recursive: true });
const { chromium } = require("playwright-core");
const fs = require("fs");
const BASE = process.argv[2] || "http://127.0.0.1:5181";
const OWNER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const cust = { id: "c0000000-0000-4000-8000-000000000001", firstName: "Test", lastName: "Customer", email: "test@example.com", phone: "5555550100", address: "1 Test St", owner_id: OWNER };
const li = [{ id: "l1", description: "House wash", quantity: 1, unitPrice: 300, total: 300 }];
const mk = (id, extra) => ({ id, customerId: cust.id, owner_id: OWNER, status: "pending", total: 318, subtotal: 300, tax: 18, lineItems: li, createdAt: "2026-10-01", ...extra });
const ESTS = {
  "e0000000-0000-4000-8000-00000000000a": mk("e0000000-0000-4000-8000-00000000000a", {}),
  "e0000000-0000-4000-8000-00000000000b": mk("e0000000-0000-4000-8000-00000000000b", { invoiced: true, status: "approved", signedAt: "2026-10-01", invoiceNumber: "1001" }),
  "e0000000-0000-4000-8000-00000000000c": mk("e0000000-0000-4000-8000-00000000000c", { invoiced: true, status: "approved", paidAt: "2026-10-02", paidFull: 300 }),
};
const settings = { companyName: "Test Co", depositPercent: 25 };
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];
  const scenarios = [
    ["quote-fresh", null, "e0000000-0000-4000-8000-00000000000a"],
    ["invoice-fresh", null, "e0000000-0000-4000-8000-00000000000b"],
    ["paid-invoice-fresh", null, "e0000000-0000-4000-8000-00000000000c"],
    ["invoice-after-landing", "#/", "e0000000-0000-4000-8000-00000000000b"],
    ["invoice-after-login", "#/login", "e0000000-0000-4000-8000-00000000000b"],
    ["quote-after-client", "#/client", "e0000000-0000-4000-8000-00000000000a"],
  ];
  for (const vp of [{ n: "desktop", w: 1280, h: 860 }, { n: "mobile", w: 390, h: 844, m: true }]) {
    for (const [name, first, id] of scenarios) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.m });
      const calls = [];
      await ctx.route("**/api/**", async route => {
        const req = route.request(); let body = {}; try { body = JSON.parse(req.postData() || "{}"); } catch {}
        calls.push((new URL(req.url()).pathname) + ":" + (body.action || ""));
        if (body.action === "get_estimate") { const e = ESTS[body.id]; return route.fulfill({ status: e ? 200 : 404, contentType: "application/json", body: JSON.stringify(e ? { estimate: e, customer: cust, settings } : { error: "Not found" }) }); }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      });
      await ctx.route(/supabase\.co/, route => route.request().method() === "GET" || route.request().method() === "HEAD" ? route.continue() : route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", e => errs.push("PAGEERROR " + e.message.slice(0, 200)));
      page.on("console", m => { if (m.type() === "error" && /React|hook|Minified|TypeError|undefined/.test(m.text())) errs.push(m.text().slice(0, 200)); });
      if (first) { await page.goto(BASE + "/" + first); await page.waitForTimeout(2500); await page.evaluate(h => { location.hash = h; }, "#/estimate/" + id); }
      else await page.goto(BASE + "/#/estimate/" + id);
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${OUT}/${vp.n}-${name}.png` });
      let txt = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(-90);
      const btn = page.locator("button").filter({ hasText: /Pay \$|Review & Sign/ }).first();
      if (await btn.isVisible().catch(() => false)) {
        txt += " || CLICK " + (await btn.innerText()).trim();
        await btn.click(); await page.waitForTimeout(1500);
        txt += " => " + (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(120, 420);
        await page.screenshot({ path: `${OUT}/${vp.n}-${name}-step2.png` });
      }
      const crashed = /Something crashed|Minified React error/.test(txt) || errs.some(e => /#310|#300|hooks/.test(e));
      results.push({ vp: vp.n, name, crashed, errs: [...new Set(errs)].slice(0, 3), calls: [...new Set(calls)], txt });
      await ctx.close();
    }
  }
  await browser.close();
  for (const r of results) console.log(JSON.stringify(r));
})().catch(e => { console.error(e); process.exit(1); });
