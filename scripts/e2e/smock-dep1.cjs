// $1 quote, 50% deposit, 6% tax variants — what the customer sees and what Pay sends.
// Screenshots go to the OS temp folder (crewboss-e2e). Uses installed Chrome via playwright-core; Supabase and /api are mocked — nothing touches production data.
const OUT = require("path").join(require("os").tmpdir(), "crewboss-e2e"); require("fs").mkdirSync(OUT, { recursive: true });
const { chromium } = require("playwright-core");
const BASE = process.argv[2];
const OWNER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const cust = { id: "c1", firstName: "Test", lastName: "C", email: "t@example.com", owner_id: OWNER };
const mk = (id, extra) => ({ id, customerId: "c1", owner_id: OWNER, status: "pending", lineItems: [{ id: "l1", description: "House wash", quantity: 1, unitPrice: 1 }], ...extra });
const cases = {
  "pct50-$1": mk("e0000000-0000-4000-8000-0000000000f1", { subtotal: 1, tax: 0, total: 1, depositRequired: 50, depositType: "percent" }),
  "pct50-$1.06tax": mk("e0000000-0000-4000-8000-0000000000f2", { subtotal: 1, tax: 0.06, total: 1.06, depositRequired: 50, depositType: "percent" }),
  "flat$1-$1": mk("e0000000-0000-4000-8000-0000000000f3", { subtotal: 1, tax: 0, total: 1, depositRequired: 1, depositType: "amount" }),
};
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const [k, est] of Object.entries(cases)) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const bodies = [];
    await ctx.route("**/api/**", async route => { let b = {}; try { b = JSON.parse(route.request().postData() || "{}"); } catch {}
      if (route.request().url().includes("stripe-action")) { bodies.push(b); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "pi", client_secret: "pi_secret_x" }) }); }
      if (b.action === "get_estimate") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ estimate: est, customer: cust, settings: { companyName: "Test Co", stripePublishableKey: "pk_test_1", paymentProviderPreference: "stripe" } }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); });
    await ctx.route(/supabase\.co/, r => ["GET", "HEAD"].includes(r.request().method()) ? r.continue() : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await ctx.route(/js\.stripe\.com/, r => r.abort());
    const page = await ctx.newPage();
    await page.goto(BASE + "/#/estimate/" + est.id); await page.waitForTimeout(3500);
    const top = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").match(/QUOTE TOTAL.*?SERVICES|Quote total.*?Services/i);
    await page.getByText("Review & Sign").click(); await page.waitForTimeout(500);
    await page.getByText("Type Name").click(); await page.locator("input").last().fill("Test C"); await page.waitForTimeout(300);
    await page.getByText("Continue to Payment").click(); await page.waitForTimeout(900);
    const opts = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").match(/Payment Options.*?Promo/);
    const dep = page.getByText(/deposit/i).first(); if (await dep.isVisible()) await dep.click(); await page.waitForTimeout(300);
    const charged = ((await page.evaluate(() => document.body.innerText)).match(/Total charged today\s*\$[\d,.]+/) || [""])[0].replace(/\s+/g, " ");
    await page.locator('input[type="checkbox"]').last().check(); await page.locator("button").filter({ hasText: /Pay .*\$/ }).last().click(); await page.waitForTimeout(1500);
    console.log(k, "\n  top:", top && top[0], "\n  options:", opts && opts[0], "\n  deposit picked →", charged, "| sent:", JSON.stringify(bodies.map(b => ({ payType: b.payType, amountCents: b.amountCents }))));
    await page.screenshot({ path: OUT + "/dep-" + k.replace(/[$.]/g, "_") + ".png" });
    await ctx.close();
  }
  await browser.close();
})();
