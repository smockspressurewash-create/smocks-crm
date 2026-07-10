import { supabase } from "./supabase";
import { uid } from "./utils";

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

export interface EmailSettings {
  resendKey?: string;
  fromEmail?: string;
  fromName?: string;
}

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
    throw new Error("Twilio not configured — add SID, Token, and phone in Settings.");
  }

  const from = channel === "whatsapp" ? `whatsapp:${twilioPhone}` : twilioPhone;
  const toNum = channel === "whatsapp" ? `whatsapp:${to}` : to;

  // Try backend proxy first (avoids CORS in browser)
  if (twilioBackendUrl) {
    const res = await fetch(`${twilioBackendUrl}/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: toNum, from, body }),
    });
    if (!res.ok) throw new Error(`SMS proxy error: ${res.status}`);
    return;
  }

  // Direct Twilio API (works if CORS is allowed)
  const formData = new URLSearchParams({ To: toNum, From: from, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Twilio error ${res.status}`);
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
    const res = await fetch(`${twilioBackendUrl}/sms/incoming?since=${since}`);
    if (!res.ok) return [];
    return res.json();
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json?DateSent>=${since}&Direction=inbound&PageSize=50`;
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}` },
  });
  if (!res.ok) return [];
  const data = await res.json() as { messages?: TwilioMessage[] };
  return data.messages ?? [];
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
export const sendViaGmail = async (
  googleProviderToken: string,
  fromEmail: string,
  to: string,
  subject: string,
  html: string
): Promise<void> => {
  let res = await sendGmailRaw(googleProviderToken, fromEmail, to, subject, html);
  if (res.status === 401) {
    // refreshSession()'s own return value often omits provider_token even when
    // the refresh succeeded (a known Supabase SDK quirk) — getSession() right
    // after tends to reflect the token the SIGNED_IN/TOKEN_REFRESHED listener
    // in App.tsx just wrote, so check both instead of trusting one.
    const { data: refreshed } = await supabase.auth.refreshSession();
    let freshToken = (refreshed.session as any)?.provider_token;
    if (!freshToken) {
      const { data: current } = await supabase.auth.getSession();
      freshToken = (current.session as any)?.provider_token;
    }
    if (freshToken) {
      res = await sendGmailRaw(freshToken, fromEmail, to, subject, html);
    }
    if (res.status === 401) {
      throw new Error("Google sign-in expired — reconnect Gmail in Settings → Integrations.");
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
  settings: { googleConnected?: boolean; googleProviderToken?: string; googleEmail?: string },
  to: string,
  subject: string,
  html: string
): Promise<void> => {
  if (!settings.googleConnected || !settings.googleProviderToken || !settings.googleEmail) {
    throw new Error("Gmail not connected — connect Google in Settings → Integrations to send email.");
  }
  await sendViaGmail(settings.googleProviderToken, settings.googleEmail, to, subject, html);
};

// ─── Email via Resend ─────────────────────────────────────────────────────────

export const sendEmail = async (
  settings: EmailSettings & { resendBackendUrl?: string; googleConnected?: boolean; googleProviderToken?: string; googleEmail?: string; ownerName?: string; myEmail?: string },
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
  const { resendKey, fromEmail, resendBackendUrl } = settings;
  // The owner's name/email from Settings → My Profile takes priority as the
  // visible sender and reply target — falls back to the generic company name
  // when the owner hasn't filled in their profile yet.
  const fromName = settings.fromName ?? settings.ownerName;
  const replyTo = settings.myEmail || undefined;

  // Try Gmail first if owner has connected Google account
  if (settings.googleProviderToken && settings.googleEmail) {
    try {
      await sendViaGmail(settings.googleProviderToken, settings.googleEmail, to, subj, body);
      return;
    } catch {
      // Fall through to Resend
    }
  }

  // Via backend proxy
  if (resendBackendUrl) {
    const res = await fetch(`${resendBackendUrl}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject: subj, html: body, from: `${fromName ?? "Crew Boss"} <${fromEmail ?? "noreply@smocks.com"}>`, replyTo }),
    });
    if (!res.ok) throw new Error(`Email proxy error: ${res.status}`);
    return;
  }

  if (!resendKey) throw new Error("Resend API key not configured.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: `${fromName ?? "Crew Boss"} <${fromEmail ?? "noreply@smocks.com"}>`,
      to: [to],
      subject: subj,
      html: body,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Resend error ${res.status}`);
  }
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
