// AUDIT 6 — Cloudflare Pages Function, auto-deployed from this /functions
// directory (no wrangler.toml needed, per Cloudflare Pages convention).
//
// Twilio's REST API never returns Access-Control-Allow-Origin headers, so a
// browser fetch() straight to api.twilio.com is rejected by CORS before the
// request even completes — no matter how correct the SID/Token/From number
// are. lib/messaging.ts's twilioSend() used to do exactly that as its
// fallback whenever no `twilioBackendUrl` was configured, which was always,
// since there was never even a Settings field to set one. That made every
// SMS send in the app (OTW, Running Late, invoice texts, campaigns,
// reviews, automations, Alfred, promotions...) silently fail. This function
// runs server-side (no CORS restriction applies to it) and same-origin (no
// CORS restriction applies to calling IT from the browser either), so it
// proxies the real Twilio call through.
export const onRequestPost = async (context: { request: Request }) => {
  try {
    const { sid, token, to, from, body } = await context.request.json() as {
      sid?: string; token?: string; to?: string; from?: string; body?: string;
    };
    if (!sid || !token || !to || !from || !body) {
      return new Response(JSON.stringify({ error: "Missing sid/token/to/from/body" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    const formData = new URLSearchParams({ To: to, From: from, Body: body });
    const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });
    const data = await twilioRes.json().catch(() => ({} as any));
    if (!twilioRes.ok) {
      return new Response(JSON.stringify({ error: data?.message || `Twilio error ${twilioRes.status}` }), {
        status: twilioRes.status, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true, sid: data?.sid }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Proxy error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
