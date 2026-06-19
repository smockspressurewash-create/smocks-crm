// ─── Types ────────────────────────────────────────────────────────────────────

export interface TwilioSettings {
  twilioSid?: string;
  twilioToken?: string;
  twilioPhone?: string;
  twilioBackendUrl?: string;
  myPhone?: string;
}

export interface EmailSettings {
  resendKey?: string;
  fromEmail?: string;
  fromName?: string;
}

// ─── Twilio SMS / WhatsApp ────────────────────────────────────────────────────

export const twilioSend = async (
  settings: TwilioSettings,
  to: string,
  body: string,
  channel: "sms" | "whatsapp" = "sms"
): Promise<void> => {
  const { twilioSid, twilioToken, twilioPhone, twilioBackendUrl } = settings;
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

const sendViaGmail = async (
  googleProviderToken: string,
  fromEmail: string,
  to: string,
  subject: string,
  html: string
): Promise<void> => {
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

  const res = await fetch(
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Gmail API error ${res.status}`);
  }
};

// ─── Email via Resend ─────────────────────────────────────────────────────────

export const sendEmail = async (
  settings: EmailSettings & { resendBackendUrl?: string; googleConnected?: boolean; googleProviderToken?: string; googleEmail?: string },
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
  const { resendKey, fromEmail, fromName, resendBackendUrl } = settings;

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
      body: JSON.stringify({ to, subject: subj, html: body, from: `${fromName ?? "Smock's"} <${fromEmail ?? "noreply@smocks.com"}>` }),
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
      from: `${fromName ?? "Smock's Pressure Washing"} <${fromEmail ?? "noreply@smocks.com"}>`,
      to: [to],
      subject: subj,
      html: body,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Resend error ${res.status}`);
  }
};
