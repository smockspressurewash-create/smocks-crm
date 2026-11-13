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
import { getOwnerSecrets, resolveCallerIsOwnerOrManager, resolveCallerOwnerId } from "./_lib/ownerSecrets";

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    let { refresh_token } = await context.request.json() as { refresh_token?: string };
    // BUG FIX (integration audit 2026-11-13) — a masked "••••••••" placeholder
    // read back out of settings is not a token; treat it as absent so the
    // caller gets the server-side owner path (or a clean no_refresh_token).
    if (typeof refresh_token === "string" && /^[•\s]*$/.test(refresh_token)) refresh_token = undefined;
    const callerToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    // BUG FIX (integration audit 2026-11-13) — a bearer token that is sent
    // must be a real session; a bad one is rejected instead of ignored.
    if (callerToken && !(await resolveCallerOwnerId(callerToken).catch(() => null))) {
      return new Response(JSON.stringify({ error: "Not signed in — sign in again and retry.", code: "not_signed_in" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }
    // SECURITY FIX — the OWNER's own Google refresh_token used to have to be
    // sent by the client on every call, meaning it had to live in browser-
    // readable state (app_settings.data) — see migration 0085's comment for
    // the full story. When the caller doesn't supply an explicit
    // refresh_token (an EMPLOYEE refreshing THEIR OWN separately-connected
    // Google account — a distinct per-employee secret they already own —
    // still does, unaffected by this), resolve it server-side instead: the
    // caller's own bearer token identifies their tenant (never a client-
    // claimed ownerId, which anyone could guess/pass to fetch a live Gmail
    // token for an unrelated business), and owner_secrets holds the real
    // refresh_token for that tenant.
    const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!refresh_token) {
      // BUG FIX (integration audit 2026-11-13) — any signed-in EMPLOYEE used
      // to get the owner's live Google access token (full Gmail/Calendar/
      // Drive) here. The business's own Google connection is now limited to
      // the owner or a manager, and always needs a session.
      const caller = await resolveCallerIsOwnerOrManager(callerToken).catch(() => null);
      if (!caller) {
        return new Response(JSON.stringify({ error: callerToken ? "Only the owner or a manager can use the business's Google connection." : "Not signed in — sign in again and retry.", code: callerToken ? "forbidden" : "not_signed_in" }), {
          status: callerToken ? 403 : 401, headers: { "Content-Type": "application/json" },
        });
      }
      if (serviceRoleKey) {
        const secrets = await getOwnerSecrets(caller.ownerId, serviceRoleKey);
        if (secrets?.googleRefreshToken) refresh_token = secrets.googleRefreshToken;
      }
    }
    const clientId = context.env.GOOGLE_CLIENT_ID;
    const clientSecret = context.env.GOOGLE_CLIENT_SECRET;
    if (!refresh_token) {
      return new Response(JSON.stringify({ error: "Missing refresh_token", code: "no_refresh_token" }), {
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
      // invalid_grant = Google itself ended this saved sign-in: revoked, the
      // password changed, or (most common) the OAuth app is still in
      // "Testing" in Google Cloud, where refresh tokens expire after 7 days.
      return new Response(JSON.stringify({ error: data?.error_description || data?.error || `Google token refresh error ${googleRes.status}`, code: data?.error === "invalid_grant" ? "invalid_grant" : (data?.error || "google_error") }), {
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
