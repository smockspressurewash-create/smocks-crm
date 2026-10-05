// Balance-due quote (deposit paid) and a fresh quote paying a deposit: check what the Pay button sends to /api/stripe-action.
// Screenshots go to the OS temp folder (crewboss-e2e). Uses installed Chrome via playwright-core; Supabase and /api are mocked — nothing touches production data.
const OUT = require("path").join(require("os").tmpdir(), "crewboss-e2e"); require("fs").mkdirSync(OUT, { recursive: true });
const { chromium } = require("playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:5181";
const OWNER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const cust = { id: "c1", firstName: "Test", lastName: "C", email: "t@example.com", owner_id: OWNER };
const li = [{ id: "l1", description: "House wash", quantity: 1, unitPrice: 300 }];
const ests = {
  bal: { id: "e0000000-0000-4000-8000-0000000000d1", customerId: "c1", owner_id: OWNER, status: "approved", signedAt: "2026-10-01", paidAt: "2026-10-01", paidDeposit: 75, total: 300, subtotal: 300, lineItems: li },
  dep: { id: "e0000000-0000-4000-8000-0000000000d2", customerId: "c1", owner_id: OWNER, status: "pending", total: 300, subtotal: 300, lineItems: li, depositRequired: 25, depositType: "percent" },
};
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const [k, est] of Object.entries(ests)) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const stripeBodies = [];
    await ctx.route("**/api/**", async route => {
      let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch {}
      if (route.request().url().includes("stripe-action")) { stripeBodies.push(b); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "pi_test", client_secret: "pi_test_secret_x", status: "requires_payment_method" }) }); }
      if (b.action === "get_estimate") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ estimate: est, customer: cust, settings: { companyName: "Test Co", stripePublishableKey: "pk_test_123", paymentProviderPreference: "stripe" } }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await ctx.route(/supabase\.co/, r => ["GET", "HEAD"].includes(r.request().method()) ? r.continue() : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await ctx.route(/js\.stripe\.com/, r => r.abort());
    const page = await ctx.newPage(); const log = [];
    await page.goto(BASE + "/#/estimate/" + est.id); await page.waitForTimeout(3500);
    try {
      if (k === "dep") {
        await page.getByText("Review & Sign").click(); await page.waitForTimeout(600);
        await page.getByText("Type Name").click(); await page.locator("input").last().fill("Test C"); await page.waitForTimeout(400);
        await page.getByText("Continue to Payment").click(); await page.waitForTimeout(900);
        const depBtn = page.getByText(/deposit/i).first(); if (await depBtn.isVisible()) await depBtn.click();
      } else {
        const b = page.locator("button").filter({ hasText: /Pay \$/ }).first(); log.push("view button: " + (await b.innerText()).trim()); await b.click(); await page.waitForTimeout(900);
      }
      log.push("screen amount: " + ((await page.evaluate(() => document.body.innerText)).match(/Total charged today\s*\$[\d,.]+/) || [""])[0].replace(/\s+/g, " "));
      await page.locator('input[type="checkbox"]').last().check(); await page.waitForTimeout(300);
      const pay = page.locator("button").filter({ hasText: /Pay .*\$|Card/ }).last(); log.push("pay button: " + (await pay.innerText()).replace(/\s+/g, " ").trim());
      await pay.click(); await page.waitForTimeout(2500);
    } catch (e) { log.push("STEP FAIL " + e.message.split("\n")[0]); }
    console.log(k, JSON.stringify(log), "stripe-action bodies:", JSON.stringify(stripeBodies.map(b => ({ action: b.action, invoiceId: b.invoiceId && "…" + b.invoiceId.slice(-2), payType: b.payType, tipCents: b.tipCents, amountCents: b.amountCents }))));
    await page.screenshot({ path: OUT + "/pay-" + k + ".png" });
    await ctx.close();
  }
  await browser.close();
})();
