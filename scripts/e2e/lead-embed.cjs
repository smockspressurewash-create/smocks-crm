// Embed the lead form in an iframe on a different "website" and submit it.
// Screenshots go to the OS temp folder (crewboss-e2e). Uses installed Chrome via playwright-core; Supabase and /api are mocked — nothing touches production data.
const OUT = require("path").join(require("os").tmpdir(), "crewboss-e2e"); require("fs").mkdirSync(OUT, { recursive: true });
const { chromium } = require("playwright-core");
const BASE = process.argv[2];
const OID = "aaaaaaaa-0000-4000-8000-000000000001";
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--disable-features=BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,LocalNetworkAccessChecks,PrivateNetworkAccessForNavigations"] });
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const posts = [];
  await ctx.route("**/api/**", async r => { let b = {}; try { b = JSON.parse(r.request().postData() || "{}"); } catch {} posts.push(b); r.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' }); });
  await ctx.route(/supabase\.co/, r => ["GET", "HEAD"].includes(r.request().method()) ? r.continue().catch(() => r.abort()) : r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.route("http://localhost:5999/**", r => r.fulfill({ status: 200, contentType: "text/html", body: `<html><body style="background:#eee"><h1>Joe's Plumbing</h1><iframe id="f" src="${BASE}/#/lead-form?oid=${OID}&co=Joe%27s%20Plumbing" width="100%" height="720" frameborder="0"></iframe></body></html>` }));
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto("http://localhost:5999/"); await page.waitForTimeout(4000);
  const fr = page.frameLocator("#f");
  await fr.locator("input").filter({ hasNot: fr.locator('[name="website"]') }).first().waitFor({ timeout: 10000 }).catch(() => {});
  const inputs = fr.locator('input:not([name="website"]):not([type="checkbox"])');
  console.log("visible inputs:", await inputs.count());
  await inputs.nth(0).fill("Ann"); await inputs.nth(1).fill("Lee");
  await fr.locator('input[type="email"]').fill("ann@example.com").catch(() => {});
  await fr.locator('input[type="tel"]').fill("5551112222").catch(() => {});
  await fr.locator('input[type="checkbox"]').first().check();
  await fr.locator("button").filter({ hasText: /Estimate|Quote|Submit/i }).last().click();
  await page.waitForTimeout(2000);
  const done = await fr.locator("body").innerText();
  console.log("posts:", JSON.stringify(posts.map(p => ({ action: p.action, ownerId: p.ownerId, website: p.website, first: p.customer?.firstName, phone: p.customer?.phone, optIn: p.customer?.smsOptIn }))));
  console.log("after submit:", done.replace(/\s+/g, " ").slice(0, 120), "| errs:", errs.length);
  await page.screenshot({ path: OUT + "/lead-embed.png" });
  await browser.close();
})();
