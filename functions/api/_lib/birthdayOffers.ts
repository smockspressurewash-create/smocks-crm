// Birthday offers — once a day, every customer whose birthday (customers
// ."birthday", YYYY-MM-DD or --MM-DD) is today gets a text with their own
// coupon code (a real row in `promotions`, so it can be redeemed and
// tracked). Turned on by text-Alfred's set_birthday_offer; the setting is the
// owner_records row kind "birthday_offer", id "default". Run by the
// /api/check-reminders cron.
import { twilioAccountSid } from "./twilioAccount";
import { recListAllOwners } from "./ownerRecords";
import { stripMarkdownForSms } from "./textFormat";
import { toE164 } from "./bulkTextSend";

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";

export type BirthdayOffer = {
  id: "default"; active: boolean; discountPercent: number; validDays: number; message?: string;
  lastRunDate?: string; sent?: Record<string, string>; // customerId → year sent
  leaseId?: string; leaseUntil?: string | null;
};

// BUG FIX (audit 2026-11-17) — two overlapping cron runs could both text the
// same customers, and a run cut off mid-way forgot who it had already texted
// (the "sent" list was only saved at the end), so customers got the birthday
// text twice. Same claim/lease approach as bulkTextSend.ts: a run must take
// the lease before sending, and saves progress after every text only while it
// still holds the lease.
const offerUrl = (ownerId: string) =>
  `${SUPABASE_URL}/rest/v1/owner_records?owner_id=eq.${encodeURIComponent(ownerId)}&kind=eq.birthday_offer&id=eq.default&deleted_at=is.null`;
async function patchOfferIf(authHeaders: Record<string, string>, ownerId: string, cfg: BirthdayOffer, filter: string): Promise<boolean> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(cfg)) if (!k.startsWith("_")) clean[k] = v;
  const res = await fetch(`${offerUrl(ownerId)}&${filter}`, {
    method: "PATCH", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ data: clean }),
  }).catch(() => null);
  const rows = res && res.ok ? await res.json().catch(() => []) : [];
  return Array.isArray(rows) && rows.length > 0;
}
const leaseFilter = (leaseId?: string) => leaseId ? `data->>leaseId=eq.${encodeURIComponent(leaseId)}` : "data->>leaseId=is.null";
async function claimOffer(authHeaders: Record<string, string>, ownerId: string, cfg: BirthdayOffer): Promise<boolean> {
  const prevLease = cfg.leaseId;
  const nowIso = new Date().toISOString();
  cfg.leaseId = crypto.randomUUID();
  cfg.leaseUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const ok = await patchOfferIf(authHeaders, ownerId, cfg,
    `${leaseFilter(prevLease)}&or=(data->>leaseUntil.is.null,data->>leaseUntil.lt.${encodeURIComponent(`"${nowIso}"`)})`);
  if (!ok) cfg.leaseId = prevLease;
  return ok;
}
export const DEFAULT_BIRTHDAY_MESSAGE = "Happy birthday {{first_name}}! 🎉 From all of us at {{company}}, here's {{percent}}% off your next service — use code {{code}} by {{expires}}.";

// US business owners: "today" in US Eastern-ish time, so a birthday text
// doesn't go out the evening before.
const usToday = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);

export async function runBirthdayOffers(authHeaders: Record<string, string>, getTwilio: (ownerId: string) => Promise<{ sid: string; token: string; from: string } | null>, getCompany: (ownerId: string) => Promise<string>): Promise<{ sent: number; errors: string[] }> {
  const day = usToday();
  const mmdd = day.slice(5);
  const year = day.slice(0, 4);
  // Don't text before 9am Eastern.
  if (new Date(Date.now() - 5 * 3600000).getUTCHours() < 9) return { sent: 0, errors: [] };
  const configs = (await recListAllOwners(authHeaders, "birthday_offer")).filter(c => c.data?.active && c.data.lastRunDate !== day);
  let sent = 0;
  const errors: string[] = [];
  for (const { ownerId, data } of configs) {
    const cfg = data as BirthdayOffer;
    const tw = await getTwilio(ownerId);
    if (!tw) { errors.push(`${ownerId}: Twilio not set up`); continue; }
    const company = await getCompany(ownerId);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?owner_id=eq.${encodeURIComponent(ownerId)}&birthday=like.*-${mmdd}&select=id,firstName,lastName,phone,smsOptOut,isTestClient&limit=500`, { headers: authHeaders }).catch(() => null);
    const rows = res ? await res.json().catch(() => []) : [];
    if (!Array.isArray(rows)) { errors.push(`${ownerId}: couldn't read birthdays (${(rows as any)?.message || "error"})`); continue; }
    cfg.sent = cfg.sent || {};
    if (!(await claimOffer(authHeaders, ownerId, cfg))) continue; // another run is already sending for this business
    const myLease = cfg.leaseId;
    let lostLease = false;
    const auth = `Basic ${btoa(`${tw.sid}:${tw.token}`)}`;
    const expires = new Date(Date.now() + (Number(cfg.validDays) || 30) * 86400000).toISOString().slice(0, 10);
    const expiresLabel = new Date(expires + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric" });
    for (const c of rows) {
      if (!c.phone || c.smsOptOut || cfg.sent[c.id] === year) continue;
      const code = "BDAY" + Math.random().toString(36).slice(2, 7).toUpperCase();
      const promo = await fetch(`${SUPABASE_URL}/rest/v1/promotions`, {
        method: "POST", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        // One use, only this customer, expires after validDays — and one per
        // customer per year (cfg.sent). Column names match the promotions table.
        body: JSON.stringify([{ id: crypto.randomUUID(), owner_id: ownerId, name: `Birthday — ${`${c.firstName || ""} ${c.lastName || ""}`.trim()}`, description: "Birthday coupon", code, discountType: "percent", discountValue: Number(cfg.discountPercent) || 10, validFrom: day, validTo: expires, usageLimit: 1, redeemedCount: 0, audience: "individual", audienceCustomerIds: [c.id], channel: "sms", status: "active", createdAt: day }]),
      }).catch(() => null);
      if (!promo?.ok) { errors.push(`${c.id}: couldn't create coupon`); continue; }
      const body = stripMarkdownForSms((cfg.message || DEFAULT_BIRTHDAY_MESSAGE)
        .replace(/{{first_name}}/g, c.firstName || "there").replace(/{{code}}/g, code)
        .replace(/{{percent}}/g, String(Number(cfg.discountPercent) || 10)).replace(/{{expires}}/g, expiresLabel).replace(/{{company}}/g, company));
      const sms = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${await twilioAccountSid(tw.sid, tw.token)}/Messages.json`, {
        method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
        // BUG FIX (integration audit 2026-11-13) — send to the E.164 form of
        // the stored number; Twilio rejects most other formats.
        body: new URLSearchParams({ To: toE164(c.phone) || c.phone, From: tw.from, Body: body }).toString(),
      }).catch(() => null);
      if (!sms?.ok) { errors.push(`${c.id}: text failed`); continue; }
      cfg.sent[c.id] = year;
      sent++;
      // Record this customer right away; stop if another run took over.
      if (!(await patchOfferIf(authHeaders, ownerId, cfg, leaseFilter(myLease)))) { lostLease = true; break; }
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_or_create_inbox_thread`, {
        method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ p_owner_id: ownerId, p_channel: "sms", p_contact_phone: c.phone, p_contact_name: `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.phone, p_customer_id: c.id, p_message: { id: crypto.randomUUID(), dir: "out", body, ts: Date.now(), via: "alfred" }, p_unread: false }),
      }).catch(() => {});
    }
    if (lostLease) { errors.push(`${ownerId}: another run took over sending`); continue; }
    cfg.lastRunDate = day;
    cfg.leaseUntil = null; // release the lease (leaseId stays, so stale copies can't re-claim)
    if (!(await patchOfferIf(authHeaders, ownerId, cfg, leaseFilter(myLease)))) errors.push(`${ownerId}: couldn't save birthday run`);
  }
  return { sent, errors };
}
