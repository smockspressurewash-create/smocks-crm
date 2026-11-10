// sendReport.ts — what happened when a quote / invoice was sent, in words.
//
// FEATURE (owner report) — "when I tried sending an estimate/quote, it said
// sending and didn't indicate whether it failed ... it never did send to my
// customer." Every send of a customer document now ends in a report window
// (SendReportHost.tsx): one row per channel (email, text) that says sent or
// failed, a one-line reason a business owner can act on ("Twilio is out of
// credit"), a "Full details" drop-down with the raw facts, and always the
// customer's link with a Copy button, so the owner can paste it to the
// customer themselves when email or texting is down.

export type SendChannel = "email" | "sms";

export interface SendResult {
  channel: SendChannel;
  ok: boolean;
  // Sent nothing on purpose (test mode, no email on file...): shown in yellow.
  skipped?: boolean;
  to?: string;
  summary: string;
  details?: string;
}

export interface SendReport {
  title: string;
  customerName?: string;
  link?: string;
  linkLabel?: string;
  // Ready-to-paste message that includes the link.
  shareText?: string;
  results: SendResult[];
}

const EVENT = "crewboss:send-report";

export const showSendReport = (r: SendReport) => {
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: r })); } catch { /* no window */ }
};
export const onSendReport = (fn: (r: SendReport) => void) => {
  const h = (e: Event) => fn((e as CustomEvent).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
};

const TWILIO_CODES: Record<number, string> = {
  20003: "Twilio rejected your login: the Account SID or Auth Token is wrong. Fix them in Settings → Integrations.",
  20005: "Your Twilio account is suspended or closed. Log in to twilio.com to see why.",
  20404: "Twilio couldn't find your account. The Account SID in Settings → Integrations is wrong (it must start with AC).",
  20429: "Twilio is getting too many texts at once. Wait a minute and try again.",
  21211: "The customer's phone number isn't a valid number. Fix it on their customer card.",
  21212: "Your Twilio 'From' number isn't valid. Check it in Settings → Integrations.",
  21408: "Your Twilio account isn't allowed to text this country.",
  21606: "Your Twilio 'From' number can't send texts. Pick an SMS number in Settings → Integrations.",
  21608: "Your Twilio account is still a trial: it can only text numbers you verified. Upgrade Twilio or verify this number.",
  21610: "The customer replied STOP, so texts to them are blocked.",
  21612: "Twilio can't text this number from your 'From' number.",
  21614: "That number can't get texts (it looks like a landline).",
  21659: "Your Twilio 'From' number doesn't belong to your Twilio account. Check it in Settings → Integrations.",
  30001: "Twilio's queue is full. Try again in a few minutes.",
  30002: "Your Twilio account is suspended. Log in to twilio.com to fix it.",
  30003: "The customer's phone was off or out of service.",
  30004: "The customer's phone blocked the text.",
  30005: "The customer's number doesn't exist or isn't active.",
  30006: "That number can't get texts (landline or unreachable carrier).",
  30007: "The phone carrier blocked the text as spam.",
  30008: "The phone carrier failed to deliver it (unknown error). Try again later.",
  30032: "Your toll-free number isn't verified yet, so carriers block its texts. Finish toll-free verification in Twilio.",
  30034: "Your Twilio number isn't registered for US business texting (A2P 10DLC). Carriers block these texts until Twilio approves the registration.",
  30035: "Your toll-free number's verification is still pending, so carriers block its texts.",
  30036: "Your toll-free number's verification was rejected. Fix it in Twilio.",
};

const lines = (o: Record<string, any>) =>
  Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n");

const balanceIsEmpty = (b?: string) => { const n = parseFloat(String(b || "")); return Number.isFinite(n) && n <= 0; };

// One plain-English reason plus every raw fact, for a failed send.
export const explainSendError = (channel: SendChannel, err: any): { summary: string; details: string } => {
  const msg = String(err?.message || err || "Unknown error");
  const info: Record<string, any> = err?.info || {};
  const code = Number(info.code) || undefined;
  const details = lines({ error: msg, time: new Date().toLocaleString(), ...info });
  const m = msg.toLowerCase();
  if (channel === "sms") {
    if (balanceIsEmpty(info.balance) || /insufficient|out of (credit|funds)|balance/.test(m)) return { summary: `Twilio is out of credit (balance ${info.balance || "0"}). Add funds in your Twilio console, then send again.`, details };
    if (code && TWILIO_CODES[code]) return { summary: TWILIO_CODES[code], details };
    if (/not configured/.test(m)) return { summary: "Texting isn't set up. Add your Twilio Account SID, Auth Token and From number in Settings → Integrations.", details };
    if (/not authenticated/.test(m)) return { summary: "Your CrewBoss sign-in timed out before the text went out. Refresh the page and try again.", details };
    if (/opted out|stop/.test(m)) return { summary: TWILIO_CODES[21610], details };
    if (/invalid phone|not a valid phone/.test(m)) return { summary: TWILIO_CODES[21211], details };
    if (/timed out/.test(m)) return { summary: "Twilio didn't answer in time. Check the Inbox or your Twilio log before sending again, so the customer doesn't get it twice.", details };
    if (/couldn't reach|failed to fetch|network/.test(m)) return { summary: "No connection to the text server. Check your internet and try again.", details };
    if (info.httpStatus === 404 || /starts with/.test(m)) return { summary: TWILIO_CODES[20404], details };
    if (info.httpStatus === 401) return { summary: TWILIO_CODES[20003], details };
    return { summary: "Twilio refused the text: " + msg, details };
  }
  if (/test mode/.test(m)) return { summary: msg, details };
  if (/not connected/.test(m)) return { summary: "Email isn't set up. Connect Google in Settings → Integrations to send email.", details };
  if (/expired|reconnect|unavailable|invalid_grant|invalid credentials/.test(m) || info.httpStatus === 401) return { summary: "Your Google connection expired. Reconnect Google in Settings → Integrations, then send again.", details };
  if (/insufficient|scope|permission/.test(m) || info.httpStatus === 403) return { summary: "Google is connected without permission to send email. Reconnect Google and allow sending email.", details };
  if (/limit|quota|rate/.test(m) || info.httpStatus === 429) return { summary: "Gmail's daily sending limit is reached. Try again tomorrow or send the link yourself.", details };
  if (/invalid to|recipient|address/.test(m) || info.httpStatus === 400) return { summary: "Gmail rejected the customer's email address. Check it on their customer card.", details };
  if (/timed out/.test(m)) return { summary: "Gmail didn't answer in time. Check your Gmail Sent folder before sending again.", details };
  if (/failed to fetch|network/.test(m)) return { summary: "No connection to Gmail. Check your internet and try again.", details };
  return { summary: "Gmail refused the email: " + msg, details };
};

export const okResult = (channel: SendChannel, to: string, info?: { testMode?: boolean; sid?: string; status?: string }): SendResult =>
  info?.testMode
    ? { channel, ok: false, skipped: true, to, summary: "Not sent: this customer is a test client and test mode is on.", details: lines({ to, testMode: true }) }
    : {
        channel, ok: true, to,
        summary: channel === "sms"
          ? (info?.status === "delivered" ? "Text delivered." : "Twilio accepted the text" + (info?.status ? ` (status: ${info.status})` : "") + ".")
          : "Email sent from your Gmail.",
        details: lines({ to, messageSid: info?.sid, status: info?.status, time: new Date().toLocaleString() }),
      };

export const failResult = (channel: SendChannel, to: string | undefined, err: any): SendResult => ({ channel, ok: false, to, ...explainSendError(channel, err) });

export const skipResult = (channel: SendChannel, summary: string): SendResult => ({ channel, ok: false, skipped: true, summary });
