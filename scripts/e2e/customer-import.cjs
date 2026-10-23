// Customers → Import CSV with a real-world client list (BOM, quoted commas,
// a note with a line break, company / source / city / state / zip / status).
// Checks the column matching on the review screen and what gets saved.
// Supabase and /api are mocked — nothing touches production data.
//   node scripts/e2e/customer-import.cjs http://127.0.0.1:5181
const OUT = require("path").join(require("os").tmpdir(), "crewboss-e2e"); require("fs").mkdirSync(OUT, { recursive: true });
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
// One customer already imported name-only by the old importer.
const existing = [{ id: "c0000000-0000-4000-8000-000000000001", owner_id: UID, firstName: "Jane", lastName: "Doe", email: "", phone: "", address: "", tags: [], totalSpent: 0, createdAt: "2026-10-20" }];
const CSV = "﻿First Name,Last Name,Email Address,Company,Source,Street Address,City,State,Zip Code,Phone Number,Status,Notes\r\n" +
  "Jane,Doe,jane@example.com,\"Doe, Inc.\",Google,412 Oak Ridge Ln,York,PA,17402,(717) 555-0100,Active,\"Gate code 1234\nDog is friendly\"\r\n" +
  "Bob,Smith,bob@example.com,,Referral,9 Main St,Hanover,PA,17331,717-555-0199,Lead,Wants a quote\r\n";
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const upserts = [];
  await ctx.route(new RegExp(REF + "\.supabase\.co"), async route => {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const accept = req.headers()["accept"] || "";
    const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
    if (p.startsWith("/auth/v1/token")) return j(session);
    if (p.startsWith("/auth/v1/user")) return j(user);
    if (p.startsWith("/realtime")) return route.abort();
    if (p.endsWith("/employees") && req.method() === "GET") return accept.includes("pgrst.object") ? j(owner) : j([owner]);
    if (p.endsWith("/customers") && req.method() === "POST") {
      const rows = JSON.parse(req.postData() || "[]"); const list = Array.isArray(rows) ? rows : [rows];
      // Like production: city/state/zip/company columns don't exist yet.
      const bad = ["city", "state", "zip", "company"].find(c => list.some(r => c in r));
      if (bad) return j({ code: "PGRST204", message: `Could not find the '${bad}' column of 'customers' in the schema cache` }, 400);
      upserts.push(...list); return j([], 201);
    }
    if (p.endsWith("/customers") && req.method() === "GET") return j(existing);
    if (accept.includes("pgrst.object")) return j({ code: "PGRST116" }, 406);
    return j([]);
  });
  await ctx.route("**/api/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http")) { localStorage.setItem(k, v); localStorage.setItem("smocks.lastOwnerSession", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message.slice(0, 160)));
  await page.goto(BASE + "/#/customers"); await page.waitForTimeout(6000);
  for (const t of ["Not now", "Skip", "Maybe later", "Skip setup"]) { const b = page.locator(`button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) await b.click().catch(() => {}); }
  await page.getByRole("button", { name: /Import CSV/ }).first().click(); await page.waitForTimeout(600);
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByText("Click to choose a .csv file").click()]);
  await chooser.setFiles({ name: "clients.csv", mimeType: "text/csv", buffer: Buffer.from(CSV, "utf8") });
  await page.waitForTimeout(1200);
  const mapping = await page.evaluate(() => Array.from(document.querySelectorAll("select")).map(s => { const card = s.closest("div.flex"); return (card?.querySelector(".text-xs.font-medium")?.textContent || "") + " → " + s.options[s.selectedIndex].text; }));
  await page.screenshot({ path: `${OUT}/import-review.png`, fullPage: true });
  await page.getByRole("button", { name: /Confirm Import/ }).click(); await page.waitForTimeout(3000);
  const toastText = (await page.evaluate(() => document.body.innerText)).match(/Imported[^\n]*/)?.[0];
  await page.screenshot({ path: `${OUT}/import-done.png` });
  const jane = upserts.filter(r => r.firstName === "Jane").pop(), bob = upserts.filter(r => r.firstName === "Bob").pop();
  console.log(JSON.stringify({ mapping, toastText, upsertCount: upserts.length, jane, bob, errs }, null, 1));
  const ok = jane && jane.id === existing[0].id && jane.email === "jane@example.com" && /York, PA 17402/.test(jane.address) && jane.phone && /Dog is friendly/.test(jane.notes) && (jane.customFields || []).some(f => f.key === "Company" && f.value === "Doe, Inc.")
    && bob && bob.email === "bob@example.com" && bob.leadSource === "Referral" && !bob.pipelineStage; // imports are customers unless "Leads" / "Use the Status column" is picked
  console.log(ok ? "PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
