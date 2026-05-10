// ===== MESSAGING LAYER (Twilio SMS + Email) =====
import { sendGmailEmail } from './google';

// SMS via Twilio — proxied through the backend to avoid CORS
export const twilioSend = async (settings: any, to: string, body: string, channel = "sms") => {
  const { twilioSid, twilioToken, twilioFrom, twilioWhatsAppFrom, googleBackendUrl } = settings;
  const fromNum = channel === "whatsapp" ? (twilioWhatsAppFrom || "whatsapp:" + twilioFrom) : twilioFrom;
  const toNum = channel === "whatsapp" ? (to.startsWith("whatsapp:") ? to : "whatsapp:" + to) : to;
  if (googleBackendUrl && settings.googleToken) {
    const res = await fetch(googleBackendUrl.replace(/\/$/, "") + "/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + settings.googleToken },
      body: JSON.stringify({ to: toNum, body, from: fromNum, channel })
    });
    if (!res.ok) throw new Error("SMS failed: " + (await res.text().catch(() => res.status)));
    return res.json();
  }
  if (!twilioSid || !twilioToken || !twilioFrom) throw new Error("Twilio not configured — add SID, Token, From number in Settings");
  const params = new URLSearchParams({ To: toNum, From: fromNum, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": "Basic " + btoa(twilioSid + ":" + twilioToken) },
    body: params
  });
  if (!res.ok) throw new Error("Twilio " + res.status + ": " + (await res.text().catch(() => "")));
  return res.json();
};

// Email via Gmail backend or Resend fallback
export const sendEmail = async (settings: any, { to, subject, body, fromName }: any) => {
  const { googleBackendUrl, googleToken, googleConnected, googleScopes, resendKey, companyEmail, companyName } = settings;
  if (googleConnected && googleScopes?.gmail && googleBackendUrl && googleToken) {
    return sendGmailEmail(googleBackendUrl, googleToken, { to, subject, body });
  }
  if (resendKey) {
    const from = fromName || companyName || "Smock's Pressure Washing";
    const fromEmail = companyEmail || "noreply@smocks.com";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + resendKey },
      body: JSON.stringify({ from: from + " <" + fromEmail + ">", to, subject, text: body })
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as any).message || "Resend failed: " + res.status); }
    return { sent: true, provider: "resend" };
  }
  throw new Error("No email provider configured — connect Gmail (Settings → Integrations → Google) or add a Resend API key");
};

// Poll Twilio for incoming messages
export const pollTwilioIncoming = async (settings: any, sinceTs?: number) => {
  const { googleBackendUrl, googleToken } = settings;
  if (googleBackendUrl && googleToken) {
    try {
      const res = await fetch(googleBackendUrl.replace(/\/$/, "") + "/api/sms/incoming?since=" + (sinceTs || 0), { headers: { "Authorization": "Bearer " + googleToken } });
      if (res.ok) return (await res.json()).messages || [];
    } catch { /* fall through */ }
  }
  return [];
};
