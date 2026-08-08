// FEATURE — Twilio A2P 10DLC compliance: real STOP/START opt-out handling.
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

const twiml = () => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
  headers: { "Content-Type": "text/xml" },
});

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
    const isStop = STOP_WORDS.includes(body);
    const isStart = START_WORDS.includes(body);

    if ((isStop || isStart) && from) {
      const fromDigits = normalizePhoneDigits(from);
      // No normalized phone column to filter on server-side (formats vary:
      // "(717) 555-0100" vs "+17175550100") — fetch id+phone and match in JS.
      // Fine at this app's single-tenant scale (CLAUDE.md).
      const listRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=id,phone`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      const list = await listRes.json().catch(() => []);
      const match = Array.isArray(list) ? list.find((c: any) => normalizePhoneDigits(c.phone) === fromDigits) : null;
      if (match?.id) {
        const patch = isStop
          ? { smsOptOut: true, optOutDate: new Date().toISOString().slice(0, 10), smsOptIn: false }
          : { smsOptOut: false, smsOptIn: true, smsOptInAt: new Date().toISOString() };
        const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(match.id)}`, {
          method: "PATCH",
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        });
        if (!patchRes.ok) console.error("[TwilioSmsWebhook] failed to update customer", match.id, ":", await patchRes.text().catch(() => ""));
        else console.log("[TwilioSmsWebhook]", isStop ? "opted OUT" : "opted back IN", "customer", match.id);
      } else {
        console.warn("[TwilioSmsWebhook]", isStop ? "STOP" : "START", "from unrecognized number:", from);
      }
    }

    // No auto-reply <Message> here — if Advanced Opt-Out is enabled on the
    // Messaging Service, Twilio already sends the required confirmation text
    // at the carrier level; replying here too would double-text the customer.
    return twiml();
  } catch (e: any) {
    console.error("[TwilioSmsWebhook] handler error:", e?.message);
    // Still 200 + empty TwiML — a bug in our own bookkeeping must never cause
    // Twilio to treat a real inbound message as failed/retry it.
    return twiml();
  }
};
