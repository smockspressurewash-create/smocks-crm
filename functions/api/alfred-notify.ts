// FEATURE (round 4) — a single persistent Alfred conversation for system
// notifications (estimate-viewed, and future similar events), instead of
// each event creating its own throwaway chat. The tricky part: the events
// that need to write here (customer viewing an estimate on the
// unauthenticated public estimate page, ClientPortal.tsx) have no owner
// Supabase session — nothing to scope an `owner_id` write to. This app is
// single-tenant per deployment (one business owner — see CLAUDE.md), so
// there's exactly one real owner_id to find: resolved server-side here by
// reading the one row in app_settings, the same trick fetchAppSettings()
// in twilio-sms-webhook.ts already uses. RLS on alfred_conversations is
// already fully permissive (CLAUDE.md — single-owner app, not multi-tenant),
// so this endpoint isn't adding a new trust boundary, just a safe, correct
// place to resolve owner_id + do the merge-into-one-thread logic server-side
// instead of teaching the public customer page how to do it directly.

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8aEa3wsYJ7ghVPcGbtHymw_ugj0aEfm";
const HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

const NOTIFICATIONS_THREAD_ID = "system-notifications";
const MAX_MESSAGES = 200; // cap so this thread can't grow unbounded

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost = async (context: { request: Request }) => {
  try {
    const { title, message } = await context.request.json() as { title?: string; message?: string };
    if (!message || !message.trim()) return json({ error: "Missing message" }, 400);

    // Single-tenant: there's exactly one app_settings row (one business
    // owner per deployment). If this ever returns more than one, something
    // deeper is wrong — using the first is the same assumption every other
    // "single settings row" read in this codebase already makes.
    const ownerRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=owner_id&limit=1`, { headers: HEADERS });
    if (!ownerRes.ok) return json({ error: "Could not resolve owner (app_settings read failed)" }, 502);
    const ownerRows = await ownerRes.json().catch(() => []);
    const ownerId = Array.isArray(ownerRows) ? ownerRows[0]?.owner_id : null;
    if (!ownerId) return json({ error: "No owner configured yet" }, 404);

    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/alfred_conversations?id=eq.${NOTIFICATIONS_THREAD_ID}&select=messages`,
      { headers: HEADERS }
    );
    const existingRows = existingRes.ok ? await existingRes.json().catch(() => []) : [];
    const existing = Array.isArray(existingRows) ? existingRows[0] : null;

    // role: "alfred" (not the AlfredMessage type's "assistant") — matches
    // what AlfredPage.tsx actually writes/reads at runtime (isUser = m.role
    // === "user", everything else renders as Alfred's own bubble).
    const newMsg = { id: crypto.randomUUID(), role: "alfred", content: message.trim(), timestamp: Date.now() };
    const prevMessages = Array.isArray(existing?.messages) ? existing.messages : [];
    const messages = [...prevMessages, newMsg].slice(-MAX_MESSAGES);
    const nowIso = new Date().toISOString();

    if (existing) {
      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/alfred_conversations?id=eq.${NOTIFICATIONS_THREAD_ID}`,
        {
          method: "PATCH",
          headers: { ...HEADERS, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ messages, updated_at: nowIso }),
        }
      );
      if (!patchRes.ok) {
        const errText = await patchRes.text().catch(() => "");
        console.error("[AlfredNotify] PATCH failed (" + patchRes.status + "):", errText);
        return json({ error: "Failed to update notifications thread" }, 502);
      }
    } else {
      const postRes = await fetch(`${SUPABASE_URL}/rest/v1/alfred_conversations`, {
        method: "POST",
        headers: { ...HEADERS, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          id: NOTIFICATIONS_THREAD_ID, owner_id: ownerId, title: title || "Alfred Notifications",
          messages, created_at: nowIso, updated_at: nowIso,
        }),
      });
      if (!postRes.ok) {
        const errText = await postRes.text().catch(() => "");
        console.error("[AlfredNotify] POST failed (" + postRes.status + "):", errText);
        return json({ error: "Failed to create notifications thread" }, 502);
      }
    }
    console.log("[AlfredNotify] appended to system-notifications for owner", ownerId);
    return json({ ok: true });
  } catch (e: any) {
    console.error("[AlfredNotify] handler error:", e?.message);
    return json({ error: e?.message || "Server error" }, 500);
  }
};
