// alfred-health.ts — one check of everything Alfred depends on, run from
// Settings → AI Models ("Check Alfred's connections") or by asking Alfred.
//
// FEATURE — "do a health check on the API connections for Alfred." Uses the
// owner's REAL saved keys (owner_secrets), not the masked copies the browser
// has, and reports each piece in plain words with how to fix it:
//   - every AI model with a key: a one-word test request,
//   - Twilio: account status, and whether the business number's incoming-
//     text webhook points at this app (without it, texting Alfred and reply
//     watching can't work),
//   - Google: the saved sign-in still refreshes,
//   - database tables/columns Alfred's features need,
//   - the reminders scheduler (reminders overdue by 30+ minutes = not running).
// POST, owner's Supabase access token as Bearer.
import { resolveCallerIsOwnerOrManager } from "./_lib/ownerSecrets";
import { runHealthChecks } from "./_lib/integrationHealth";
import { pushToOwnerDevices } from "./_lib/webPush";

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";
const json = (b: any, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY isn't set in Cloudflare Pages" }, 500);
  const token = (context.request.headers.get("Authorization") || "").replace(/^Bearer /, "");
  // BUG FIX (audit 2026-11-17) — any staff login could run this check, which
  // spends the business's AI credits and shows its Twilio/Google setup.
  // Limited to the owner or a manager now.
  const caller = await resolveCallerIsOwnerOrManager(token).catch(() => null);
  if (!caller) return json({ error: "Only the owner or a manager can run this check." }, 403);
  const ownerId = caller.ownerId;
  const checks = await runHealthChecks(ownerId, context.env, serviceRoleKey);
  const failed = checks.filter(c => !c.ok);
  return json({ ok: failed.length === 0, checkedAt: new Date().toISOString(), summary: failed.length ? `${failed.length} problem${failed.length !== 1 ? "s" : ""} found` : "Everything Alfred needs is working", checks });
};

// ── Scheduled run (owner request: "make sure you're doing that scheduled
// health check"). Before this, only the AI models were checked on a
// schedule; a broken Twilio, Google or reminders setup went unnoticed until
// a send failed. GET /api/alfred-health?key=<HEALTH_CHECK_KEY or
// REMINDERS_CRON_SECRET> checks every business that has saved connections
// and pushes the owner a notice when a check fails that passed last time.
// Called daily by .github/workflows/health-check.yml. Answers counts only,
// never keys or numbers.
export const onRequestGet = async (context: { request: Request; env: Record<string, string> }) => {
  const env = context.env;
  const secret = env.HEALTH_CHECK_KEY || env.REMINDERS_CRON_SECRET;
  if (!secret) return json({ error: "Set HEALTH_CHECK_KEY (or REMINDERS_CRON_SECRET) in Cloudflare Pages first." }, 403);
  if (new URL(context.request.url).searchParams.get("key") !== secret) return json({ error: "forbidden" }, 403);
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY isn't set" }, 500);
  const h = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" };
  const owners: any[] = await fetch(`${SUPABASE_URL}/rest/v1/owner_secrets?select=owner_id`, { headers: h }).then(r => r.ok ? r.json() : []).catch(() => []);
  const results: { business: number; failing: number; newlyFailing: number }[] = [];
  let n = 0;
  for (const row of owners) {
    const ownerId = String(row?.owner_id || "");
    if (!ownerId) continue;
    n++;
    let checks;
    try { checks = await runHealthChecks(ownerId, env, serviceRoleKey); }
    catch { results.push({ business: n, failing: -1, newlyFailing: 0 }); continue; }
    const failing = checks.filter(c => !c.ok).map(c => `${c.area}: ${c.name}`);
    const prevRows: any[] = await fetch(`${SUPABASE_URL}/rest/v1/owner_records?owner_id=eq.${encodeURIComponent(ownerId)}&kind=eq.health_check&id=eq.latest&select=data`, { headers: h }).then(r => r.ok ? r.json() : []).catch(() => []);
    const before = new Set<string>(prevRows[0]?.data?.failing || []);
    const fresh = failing.filter(f => !before.has(f));
    await fetch(`${SUPABASE_URL}/rest/v1/owner_records?on_conflict=owner_id,kind,id`, {
      method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ owner_id: ownerId, kind: "health_check", id: "latest", data: { checkedAt: new Date().toISOString(), failing, checks } }),
    }).catch(() => null);
    if (fresh.length) {
      const first = checks.find(c => !c.ok && fresh.includes(`${c.area}: ${c.name}`));
      await pushToOwnerDevices(env, ownerId, {
        title: `CrewBoss: ${fresh.length} connection${fresh.length !== 1 ? "s" : ""} need${fresh.length === 1 ? "s" : ""} attention`,
        body: (first ? `${first.name}: ${first.detail}` : fresh.join(", ")).slice(0, 180) + (first?.fix ? ` Fix: ${first.fix}`.slice(0, 120) : ""),
        url: "/#/settings", tag: "health-check",
      }).catch(() => null);
    }
    results.push({ business: n, failing: failing.length, newlyFailing: fresh.length });
  }
  return json({ ok: true, checkedAt: new Date().toISOString(), businesses: n, results });
};
