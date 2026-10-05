// Owner session (mocked Supabase) → Quotes → New → measure horizontal overflow on a phone, try deposit + AI Add.
// Screenshots go to the OS temp folder (crewboss-e2e). Uses installed Chrome via playwright-core; Supabase and /api are mocked — nothing touches production data.
const OUT = require("path").join(require("os").tmpdir(), "crewboss-e2e"); require("fs").mkdirSync(OUT, { recursive: true });
const { chromium } = require("playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:5181";
const HOST = process.argv[3] === "missing-config" ? /missing-config\.supabase\.co/ : /boaqaihymgmrhnjtiqrs\.supabase\.co/;
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "11111111-2222-4333-8444-555555555555"; const now = Math.floor(Date.now() / 1000);
const jwt = b64u({ alg: "HS256", typ: "JWT" }) + "." + b64u({ sub: UID, email: "owner@example.com", role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now }) + ".sig";
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "owner@example.com", app_metadata: { provider: "email" }, user_metadata: {} };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r", user };
const owner = { id: "owner_owner@example.com", role: "owner", owner_id: UID, user_id: UID, status: "active", email: "owner@example.com", firstName: "Owner", permissions: {} };
const customers = [{ id: "c0000000-0000-4000-8000-000000000001", firstName: "Test", lastName: "Customer", email: "t@example.com", phone: "5555550100", address: "1 Test St", sqFootage: 2000, owner_id: UID }];
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(HOST, async route => {
    const req = route.request(); const p = new URL(req.url()).pathname; const accept = req.headers()["accept"] || "";
    const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
    if (p.startsWith("/auth/v1/token")) return j(session);
    if (p.startsWith("/auth/v1/user")) return j(user);
    if (p.startsWith("/realtime")) return route.abort();
    if (p.endsWith("/employees") && req.method() === "GET") return accept.includes("pgrst.object") ? j(owner) : j([owner]);
    if (p.endsWith("/customers") && req.method() === "GET") return j(customers);
    if (accept.includes("pgrst.object")) return j({ code: "PGRST116" }, 406);
    return j([]);
  });
  await ctx.route("**/api/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", e => errs.push(e.message.slice(0, 160)));
  await page.goto(BASE + "/#/login"); await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', "owner@example.com"); await page.fill('input[type="password"], input[placeholder="••••••••"]', "pw123456");
  await page.locator("button", { hasText: /^Sign In$/ }).first().click(); await page.waitForTimeout(4500);
  for (const t of ["Not now", "Skip", "Maybe later"]) { const b = page.locator(`button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); }
  await page.evaluate(() => { location.hash = "#/estimates"; }); await page.waitForTimeout(2000);
  await page.locator("button", { hasText: /^\s*New\s*$/ }).first().click().catch(e => errs.push("no New btn")); await page.waitForTimeout(1500);
  // pick customer if a select exists
  const sel = page.locator("select").first(); if (await sel.count()) { await sel.selectOption({ index: 1 }).catch(() => {}); await page.waitForTimeout(800); }
  const overflow = await page.evaluate(() => {
    const W = innerWidth; const wide = [];
    for (const el of document.querySelectorAll("body *")) { const r = el.getBoundingClientRect(); if (r.width > 2 && (r.right > W + 1 || r.left < -1)) { const cs = getComputedStyle(el); wide.push(Math.round(r.left) + ".." + Math.round(r.right) + " " + el.tagName.toLowerCase() + "." + String(el.className).slice(0, 70)); } }
    return { W, docScroll: document.documentElement.scrollWidth, bodyScroll: document.body.scrollWidth, wide: wide.slice(0, 12) };
  });
  console.log("OVERFLOW", JSON.stringify(overflow));
  await page.screenshot({ path: OUT + "/builder-1.png" });
  // AI Add
  const addBtns = page.locator("button", { hasText: /^Add$/ });
  console.log("AI add buttons:", await addBtns.count());
  if (await addBtns.count()) { await addBtns.first().click(); await page.waitForTimeout(500); }
  const body1 = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
  console.log("after add has House Soft Wash row value:", await page.evaluate(() => [...document.querySelectorAll("input")].some(i => i.value === "House Soft Wash")));
  // Deposit $1 flat
  const depLabel = page.getByText("Deposit Required", { exact: true });
  if (await depLabel.count()) {
    const dep = depLabel.locator("xpath=following-sibling::div[1]//input").first();
    await dep.fill("100"); await page.waitForTimeout(500);
    const t = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
    console.log("deposit texts:", (t.match(/Deposit due now[^A-Z]{0,40}/g) || []).join(" | "), "|| totals:", (t.match(/Total \$[\d,.]+/g) || []).join(" "));
    await page.screenshot({ path: OUT + "/builder-2.png", fullPage: false });
  } else console.log("no deposit label");
  console.log("errs", errs);
  await browser.close();
})();
