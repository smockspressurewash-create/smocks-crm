// Owner screens from the Oct 23 feedback round, desktop + phone:
//   Jobs — day clock bar, tapping a card opens the job, no per-job clock-in,
//          work details only on the job the owner is working
//   Inbox — tapping the name opens the customer file pop-up, Edit opens the form
//   Fleet — new vehicle fields + problem log
//   Accountability — no meditation, summary card
//   Lead Intake — select all → Move to Customers
// Supabase and /api are mocked — nothing touches production data.
//   node scripts/e2e/owner-screens.cjs http://127.0.0.1:5193
const OUT = require("path").join(require("os").tmpdir(), "crewboss-e2e"); require("fs").mkdirSync(OUT, { recursive: true });
const { chromium } = require("playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:5193";
const REF = "boaqaihymgmrhnjtiqrs", KEY = `sb-${REF}-auth-token`;
const b64u = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const UID = "11111111-2222-4333-8444-555555555555"; const now = Math.floor(Date.now() / 1000);
const EMAIL = "owner@example.com";
const jwt = b64u({ alg: "HS256", typ: "JWT" }) + "." + b64u({ sub: UID, email: EMAIL, role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now }) + ".sig";
const user = { id: UID, aud: "authenticated", role: "authenticated", email: EMAIL, app_metadata: { provider: "email" }, user_metadata: {} };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "r", user };
const d = new Date(); const TODAY = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const OWNER0 = { id: "owner_" + EMAIL, role: "owner", owner_id: UID, user_id: UID, status: "active", email: EMAIL, firstName: "Will", lastName: "Smock", permissions: {}, dayClockInAt: null };
const CUSTS0 = [
  { id: "c0000000-0000-4000-8000-000000000001", owner_id: UID, firstName: "Jane", lastName: "Doe", phone: "(717) 555-0100", email: "jane@example.com", address: "412 Oak Ridge Ln, York, PA", tags: ["VIP"], totalSpent: 450, createdAt: "2026-01-02" },
  { id: "c0000000-0000-4000-8000-000000000002", owner_id: UID, firstName: "Bob", lastName: "Smith", phone: "(717) 555-0199", email: "", address: "9 Main St, Hanover, PA", tags: [], totalSpent: 0, createdAt: "2026-02-02" },
  { id: "c0000000-0000-4000-8000-000000000003", owner_id: UID, firstName: "Imported", lastName: "Lead1", phone: "", email: "", tags: [], totalSpent: 0, createdAt: "2026-10-20", pipelineStage: "lead" },
  { id: "c0000000-0000-4000-8000-000000000004", owner_id: UID, firstName: "Imported", lastName: "Lead2", phone: "", email: "", tags: [], totalSpent: 0, createdAt: "2026-10-20", pipelineStage: "lead" },
];
const JOBS0 = [
  { id: "a0000000-0000-4000-8000-000000000001", owner_id: UID, customerId: CUSTS0[0].id, address: CUSTS0[0].address, status: "scheduled", scheduledDate: TODAY, amount: 300, crew: [OWNER0.id], checklist: [{ label: "Pre-rinse plants", done: false }, { label: "Take before photos", done: false }], createdAt: "2026-10-01" },
  { id: "a0000000-0000-4000-8000-000000000002", owner_id: UID, customerId: CUSTS0[1].id, address: CUSTS0[1].address, status: "scheduled", scheduledDate: TODAY, amount: 180, crew: [], checklist: [{ label: "SECRET-CHECKLIST-LINE", done: false }], createdAt: "2026-10-01" },
];
const THREADS0 = [{ id: "t1", owner_id: UID, channel: "sms", contact_phone: "+17175550100", contact_name: "Jane Doe", customer_id: CUSTS0[0].id, messages: [{ id: "m1", dir: "in", body: "Hi, what time tomorrow?", ts: Date.now() - 60000 }], unread: false, updated_at: new Date().toISOString() }];

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = {}; const errs = [];
  for (const [label, viewport, mobile] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    const owner = structuredClone(OWNER0), custs = structuredClone(CUSTS0), jobs = structuredClone(JOBS0), threads = structuredClone(THREADS0);
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
    const writes = [];
    await ctx.route(new RegExp(REF + "\\.supabase\\.co"), async route => {
      const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const accept = req.headers()["accept"] || "";
      const j = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
      if (p.startsWith("/auth/v1/token")) return j(session);
      if (p.startsWith("/auth/v1/user")) return j(user);
      if (p.startsWith("/realtime")) return route.abort();
      if (req.method() !== "GET") {
        const body = req.postData() || ""; writes.push({ m: req.method(), p, body: body.slice(0, 300) });
        if (p.endsWith("/employees") && req.method() === "PATCH") { try { Object.assign(owner, JSON.parse(body)); } catch {} return j([{ id: owner.id }]); }
        if (p.endsWith("/customers")) { try { const rows = JSON.parse(body); (Array.isArray(rows) ? rows : [rows]).forEach(r => { const i = custs.findIndex(c => c.id === r.id); if (i >= 0) custs[i] = { ...custs[i], ...r }; }); } catch {} return j(Array.isArray(JSON.parse(body || "[]")) ? JSON.parse(body).map(r => ({ id: r.id })) : [{ id: "x" }], 201); }
        return j([{ id: "x" }], 201);
      }
      if (p.endsWith("/employees")) return accept.includes("pgrst.object") ? j(owner) : j([owner]);
      if (p.endsWith("/customers")) return j(custs);
      if (p.endsWith("/jobs")) return j(jobs);
      if (p.endsWith("/inbox_threads")) return j(threads);
      if (accept.includes("pgrst.object")) return j({ code: "PGRST116" }, 406);
      return j([]);
    });
    await ctx.route("**/api/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await ctx.addInitScript(([k, v]) => { try { if (location.origin.startsWith("http") && !sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); localStorage.setItem("smocks.lastOwnerSession", "1"); sessionStorage.setItem("seeded", "1"); } } catch {} }, [KEY, JSON.stringify(session)]);
    const page = await ctx.newPage(); page.on("pageerror", e => errs.push(label + ": " + e.message.slice(0, 160))); page.on("dialog", dl => dl.accept());
    const dismiss = async () => { for (const t of ["Not now", "Skip", "Maybe later", "Skip setup", "Got it", "Dismiss", "Later"]) { const b = page.locator(`.fixed.inset-0 button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(300); } } };
    const text = () => page.evaluate(() => document.body.innerText);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    const r = {};

    // Jobs
    await page.goto(BASE + "/#/jobs"); await page.waitForTimeout(7000); await dismiss();
    let t = await text();
    r.jobsClockBar = /Clock in for the day/.test(t);
    r.jobsNoPerJobClock = (await page.locator('button[title="Clock in"]').count()) === 0;
    r.jobsHidesOtherJobChecklist = !/SECRET-CHECKLIST-LINE/.test(t);
    await page.screenshot({ path: `${OUT}/jobs-${label}.png`, fullPage: true });
    await page.locator('button:has-text("Clock in for the day")').first().click({ timeout: 8000 }).catch(e => errs.push(label + ' clock-in click: ' + e.message.slice(0, 80))); await page.waitForTimeout(1200);
    t = await text();
    r.jobsClockedIn = /On the clock/.test(t) && writes.some(w => w.p.endsWith("/employees") && /dayClockInAt/.test(w.body));
    await page.waitForTimeout(3500); t = await text();
    r.jobsWorkingBadge = /You're on this job/i.test(t);
    r.jobsWorkingShowsChecklist = /Pre-rinse plants/.test(t);
    await page.locator('[data-job-id="a0000000-0000-4000-8000-000000000002"]').first().click({ position: { x: 40, y: 30 } }); await page.waitForTimeout(1200);
    t = await text();
    r.jobsCardOpensJob = /Job · Bob Smith/.test(t);
    r.jobsOverflow = await overflow();
    await page.screenshot({ path: `${OUT}/job-open-${label}.png` });
    await page.keyboard.press("Escape").catch(() => {});

    // Inbox
    await page.goto(BASE + "/#/inbox"); await page.waitForTimeout(4000); await dismiss();
    await page.getByText("Jane Doe").first().click(); await page.waitForTimeout(1000);
    await page.locator('button[title="Open customer file"]').last().click(); await page.waitForTimeout(1000);
    t = await text();
    r.inboxProfilePopup = /Customer Details/.test(t) && /jane@example.com/.test(t);
    await page.screenshot({ path: `${OUT}/inbox-profile-${label}.png` });
    await page.locator('button[title="Edit customer"]').first().click(); await page.waitForTimeout(800);
    t = await text();
    r.inboxEditOpens = /Edit Customer/.test(t) && /Birthday/.test(t);
    await page.screenshot({ path: `${OUT}/inbox-edit-${label}.png` });

    // Fleet
    await page.goto(BASE + "/#/fleet"); await page.waitForTimeout(3000); await dismiss();
    await page.getByRole("button", { name: /Add Vehicle/ }).first().click(); await page.waitForTimeout(700);
    t = await text();
    r.fleetNewFields = /VIN/.test(t) && /Problems & issues/.test(t) && /Insurance expires/.test(t);
    r.fleetOverflow = await overflow();
    await page.screenshot({ path: `${OUT}/fleet-modal-${label}.png` });

    // Accountability
    await page.goto(BASE + "/#/accountability"); await page.waitForTimeout(3000); await dismiss();
    t = await text();
    r.acctNoMeditation = !/meditat/i.test(t);
    r.acctSummary = /streak/i.test(t) && /Daily check-in/.test(t);
    r.acctOverflow = await overflow();
    await page.screenshot({ path: `${OUT}/accountability-${label}.png`, fullPage: true });

    // Lead Intake bulk move
    await page.goto(BASE + "/#/intake"); await page.waitForTimeout(3000); await dismiss();
    await page.screenshot({ path: `${OUT}/intake-before-${label}.png`, fullPage: true });
    await page.locator('label:has-text("Select all")').first().click({ timeout: 8000 }).catch(e => errs.push(label + " select-all: " + e.message.slice(0, 80))); await page.waitForTimeout(400);
    await page.locator('button:has-text("Move to Customers")').first().click({ timeout: 8000 }).catch(e => errs.push(label + " move: " + e.message.slice(0, 80))); await page.waitForTimeout(2000);
    r.leadsMoved = custs.filter(c => c.lastName.startsWith("Lead")).every(c => c.pipelineStage === null);
    await page.screenshot({ path: `${OUT}/intake-${label}.png` });
    results[label] = r;
    await ctx.close();
  }
  console.log(JSON.stringify({ results, errs }, null, 1));
  const ok = Object.values(results).every(r => Object.entries(r).every(([k, v]) => /Overflow$/.test(k) ? v === false : v === true)) && errs.length === 0;
  console.log(ok ? "PASS" : "FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
