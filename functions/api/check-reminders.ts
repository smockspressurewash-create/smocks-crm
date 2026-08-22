// check-reminders.ts — sends any Alfred SMS reminders (see
// functions/api/_lib/alfredSmsAgent.ts's set_reminder tool) that are now due.
//
// Cloudflare PAGES Functions (this deployment) have no built-in Cron
// Trigger — that's a Workers-only feature requiring a wrangler.toml this
// project deliberately doesn't have (see CLAUDE.md). So this endpoint needs
// something OUTSIDE Cloudflare pinging it on a schedule:
//
// 1. Go to https://cron-job.org (free) or use a GitHub Actions scheduled
//    workflow — anything that can hit a URL every few minutes.
// 2. Point it at: https://<your-domain>/api/check-reminders
// 3. Every 5 minutes is plenty — reminders just fire up to 5 minutes late,
//    never early (a reminder due at 2:00pm sent at 2:03pm is fine; this
//    endpoint only ever sends what's ALREADY due when it runs).
//
// Optional hardening: set REMINDERS_CRON_SECRET in Cloudflare Pages env vars
// and have your pinger call /api/check-reminders?key=<that value> — without
// it, this endpoint is still safe to leave open (it only ever sends
// reminders that already exist and are already due; nothing a caller
// controls), just slightly more guessable as an endpoint to hit repeatedly
// (harmless — sending an already-sent reminder again is prevented by the
// `sent` flag, checked and set atomically per-row below).
const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";

export const onRequest = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return new Response(JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  const secret = context.env.REMINDERS_CRON_SECRET;
  if (secret) {
    const key = new URL(context.request.url).searchParams.get("key");
    if (key !== secret) return new Response(JSON.stringify({ error: "Invalid key" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const dueRes = await fetch(`${SUPABASE_URL}/rest/v1/alfred_reminders?sent=eq.false&due_at=lte.${encodeURIComponent(new Date().toISOString())}&select=id,owner_id,phone,message`, { headers });
  const due = await dueRes.json().catch(() => []);
  if (!Array.isArray(due) || due.length === 0) return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });

  const settingsCache = new Map<string, any>();
  const getSettings = async (ownerId: string) => {
    if (settingsCache.has(ownerId)) return settingsCache.get(ownerId);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(ownerId)}&select=data&limit=1`, { headers });
    const rows = await res.json().catch(() => []);
    const s = Array.isArray(rows) ? rows[0]?.data || null : null;
    settingsCache.set(ownerId, s);
    return s;
  };

  let sentCount = 0;
  const errors: string[] = [];
  for (const r of due) {
    // Claim this row FIRST (sent:true) so two overlapping cron calls can
    // never double-send the same reminder — same idea as the webhook's
    // MessageSid dedup, just via a flag instead of an id check.
    const claim = await fetch(`${SUPABASE_URL}/rest/v1/alfred_reminders?id=eq.${encodeURIComponent(r.id)}&sent=eq.false`, {
      method: "PATCH", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ sent: true }),
    });
    const claimed = await claim.json().catch(() => []);
    if (!Array.isArray(claimed) || claimed.length === 0) continue; // another run already claimed it

    const s = await getSettings(r.owner_id);
    if (!s?.twilioSid || !s?.twilioToken || !s?.twilioFrom) {
      errors.push(`${r.id}: Twilio not configured for owner ${r.owner_id}`);
      continue;
    }
    const auth = `Basic ${btoa(`${s.twilioSid}:${s.twilioToken}`)}`;
    const params = new URLSearchParams({ To: r.phone, From: s.twilioFrom, Body: `⏰ Reminder: ${r.message}` });
    const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${s.twilioSid}/Messages.json`, {
      method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString(),
    });
    if (!smsRes.ok) {
      errors.push(`${r.id}: Twilio send failed (${smsRes.status})`);
      continue;
    }
    sentCount++;
  }

  return new Response(JSON.stringify({ sent: sentCount, errors }), { headers: { "Content-Type": "application/json" } });
};
