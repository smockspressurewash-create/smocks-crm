import { useEffect, useRef } from "react";
import type { Automation, Job, Customer, Estimate, Referral } from "../types";
import { today, daysSince } from "../lib/utils";
import { twilioSend, logOutboundSmsToInbox } from "../lib/messaging";
import type { AppSettings } from "../types";

interface AutomationEngineProps {
  automations: Automation[];
  setAutomations: React.Dispatch<React.SetStateAction<Automation[]>>;
  jobs: Job[];
  customers: Customer[];
  estimates: Estimate[];
  referrals?: Referral[];
  settings: AppSettings;
  toast: (msg: string) => void;
}

const SMS_TEMPLATES: Record<string, string> = {
  new_lead:            "Hi {{first_name}}! Thanks for reaching out to Crew Boss. I'll send your estimate shortly. — Will",
  estimate_followup:    "Hi {{first_name}}, just checking in on your estimate. Any questions? Ready to schedule? — Will @ Crew Boss",
  estimate_expiring:    "Hi {{first_name}}, your Crew Boss estimate for {{amount}} expires in 48 hours. Reply BOOK to lock in this price — Crew Boss",
  job_reminder:         "Hi {{first_name}}, reminder: your Crew Boss service is tomorrow. We'll text when on the way. — Crew Boss",
  review_request:       "Hi {{first_name}}, how did we do? A quick Google review means a lot: {{review_link}} — Will",
  payment_overdue_3:    "Hi {{first_name}}, friendly reminder — your Crew Boss invoice for {{amount}} is due. Pay here: {{payment_link}}",
  payment_overdue_7:    "Hi {{first_name}}, your Crew Boss invoice for {{amount}} is now a week overdue. Pay here: {{payment_link}}",
  payment_overdue_14:   "Hi {{first_name}}, your invoice for {{amount}} is 2 weeks overdue. Please pay at your earliest convenience: {{payment_link}} — Crew Boss",
  maintenance_reminder: "Hi {{first_name}}, it's been 90 days since your last Crew Boss service — ready for a refresh? Reply BOOK or call (717) 555-0100.",
  birthday:             "Hi {{first_name}}! Happy birthday 🎂 Enjoy 10% off your next service — code BDAY10. — Crew Boss",
  seasonal_spring:      "Hi {{first_name}}, spring is here! Book your house or driveway soft wash this month and save 15% — reply BOOK. — Crew Boss",
  seasonal_fall:        "Hi {{first_name}}, protect your home this fall — clogged gutters cause ice dams & water damage. Reply GUTTERS to book. — Crew Boss",
  abandoned_estimate_1: "Hi {{first_name}}, just checking in on your Crew Boss estimate for {{amount}}. Any questions? Reply BOOK to schedule.",
  abandoned_estimate_2: "Hi {{first_name}}, still thinking it over? Your Crew Boss estimate for {{amount}} is ready whenever you are — reply BOOK.",
  abandoned_estimate_3: "Hi {{first_name}}, last check-in on your {{amount}} estimate — reply BOOK to schedule, or let us know if you have questions. — Crew Boss",
  reengage:             "Hi {{first_name}}, it's been 6 months since your last Crew Boss service! Book now and save 10% — reply BOOK.",
  referral_ask:         "Hi {{first_name}}, thanks for being a loyal Crew Boss customer! Know anyone who could use a wash? Refer them and you both save — reply REFER.",
  referral_reward:      "Hi {{first_name}}, your referral just booked — you've earned ${{reward}} credit toward your next Crew Boss service! 🎉",
  anniversary:          "Hi {{first_name}}, happy anniversary with Crew Boss! Thanks for trusting us — enjoy 10% off your next service this month. Reply BOOK.",
};

const fillTemplate = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);

// Days between now and a future date (validUntil-style "expiring in N days"),
// the mirror image of lib/utils.ts's daysSince.
const daysUntil = (dateStr: string | null | undefined): number => {
  if (!dateStr) return Infinity;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.floor(diff / 86400000);
};

// Most recent COMPLETED job's scheduledDate for a customer, or null if they've
// never had one — the shared basis for both the 90-day maintenance nudge and
// the 6-month re-engagement win-back (see FIX comments below).
const lastServiceDate = (jobs: Job[], customerId: string): string | null => {
  const done = jobs.filter(j => j.customerId === customerId && j.status === "completed" && j.scheduledDate);
  if (done.length === 0) return null;
  return done.reduce((latest, j) => (j.scheduledDate! > latest ? j.scheduledDate! : latest), done[0].scheduledDate!);
};

export function useAutomationEngine({
  automations,
  setAutomations,
  jobs,
  customers,
  estimates,
  referrals = [],
  settings,
  toast,
}: AutomationEngineProps): void {
  const lastRunRef = useRef<string>("");

  useEffect(() => {
    const run = async () => {
      const nowKey = new Date().toISOString().slice(0, 16); // minute precision
      if (lastRunRef.current === nowKey) return;
      lastRunRef.current = nowKey;

      const todayStr = today();
      const hour = new Date().getHours();

      // FIX 1 (mobile round 6) — this used to gate the WHOLE automation on
      // `auto.lastTriggered === todayStr`, skipping every remaining
      // recipient for the rest of the day the moment the FIRST one was
      // messaged (e.g. 3 tomorrow-jobs → only the first customer ever got
      // the 24h reminder; the other 2 got nothing, silently, every day).
      // Per-recipient dedup via sentLog (recipientKey -> last-sent date,
      // persisted on the automation itself) replaces that — each recipient
      // is checked and throttled independently, so a shared trigger window
      // can message everyone who matches it, not just whoever happened to
      // be first in the array.
      const patchesByAutoId: Record<string, { sentTo: Record<string, string>; sent: number }> = {};

      const alreadySent = (auto: Automation, key: string, cooldownDays: number): boolean => {
        const last = auto.sentLog?.[key];
        return !!last && daysSince(last) < cooldownDays;
      };
      const recordSend = (auto: Automation, key: string, label: string) => {
        if (!patchesByAutoId[auto.id]) patchesByAutoId[auto.id] = { sentTo: {}, sent: 0 };
        patchesByAutoId[auto.id].sentTo[key] = todayStr;
        patchesByAutoId[auto.id].sent += 1;
        console.log("[Automations] fired:", auto.name, "->", label);
      };
      // Shared send-and-record helper for the common "SMS a customer, log it
      // to the inbox, dedupe per recipient" shape every handler below needs.
      const sendSms = async (auto: Automation, c: Customer, key: string, msg: string, cooldownDays: number): Promise<boolean> => {
        if (!c?.phone || c.smsOptOut) return false;
        if (alreadySent(auto, key, cooldownDays)) return false;
        try {
          await twilioSend(settings, c.phone, msg);
          logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {});
          recordSend(auto, key, c.firstName + " " + c.lastName);
          toast(`📱 ${auto.name} → ${c.firstName}`);
          return true;
        } catch (e: any) {
          console.error("[Automations]", auto.name, "— failed for", c.firstName, ":", e?.message || e);
          return false;
        }
      };

      for (const auto of automations) {
        if (!auto.active) continue;
        const t = auto.trigger.toLowerCase();

        // ── New lead auto-response (instant SMS) ────────────────────────────
        if (t.includes("new lead")) {
          const freshLeads = customers.filter(c => Date.now() - new Date(c.createdAt).getTime() < 20 * 60000);
          for (const c of freshLeads) {
            await sendSms(auto, c, "lead:" + c.id, fillTemplate(SMS_TEMPLATES.new_lead, { first_name: c.firstName }), 3650);
          }
        }

        // ── Estimate follow-up (sent, still unviewed) ───────────────────────
        if (t.includes("estimate sent")) {
          const staleEstimates = estimates.filter(e => e.status === "pending" && e.sentAt && daysSince(e.sentAt) >= 1 && !e.viewed);
          for (const est of staleEstimates.slice(0, 20)) {
            const c = customers.find(x => x.id === est.customerId);
            if (!c) continue;
            await sendSms(auto, c, "est-followup:" + est.id, fillTemplate(SMS_TEMPLATES.estimate_followup, { first_name: c.firstName }), 3);
          }
        }

        // ── Estimate expiring (48h before validUntil) ───────────────────────
        if (t.includes("expiring")) {
          const expiringSoon = estimates.filter(e => e.status === "pending" && e.validUntil && daysUntil(e.validUntil) >= 0 && daysUntil(e.validUntil) <= 2);
          for (const est of expiringSoon.slice(0, 20)) {
            const c = customers.find(x => x.id === est.customerId);
            if (!c) continue;
            await sendSms(auto, c, "expiring:" + est.id, fillTemplate(SMS_TEMPLATES.estimate_expiring, { first_name: c.firstName, amount: `$${est.total}` }), 30);
          }
        }

        // ── Job reminder (24h before scheduled) ─────────────────────────────
        if (t.includes("24h before job") && hour >= 7 && hour < 9) {
          const tomorrowJobs = jobs.filter(j => j.status === "scheduled" && j.scheduledDate === new Date(Date.now() + 86400000).toISOString().slice(0, 10));
          for (const job of tomorrowJobs) {
            const c = customers.find(x => x.id === job.customerId);
            if (!c) continue;
            await sendSms(auto, c, "job-reminder:" + job.id, fillTemplate(SMS_TEMPLATES.job_reminder, { first_name: c.firstName, time: job.scheduledTime || "the scheduled time" }), 1);
          }
        }

        // ── Review request (48h after completion) ───────────────────────────
        // AUDIT ITEM 8 — requiring "48h" too disambiguates this from a12's
        // "Job completed (3rd+)" referral-ask trigger, which also contains
        // "job completed".
        if (t.includes("job completed") && t.includes("48h")) {
          const recentJobs = jobs.filter(j => {
            if (j.status !== "completed") return false;
            const completedDate = j.signOff?.timestamp?.slice(0, 10) || j.scheduledDate;
            return completedDate && daysSince(completedDate) === 2;
          });
          for (const job of recentJobs) {
            const c = customers.find(x => x.id === job.customerId);
            if (!c) continue;
            if (c.reviewRequested && daysSince(c.reviewRequested) < 90) continue;
            const reviewLink = `${window.location.origin}${window.location.pathname}#/rate?c=${encodeURIComponent(c.id)}&n=${encodeURIComponent(c.firstName)}&g=${encodeURIComponent(settings.googlePlaceId ?? "")}&co=${encodeURIComponent(settings.companyName ?? "Crew Boss")}`;
            await sendSms(auto, c, "review:" + job.id, fillTemplate(SMS_TEMPLATES.review_request, { first_name: c.firstName, review_link: reviewLink }), 90);
          }
        }

        // ── Payment overdue — staged 3 / 7 / 14 day reminders ───────────────
        // FIX 1 (mobile round 6) — was a single fixed >=7-day check with one
        // message. Real invoice follow-up needs escalating touches; each
        // stage fires exactly once (long cooldown) so a still-unpaid invoice
        // gets 3 distinct nudges over its lifetime instead of one.
        if (t.includes("overdue")) {
          const unpaid = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt);
          for (const est of unpaid) {
            const c = customers.find(x => x.id === est.customerId);
            if (!c) continue;
            const daysOver = daysSince(est.invoicedAt);
            const paymentLink = `${window.location.origin}${window.location.pathname}#/estimate/${est.id}`;
            if (daysOver >= 14) {
              await sendSms(auto, c, "overdue14:" + est.id, fillTemplate(SMS_TEMPLATES.payment_overdue_14, { first_name: c.firstName, amount: `$${est.total}`, payment_link: paymentLink }), 3650);
            } else if (daysOver >= 7) {
              await sendSms(auto, c, "overdue7:" + est.id, fillTemplate(SMS_TEMPLATES.payment_overdue_7, { first_name: c.firstName, amount: `$${est.total}`, payment_link: paymentLink }), 3650);
            } else if (daysOver >= 3) {
              await sendSms(auto, c, "overdue3:" + est.id, fillTemplate(SMS_TEMPLATES.payment_overdue_3, { first_name: c.firstName, amount: `$${est.total}`, payment_link: paymentLink }), 3650);
            }
          }
        }

        // ── Maintenance reminder (90 days since last completed service) ─────
        if (t.includes("since service") || t.includes("maintenance")) {
          for (const c of customers) {
            const last = lastServiceDate(jobs, c.id);
            if (!last || daysSince(last) < 90) continue;
            await sendSms(auto, c, "maint90:" + c.id + ":" + last, fillTemplate(SMS_TEMPLATES.maintenance_reminder, { first_name: c.firstName }), 90);
          }
        }

        // ── Birthday ─────────────────────────────────────────────────────────
        if (t.includes("birthday") && hour >= 8 && hour < 9) {
          const mmdd = todayStr.slice(5);
          const birthdayCustomers = customers.filter(c => c.birthday && c.birthday.slice(5) === mmdd);
          for (const c of birthdayCustomers) {
            await sendSms(auto, c, "bday:" + c.id + ":" + todayStr.slice(0, 4), fillTemplate(SMS_TEMPLATES.birthday, { first_name: c.firstName }), 300);
          }
        }

        // ── Seasonal — spring (March 1, broadcast to the whole customer list) ─
        if (t.includes("march 1") || (t.includes("spring") && t.includes("annually"))) {
          const now = new Date();
          if (now.getMonth() === 2 && now.getDate() <= 3) { // March 1-3 window
            for (const c of customers) {
              await sendSms(auto, c, "spring:" + c.id + ":" + now.getFullYear(), fillTemplate(SMS_TEMPLATES.seasonal_spring, { first_name: c.firstName }), 300);
            }
          }
        }

        // ── Seasonal — fall gutter (October 1, broadcast) ───────────────────
        if (t.includes("october 1") || (t.includes("fall") && t.includes("annually"))) {
          const now = new Date();
          if (now.getMonth() === 9 && now.getDate() <= 3) { // Oct 1-3 window
            for (const c of customers) {
              await sendSms(auto, c, "fall:" + c.id + ":" + now.getFullYear(), fillTemplate(SMS_TEMPLATES.seasonal_fall, { first_name: c.firstName }), 300);
            }
          }
        }

        // ── Abandoned estimate — 3-touch nurture sequence (day 3/7/14) ──────
        // Broader than the "estimate sent, unviewed" follow-up above — this
        // catches estimates the customer DID view but never approved or
        // declined, not just ones never opened.
        if (t.includes("not approved") || t.includes("abandoned")) {
          const abandoned = estimates.filter(e => e.status === "pending" && e.sentAt);
          for (const est of abandoned) {
            const c = customers.find(x => x.id === est.customerId);
            if (!c) continue;
            const daysOld = daysSince(est.sentAt);
            if (daysOld >= 14) {
              await sendSms(auto, c, "nurture3:" + est.id, fillTemplate(SMS_TEMPLATES.abandoned_estimate_3, { first_name: c.firstName, amount: `$${est.total}` }), 3650);
            } else if (daysOld >= 7) {
              await sendSms(auto, c, "nurture2:" + est.id, fillTemplate(SMS_TEMPLATES.abandoned_estimate_2, { first_name: c.firstName, amount: `$${est.total}` }), 3650);
            } else if (daysOld >= 3) {
              await sendSms(auto, c, "nurture1:" + est.id, fillTemplate(SMS_TEMPLATES.abandoned_estimate_1, { first_name: c.firstName, amount: `$${est.total}` }), 3650);
            }
          }
        }

        // ── Recurring customer re-engagement (6 months no service) ──────────
        if (t.includes("no service") || t.includes("re-engage") || t.includes("6 months")) {
          for (const c of customers) {
            const last = lastServiceDate(jobs, c.id);
            if (!last || daysSince(last) < 180) continue;
            await sendSms(auto, c, "reengage:" + c.id + ":" + last, fillTemplate(SMS_TEMPLATES.reengage, { first_name: c.firstName }), 90);
          }
        }

        // ── Referral ask (3rd+ completed job) ───────────────────────────────
        if (t.includes("job completed") && t.includes("3rd")) {
          for (const c of customers) {
            const completedCount = jobs.filter(j => j.customerId === c.id && j.status === "completed").length;
            if (completedCount < 3) continue;
            await sendSms(auto, c, "refask:" + c.id, fillTemplate(SMS_TEMPLATES.referral_ask, { first_name: c.firstName }), 3650);
          }
        }

        // ── Customer anniversary (1yr+ since becoming a customer) ───────────
        if (t.includes("anniversary")) {
          const now = new Date();
          const mmdd = todayStr.slice(5);
          for (const c of customers) {
            if (!c.createdAt || daysSince(c.createdAt) < 365) continue;
            if (c.createdAt.slice(5, 10) !== mmdd) continue;
            await sendSms(auto, c, "anniv:" + c.id + ":" + now.getFullYear(), fillTemplate(SMS_TEMPLATES.anniversary, { first_name: c.firstName }), 300);
          }
        }

        // ── Referral reward earned (a referral of theirs completed booking) ─
        if (t.includes("reward earned") || t.includes("referral") && t.includes("reward")) {
          for (const ref of referrals) {
            if (ref.status !== "completed" || !ref.reward) continue;
            const c = customers.find(x => x.id === ref.referrerId);
            if (!c) continue;
            await sendSms(auto, c, "refreward:" + ref.id, fillTemplate(SMS_TEMPLATES.referral_reward, { first_name: c.firstName, reward: String(ref.reward) }), 3650);
          }
        }

        const knownTrigger = t.includes("new lead") || t.includes("estimate sent") || t.includes("expiring")
          || t.includes("24h before job") || (t.includes("job completed") && (t.includes("48h") || t.includes("3rd")))
          || t.includes("overdue") || t.includes("since service") || t.includes("maintenance") || t.includes("birthday")
          || t.includes("march 1") || t.includes("october 1") || (t.includes("spring") && t.includes("annually")) || (t.includes("fall") && t.includes("annually"))
          || t.includes("not approved") || t.includes("abandoned") || t.includes("no service") || t.includes("re-engage") || t.includes("6 months")
          || t.includes("anniversary") || t.includes("reward earned") || (t.includes("referral") && t.includes("reward"));
        if (!knownTrigger) {
          console.warn("[Automations] \"" + auto.name + "\" (trigger: \"" + auto.trigger + "\") has no matching engine handler yet.");
        }
      }

      if (Object.keys(patchesByAutoId).length > 0) {
        setAutomations(prev => prev.map(a => {
          const patch = patchesByAutoId[a.id];
          if (!patch) return a;
          return { ...a, lastTriggered: todayStr, count: (a.count ?? 0) + patch.sent, sentLog: { ...(a.sentLog || {}), ...patch.sentTo } };
        }));
      }
    };

    // Run immediately then every 15 minutes
    run();
    const interval = setInterval(run, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [automations, jobs, customers, estimates, referrals, settings]); // eslint-disable-line
}
