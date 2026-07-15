// AUDIT 6 — same CORS problem as twilio-send.ts, but for polling inbound
// SMS into the owner's Inbox (InboxPage's pollTwilioIncoming). Credentials
// are sent in the POST body rather than a query string so they don't end up
// logged in any CDN/proxy access log.
export const onRequestPost = async (context: { request: Request }) => {
  try {
    const { sid, token, since } = await context.request.json() as {
      sid?: string; token?: string; since?: string;
    };
    if (!sid || !token) {
      return new Response(JSON.stringify({ error: "Missing sid/token" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    // FEATURE 7 (mobile round 7) — Twilio's Messages List Resource only
    // supports DateSent, DateSent<, and DateSent> as filter params; DateSent>=
    // isn't a real Twilio operator (unrecognized query params are silently
    // ignored), so this "since" filter never actually narrowed the request —
    // every poll re-fetched the same last-50 messages regardless.
    const sinceParam = since ? `&DateSent>${encodeURIComponent(since)}` : "";
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?Direction=inbound&PageSize=50${sinceParam}`;
    const twilioRes = await fetch(url, {
      headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` },
    });
    if (!twilioRes.ok) {
      const err = await twilioRes.json().catch(() => ({} as any));
      return new Response(JSON.stringify({ error: err?.message || `Twilio error ${twilioRes.status}`, messages: [] }), {
        status: twilioRes.status, headers: { "Content-Type": "application/json" },
      });
    }
    const data = await twilioRes.json() as { messages?: any[] };
    return new Response(JSON.stringify({ messages: data.messages ?? [] }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Proxy error", messages: [] }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
