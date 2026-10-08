// Alfred Cockpit by text message.
//
// Only two phone numbers can use it: Will (the CrewBoss owner, the account
// the Cockpit belongs to) and the developer (Will's employee). From those
// numbers, text-Alfred can file "this isn't working, please fix it" requests
// on the Cockpit board, answer Claude's questions, approve risky changes,
// make a preview live / discard it / undo it, and check progress — the same
// things the Cockpit page does. functions/api/cockpit-sync.ts texts both
// numbers when Claude needs an answer or finishes.
//
// Everything else they text Alfred about (their customers, jobs, invoices…)
// is ordinary business Alfred, unchanged.
import { getOwnerSecrets } from "./ownerSecrets";

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";
export const COCKPIT_OWNER_EMAIL = "smockspressurewash@gmail.com";

// Last 10 digits → who it is.
export const COCKPIT_PHONES: Record<string, { label: string; isOwner: boolean }> = {
  "7173411794": { label: "Will (the owner)", isOwner: true },
  "2236670555": { label: "the developer (Will's employee)", isOwner: false },
};
const digits10 = (phone?: string) => String(phone || "").replace(/\D/g, "").slice(-10);
export const cockpitSender = (phone?: string) => COCKPIT_PHONES[digits10(phone)] || null;

// The Cockpit belongs to one CrewBoss account. Texts that reach another
// business's Alfred number never get Cockpit tools, even from these phones.
const cockpitOwnerCache = new Map<string, boolean>();
export const isCockpitOwner = async (env: Record<string, string> | undefined, ownerId?: string | null): Promise<boolean> => {
  if (!ownerId || !env?.SUPABASE_SERVICE_ROLE_KEY) return false;
  if (cockpitOwnerCache.has(ownerId)) return cockpitOwnerCache.get(ownerId)!;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(ownerId)}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  }).catch(() => null);
  if (!res?.ok) return false; // not cached: try again next time
  const user: any = await res.json().catch(() => null);
  const ok = String(user?.email || "").toLowerCase() === COCKPIT_OWNER_EMAIL;
  cockpitOwnerCache.set(ownerId, ok);
  return ok;
};
// Who's texting, if it's a Cockpit phone texting the Cockpit owner's Alfred.
export const cockpitSenderFor = async (env: Record<string, string> | undefined, ownerId: string | null | undefined, phone?: string) => {
  const who = cockpitSender(phone);
  return who && (await isCockpitOwner(env, ownerId)) ? who : null;
};

// Exact replies the Cockpit workflow (scripts/cockpit, .claude/commands/cockpit.md) acts on.
const DECISIONS: Record<string, string> = {
  approve: "Yes, go ahead.",
  cancel: "Cancel — don't make this change.",
  make_live: "Make it live for everyone.",
  discard: "Discard this change.",
  undo: "Undo this change.",
};

export const COCKPIT_TOOLS = [
  {
    name: "cockpit_report",
    description: "File a problem or request about the CrewBoss SOFTWARE itself (something broken, wrong, missing, or a new idea for the app) on the Alfred Cockpit board, where Claude fixes it automatically. Use this — not the business tools — when they say things like 'this isn't working in the CRM, fix it', 'can you change how X looks', 'add a feature'. Returns a short #ref they can use in later texts.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short summary, e.g. 'Invoice page cuts off total on iPhone'" },
        details: { type: "string", description: "Everything they said: what they did, what happened, what they expected, which screen" },
        type: { type: "string", enum: ["bug", "idea", "question"] },
      },
      required: ["title", "type"],
    },
  },
  {
    name: "cockpit_status",
    description: "List Cockpit requests and where each one stands (working on it %, waiting for their answer, preview ready, live). Use for 'what's the status', 'is it done yet', 'what are you working on'.",
    input_schema: { type: "object", properties: { includeDone: { type: "boolean", description: "Also list finished ones (last 10)" } } },
  },
  {
    name: "cockpit_reply",
    description: "Send their answer or extra detail to an existing Cockpit request (answers Claude's question, or 'actually you didn't fix it right — …' on a finished one, which reopens it). Identify the request by its #ref, or by words from its title; omit ref to use the most recent request waiting on them.",
    input_schema: {
      type: "object",
      properties: { ref: { type: "string", description: "#ref like #07bb, or words from the title" }, message: { type: "string" } },
      required: ["message"],
    },
  },
  {
    name: "cockpit_decide",
    description: "Act on a Cockpit request: approve a risky change Claude asked about, cancel it, make a preview live for everyone, discard a preview, or undo a change that's live. Confirm with them first if they didn't clearly say which.",
    input_schema: {
      type: "object",
      properties: { ref: { type: "string", description: "#ref or words from the title; omit for the most recent one waiting on them" }, decision: { type: "string", enum: Object.keys(DECISIONS) } },
      required: ["decision"],
    },
  },
];

export const cockpitPrompt = (sender: { label: string; isOwner: boolean }) => `

ALFRED COCKPIT (you're texting with ${sender.label}): besides normal business help, this person can get the CrewBoss APP ITSELF fixed or changed through the Alfred Cockpit, where Claude (the AI developer) works on it automatically. Decide which they mean:
- About the app (something broken, wrong, slow, missing, "fix this in the CRM", a new feature, change how a screen looks) → cockpit_report. Reply that it's filed with its #ref and Claude is starting on it; they'll get a text when Claude has a question, a preview to try, or it's live.
- About their business data (customers, jobs, invoices, schedule…) → your normal tools, as usual.
- If unclear, ask one short question: "Is that a problem with the app itself, or something about your business data?"
- "Status?", "is it done?" → cockpit_status. Answers to Claude's questions or more detail → cockpit_reply. "Yes go ahead", "make it live", "discard", "undo", "cancel" about a Cockpit item → cockpit_decide (with the #ref if they gave one; otherwise the most recent item waiting on them).
- "It's still broken" / "you didn't fix it right" about a finished item → cockpit_reply (it reopens it).
Always include the #ref when you mention a Cockpit item. If they give a #ref you can't find, say so and list the open ones (cockpit_status) — never act on a different item.
WHO THIS IS: ${sender.isOwner ? "Will, the owner." : "the developer who builds CrewBoss for Will — NOT Will. Wherever the instructions above say \"the owner\", this conversation is with the developer instead: don't call them Will, and don't save standing preferences or change Alfred's settings for Will on their say-so. They may act on Cockpit items; preview sign-in links only go to Will."} Will and the developer each have their own separate text thread with you.`;

const sb = (env: Record<string, string>, path: string, init?: RequestInit) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });

export const refOf = (id: string) => "#" + String(id).slice(0, 4);
const NL2 = "\n\n";
const lastNote = (notes: string) => String(notes || "").trim().split(NL2).filter(Boolean).slice(-1)[0] || "";
const stripStamp = (s: string) => s.replace(/^\[[^\]]*\]\s*/, "");
const stamp = () => new Date().toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const describe = (it: any) => {
  const last = stripStamp(lastNote(it.claude_notes));
  if (it.status === "done") return /^LIVE:/.test(last) ? "live" : "done";
  if (it.status === "backlog") return "queued";
  if (/^You:/.test(last)) return "Claude will pick up your reply";
  if (/^APPROVAL NEEDED:/.test(last)) return "needs your OK";
  if (/^QUESTION:/.test(last) || /\?\s*$/.test(last)) return "waiting for your answer";
  if (/^PREVIEW READY:/.test(last)) return "preview ready to try";
  return typeof it.progress === "number" ? `working on it (${it.progress}%${it.progress_label ? " — " + it.progress_label : ""})` : `working on it${it.progress_label ? " — " + it.progress_label : ""}`;
};

const findItem = async (env: Record<string, string>, ownerId: string, ref?: string) => {
  const res = await sb(env, `cockpit_items?owner_id=eq.${encodeURIComponent(ownerId)}&select=*&order=updated_at.desc&limit=100`);
  const items: any[] = await res.json().catch(() => []);
  if (!Array.isArray(items) || !items.length) return null;
  const r = String(ref || "").trim().toLowerCase().replace(/^#/, "");
  if (r) {
    const byId = items.filter(i => i.id.toLowerCase().startsWith(r));
    if (byId.length === 1) return byId[0];
    const words = r.split(/\s+/).filter(w => w.length > 2);
    const byTitle = items.filter(i => words.length && words.every(w => String(i.title).toLowerCase().includes(w)));
    if (byTitle.length) return byTitle[0];
    // They named a request we can't find: never fall back to a different
    // one (a "make live #zzzz" must not publish some other change).
    return null;
  }
  // Most recent item waiting on them, then most recent open item.
  const waiting = items.find(i => i.status === "in_progress" && /^(APPROVAL NEEDED|QUESTION|PREVIEW READY):/.test(stripStamp(lastNote(i.claude_notes))));
  return waiting || items.find(i => i.status !== "done") || null;
};

// Start the Cockpit worker now (same as the Cockpit page does).
const wake = async (env: Record<string, string>) => {
  if (!env.GITHUB_DISPATCH_TOKEN) return false;
  const gh = await fetch("https://api.github.com/repos/smockspressurewash-create/smocks-crm/actions/workflows/cockpit.yml/dispatches", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "crewboss-cockpit", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "master" }),
  }).catch(() => null);
  return !!gh?.ok;
};

const appendOwnerReply = async (env: Record<string, string>, item: any, message: string, senderLabel: string, isDecision = false) => {
  // Button-style decisions must stay exactly as the workflow expects them.
  const from = isDecision || senderLabel.startsWith("Will") ? "" : " (from the developer, by text)";
  const notes = (String(item.claude_notes || "").trim() ? String(item.claude_notes).trim() + NL2 : "") + `[${stamp()}] You: ${message}${from}`;
  const res = await sb(env, `cockpit_items?id=eq.${encodeURIComponent(item.id)}&select=id`, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ claude_notes: notes, status: "in_progress", progress: null, progress_label: "Waiting for Claude to pick this up", updated_at: new Date().toISOString() }),
  });
  const rows = await res.json().catch(() => []);
  return res.ok && Array.isArray(rows) && rows.length > 0;
};

export const runCockpitTool = async (env: Record<string, string>, ownerId: string | null, sender: { label: string; isOwner: boolean } | null, name: string, input: Record<string, any>): Promise<any> => {
  if (!sender) return { error: "The Alfred Cockpit is only available from Will's and the developer's phones." };
  if (!ownerId || !env.SUPABASE_SERVICE_ROLE_KEY) return { error: "Cockpit isn't available right now (server setup)." };
  if (!(await isCockpitOwner(env, ownerId))) return { error: "The Alfred Cockpit isn't available on this business's number." };

  if (name === "cockpit_report") {
    const id = crypto.randomUUID();
    const type = ["bug", "idea", "question"].includes(input.type) ? input.type : "bug";
    const description = [String(input.details || "").trim(), sender.isOwner ? "" : "(Reported by text by the developer.)"].filter(Boolean).join("\n\n");
    const res = await sb(env, "cockpit_items", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ id, owner_id: ownerId, title: String(input.title || "Request").slice(0, 140), description, type, status: "backlog", claude_notes: "" }) });
    if (!res.ok) return { error: "Couldn't file it on the Cockpit — " + (await res.text().catch(() => "")).slice(0, 160) };
    const woke = await wake(env);
    return { success: true, ref: refOf(id), title: input.title, startedNow: woke, note: woke ? "Claude is starting on it now." : "Claude couldn't be started right away; it'll be picked up at the next scheduled check (GitHub can delay those by hours). Opening the Cockpit page and tapping Nudge starts it now." };
  }

  if (name === "cockpit_status") {
    const res = await sb(env, `cockpit_items?owner_id=eq.${encodeURIComponent(ownerId)}&select=*&order=updated_at.desc&limit=50`);
    const items: any[] = await res.json().catch(() => []);
    const open = items.filter(i => i.status !== "done");
    const done = input.includeDone ? items.filter(i => i.status === "done").slice(0, 10) : [];
    return { success: true, open: open.map(i => ({ ref: refOf(i.id), title: i.title, state: describe(i), lastNote: stripStamp(lastNote(i.claude_notes)).slice(0, 200) })), ...(done.length ? { done: done.map(i => ({ ref: refOf(i.id), title: i.title, state: describe(i) })) } : {}) };
  }

  if (name === "cockpit_reply" || name === "cockpit_decide") {
    const item = await findItem(env, ownerId, input.ref);
    if (!item) return { error: "Couldn't find that Cockpit request — ask them for the #ref, or use cockpit_status." };
    let message = "";
    if (name === "cockpit_reply") {
      message = String(input.message || "").trim();
      if (!message) return { error: "No message to send." };
      if (item.status === "done") message = "Not fixed yet: " + message;
    } else {
      message = DECISIONS[input.decision];
      if (!message) return { error: "Unknown decision." };
      if (input.decision === "make_live" && !/PREVIEW READY:/.test(String(item.claude_notes))) return { error: `${refOf(item.id)} doesn't have a preview to make live yet (${describe(item)}).` };
      if (input.decision === "undo" && !/\]\s*LIVE:/.test(String(item.claude_notes))) return { error: `${refOf(item.id)} isn't live, so there's nothing to undo.` };
    }
    if (!(await appendOwnerReply(env, item, message, sender.label, name === "cockpit_decide"))) return { error: "Couldn't update the Cockpit request." };
    const woke = await wake(env);
    return { success: true, ref: refOf(item.id), title: item.title, sent: message, startedNow: woke };
  }
  return { error: "Unknown Cockpit tool." };
};

// ── Outbound: text both Cockpit phones when Claude needs them or finishes ──
const sendTwilio = async (sid: string, token: string, from: string, to: string, body: string) => {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${sid}:${token}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  }).catch(() => null);
  return !!res?.ok;
};

// One-time sign-in link to the preview (Will only — it signs in as him).
const previewLoginLink = async (env: Record<string, string>, previewUrl: string) => {
  const m = String(previewUrl || "").match(/^(https:\/\/[a-z0-9-]+\.smocks-crm\.pages\.dev)\/?(?:#\/?([A-Za-z0-9\/_?=&.-]*))?$/);
  if (!m) return "";
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email: COCKPIT_OWNER_EMAIL, redirect_to: m[1] + "/" }),
  }).catch(() => null);
  const data: any = res ? await res.json().catch(() => null) : null;
  const hashed = data?.hashed_token || data?.properties?.hashed_token;
  return hashed ? `${m[1]}/?th=${encodeURIComponent(hashed)}${m[2] ? "&go=" + encodeURIComponent(m[2]) : ""}` : "";
};

export const textCockpitPhones = async (env: Record<string, string>, ownerId: string, item: { id: string; title: string; preview_url?: string | null }, headline: string, text: string, marker?: string) => {
  const secrets = await getOwnerSecrets(ownerId, env.SUPABASE_SERVICE_ROLE_KEY).catch(() => null);
  if (!secrets?.twilioAccountSid || !secrets?.twilioAuthToken || !secrets?.twilioFromNumber) return;
  const ref = refOf(item.id);
  const how = marker === "APPROVAL NEEDED" ? `Reply "yes ${ref}" to go ahead or "cancel ${ref}".`
    : marker === "PREVIEW READY" ? `Reply "make live ${ref}" or "discard ${ref}".`
    : marker === "QUESTION" ? `Reply with your answer (mention ${ref}).`
    : marker === "LIVE" ? `Reply "undo ${ref}" to put it back, or tell me if it's not right.`
    : "";
  const body0 = `Alfred Cockpit ${ref} · ${headline}: ${item.title}\n${text.replace(/^(APPROVAL NEEDED|PREVIEW READY|QUESTION|LIVE):\s*/, "").slice(0, 600)}`;
  for (const [digits, who] of Object.entries(COCKPIT_PHONES)) {
    let body = body0;
    if (marker === "PREVIEW READY" && item.preview_url) {
      const link = who.isOwner ? (await previewLoginLink(env, item.preview_url)) || item.preview_url : item.preview_url;
      body += `\nTry it: ${link}${who.isOwner ? "" : " (sign in with Will's login, or ask him to check)"}`;
    }
    if (how) body += `\n${how}`;
    body = body.slice(0, 1500);
    const to = "+1" + digits;
    if (await sendTwilio(secrets.twilioAccountSid, secrets.twilioAuthToken, secrets.twilioFromNumber, to, body)) {
      await rememberSent(env, ownerId, to, body).catch(() => {});
    }
  }
};

// Put the Cockpit text into that phone's Alfred conversation (so a reply
// like "yes" or "make it live" has context) and into the Inbox.
const rememberSent = async (env: Record<string, string>, ownerId: string, phone: string, body: string) => {
  const q = `alfred_sms_threads?owner_id=eq.${encodeURIComponent(ownerId)}&phone=eq.${encodeURIComponent(phone)}`;
  const rows: any[] = await (await sb(env, `${q}&select=messages&limit=1`)).json().catch(() => []);
  const msg = { role: "assistant", content: body, ts: Date.now() };
  if (Array.isArray(rows) && rows.length) {
    const messages = [...(Array.isArray(rows[0].messages) ? rows[0].messages : []), msg];
    await sb(env, q, { method: "PATCH", body: JSON.stringify({ messages, updated_at: new Date().toISOString() }) });
  } else {
    await sb(env, "alfred_sms_threads", { method: "POST", body: JSON.stringify({ owner_id: ownerId, phone, messages: [msg], updated_at: new Date().toISOString() }) });
  }
  await sb(env, "rpc/find_or_create_inbox_thread", {
    method: "POST",
    body: JSON.stringify({ p_owner_id: ownerId, p_channel: "sms", p_contact_phone: phone, p_contact_name: COCKPIT_PHONES[digits10(phone)]?.isOwner ? "You" : "Developer", p_customer_id: null, p_message: { id: crypto.randomUUID(), dir: "out", body, ts: Date.now(), via: "alfred" }, p_unread: false }),
  });
};
