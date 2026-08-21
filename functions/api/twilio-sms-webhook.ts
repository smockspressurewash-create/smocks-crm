// FEATURE — Twilio A2P 10DLC compliance: real STOP/START opt-out handling,
// plus a keyword-based "via text" double opt-in flow. ALSO (Inbox audit,
// round 2) persists every inbound message — not just STOP/START/keyword
// ones — straight to inbox_threads, so a text arrives in the owner's Inbox
// (via the existing Supabase realtime subscription InboxPage.tsx already
// has on that table) the instant Twilio receives it, whether or not the
// app happens to be open. Before this, ordinary messages relied entirely
// on InboxPage.tsx polling Twilio's REST API every 15s WHILE the owner's
// Inbox tab was open — nothing arrived if it wasn't. That client-side poll
// still exists as a fallback (e.g. for a deployment that hasn't configured
// this webhook yet), just at a longer interval now that it's not the only
// path.
//
// One-time setup in the Twilio console (code alone can't do this part):
// Messaging -> Services -> (your Messaging Service) -> Integration ->
// "Incoming Messages" -> Webhook -> POST -> https://<your-domain>/api/twilio-sms-webhook
// (If you send from a standalone number with no Messaging Service, set this
// under Phone Numbers -> your number -> Messaging -> "A message comes in".)
//
// Optional hardening: set TWILIO_AUTH_TOKEN in Cloudflare Pages -> Settings
// -> Environment variables to verify requests are genuinely from Twilio
// (X-Twilio-Signature). Without it, this endpoint still works, just
// unverified — worst case of a forged request without it is one customer's
// opt-in flag flipping at the business whose Twilio number was guessed.

import { runAlfredSmsAgent } from "./_lib/alfredSmsAgent";

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8aEa3wsYJ7ghVPcGbtHymw_ugj0aEfm";

const STOP_WORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
const START_WORDS = ["START", "UNSTOP", "YES"];
const CONFIRM_WORDS = ["Y", "YES"];
const DEFAULT_OPT_IN_KEYWORD = "DEALS";

const normalizePhoneDigits = (p: string) => (p || "").replace(/\D/g, "");

// Twilio's request-signing scheme: HMAC-SHA1(authToken, url + sorted(key+value
// pairs, concatenated with no separator)), base64-encoded, compared to the
// X-Twilio-Signature header. See twilio.com/docs/usage/security#validating-requests.
const verifyTwilioSignature = async (url: string, params: Record<string, string>, signature: string, authToken: string): Promise<boolean> => {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) data += key + params[key];
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return expected === signature;
};

const twiml = (message?: string) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Message>` : ""}</Response>`,
  { headers: { "Content-Type": "text/xml" } }
);

// MULTI-TENANT (Phase G) — under migration 0033_multitenant_owner_scoping.sql,
// app_settings is now owner_id-scoped RLS, so an anon-key `limit=1` read
// (a) can't resolve current_owner_id() at all on this server-to-server call
// (no session) and would return zero rows regardless, and (b) was already an
// unsound "there's only ever one business" assumption. This webhook receives
// an inbound SMS to a specific Twilio number — Twilio sends that as the `To`
// field in the POST body — and each owner's own outbound Twilio number is
// already stored as `settings.twilioFrom` (see lib/messaging.ts / the Twilio
// section of SettingsModal.tsx). Match the inbound `To` against every
// owner's stored `twilioFrom` (service role, bypasses RLS) to find which
// business this text belongs to, instead of guessing "the" owner.
//
// Falls back to the OLD limit=1/anon-key behavior when
// SUPABASE_SERVICE_ROLE_KEY isn't configured yet, so a single-owner
// deployment that hasn't set up the new env var (or hasn't applied migration
// 0033 yet, so RLS is still permissive) keeps working unmodified — same
// fallback style stripe-action.ts uses for STRIPE_SECRET_KEY.
interface ResolvedOwnerSettings {
  companyName: string;
  keyword: string;
  ownerId: string | null;
  myPhone: string;
  alfredSmsEnabled: boolean;
  twilioSid: string;
  twilioToken: string;
  twilioFrom: string;
  anthropicKey: string;
}

const shapeSettings = (row: any, data: any): ResolvedOwnerSettings => ({
  companyName: data?.companyName || "Crew Boss",
  keyword: (data?.smsOptInKeyword || DEFAULT_OPT_IN_KEYWORD).toUpperCase(),
  ownerId: row?.owner_id || null,
  myPhone: data?.myPhone || "",
  alfredSmsEnabled: !!data?.alfredSmsEnabled,
  twilioSid: data?.twilioSid || "",
  twilioToken: data?.twilioToken || "",
  twilioFrom: data?.twilioFrom || "",
  anthropicKey: data?.modelKeys?.claude || data?.anthropicKey || "",
});

const fetchAppSettings = async (env: Record<string, string>, toNumber: string): Promise<ResolvedOwnerSettings> => {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const toDigits = normalizePhoneDigits(toNumber);
  try {
    if (serviceRoleKey) {
      const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
      // Prefer a direct PostgREST JSONB-text filter (matches the exact
      // stored string) — falls back to fetching all rows and matching in JS
      // (digits-only) below if that finds nothing, since `twilioFrom` may be
      // stored in a different format than Twilio's E.164 `To` (e.g.
      // "(717) 555-0100" vs "+17175550100").
      if (toNumber) {
        const exactRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=owner_id,data&data-%3E%3EtwilioFrom=eq.${encodeURIComponent(toNumber)}&limit=1`, { headers });
        const exactRows = await exactRes.json().catch(() => []);
        const exactRow = Array.isArray(exactRows) ? exactRows[0] : null;
        if (exactRow) return shapeSettings(exactRow, exactRow?.data);
      }
      const allRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=owner_id,data`, { headers });
      const allRows = await allRes.json().catch(() => []);
      const match = Array.isArray(allRows)
        ? allRows.find((r: any) => toDigits && normalizePhoneDigits(r?.data?.twilioFrom || "") === toDigits)
        : null;
      if (match) return shapeSettings(match, match?.data);
      console.warn("[TwilioSmsWebhook] no app_settings row's twilioFrom matched inbound To:", toNumber);
      return shapeSettings(null, null);
    }

    // Fallback — no service role key configured, old single-tenant behavior.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=owner_id,data&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    const rows = await res.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    return shapeSettings(row, row?.data);
  } catch {
    return shapeSettings(null, null);
  }
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    const raw = await context.request.text();
    const params = Object.fromEntries(new URLSearchParams(raw));
    // AUDIT #3.4 (round 4) — unconditional entry log, independent of which
    // branch (STOP/START/keyword/ordinary) this message ends up taking, so
    // "is the webhook even being hit" is answerable from Cloudflare Pages'
    // Functions log tab alone, without needing to reason about which of the
    // more specific logs further down should have fired.
    console.log("[TwilioSmsWebhook] inbound request received — From:", params.From, "Body:", (params.Body || "").slice(0, 80));

    const authToken = context.env.TWILIO_AUTH_TOKEN;
    if (authToken) {
      const signature = context.request.headers.get("X-Twilio-Signature") || "";
      const valid = await verifyTwilioSignature(context.request.url, params, signature, authToken);
      if (!valid) {
        console.warn("[TwilioSmsWebhook] signature verification failed — rejecting");
        return new Response("Invalid signature", { status: 403 });
      }
    } else {
      console.warn("[TwilioSmsWebhook] TWILIO_AUTH_TOKEN not set — processing without signature verification");
    }

    const bodyRaw = params.Body || "";
    const body = bodyRaw.trim().toUpperCase();
    const from = params.From || "";
    if (!from) return twiml();

    const isStop = STOP_WORDS.includes(body);
    const isStart = START_WORDS.includes(body);
    const resolved = await fetchAppSettings(context.env, params.To || "");
    const { companyName, keyword, ownerId, myPhone, alfredSmsEnabled, twilioSid, twilioToken, twilioFrom, anthropicKey } = resolved;
    const isOptInKeyword = body === keyword;
    const isConfirm = CONFIRM_WORDS.includes(body);

    // MULTI-TENANT — every read/write below now goes through the SAME
    // credentials + owner scoping fetchAppSettings resolved above: service
    // role key + this business's owner_id when both are available (RLS is
    // live and we identified the owner), otherwise the old anon-key/
    // unscoped behavior (RLS still permissive, or no service role key
    // configured yet) — same fallback contract as fetchAppSettings itself.
    const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
    const authHeaders = serviceRoleKey
      ? { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
      : { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
    let ownerFilter = ownerId ? `&owner_id=eq.${encodeURIComponent(ownerId)}` : "";

    const fromDigits = normalizePhoneDigits(from);

    // FEATURE — text-Alfred bridge. If the owner opted in (Settings →
    // AI Models/Twilio → "Text Alfred from my phone") and this inbound
    // message is FROM the owner's own personal number (settings.myPhone),
    // hand the whole thing to the AI agent instead of any of the
    // customer-facing opt-in/STOP/ordinary-message logic below — a text
    // from the owner is never a customer opt-out/opt-in action. Checked
    // before everything else so STOP/keyword words the owner might
    // legitimately type ("stop the job", "cancel that") never get
    // misinterpreted as an SMS compliance action.
    if (alfredSmsEnabled && myPhone && fromDigits === normalizePhoneDigits(myPhone)) {
      const ctx = { authHeaders, ownerId, companyName, twilioSid, twilioToken, twilioFrom };
      const reply = await runAlfredSmsAgent(ctx, anthropicKey, from, bodyRaw).catch((e: any) => {
        console.error("[TwilioSmsWebhook] Alfred SMS agent failed:", e?.message);
        return "Sorry, something went wrong on my end — try again in a moment.";
      });
      return twiml(reply);
    }
    // No normalized phone column to filter on server-side (formats vary:
    // "(717) 555-0100" vs "+17175550100") — fetch and match in JS.
    let listRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=id,phone,firstName,lastName,smsOptInPending${ownerFilter}`, {
      headers: authHeaders,
    });
    // FIX — verified live: app_settings.owner_id is already populated on
    // this deployment, but customers/inbox_threads don't have an owner_id
    // column yet (migration 0033 not applied), so `&owner_id=eq.X` 400s the
    // whole query and this used to silently resolve to "no customers at
    // all" — every STOP/opt-in match and the Inbox sync below would fail
    // with zero trace. If the scoped query fails, drop the filter and retry
    // once for the rest of this request (both here and for inbox_threads).
    if (!listRes.ok && ownerFilter) {
      console.warn("[TwilioSmsWebhook] scoped customers query failed (" + listRes.status + ") — retrying unscoped; migration 0033 likely not applied yet");
      ownerFilter = "";
      listRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=id,phone,firstName,lastName,smsOptInPending`, { headers: authHeaders });
    }
    const list = await listRes.json().catch(() => []);
    const match = Array.isArray(list) ? list.find((c: any) => normalizePhoneDigits(c.phone) === fromDigits) : null;

    // ISSUE 7 (Inbox audit) — this webhook used to bail out immediately for
    // any ORDINARY message ("InboxPage's poll handles display"), meaning
    // real-time inbound SMS only ever reached inbox_threads while the
    // owner's browser tab happened to be open and polling Twilio's REST API
    // every 15s. Writing it here too means it's captured the instant it
    // arrives regardless of whether the app is open, via the SAME
    // find-existing-thread-by-phone-or-create merge every other write path
    // in this app uses (see lib/messaging.ts's logOutboundSmsToInbox and
    // InboxPage.tsx's syncThreadToSupabase) — one consistent place threads
    // get merged, instead of the client being the only thing that can do it.
    // This also means the client-side poll can safely run less often (it's
    // now just a fallback/catch-up for whenever this webhook isn't
    // configured yet), directly reducing Twilio REST API usage.
    try {
      const threadsRes = await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?channel=eq.sms&select=id,contact_phone,messages${ownerFilter}`, {
        headers: authHeaders,
      });
      if (!threadsRes.ok) console.error("[TwilioSmsWebhook] inbox_threads read failed (" + threadsRes.status + "):", await threadsRes.clone().text().catch(() => ""));
      const existingThreads = await threadsRes.json().catch(() => []);
      const existingThread = Array.isArray(existingThreads)
        ? existingThreads.find((t: any) => normalizePhoneDigits(t.contact_phone) === fromDigits)
        : null;
      // ISSUE 17 (round 3) — neither write below checked res.ok; a non-2xx
      // (RLS rejection, a column that doesn't exist, a malformed JSONB
      // payload) was completely silent — no error log, no thrown exception,
      // just a text message that vanished with zero trace. That made "SMS
      // not showing in the inbox despite the webhook being set up" nearly
      // undiagnosable from the Cloudflare Function logs. Log the actual
      // Supabase response body on failure now.
      //
      // ISSUE 2 (round 6) — ROOT CAUSE of double-showing messages: this used
      // crypto.randomUUID() for every message's id, a value with no
      // relationship to the physical Twilio message. InboxPage.tsx's OWN
      // Twilio REST poll (a fallback that also runs while the owner's tab is
      // open) can independently pick up the SAME inbound message and, since
      // it used a locally-generated uid() too, had no way to recognize "this
      // is the one the webhook already recorded." Both this file and
      // InboxPage.tsx's poll now key the message's id off Twilio's own
      // MessageSid (always present on an inbound webhook POST) — the one
      // identifier both write paths can agree on regardless of which side
      // processes it first or what "now" happens to read on each side (the
      // two paths previously used DIFFERENT timestamp sources for the same
      // message — Date.now() here vs. Twilio's own DateSent on the poll
      // side — so a body+ts dedup check could never reliably catch this).
      const msgId = params.MessageSid || crypto.randomUUID();
      const newMsg = { id: msgId, sid: params.MessageSid || null, dir: "in", body: bodyRaw, ts: Date.now() };
      const alreadyHave = existingThread && (Array.isArray(existingThread.messages) ? existingThread.messages : []).some((m: any) => m?.id === msgId);
      if (alreadyHave) {
        console.log("[TwilioSmsWebhook] message", msgId, "already recorded — skipping duplicate insert");
      } else if (existingThread) {
        const merged = [...(Array.isArray(existingThread.messages) ? existingThread.messages : []), newMsg];
        const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?id=eq.${encodeURIComponent(existingThread.id)}`, {
          method: "PATCH",
          headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ messages: merged, unread: true, last_message_at: newMsg.ts, updated_at: new Date().toISOString() }),
        });
        if (!patchRes.ok) console.error("[TwilioSmsWebhook] inbox_threads PATCH failed (" + patchRes.status + "):", await patchRes.text().catch(() => ""));
      } else {
        const contactName = match ? `${match.firstName || ""} ${match.lastName || ""}`.trim() || from : from;
        const postRes = await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads`, {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ id: crypto.randomUUID(), channel: "sms", contact_name: contactName, contact_phone: from, customer_id: match?.id || null, unread: true, messages: [newMsg], last_message_at: newMsg.ts, updated_at: new Date().toISOString(), ...(ownerFilter ? { owner_id: ownerId || null } : {}) }),
        });
        if (!postRes.ok) console.error("[TwilioSmsWebhook] inbox_threads POST failed (" + postRes.status + "):", await postRes.text().catch(() => ""));
      }
    } catch (e: any) {
      console.error("[TwilioSmsWebhook] failed to persist inbound message to inbox_threads:", e?.message);
      // Non-fatal — the client-side poll is still a fallback for this.
    }

    if (!isStop && !isStart && !isOptInKeyword && !isConfirm) return twiml(); // ordinary message — already persisted above

    const origin = new URL(context.request.url).origin;
    const termsUrl = `${origin}/#/terms?co=${encodeURIComponent(companyName)}`;
    const privacyUrl = `${origin}/#/privacy?co=${encodeURIComponent(companyName)}`;

    const patchCustomer = async (id: string, patch: Record<string, unknown>) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) console.error("[TwilioSmsWebhook] patch failed for", id, ":", await res.text().catch(() => ""));
      return res.ok;
    };

    // ISSUE 1 (round 8) — the confirmation/welcome TwiML replies below are
    // real outbound SMS Twilio sends to the customer, but until now nothing
    // ever recorded them in inbox_threads — they were invisible in the
    // owner's Inbox, which read as "the auto-reply isn't showing as
    // outgoing" (it wasn't showing at all). Persist each one as a normal
    // dir:"out" message in the same thread the inbound trigger message just
    // landed in. Id is derived from the triggering MessageSid (not a fresh
    // random one) so a Twilio webhook retry of the SAME inbound request can
    // never log the reply twice.
    const persistOutboundReply = async (text: string) => {
      try {
        const threadsRes = await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?channel=eq.sms&select=id,contact_phone,messages${ownerFilter}`, {
          headers: authHeaders,
        });
        const existingThreads = await threadsRes.json().catch(() => []);
        const existingThread = Array.isArray(existingThreads)
          ? existingThreads.find((t: any) => normalizePhoneDigits(t.contact_phone) === fromDigits)
          : null;
        const replyId = params.MessageSid ? params.MessageSid + "-reply" : crypto.randomUUID();
        const alreadyHave = existingThread && (Array.isArray(existingThread.messages) ? existingThread.messages : []).some((m: any) => m?.id === replyId);
        if (alreadyHave) return;
        const replyMsg = { id: replyId, dir: "out", body: text, ts: Date.now() };
        if (existingThread) {
          const merged = [...(Array.isArray(existingThread.messages) ? existingThread.messages : []), replyMsg];
          const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?id=eq.${encodeURIComponent(existingThread.id)}`, {
            method: "PATCH",
            headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ messages: merged, last_message_at: replyMsg.ts, updated_at: new Date().toISOString() }),
          });
          if (!patchRes.ok) console.error("[TwilioSmsWebhook] auto-reply PATCH failed (" + patchRes.status + "):", await patchRes.text().catch(() => ""));
        } else {
          const contactName = match ? `${match.firstName || ""} ${match.lastName || ""}`.trim() || from : from;
          const postRes = await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads`, {
            method: "POST",
            headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ id: crypto.randomUUID(), channel: "sms", contact_name: contactName, contact_phone: from, customer_id: match?.id || null, unread: false, messages: [replyMsg], last_message_at: replyMsg.ts, updated_at: new Date().toISOString(), owner_id: ownerId || null }),
          });
          if (!postRes.ok) console.error("[TwilioSmsWebhook] auto-reply POST failed (" + postRes.status + "):", await postRes.text().catch(() => ""));
        }
      } catch (e: any) {
        console.error("[TwilioSmsWebhook] failed to persist auto-reply:", e?.message);
      }
    };

    if (isStop) {
      if (match?.id) {
        await patchCustomer(match.id, { smsOptOut: true, optOutDate: new Date().toISOString().slice(0, 10), smsOptIn: false, smsOptInPending: false });
        console.log("[TwilioSmsWebhook] opted OUT customer", match.id);
      } else {
        console.warn("[TwilioSmsWebhook] STOP from unrecognized number:", from);
      }
      // No auto-reply here — if Advanced Opt-Out is enabled on the Messaging
      // Service, Twilio already sends the required confirmation text at the
      // carrier level; replying here too would double-text the customer.
      return twiml();
    }

    // Confirmation step of the double opt-in (Twilio "via text" keyword flow)
    // — only completes the opt-in if THIS number actually has a pending
    // request on file, so a stray "Y"/"YES" from someone who never texted
    // the keyword doesn't silently opt them in.
    if (isConfirm && match?.smsOptInPending) {
      await patchCustomer(match.id, { smsOptIn: true, smsOptInAt: new Date().toISOString(), smsOptInPending: false, smsOptOut: false });
      console.log("[TwilioSmsWebhook] confirmed opt-in for customer", match.id);
      const replyText = `You're confirmed! Welcome to ${companyName} text updates — appointment reminders, on-my-way alerts, and occasional offers. Msg freq varies (~1-4/mo). Msg&data rates may apply. Reply HELP for help, STOP to cancel anytime.`;
      await persistOutboundReply(replyText);
      return twiml(replyText);
    }

    if (isOptInKeyword) {
      let customerId = match?.id;
      if (!customerId) {
        // New number, no existing customer record — create a minimal one so
        // the pending opt-in has somewhere to live. Mirrors LeadFormPage.tsx's
        // bare-minimum new-lead shape.
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/customers`, {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify([{ id: crypto.randomUUID(), firstName: "", lastName: "", phone: from, email: "", totalSpent: 0, createdAt: new Date().toISOString(), smsOptInPending: true, smsOptInPendingAt: new Date().toISOString(), owner_id: ownerId || null }]),
        });
        const inserted = await insertRes.json().catch(() => null);
        customerId = Array.isArray(inserted) ? inserted[0]?.id : undefined;
        if (!customerId) console.error("[TwilioSmsWebhook] failed to create customer for new opt-in number:", from);
      } else {
        await patchCustomer(customerId, { smsOptInPending: true, smsOptInPendingAt: new Date().toISOString() });
      }
      console.log("[TwilioSmsWebhook] opt-in keyword received, pending confirmation for", customerId || from);
      const replyText = `Thanks for texting ${keyword} to ${companyName}! Reply Y to confirm you want text updates (appointment reminders & offers, ~1-4 msgs/mo). Msg&data rates may apply. Terms: ${termsUrl} Privacy: ${privacyUrl}`;
      await persistOutboundReply(replyText);
      return twiml(replyText);
    }

    // isStart (plain STOP-reversal, not the keyword flow above) — checked
    // explicitly (not just "fell through the checks above") so a bare "Y"
    // that ISN'T a pending-confirmation reply (isConfirm is true for "Y" too,
    // but that branch above already returned if it applied) can never
    // silently opt someone in here just because it also passed the top-level
    // gate — "Y" alone is not one of START_WORDS.
    if (isStart) {
      if (match?.id) {
        await patchCustomer(match.id, { smsOptOut: false, smsOptIn: true, smsOptInAt: new Date().toISOString(), smsOptInPending: false });
        console.log("[TwilioSmsWebhook] opted back IN customer", match.id);
      } else {
        console.warn("[TwilioSmsWebhook] START from unrecognized number:", from);
      }
    }
    return twiml();
  } catch (e: any) {
    console.error("[TwilioSmsWebhook] handler error:", e?.message);
    // Still 200 + empty TwiML — a bug in our own bookkeeping must never cause
    // Twilio to treat a real inbound message as failed/retry it.
    return twiml();
  }
};
