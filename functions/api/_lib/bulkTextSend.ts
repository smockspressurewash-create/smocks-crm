// Sends an owner-approved bulk text (an owner_records "bulk_text_draft"
// Alfred prepared — see prepare_bulk_text / send_bulk_text in
// alfredSmsAgent.ts) in batches. A long list can't go out inside one text
// conversation's time limit, so whatever doesn't fit is picked up by the
// /api/check-reminders cron on its next run until everyone's been sent.
// Every send re-checks opt-outs, is logged to the owner's Inbox, and the
// matching campaign in the Campaigns page is kept up to date.
import { twilioAccountSid } from "./twilioAccount";
import { recGet, recPut, recListAllOwners } from "./ownerRecords";
import { stripMarkdownForSms } from "./textFormat";

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";

export type BulkRecipient = { n: number; customerId: string; name: string; firstName: string; phone: string; status?: "pending" | "sent" | "failed" | "skipped"; error?: string };
export type BulkDraft = {
  id: string; campaignId?: string; message: string; recipients: BulkRecipient[];
  status: "draft" | "sending" | "sent" | "cancelled"; createdAt: string; approvedAt?: string; approval?: string;
  watchId?: string; sentCount?: number; failedCount?: number; finishedAt?: string;
  leaseId?: string; leaseUntil?: string | null;
};
type Twilio = { sid: string; token: string; from: string };

// BUG FIX (integration audit 2026-11-13) — server-side sends passed the
// phone exactly as stored ("(555) 123-4567", "5551234567"...), which Twilio
// often rejects. Normalize to E.164 the same way src/lib/utils.ts toE164
// does: "+1" for a 10-digit US number; "" when it can't be made valid.
export const toE164 = (raw: string): string => {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? "+" + digits : "";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return "";
};

// BUG FIX (integration audit 2026-11-13) — the same draft could be sent by
// two runners at once (the text conversation that approved it and the
// check-reminders cron), so customers got the text twice. Writes to a draft
// are now conditional: PATCH with a filter and check that a row actually
// came back (Prefer: return=representation). Only the runner whose filter
// still matches wins.
const draftUrl = (ownerId: string, id: string) =>
  `${SUPABASE_URL}/rest/v1/owner_records?owner_id=eq.${encodeURIComponent(ownerId)}&kind=eq.bulk_text_draft&id=eq.${encodeURIComponent(id)}&deleted_at=is.null`;
async function patchDraftIf(authHeaders: Record<string, string>, ownerId: string, draft: BulkDraft, filter: string): Promise<boolean> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(draft)) if (!k.startsWith("_")) clean[k] = v;
  const res = await fetch(`${draftUrl(ownerId, draft.id)}&${filter}`, {
    method: "PATCH", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ data: clean }),
  }).catch(() => null);
  const rows = res && res.ok ? await res.json().catch(() => []) : [];
  return Array.isArray(rows) && rows.length > 0;
}
const leaseFilter = (leaseId?: string) => leaseId ? `data->>leaseId=eq.${encodeURIComponent(leaseId)}` : "data->>leaseId=is.null";

// Moves a draft from "draft" to "sending" only if it's still a draft, so two
// approvals of the same draft can't both start sending.
export async function markDraftSending(authHeaders: Record<string, string>, ownerId: string, draft: BulkDraft): Promise<boolean> {
  return patchDraftIf(authHeaders, ownerId, draft, "data->>status=eq.draft");
}

// Takes the send lease: succeeds only when nobody holds an unexpired lease
// AND the draft hasn't been claimed by anyone since `draft` was read.
async function claimDraft(authHeaders: Record<string, string>, ownerId: string, draft: BulkDraft, deadline: number): Promise<boolean> {
  const prevLease = draft.leaseId;
  const nowIso = new Date().toISOString();
  draft.leaseId = crypto.randomUUID();
  draft.leaseUntil = new Date(Math.max(deadline, Date.now()) + 2 * 60 * 1000).toISOString();
  const ok = await patchDraftIf(authHeaders, ownerId, draft,
    `${leaseFilter(prevLease)}&or=(data->>leaseUntil.is.null,data->>leaseUntil.lt.${encodeURIComponent(`"${nowIso}"`)})`);
  if (!ok) { draft.leaseId = prevLease; }
  return ok;
}

async function logToInbox(authHeaders: Record<string, string>, ownerId: string, to: string, name: string, customerId: string, body: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_or_create_inbox_thread`, {
    method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ p_owner_id: ownerId, p_channel: "sms", p_contact_phone: to, p_contact_name: name || to, p_customer_id: customerId || null, p_message: { id: crypto.randomUUID(), dir: "out", body, ts: Date.now(), via: "alfred" }, p_unread: false }),
  }).catch(() => {});
}

// Sends pending recipients until `deadline` (epoch ms). Returns the draft as saved.
export async function runBulkSendBatch(authHeaders: Record<string, string>, ownerId: string, twilio: Twilio, draft: BulkDraft, deadline: number): Promise<BulkDraft> {
  if (draft.status !== "sending") return draft;
  const pending = draft.recipients.filter(r => r.status === "pending");
  // Opt-outs can change between approval and sending.
  const ids = pending.map(r => r.customerId).filter(Boolean);
  const optedOut = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=id,smsOptOut&smsOptOut=eq.true&id=in.(${ids.slice(i, i + 100).map(encodeURIComponent).join(",")})`, { headers: authHeaders }).catch(() => null);
    const rows = res ? await res.json().catch(() => []) : [];
    if (Array.isArray(rows)) rows.forEach((r: any) => optedOut.add(r.id));
  }
  // BUG FIX (integration audit 2026-11-13) — take the lease before sending;
  // if another runner holds it (or got there first), leave this draft alone.
  if (!(await claimDraft(authHeaders, ownerId, draft, deadline))) return draft;
  const myLease = draft.leaseId;
  const auth = `Basic ${btoa(`${twilio.sid}:${twilio.token}`)}`;
  let lostLease = false;
  for (const r of pending) {
    if (Date.now() > deadline) break;
    if (optedOut.has(r.customerId)) { r.status = "skipped"; r.error = "opted out"; continue; }
    const body = stripMarkdownForSms(draft.message.replace(/{{first_name}}/g, r.firstName || "there"));
    const to = toE164(r.phone) || r.phone;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${await twilioAccountSid(twilio.sid, twilio.token)}/Messages.json`, {
      method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: twilio.from, Body: body }).toString(),
    }).catch((e: any) => ({ ok: false, text: async () => String(e?.message || e) } as any));
    if (res.ok) { r.status = "sent"; await logToInbox(authHeaders, ownerId, to, r.name, r.customerId, body); }
    else { r.status = "failed"; r.error = (await res.text().catch(() => "")).slice(0, 120); }
    // BUG FIX (integration audit 2026-11-13) — save progress after EVERY
    // send (it used to be every 20), so a cut-off never re-sends up to 19
    // people. The save only lands while we still hold the lease; if we lost
    // it, stop sending.
    if (!(await patchDraftIf(authHeaders, ownerId, draft, leaseFilter(myLease)))) { lostLease = true; break; }
    await new Promise(res2 => setTimeout(res2, 120)); // stay under Twilio's rate limit
  }
  if (lostLease) return draft;
  draft.sentCount = draft.recipients.filter(r => r.status === "sent").length;
  draft.failedCount = draft.recipients.filter(r => r.status === "failed").length;
  if (!draft.recipients.some(r => r.status === "pending")) { draft.status = "sent"; draft.finishedAt = new Date().toISOString(); }
  draft.leaseUntil = null; // release the lease (leaseId stays, so stale copies can't re-claim)
  if (!(await patchDraftIf(authHeaders, ownerId, draft, leaseFilter(myLease)))) return draft;
  if (draft.campaignId) {
    const camp = await recGet(authHeaders, ownerId, "campaigns", draft.campaignId);
    if (camp) {
      const attempted = (draft.sentCount || 0) + (draft.failedCount || 0);
      await recPut(authHeaders, ownerId, "campaigns", {
        ...camp, status: draft.status === "sent" ? "sent" : "sending", sentAt: draft.finishedAt || camp.sentAt, sentCount: draft.sentCount, failedCount: draft.failedCount,
        recipientCount: draft.recipients.filter(r => r.status !== "skipped").length,
        deliveryRate: attempted ? Math.round(((draft.sentCount || 0) / attempted) * 100) : undefined,
        failureSamples: draft.recipients.filter(r => r.status === "failed").slice(0, 3).map(r => `${r.name}: ${r.error}`),
      });
    }
  }
  return draft;
}

// Cron side (check-reminders): finish every bulk send still in progress.
export async function continueBulkSends(authHeaders: Record<string, string>, getTwilio: (ownerId: string) => Promise<Twilio | null>, budgetMs = 20000): Promise<{ sent: number; owners: number }> {
  const all = await recListAllOwners(authHeaders, "bulk_text_draft");
  const sending = all.filter(r => r.data?.status === "sending");
  const deadline = Date.now() + budgetMs;
  let sent = 0;
  for (const { ownerId, data } of sending) {
    if (Date.now() > deadline) break;
    const tw = await getTwilio(ownerId);
    if (!tw) continue;
    const before = (data.recipients || []).filter((r: any) => r.status === "sent").length;
    const after = await runBulkSendBatch(authHeaders, ownerId, tw, data as BulkDraft, deadline);
    sent += (after.sentCount || 0) - before;
  }
  return { sent, owners: sending.length };
}
