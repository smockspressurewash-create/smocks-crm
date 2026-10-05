// Quote link: sign (typed) → payment step → "pay after service" → done; and decline flow.
// Screenshots go to the OS temp folder (crewboss-e2e). Uses installed Chrome via playwright-core; Supabase and /api are mocked — nothing touches production data.
const OUT = require("path").join(require("os").tmpdir(), "crewboss-e2e"); require("fs").mkdirSync(OUT, { recursive: true });
const { chromium } = require("playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:5181";
const OWNER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const cust = { id: "c0000000-0000-4000-8000-000000000001", firstName: "Test", lastName: "Customer", email: "t@example.com", phone: "5555550100", address: "1 Test St", owner_id: OWNER };
const est = { id: "e0000000-0000-4000-8000-00000000000a", customerId: cust.id, owner_id: OWNER, status: "pending", total: 300, subtotal: 300, tax: 0, lineItems: [{ id: "l1", description: "House wash", quantity: 1, unitPrice: 300 }], createdAt: "2026-10-01" };
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const flow of ["later", "decline"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const posted = [];
    await ctx.route("**/api/**", async route => {
      let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch {}
      posted.push(b.action || new URL(route.request().url()).pathname);
      if (b.action === "get_estimate") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ estimate: est, customer: cust, settings: { companyName: "Test Co" } }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: "{\"success\":true}" });
    });
    await ctx.route(/supabase\.co/, r => ["GET", "HEAD"].includes(r.request().method()) ? r.continue() : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    const page = await ctx.newPage(); const errs = [];
    page.on("pageerror", e => errs.push(e.message.slice(0, 160)));
    await page.goto(BASE + "/#/estimate/" + est.id); await page.waitForTimeout(3500);
    const log = [];
    try {
      if (flow === "later") {
        await page.getByText("Review & Sign").click(); await page.waitForTimeout(800);
        await page.getByText("Type Name").click(); await page.waitForTimeout(300);
        await page.locator("input").last().fill("Test Customer"); await page.waitForTimeout(500);
        await page.getByText("Continue to Payment").click(); await page.waitForTimeout(1000);
        log.push("payment step: " + (await page.getByText("Payment amount").isVisible()));
        await page.locator('input[type="checkbox"]').last().check(); await page.waitForTimeout(300);
        await page.getByText("just sign for now").click(); await page.waitForTimeout(2000);
      } else {
        await page.getByText("Decline this quote").click(); await page.waitForTimeout(500);
        await page.locator("textarea").last().fill("Too expensive");
        await page.getByText("Confirm Decline").click(); await page.waitForTimeout(1500);
      }
    } catch (e) { log.push("STEP FAIL " + e.message.split("\n")[0]); }
    const txt = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
    await page.screenshot({ path: `${OUT}/flow-${flow}.png` });
    console.log(JSON.stringify({ flow, log, errs, posted: [...new Set(posted)], end: txt.slice(0, 260) }));
    await ctx.close();
  }
  await browser.close();
})();
