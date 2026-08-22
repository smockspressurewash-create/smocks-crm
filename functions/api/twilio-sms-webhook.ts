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

import { runAlfredSmsAgent, sendAlfredSms } from "./_lib/alfredSmsAgent";
import { runAlfredCustomerAgent } from "./_lib/alfredCustomerAgent";

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8aEa3wsYJ7ghVPcGbtHymw_ugj0aEfm";

// Sends the customer-facing agent's reply to the CUSTOMER (not the owner)
// and logs it in THEIR thread, marked via:"alfred" so it's badged in the
// Inbox the same way an owner-directed Alfred reply is.
const sendCustomerAgentReply = async (ctx: { authHeaders: Record<string, string>; ownerId: string | null; twilioSid?: string; twilioToken?: string; twilioFrom?: string }, toPhone: string, body: string): Promise<void> => {
  if (!ctx.twilioSid || !ctx.twilioToken || !ctx.twilioFrom) return;
  const auth = `Basic ${btoa(`${ctx.twilioSid}:${ctx.twilioToken}`)}`;
  const params = new URLSearchParams({ To: toPhone, From: ctx.twilioFrom, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ctx.twilioSid}/Messages.json`, {
    method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString(),
  });
  if (!res.ok) { console.error("[TwilioSmsWebhook] customer agent reply send failed:", await res.text().catch(() => "")); return; }
  try {
    const digits = normalizePhoneDigits(toPhone);
    const ownerFilter = ctx.ownerId ? `&owner_id=eq.${encodeURIComponent(ctx.ownerId)}` : "";
    const threadsRes = await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?channel=eq.sms&select=id,contact_phone,messages${ownerFilter}`, { headers: ctx.authHeaders });
    const threads = await threadsRes.json().catch(() => []);
    const existing = Array.isArray(threads) ? threads.find((t: any) => normalizePhoneDigits(t.contact_phone) === digits) : null;
    const msg = { id: crypto.randomUUID(), dir: "out", body, ts: Date.now(), via: "alfred" };
    if (existing) {
      await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?id=eq.${encodeURIComponent(existing.id)}`, {
        method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ messages: [...(existing.messages || []), msg], last_message_at: msg.ts, updated_at: new Date().toISOString() }),
      });
    }
    // No else-create branch — the inbound message handler above already
    // created/updated this thread for the customer's own text moments ago.
  } catch (e: any) { console.error("[TwilioSmsWebhook] failed to log customer agent reply:", e?.message); }
};

const STOP_WORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
const START_WORDS = ["START", "UNSTOP", "YES"];
const CONFIRM_WORDS = ["Y", "YES"];
const DEFAULT_OPT_IN_KEYWORD = "DEALS";

// FIX — Twilio's `From`/`To` always arrive E.164 with the US country code
// ("+17173411794" → digits "17173411794", 11 digits), but a number the
// owner types into Settings (myPhone/alfredExtraPhones) is normally just
// the 10-digit local number ("717 341 1794" → "7173411794") — plain digit
// stripping alone left those two NEVER equal, so the "is this the owner
// texting Alfred?" check (authorizedPhones.includes(fromDigits)) silently
// failed every time for a US number entered without a country code. This
// was the root cause of "I texted Alfred and it just logged to the Inbox
// like a normal customer message, Alfred never replied." Strip a leading
// "1" off an 11-digit result so both forms normalize to the same 10 digits.
const normalizePhoneDigits = (p: string) => {
  const d = (p || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
};

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
  alfredExtraPhones: string[];
  alfredSmsEnabled: boolean;
  twilioSid: string;
  twilioToken: string;
  twilioFrom: string;
  modelKeys: Record<string, string>;
  modelPriority: string[];
  activeModel: string;
  openaiKey: string;
  googleProviderToken: string;
  googleRefreshToken: string;
  googleTokenExpiresAt: number;
}

const shapeSettings = (row: any, data: any): ResolvedOwnerSettings => ({
  companyName: data?.companyName || "Crew Boss",
  keyword: (data?.smsOptInKeyword || DEFAULT_OPT_IN_KEYWORD).toUpperCase(),
  ownerId: row?.owner_id || null,
  myPhone: data?.myPhone || "",
  alfredExtraPhones: Array.isArray(data?.alfredExtraPhones) ? data.alfredExtraPhones.filter((p: any) => typeof p === "string" && p.trim()) : [],
  alfredSmsEnabled: !!data?.alfredSmsEnabled,
  twilioSid: data?.twilioSid || "",
  twilioToken: data?.twilioToken || "",
  twilioFrom: data?.twilioFrom || "",
  // Text-Alfred uses the SAME provider config as the in-app Alfred — every
  // key the owner has saved (Claude, GPT-4o, Gemini, Groq, Mistral, NVIDIA
  // models) plus their priority order, so a business running on Gemini or a
  // free NVIDIA model gets that same provider over text, not just Claude.
  modelKeys: data?.modelKeys && typeof data.modelKeys === "object" ? data.modelKeys : {},
  modelPriority: Array.isArray(data?.modelPriority) ? data.modelPriority : [],
  activeModel: data?.activeModel || "",
  // FEATURE — voice memo support: a text-to-Alfred voice memo (MMS with an
  // audio attachment) is transcribed via OpenAI Whisper before being handed
  // to the agent, so "just talking" to Alfred works the same as typing.
  // Reuses whichever OpenAI key is already saved for the in-app Alfred
  // (Settings → AI Models) — no separate setup needed if that's configured.
  openaiKey: data?.modelKeys?.openai || "",
  googleProviderToken: data?.googleProviderToken || "",
  googleRefreshToken: data?.googleRefreshToken || "",
  googleTokenExpiresAt: Number(data?.googleTokenExpiresAt) || 0,
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
        // BUG FIX (root cause of "text-Alfred just never responds, with no
        // error anywhere") — this used to fetch with `limit=1` and no
        // ORDER BY. Confirmed live: two app_settings rows existed with the
        // IDENTICAL twilioFrom (an orphaned duplicate owner_id with zero
        // real business data anywhere — no employees/jobs/customers — but
        // alfredSmsEnabled left at its default null/false). Which row
        // Postgres happened to return first was arbitrary per-request, so
        // some inbound texts silently resolved to the dead account's
        // settings — Alfred correctly appeared "disabled" for those
        // requests with nothing to indicate why, and any message that
        // landed there got logged to THAT owner's Inbox instead, not the
        // real one. Fetch every match (still narrow — a handful of rows at
        // most) and deterministically prefer one with alfredSmsEnabled on,
        // logging loudly if this ever happens again so it's diagnosable
        // instead of silently misrouting.
        const exactRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=owner_id,data&data-%3E%3EtwilioFrom=eq.${encodeURIComponent(toNumber)}&limit=5`, { headers });
        const exactRows = await exactRes.json().catch(() => []);
        if (Array.isArray(exactRows) && exactRows.length > 0) {
          if (exactRows.length > 1) {
            console.error("[TwilioSmsWebhook] MULTIPLE app_settings rows share twilioFrom", toNumber, "— owner_ids:", exactRows.map((r: any) => r.owner_id).join(", "), "— this is a data problem (duplicate/orphaned owner account), not just a routing quirk; clean up the extra row(s) in Supabase.");
          }
          const exactRow = exactRows.find((r: any) => r?.data?.alfredSmsEnabled) || exactRows[0];
          return shapeSettings(exactRow, exactRow?.data);
        }
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

// FEATURE — voice memo support. A voice memo sent to Alfred arrives as an
// MMS with an audio attachment (Twilio's NumMedia/MediaUrl0/
// MediaContentType0 fields on the same inbound webhook POST — no separate
// endpoint needed). Twilio media URLs require the SAME Basic Auth as any
// other Twilio API call to fetch (they're not public), so this can only run
// once the real Account SID/Auth Token are configured.
//
// TRANSCRIPTION: tries Cloudflare Workers AI FIRST (free — Cloudflare's own
// hosted Whisper model, no OpenAI key needed at all), only falling back to
// OpenAI's Whisper API if that's not available. Workers AI requires a
// one-time "AI" binding added to this Pages project: Cloudflare dashboard →
// this project → Settings → Functions → "AI" bindings → add binding named
// "AI" (no wrangler.toml needed — this is a Pages-native binding, not the
// separate Workers Cron Trigger feature this repo deliberately doesn't have
// set up). Free tier: 10,000 "neurons" per day, comfortably enough for
// normal voice-memo volume.
const transcribeViaWorkersAI = async (ai: any, audioBuf: ArrayBuffer): Promise<string | null> => {
  if (!ai) return null;
  try {
    const result: any = await ai.run("@cf/openai/whisper", { audio: Array.from(new Uint8Array(audioBuf)) });
    const text = (result?.text || "").trim();
    return text || null;
  } catch (e: any) {
    console.warn("[TwilioSmsWebhook] Workers AI transcription failed, will try OpenAI fallback if configured:", e?.message);
    return null;
  }
};

const transcribeViaOpenAI = async (audioBuf: ArrayBuffer, openaiKey: string): Promise<string | null> => {
  if (!openaiKey) return null;
  try {
    const form = new FormData();
    form.append("file", new Blob([audioBuf]), "voice-memo.ogg");
    form.append("model", "whisper-1");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${openaiKey}` }, body: form,
    });
    if (!res.ok) throw new Error(`OpenAI Whisper failed (${res.status})`);
    const data = await res.json() as { text?: string };
    return (data.text || "").trim() || null;
  } catch (e: any) {
    console.error("[TwilioSmsWebhook] OpenAI transcription failed:", e?.message);
    return null;
  }
};

// Falls back to the plain text body whenever there's no audio, no working
// transcription path, or the transcription call itself fails — Alfred still
// gets SOMETHING to respond to rather than the whole request silently dying.
const resolveIncomingText = async (params: Record<string, string>, bodyRaw: string, twilioSid: string, twilioToken: string, openaiKey: string, workersAi: any): Promise<string> => {
  const numMedia = Number(params.NumMedia || "0");
  if (numMedia <= 0) return bodyRaw;
  const contentType = params.MediaContentType0 || "";
  if (!contentType.startsWith("audio/")) return bodyRaw || "[sent an attachment that isn't a voice memo — no text to respond to]";
  const mediaUrl = params.MediaUrl0;
  if (!mediaUrl || !twilioSid || !twilioToken) {
    console.warn("[TwilioSmsWebhook] voice memo received but Twilio media can't be fetched — check the Account SID/Auth Token");
    return bodyRaw || "[sent a voice memo, but couldn't fetch it — check the Twilio Account SID in Settings]";
  }
  try {
    const audioRes = await fetch(mediaUrl, { headers: { Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}` } });
    if (!audioRes.ok) throw new Error(`Twilio media fetch failed (${audioRes.status})`);
    const audioBuf = await audioRes.arrayBuffer();
    const transcript = (await transcribeViaWorkersAI(workersAi, audioBuf)) || (await transcribeViaOpenAI(audioBuf, openaiKey));
    if (!transcript) {
      return bodyRaw || "[sent a voice memo, but transcription isn't set up — either add the free \"AI\" binding in Cloudflare Pages settings, or add an OpenAI key in Settings → AI Models]";
    }
    console.log("[TwilioSmsWebhook] voice memo transcribed:", transcript.slice(0, 100));
    return bodyRaw ? `${transcript}\n\n(caption: ${bodyRaw})` : transcript;
  } catch (e: any) {
    console.error("[TwilioSmsWebhook] voice memo transcription failed:", e?.message);
    return bodyRaw || "[sent a voice memo but transcription failed — try typing instead]";
  }
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string>; waitUntil: (p: Promise<any>) => void }) => {
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
    const { companyName, keyword, ownerId, myPhone, alfredExtraPhones, alfredSmsEnabled, twilioSid, twilioToken, twilioFrom, modelKeys, modelPriority, activeModel, openaiKey, googleProviderToken, googleRefreshToken, googleTokenExpiresAt } = resolved;
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
    //
    // FEATURE — also checks alfredExtraPhones (Settings → AI Models →
    // "Numbers allowed to text Alfred"), so an owner testing the CUSTOMER
    // side of texting from their own main number (myPhone) can register a
    // SECOND number for Alfred conversations without losing access to
    // either — either number reaching this webhook is treated as "this is
    // Alfred, not a customer."
    const authorizedPhones = [myPhone, ...alfredExtraPhones].filter(Boolean).map(normalizePhoneDigits);
    if (alfredSmsEnabled && authorizedPhones.includes(fromDigits)) {
      const ctx = { authHeaders, ownerId, companyName, twilioSid, twilioToken, twilioFrom, origin: new URL(context.request.url).origin, fromPhone: from, googleProviderToken, googleRefreshToken, googleTokenExpiresAt };
      // BUG FIX — this branch never logged the OWNER's own inbound text to
      // inbox_threads at all (only to alfred_sms_threads, which the Inbox
      // UI never reads) — sendAlfredSms below only logs Alfred's OUTGOING
      // reply. So the Inbox showed a one-sided thread of nothing but
      // Alfred's replies with no visible question ever asked, which read as
      // "messages going out from Alfred as if they're incoming" — there was
      // no incoming side to contrast them against at all. Log it the same
      // way the ordinary-message path below does, dir:"in", so the owner
      // sees their own side of the conversation too.
      context.waitUntil((async () => {
        try {
          const threadsRes = await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?channel=eq.sms&select=id,contact_phone,messages${ownerFilter}`, { headers: authHeaders });
          const existingThreads = await threadsRes.json().catch(() => []);
          const existingThread = Array.isArray(existingThreads) ? existingThreads.find((t: any) => normalizePhoneDigits(t.contact_phone) === fromDigits) : null;
          const msgId = params.MessageSid || crypto.randomUUID();
          const alreadyHave = existingThread && (Array.isArray(existingThread.messages) ? existingThread.messages : []).some((m: any) => m?.id === msgId);
          if (alreadyHave) return;
          const newMsg = { id: msgId, sid: params.MessageSid || null, dir: "in", body: bodyRaw, ts: Date.now() };
          if (existingThread) {
            await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?id=eq.${encodeURIComponent(existingThread.id)}`, {
              method: "PATCH", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
              body: JSON.stringify({ messages: [...(existingThread.messages || []), newMsg], unread: true, last_message_at: newMsg.ts, updated_at: new Date().toISOString() }),
            });
          } else {
            await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads`, {
              method: "POST", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
              body: JSON.stringify({ id: crypto.randomUUID(), channel: "sms", contact_name: "Alfred", contact_phone: from, unread: true, messages: [newMsg], last_message_at: newMsg.ts, updated_at: new Date().toISOString(), ...(ownerFilter ? { owner_id: ownerId || null } : {}) }),
            });
          }
        } catch (e: any) { console.error("[TwilioSmsWebhook] failed to log inbound Alfred text:", e?.message); }
      })());
      // FIX — Twilio abandons an unanswered webhook after ~15s with nothing
      // shown to the owner. A multi-step request (e.g. "reschedule this job
      // AND text the customer") can easily need multiple Anthropic
      // round-trips + several Supabase writes, well past that window. Ack
      // Twilio immediately with an empty response (so the request always
      // "succeeds" from Twilio's side), then keep running the actual agent
      // in the background via waitUntil and deliver the real answer as its
      // own follow-up text a few seconds later via the Messages API —
      // exactly like sendSms elsewhere in this agent already does, so it
      // also gets logged to the Inbox like every other outbound text.
      context.waitUntil(
        resolveIncomingText(params, bodyRaw, twilioSid, twilioToken, openaiKey, (context.env as any).AI)
          .then((text) => runAlfredSmsAgent(ctx, modelKeys, modelPriority, activeModel, from, text))
          .catch((e: any) => {
            console.error("[TwilioSmsWebhook] Alfred SMS agent failed:", e?.message);
            return "Sorry, something went wrong on my end — try again in a moment.";
          })
          .then((reply) => sendAlfredSms(ctx, from, reply))
      );
      return twiml();
    }
    // No normalized phone column to filter on server-side (formats vary:
    // "(717) 555-0100" vs "+17175550100") — fetch and match in JS.
    let listRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=id,phone,firstName,lastName,smsOptInPending,alfredAutoRespond${ownerFilter}`, {
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
      listRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=id,phone,firstName,lastName,smsOptInPending,alfredAutoRespond`, { headers: authHeaders });
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

    // FEATURE — customer-facing Alfred auto-response (opt-in per customer,
    // off by default — see CustomerDetail.tsx's toggle). Only for a matched,
    // opted-in customer's ORDINARY message — never for STOP/START/keyword
    // compliance actions (those still go through the exact flow below,
    // unmodified). Runs in the background the same way the owner bridge
    // does; if no model is configured this just returns null and nothing
    // changes from today's behavior (message stays logged for the owner to
    // answer manually).
    if (!isStop && !isStart && !isOptInKeyword && !isConfirm && match?.alfredAutoRespond) {
      const custCtx = { authHeaders, ownerId, companyName, twilioSid, twilioToken, twilioFrom, ownerPhone: myPhone };
      context.waitUntil(
        resolveIncomingText(params, bodyRaw, twilioSid, twilioToken, openaiKey, (context.env as any).AI)
          .then((text) => runAlfredCustomerAgent(custCtx, match, modelKeys, modelPriority, text))
          .then((reply) => { if (reply) return sendCustomerAgentReply(custCtx, from, reply); })
          .catch((e: any) => console.error("[TwilioSmsWebhook] customer Alfred agent failed:", e?.message))
      );
      return twiml();
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
