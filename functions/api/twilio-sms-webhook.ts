// FEATURE — Twilio A2P 10DLC compliance: real STOP/START opt-out handling,
// plus a keyword-based "via text" double opt-in flow.
// Twilio's own carrier-level Advanced Opt-Out (if enabled on the Messaging
// Service) can auto-reply to STOP and block the number at Twilio's layer,
// but this app's OWN customers table has no visibility into that — nothing
// here would know to stop queuing automations/manual sends to that person.
// InboxPage.tsx also detects STOP/START, but only via polling Twilio's REST
// API once every 15s AND only while the owner's Inbox tab happens to be
// open — an opt-out sent while the app is closed would sit unprocessed
// until someone next opens the Inbox. This is a real Twilio-called webhook:
// it fires immediately, every time, regardless of whether the app is open.
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
// unverified — acceptable here since the worst case of a forged request is
// one customer's opt-in flag flipping, not a data breach (this app's RLS is
// already fully permissive per CLAUDE.md — single-owner app, not multi-tenant).

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

const fetchAppSettings = async (): Promise<{ companyName: string; keyword: string }> => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=data-%3E%3EcompanyName,data-%3E%3EsmsOptInKeyword&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    const rows = await res.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    return {
      companyName: row?.companyName || "Crew Boss",
      keyword: (row?.smsOptInKeyword || DEFAULT_OPT_IN_KEYWORD).toUpperCase(),
    };
  } catch {
    return { companyName: "Crew Boss", keyword: DEFAULT_OPT_IN_KEYWORD };
  }
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    const raw = await context.request.text();
    const params = Object.fromEntries(new URLSearchParams(raw));

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

    const body = (params.Body || "").trim().toUpperCase();
    const from = params.From || "";
    if (!from) return twiml();

    const isStop = STOP_WORDS.includes(body);
    const isStart = START_WORDS.includes(body);
    const { companyName, keyword } = await fetchAppSettings();
    const isOptInKeyword = body === keyword;
    const isConfirm = CONFIRM_WORDS.includes(body);
    if (!isStop && !isStart && !isOptInKeyword && !isConfirm) return twiml(); // ordinary message — InboxPage's poll handles display

    const fromDigits = normalizePhoneDigits(from);
    // No normalized phone column to filter on server-side (formats vary:
    // "(717) 555-0100" vs "+17175550100") — fetch and match in JS. Fine at
    // this app's single-tenant scale (CLAUDE.md).
    const listRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=id,phone,firstName,smsOptInPending`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    const list = await listRes.json().catch(() => []);
    const match = Array.isArray(list) ? list.find((c: any) => normalizePhoneDigits(c.phone) === fromDigits) : null;

    const origin = new URL(context.request.url).origin;
    const termsUrl = `${origin}/#/terms?co=${encodeURIComponent(companyName)}`;
    const privacyUrl = `${origin}/#/privacy?co=${encodeURIComponent(companyName)}`;

    const patchCustomer = async (id: string, patch: Record<string, unknown>) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) console.error("[TwilioSmsWebhook] patch failed for", id, ":", await res.text().catch(() => ""));
      return res.ok;
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
      return twiml(`You're confirmed! Welcome to ${companyName} text updates — appointment reminders, on-my-way alerts, and occasional offers. Msg freq varies (~1-4/mo). Msg&data rates may apply. Reply HELP for help, STOP to cancel anytime.`);
    }

    if (isOptInKeyword) {
      let customerId = match?.id;
      if (!customerId) {
        // New number, no existing customer record — create a minimal one so
        // the pending opt-in has somewhere to live. Mirrors LeadFormPage.tsx's
        // bare-minimum new-lead shape.
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/customers`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify([{ id: crypto.randomUUID(), firstName: "", lastName: "", phone: from, email: "", totalSpent: 0, createdAt: new Date().toISOString(), smsOptInPending: true, smsOptInPendingAt: new Date().toISOString() }]),
        });
        const inserted = await insertRes.json().catch(() => null);
        customerId = Array.isArray(inserted) ? inserted[0]?.id : undefined;
        if (!customerId) console.error("[TwilioSmsWebhook] failed to create customer for new opt-in number:", from);
      } else {
        await patchCustomer(customerId, { smsOptInPending: true, smsOptInPendingAt: new Date().toISOString() });
      }
      console.log("[TwilioSmsWebhook] opt-in keyword received, pending confirmation for", customerId || from);
      return twiml(`Thanks for texting ${keyword} to ${companyName}! Reply Y to confirm you want text updates (appointment reminders & offers, ~1-4 msgs/mo). Msg&data rates may apply. Terms: ${termsUrl} Privacy: ${privacyUrl}`);
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
