// ITEM 10 — same shape as functions/api/twilio-send.ts: refreshing a Google
// OAuth access token requires the client_secret, which must never ship in
// the frontend bundle. This project's Google Sign-In already runs through
// Supabase's own registered Google OAuth client (the owner pasted that
// client's ID + Secret into the Supabase dashboard's Google provider
// settings when they set up login) — a refresh_token issued under that
// client can only be redeemed using the SAME client_id/secret pair, so this
// function expects the owner to also set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET
// as Cloudflare Pages environment variables (Settings → Environment
// variables in the Cloudflare dashboard — same place VITE_SUPABASE_URL etc.
// already live), matching the values already in Supabase's Google provider
// config. Without a real refresh_token AND these two env vars, this always
// fails cleanly — callers fall back to prompting the owner to reconnect.
export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    const { refresh_token } = await context.request.json() as { refresh_token?: string };
    const clientId = context.env.GOOGLE_CLIENT_ID;
    const clientSecret = context.env.GOOGLE_CLIENT_SECRET;
    if (!refresh_token) {
      return new Response(JSON.stringify({ error: "Missing refresh_token" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Server missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET env vars — add them in the Cloudflare Pages dashboard" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token,
      grant_type: "refresh_token",
    });
    const googleRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = await googleRes.json().catch(() => ({} as any));
    if (!googleRes.ok) {
      return new Response(JSON.stringify({ error: data?.error_description || data?.error || `Google token refresh error ${googleRes.status}` }), {
        status: googleRes.status, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ access_token: data.access_token, expires_in: data.expires_in }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Proxy error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
