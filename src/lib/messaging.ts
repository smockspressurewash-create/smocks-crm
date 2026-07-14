import { supabase } from "./supabase";
import { uid, withTimeout } from "./utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TwilioSettings {
  twilioSid?: string;
  twilioToken?: string;
  // FIX 13 — Settings → Integrations (and every "is Twilio configured?" check
  // elsewhere: InboxPage, CampaignsPage) reads/writes the From number under
  // `twilioFrom`. This field was still called `twilioPhone` here, which meant
  // the owner could see a green "Configured ✓" badge in Settings while every
  // actual twilioSend() call threw "Twilio not configured" — the number it
  // was checking was never the field being filled in. Keeping twilioPhone as
  // a fallback in case anything still constructs a settings object with the
  // old name directly.
  twilioFrom?: string;
  twilioPhone?: string;
  twilioBackendUrl?: string;
  myPhone?: string;
}

export interface EmailSettings {}

// ─── Buffer (social posting) ────────────────────────────────────────────────
// Buffer retired its old REST API (api.bufferapp.com/1/...) in favor of a
// GraphQL API at api.buffer.com, authenticated with a Bearer API key from
// https://publish.buffer.com/settings/api (see developers.buffer.com). This
// is a best-effort direct browser call exactly like the Twilio direct-API
// path below — the caller is expected to catch failures and fall back to
// the manual copy/share flow when CORS or permissions block it.
const BUFFER_GRAPHQL_URL = "https://api.buffer.com";

export interface BufferSettings {
  bufferApiKey?: string;
  bufferOrganizationId?: string;
  bufferChannelIds?: Record<string, string>;
}

const bufferGraphQL = async <T = any>(apiKey: string, query: string, variables: Record<string, unknown>): Promise<T> => {
  const res = await fetch(BUFFER_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message ?? `Buffer error ${res.status}`);
  }
  return json.data as T;
};

export interface BufferChannel {
  id: string;
  name: string;
  displayName: string;
  service: string;
  avatar?: string;
}

// Buffer's GraphQL schema scopes channels to an Organization — fetch the
// account's first/only org automatically so the user only has to paste an
// API key, not hunt down an org ID.
export const fetchBufferOrganizationId = async (apiKey: string): Promise<string | null> => {
  const data = await bufferGraphQL<{ account: { organizations: { id: string }[] } }>(
    apiKey,
    `query { account { organizations { id } } }`,
    {}
  );
  return data?.account?.organizations?.[0]?.id ?? null;
};

export const fetchBufferChannels = async (apiKey: string, organizationId: string): Promise<BufferChannel[]> => {
  const data = await bufferGraphQL<{ channels: BufferChannel[] }>(
    apiKey,
    `query GetChannels($organizationId: String!) { channels(input: { organizationId: $organizationId }) { id name displayName service avatar } }`,
    { organizationId }
  );
  return data?.channels ?? [];
};

export const postToBuffer = async (
  settings: BufferSettings,
  platform: string,
  text: string,
  scheduledAt?: Date
): Promise<void> => {
  const { bufferApiKey, bufferChannelIds } = settings;
  const channelId = bufferChannelIds?.[platform];
  if (!bufferApiKey || !channelId) {
    throw new Error("Buffer not connected for this platform — add an API key and pick a channel in Settings.");
  }
  const data = await bufferGraphQL<{ createPost: { __typename: string; message?: string } }>(
    bufferApiKey,
    `mutation CreatePost($text: String!, $channelId: String!, $schedulingType: PostSchedulingTypeInput!, $mode: PostCreationModeInput!) {
      createPost(input: { text: $text, channelId: $channelId, schedulingType: $schedulingType, mode: $mode }) {
        ... on PostActionSuccess { post { id } }
        ... on MutationError { message }
      }
    }`,
    {
      text, channelId,
      schedulingType: scheduledAt ? "automatic" : "notification",
      mode: scheduledAt ? "addToQueue" : "shareNow",
    }
  );
  if (data?.createPost?.message) throw new Error(data.createPost.message);
};

// ─── Twilio SMS / WhatsApp ────────────────────────────────────────────────────

export const twilioSend = async (
  settings: TwilioSettings,
  to: string,
  body: string,
  channel: "sms" | "whatsapp" = "sms"
): Promise<void> => {
  const { twilioSid, twilioToken, twilioBackendUrl } = settings;
  const twilioPhone = settings.twilioFrom || settings.twilioPhone;
  if (!twilioSid || !twilioToken || !twilioPhone) {
    throw new Error("Twilio not configured — add Account SID, Auth Token, and From number in Settings → Integrations.");
  }

  const from = channel === "whatsapp" ? `whatsapp:${twilioPhone}` : twilioPhone;
  const toNum = channel === "whatsapp" ? `whatsapp:${to}` : to;

  // AUDIT 6 — Twilio's REST API never returns CORS headers for browser-origin
  // requests, so a direct fetch() from here to api.twilio.com always fails
  // (opaque network error, not even a readable HTTP status) no matter how
  // correct the SID/Token/From are — this was the actual reason SMS sending
  // silently did nothing across the whole app. Route through this project's
  // own same-origin Cloudflare Pages Function (functions/api/twilio-send.ts)
  // by default; an explicitly configured twilioBackendUrl (self-hosted proxy)
  // still takes priority if the owner has one.
  const endpoint = twilioBackendUrl ? `${twilioBackendUrl}/sms` : "/api/twilio-send";
  const payload = twilioBackendUrl
    ? { to: toNum, from, body }
    : { sid: twilioSid, token: twilioToken, to: toNum, from, body };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    console.error("[Twilio] send failed:", data?.error || res.status);
    throw new Error(data?.error || `Twilio error ${res.status}`);
  }
};

// ─── Inbox sync (SMS) ─────────────────────────────────────────────────────────
// Every outbound SMS sent from anywhere in the app (owner's own Inbox compose,
// or an employee's OTW/Running Late/invoice-text from the field portal) needs
// to show up in the owner's Inbox, on every device. The Inbox itself stores
// each conversation as one row in `inbox_threads` with its message list in a
// single JSONB column (mirrors how `jobs` already stores arrays like `photos`
// as JSONB) rather than a normalized messages table — simplest schema that
// still lets InboxPage read/poll it like any other synced table. Degrades to
// a no-op (logged, not thrown) if the table doesn't exist yet so a missing
// migration never breaks the actual SMS send.
export interface InboxSyncMessage {
  id: string;
  dir: "in" | "out";
  body: string;
  ts: number;
  status?: "sending" | "sent" | "failed";
  subject?: string;
}

export const logOutboundSmsToInbox = async (
  opts: { contactName: string; contactPhone: string; customerId?: string | null; body: string }
): Promise<void> => {
  try {
    const normPhone = (p: string) => (p || "").replace(/\D/g, "");
    const { data, error } = await (supabase as any).from("inbox_threads").select("*").eq("channel", "sms");
    if (error) { console.warn("[Inbox Sync] inbox_threads unavailable — run the inbox_threads SQL:", error.message); return; }
    const rows: any[] = Array.isArray(data) ? data : [];
    const existing = rows.find(r => normPhone(r.contact_phone) === normPhone(opts.contactPhone) && normPhone(opts.contactPhone));
    const newMsg: InboxSyncMessage = { id: uid(), dir: "out", body: opts.body, ts: Date.now(), status: "sent" };
    if (existing) {
      const messages = [...(Array.isArray(existing.messages) ? existing.messages : []), newMsg];
      await (supabase as any).from("inbox_threads").update({ messages, unread: false, last_message_at: newMsg.ts, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await (supabase as any).from("inbox_threads").insert({
        id: uid(), channel: "sms", contact_name: opts.contactName, contact_phone: opts.contactPhone,
        customer_id: opts.customerId || null, unread: false, messages: [newMsg], last_message_at: newMsg.ts, updated_at: new Date().toISOString(),
      });
    }
  } catch (e: any) {
    console.warn("[Inbox Sync] failed to log outbound SMS:", e?.message);
  }
};

// ─── Twilio incoming poll ─────────────────────────────────────────────────────

export interface TwilioMessage {
  sid: string;
  from: string;
  body: string;
  dateSent: string;
  direction: string;
}

export const pollTwilioIncoming = async (
  settings: TwilioSettings,
  since: string
): Promise<TwilioMessage[]> => {
  const { twilioSid, twilioToken, twilioBackendUrl } = settings;
  if (!twilioSid || !twilioToken) return [];

  if (twilioBackendUrl) {
    try {
      const res = await fetch(`${twilioBackendUrl}/sms/incoming?since=${since}`);
      if (!res.ok) return [];
      return res.json();
    } catch (e: any) {
      console.warn("[Twilio] inbound poll (custom backend) failed:", e?.message);
      return [];
    }
  }

  // AUDIT 6 — same CORS blocker as twilioSend; route through the same-origin
  // Pages Function instead of api.twilio.com directly.
  try {
    const res = await fetch("/api/twilio-inbound", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sid: twilioSid, token: twilioToken, since }),
    });
    if (!res.ok) { console.warn("[Twilio] inbound poll failed:", res.status); return []; }
    const data = await res.json() as { messages?: TwilioMessage[] };
    return data.messages ?? [];
  } catch (e: any) {
    console.warn("[Twilio] inbound poll threw:", e?.message);
    return [];
  }
};

// ─── Email via Gmail API ──────────────────────────────────────────────────────

const sendGmailRaw = async (googleProviderToken: string, fromEmail: string, to: string, subject: string, html: string): Promise<Response> => {
  const mime = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    html,
  ].join("\r\n");

  // base64url encode
  const raw = btoa(unescape(encodeURIComponent(mime)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return fetch(
    "https://www.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${googleProviderToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );
};

// Google access tokens last ~1hr, and this is called from many places across
// the app (not just the Google Workspace settings page), so a stale token is
// the normal case, not the exception. On a 401, ask Supabase to refresh the
// session — Supabase holds Google's refresh token server-side from the
// initial OAuth link, so this works without needing our own backend or the
// OAuth client secret — and retry once before giving up. Without this, every
// Gmail send after the first hour would silently fail and fall through to
// Resend, which is exactly the "everything uses Resend" bug this fixes.
// ITEM 10 — a Google access token can only be refreshed with the client_id
// + client_secret it was issued under (this project's Google Sign-In runs
// through Supabase's own registered OAuth client), so the secret must live
// server-side. functions/api/google-refresh.ts holds it as a Cloudflare env
// var and does the actual token exchange; this just calls that same-origin
// endpoint. Returns null (never throws) so callers can fall back cleanly.
const refreshGoogleAccessToken = async (
  refreshToken: string,
  backendUrl?: string
): Promise<{ token: string; expiresAt: number } | null> => {
  const endpoint = backendUrl ? `${backendUrl}/google/refresh` : "/api/google-refresh";
  try {
    const res = await withTimeout(fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }), 8000, "Google token refresh");
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok || !data?.access_token) {
      console.warn("[GoogleToken] refresh failed:", data?.error || res.status);
      return null;
    }
    return { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3300) * 1000 };
  } catch (e: any) {
    console.warn("[GoogleToken] refresh threw:", e?.message);
    return null;
  }
};

export const sendViaGmail = async (
  googleProviderToken: string,
  fromEmail: string,
  to: string,
  subject: string,
  html: string,
  opts?: { refreshToken?: string; tokenExpiresAt?: number; backendUrl?: string; onTokenRefreshed?: (token: string, expiresAt: number) => void }
): Promise<void> => {
  let activeToken = googleProviderToken;

  // ITEM 10 — proactive refresh: if we know this token is already past (or
  // near) its ~1hr expiry, refresh BEFORE wasting a call that's certain to
  // 401. This is what actually stops "token keeps expiring" from being user
  // visible at all, rather than just reacting faster to the 401 after it
  // already happened.
  if (opts?.refreshToken && opts.tokenExpiresAt && Date.now() > opts.tokenExpiresAt - 2 * 60 * 1000) {
    const refreshed = await refreshGoogleAccessToken(opts.refreshToken, opts.backendUrl);
    if (refreshed) {
      activeToken = refreshed.token;
      opts.onTokenRefreshed?.(refreshed.token, refreshed.expiresAt);
    }
  }

  let res = await sendGmailRaw(activeToken, fromEmail, to, subject, html);
  if (res.status === 401) {
    console.warn("[SendInvoice] Gmail 401 — attempting real Google token refresh");
    let freshToken: string | undefined;
    // ITEM 10 — the REAL fix: redeem the stored Google refresh_token via
    // Google's own token endpoint (through our server-side proxy). This
    // actually works, unlike supabase.auth.refreshSession() below, which
    // only refreshes Supabase's own session JWT — it does not re-authenticate
    // with Google, so the "fresh" provider_token it sometimes returns is
    // usually just the same stale one, or null.
    if (opts?.refreshToken) {
      const refreshed = await refreshGoogleAccessToken(opts.refreshToken, opts.backendUrl);
      if (refreshed) {
        freshToken = refreshed.token;
        opts.onTokenRefreshed?.(refreshed.token, refreshed.expiresAt);
      }
    }
    // Fallback for accounts with no stored refresh_token yet (e.g. connected
    // before this was tracked) — occasionally still turns up a usable token.
    if (!freshToken) {
      console.warn("[GoogleToken] no refresh_token available or refresh failed — falling back to Supabase session refresh (less reliable)");
      try {
        const { data: refreshed } = await withTimeout(supabase.auth.refreshSession(), 6000, "Google session refresh");
        freshToken = (refreshed.session as any)?.provider_token;
        if (!freshToken) {
          const { data: current } = await withTimeout(supabase.auth.getSession(), 4000, "Google session check");
          freshToken = (current.session as any)?.provider_token;
        }
      } catch (refreshErr: any) {
        console.warn("[SendInvoice] session refresh failed or timed out:", refreshErr?.message);
      }
    }
    if (freshToken) {
      res = await sendGmailRaw(freshToken, fromEmail, to, subject, html);
    }
    // ITEM 10 — only surface "reconnect" once BOTH the real refresh_token
    // exchange AND the Supabase-session fallback have failed to produce a
    // token that actually works against Gmail.
    if (res.status === 401) {
      throw new Error("Google token expired — reconnect in Settings → Integrations.");
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Gmail API error ${res.status}`);
  }
};

// Gmail-only send — no Resend fallback, ever. Used by flows that must never
// silently default to Resend (running late, on-my-way, in-portal invoice send):
// throws a clear, actionable error instead of falling through to a provider
// the owner never configured.
export const sendOwnerGmailOnly = async (
  settings: { googleConnected?: boolean; googleProviderToken?: string; googleEmail?: string; googleRefreshToken?: string; googleTokenExpiresAt?: number; googleBackendUrl?: string },
  to: string,
  subject: string,
  html: string
): Promise<void> => {
  if (!settings.googleConnected || !settings.googleProviderToken || !settings.googleEmail) {
    throw new Error("Gmail not connected — connect Google in Settings → Integrations to send email.");
  }
  await sendViaGmail(settings.googleProviderToken, settings.googleEmail, to, subject, html, {
    refreshToken: settings.googleRefreshToken,
    tokenExpiresAt: settings.googleTokenExpiresAt,
    backendUrl: settings.googleBackendUrl,
  });
};

// ─── Email via Gmail (no Resend fallback — removed entirely, FIX 9) ───────────
// This used to fall back to Resend when Gmail wasn't connected or failed.
// Every email in this app now goes through the owner's connected Gmail
// account, full stop — this is functionally identical to sendOwnerGmailOnly,
// kept as a separate export only because many call sites already use the
// (to, subject, body) positional/object-args calling convention this
// function supports.
export const sendEmail = async (
  settings: EmailSettings & { googleConnected?: boolean; googleProviderToken?: string; googleEmail?: string; ownerName?: string; myEmail?: string; googleRefreshToken?: string; googleTokenExpiresAt?: number; googleBackendUrl?: string },
  toOrOpts: string | { to: string; subject: string; body: string; [key: string]: any },
  subject?: string,
  html?: string
): Promise<void> => {
  // Support both positional args and object form
  let to: string;
  let subj: string;
  let body: string;
  if (typeof toOrOpts === "object") {
    to = toOrOpts.to;
    subj = toOrOpts.subject;
    body = toOrOpts.body;
  } else {
    to = toOrOpts;
    subj = subject!;
    body = html!;
  }
  if (!settings.googleProviderToken || !settings.googleEmail) {
    throw new Error("Gmail not connected — connect Google in Settings → Integrations to send email.");
  }
  await sendViaGmail(settings.googleProviderToken, settings.googleEmail, to, subj, body, {
    refreshToken: settings.googleRefreshToken,
    tokenExpiresAt: settings.googleTokenExpiresAt,
    backendUrl: settings.googleBackendUrl,
  });
};

// ─── Branded HTML email shell ──────────────────────────────────────────────────
// One shared shell applied to every outgoing email (job assignments, requests,
// reminders, daily briefings, tomorrow's jobs) so they all look like real,
// mobile-friendly transactional email instead of plain text — branded header,
// readable typography, optional action button, footer. Wrapped in an outer
// table for consistent rendering across email clients (Gmail/Outlook strip
// <style> blocks, so all styling here is inline).
export const emailShell = (companyName: string, title: string, bodyHtml: string): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#0a0a0a;color:#fff;border-radius:16px;overflow:hidden">
      <tr><td style="background:linear-gradient(135deg,#dc2626,#7f1d1d);padding:28px 24px;text-align:center">
        <div style="font-size:21px;font-weight:800;letter-spacing:-0.02em">${companyName}</div>
        <div style="font-size:13px;opacity:0.85;margin-top:4px">${title}</div>
      </td></tr>
      <tr><td style="padding:28px 24px;background:#111;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.85)">${bodyHtml}</td></tr>
      <tr><td style="padding:16px 24px;text-align:center;font-size:11px;color:rgba(255,255,255,0.3);background:#0a0a0a">
        Sent automatically by ${companyName}'s CrewBoss system.
      </td></tr>
    </table>
  </td></tr>
</table>`;

// A pill-style call-to-action button, used for "Open the crew portal" / "View
// estimate" / "Confirm" links so emails read as actionable, not just informative.
export const emailButton = (label: string, href: string): string => `
  <div style="text-align:center;margin:22px 0 4px">
    <a href="${href}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 30px;border-radius:10px">${label}</a>
  </div>`;

const jobCardHtml = (j: any, custName: string): string => `
  <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px;margin-bottom:10px">
    <div style="font-weight:700;font-size:14px">${j.address || ""}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px">${j.scheduledTime ? j.scheduledTime + " · " : ""}${custName}</div>
    ${j.notes ? `<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:6px;font-style:italic">"${j.notes}"</div>` : ""}
  </div>`;

export const buildTomorrowJobsEmailHtml = (companyName: string, empFirstName: string, jobsList: Array<{ job: any; custName: string }>): string => {
  const body = `<p style="font-size:14px;color:rgba(255,255,255,0.8)">Hi ${empFirstName}, here's your schedule for tomorrow:</p>` +
    jobsList.map(({ job, custName }) => jobCardHtml(job, custName)).join("") +
    `<p style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:16px">Open the crew portal for full details, directions, and checklists.</p>`;
  return emailShell(companyName, "Tomorrow's Jobs", body);
};

export const buildDailyBriefingEmailHtml = (companyName: string, stats: { completed: number; total: number; revenue: number; late: number; issues: number }): string => {
  const body = `
    <p style="font-size:14px;color:rgba(255,255,255,0.8)">Here's how today went:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:10px">
      <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:13px">Jobs completed</td><td style="text-align:right;font-weight:700;font-size:13px">${stats.completed} / ${stats.total}</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:13px">Revenue today</td><td style="text-align:right;font-weight:700;font-size:13px;color:#4ade80">$${stats.revenue.toLocaleString()}</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:13px">Late arrivals</td><td style="text-align:right;font-weight:700;font-size:13px;color:${stats.late > 0 ? "#facc15" : "#fff"}">${stats.late}</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:13px">Field notes/issues</td><td style="text-align:right;font-weight:700;font-size:13px;color:${stats.issues > 0 ? "#fb923c" : "#fff"}">${stats.issues}</td></tr>
    </table>`;
  return emailShell(companyName, "Daily Briefing", body);
};
