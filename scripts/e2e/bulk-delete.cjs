// Owner with 1,050 customers selects all and deletes them. The mock server
// rejects URLs over 16 KB (like the real one) and paginates GETs at 1,000
// rows. After the delete and a few refreshes, no customer may come back.
// Supabase is mocked — nothing touches production.
//   node scripts/e2e/bulk-delete.cjs http://127.0.0.1:5181
const { chromium } = require("playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:5181";
const REF = "boaqaihymgmrhnjtiqrs", KEY = `sb-${REF}-auth-token`;
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "11111111-2222-4333-8444-555555555555"; const now = Math.floor(Date.now() / 1000);
const EMAIL = "owner@example.com";
const jwt = b64u({ alg: "HS256", typ: "JWT" }) + "." + b64u({ sub: UID, email: EMAIL, role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now }) + ".sig";
const user = { id: UID, aud: "authenticated", role: "authenticated", email: EMAIL, app_metadata: { provider: "email" }, user_metadata: {} };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r", user };
const owner = { id: "owner_" + EMAIL, role: "owner", owner_id: UID, user_id: UID, status: "active", email: EMAIL, firstName: "Will", permissions: {} };
const hex = n => n.toString(16).padStart(12, "0");
let server = Array.from({ length: 1050 }, (_, i) => ({ id: `c0000000-0000-4000-8000-${hex(i)}`, owner_id: UID, firstName: "Cust", lastName: String(i), email: "", phone: "", tags: [], totalSpent: 0, createdAt: "2026-10-01" }));
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let deletes = 0, rejected = 0, upserted = 0;
  await ctx.route(new RegExp(REF + "\.supabase\.co"), async route => {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const accept = req.headers()["accept"] || "";
    const j = (b, s = 200, h = {}) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b), headers: h });
    if (req.url().length > 16000) { rejected++; return route.fulfill({ status: 414, body: "URI Too Long" }); }
    if (p.startsWith("/auth/v1/token")) return j(session);
    if (p.startsWith("/auth/v1/user")) return j(user);
    if (p.startsWith("/realtime")) return route.abort();
    if (p.endsWith("/employees") && req.method() === "GET") return accept.includes("pgrst.object") ? j(owner) : j([owner]);
    if (p.endsWith("/customers")) {
      if (req.method() === "DELETE") {
        deletes++;
        const ids = new Set((u.searchParams.get("id") || "").replace(/^in\.\(|\)$/g, "").split(",").map(s => s.replace(/"/g, "")));
        const gone = server.filter(c => ids.has(c.id)); server = server.filter(c => !ids.has(c.id));
        return j(gone.map(c => ({ id: c.id })));
      }
      if (req.method() === "POST") { upserted++; const rows = JSON.parse(req.postData() || "[]"); (Array.isArray(rows) ? rows : [rows]).forEach(r => { if (!server.some(c => c.id === r.id)) server.push(r); }); return j([], 201); }
      // GET: PostgREST caps at 1000 rows; honour Range / offset+limit.
      const range = req.headers()["range"]; let from = 0, to = 999;
      if (range) { const m = range.match(/(\d+)-(\d+)/); if (m) { from = +m[1]; to = Math.min(+m[2], from + 999); } }
      if (u.searchParams.get("offset")) { from = +u.searchParams.get("offset"); to = from + Math.min(+(u.searchParams.get("limit") || 1000), 1000) - 1; }
      return j(server.slice(from, to + 1));
    }
    if (accept.includes("pgrst.object")) return j({ code: "PGRST116" }, 406);
    return j([]);
  });
  await ctx.route("**/api/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http") && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); localStorage.setItem("smocks.lastOwnerSession", "1"); sessionStorage.setItem("seeded", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
  const page = await ctx.newPage();
  page.on("dialog", d => d.accept());
  await page.goto(BASE + "/#/customers"); await page.waitForTimeout(8000);
  const overlay = await page.evaluate(() => [...document.querySelectorAll("div.fixed")].map(d => d.innerText).filter(Boolean).join(" | ")?.slice(0, 200)); console.log("overlay:", overlay);
  for (const t of ["Not now", "Skip", "Maybe later", "Skip setup", "Got it", "Close", "Dismiss", "Later"]) { const b = page.locator(`.fixed.inset-0 button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(400); } }
  const loaded = await page.evaluate(() => (document.body.innerText.match(/(\d[\d,]*) customers?/i) || [])[0]);
  await page.getByRole("button", { name: /^Select$/ }).first().click(); await page.waitForTimeout(500);
  await page.getByText(/Select all|All \(/i).first().click().catch(async () => { await page.locator('input[type="checkbox"]').first().check(); });
  await page.waitForTimeout(500);
  const delBtn = page.getByRole("button", { name: /Delete/ }).last();
  await delBtn.click(); await page.waitForTimeout(800);
  const confirm = page.getByRole("button", { name: /^Delete$/ }).last(); if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await page.waitForTimeout(8000);
  await page.reload(); await page.waitForTimeout(8000);
  const visible = await page.evaluate(() => document.querySelectorAll("[data-customer-row], tbody tr").length);
  console.log(JSON.stringify({ loaded, serverLeft: server.length, deleteRequests: deletes, rejectedTooLong: rejected, upserts: upserted, rowsShownAfterReload: visible }));
  await browser.close();
  process.exit(server.length === 0 ? 0 : 1);
})();
