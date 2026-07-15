import { useEffect, useRef } from "react";
import type { Automation, AutomationStep, Job, Customer, Estimate, Referral } from "../types";
import { today, daysSince } from "../lib/utils";
import { twilioSend, logOutboundSmsToInbox, sendOwnerGmailOnly, emailShell } from "../lib/messaging";
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
  new_lead:             "Hi {{first_name}}! Thanks for reaching out to Crew Boss. I'll send your estimate shortly. — Will",
  estimate_followup:    "Hi {{first_name}}, just checking in on your estimate. Any questions? Ready to schedule? — Will @ Crew Boss",
  estimate_expiring:    "Hi {{first_name}}, your Crew Boss estimate for {{amount}} expires in 48 hours. Reply BOOK to lock in this price — Crew Boss",
  estimate_viewed_ack:  "Hi {{first_name}}, glad you had a chance to look over your Crew Boss estimate! Any questions before we get you scheduled? — Will",
  estimate_accepted:    "Hi {{first_name}}, thanks for approving your Crew Boss estimate! We'll be in touch shortly to get you scheduled. — Will",
  payment_received:     "Hi {{first_name}}, thank you for your payment! We appreciate your business. — Crew Boss",
  job_reminder:         "Hi {{first_name}}, reminder: your Crew Boss service is coming up. We'll text when on the way. — Crew Boss",
  job_scheduled:        "Hi {{first_name}}, you're booked with Crew Boss for {{date}}! We'll send reminders as it gets closer. — Will",
  crew_starts:          "Hi {{first_name}}, your Crew Boss technician just started your service — we'll let you know when it's done!",
  review_request:       "Hi {{first_name}}, how did we do? A quick Google review means a lot: {{review_link}} — Will",
  payment_overdue_3:    "Hi {{first_name}}, friendly reminder — your Crew Boss invoice for {{amount}} is due. Pay here: {{payment_link}}",
  payment_overdue_7:    "Hi {{first_name}}, your Crew Boss invoice for {{amount}} is now a week overdue. Pay here: {{payment_link}}",
  payment_overdue_14:   "Hi {{first_name}}, your invoice for {{amount}} is 2+ weeks overdue. Please pay at your earliest convenience: {{payment_link}} — Crew Boss",
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
  referral_booked:      "Hi {{first_name}}, your referral just booked their first Crew Boss service! Thank you for spreading the word 🎉",
  anniversary:          "Hi {{first_name}}, happy anniversary with Crew Boss! Thanks for trusting us — enjoy 10% off your next service this month. Reply BOOK.",
};

// BLOCKER 1 (mobile round 9) — module scope (not inside the hook) so it
// survives across every 15-min engine tick within this browser session:
// tracks which automation+failure-mode combos have already logged a
// "not configured" warning, so a business with dozens of customers and no
// Twilio/Gmail configured doesn't produce 50+ near-identical console errors.
// The automation itself keeps retrying every candidate every tick (nothing
// is skipped) — only the console noise after the first occurrence is
// suppressed. Resets on a full page reload.
const notConfiguredWarnedThisSession = new Set<string>();

const fillTemplate = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);

const lastServiceDate = (jobs: Job[], customerId: string): string | null => {
  const done = jobs.filter(j => j.customerId === customerId && j.status === "completed" && j.scheduledDate);
  if (done.length === 0) return null;
  return done.reduce((latest, j) => (j.scheduledDate! > latest ? j.scheduledDate! : latest), done[0].scheduledDate!);
};

// Pulls an explicit "N days" / "N hours" out of a trigger/step label so labels
// like "Invoice unpaid 3 days" or "Job complete + 2h" drive real timing
// instead of a one-size-fits-all constant — falls back to fallbackMinutes when
// the label has no number in it (e.g. a bare "Estimate sent").
const deriveDelayMinutesFromLabel = (label: string, fallbackMinutes: number): number => {
  const t = (label || "").toLowerCase();
  const h = t.match(/(\d+)\s*h(our)?s?\b/);
  if (h) return parseInt(h[1], 10) * 60;
  const d = t.match(/(\d+)\s*d(ay)?s?\b/);
  if (d) return parseInt(d[1], 10) * 1440;
  return fallbackMinutes;
};
const deriveDaysFromLabel = (label: string, fallbackDays: number): number => {
  const t = (label || "").toLowerCase();
  const h = t.match(/(\d+)\s*h(our)?s?\b/);
  if (h) return Math.max(1, Math.round(parseInt(h[1], 10) / 24));
  const d = t.match(/(\d+)\s*d(ay)?s?\b/);
  if (d) return parseInt(d[1], 10);
  return fallbackDays;
};

// ── Trigger classification ───────────────────────────────────────────────────
// Every place an automation's trigger text can come from — the legacy seed
// data (lib/seed.ts seedAutomations), the simple trigger/action dropdown
// (ui/AutomationEditor.tsx triggerPresets), and the full n8n-style builder
// (ui/VisualWorkflowBuilder.tsx TRIGGER_PRESETS) — all use slightly different
// wording for the same concept ("24h before job" vs "24h before scheduled
// job", "Job completed + 48h" vs "Job complete + 48h", etc). Matching on
// narrow exact phrases (the previous version of this file) meant most
// UI-created workflows fell through to "no matching engine handler" even
// though their trigger was a perfectly valid preset. These patterns are
// written to cover every preset string from all three sources, ordered so
// more specific checks run before broader ones that could also match.
type Category =
  | "new_lead" | "estimate_expiring" | "job_reminder" | "job_reminder_morning" | "crew_starts"
  | "referral_ask" | "review_request" | "job_scheduled" | "estimate_followup" | "estimate_viewed"
  | "estimate_accepted" | "payment_received" | "payment_overdue" | "maintenance" | "birthday"
  | "seasonal_spring" | "seasonal_fall" | "abandoned_estimate" | "reengage" | "anniversary"
  | "referral_reward" | "referral_booked" | "review_good" | "review_bad" | "manual" | "weekly_scheduled";

const classifyTrigger = (labelRaw: string): Category | null => {
  const t = (labelRaw || "").toLowerCase();
  if (/new (lead|inquiry|customer)|lead (form )?submitted|inquiry submitted/.test(t)) return "new_lead";
  if (/expir/.test(t)) return "estimate_expiring";
  if (/24h before|before.*scheduled job/.test(t)) return "job_reminder";
  if (/job day morning|morning of/.test(t)) return "job_reminder_morning";
  if (/crew start/.test(t)) return "crew_starts";
  if (/job complete.*3rd|3rd.*job complete/.test(t)) return "referral_ask";
  if (/job complete|post.?job review|review request/.test(t)) return "review_request";
  if (/\bjob scheduled\b/.test(t)) return "job_scheduled";
  if (/quote unviewed|estimate sent|quote sent/.test(t)) return "estimate_followup";
  if (/estimate viewed/.test(t)) return "estimate_viewed";
  if (/estimate (accepted|signed)/.test(t)) return "estimate_accepted";
  if (/payment received/.test(t)) return "payment_received";
  if (/invoice (unpaid|overdue)/.test(t)) return "payment_overdue";
  if (/since service|maintenance|90 days/.test(t)) return "maintenance";
  if (/birthday/.test(t)) return "birthday";
  if (/march 1/.test(t)) return "seasonal_spring";
  if (/october 1/.test(t)) return "seasonal_fall";
  if (/not approved|abandoned|no response/.test(t)) return "abandoned_estimate";
  if (/no service|re-?engage|6 months/.test(t)) return "reengage";
  if (/anniversary/.test(t)) return "anniversary";
  if (/reward earned|referr.*reward/.test(t)) return "referral_reward";
  if (/referr.*book/.test(t)) return "referral_booked";
  if (/review submitted|5 star/.test(t) && /review/.test(t)) return "review_good";
  if (/negative review|≤3|low.?rating/.test(t)) return "review_bad";
  if (/manual/.test(t)) return "manual";
  if (/every monday|weekly/.test(t)) return "weekly_scheduled";
  return null;
};

interface Candidate {
  key: string;
  customer: Customer;
  job?: Job;
  estimate?: Estimate;
  referral?: Referral;
  anchorMs: number;
}
type Direction = "after" | "before" | "immediate";
interface CategorySpec {
  direction: Direction;
  defaultDelayMinutes: number;
  defaultCooldownDays: number;
  conditionKey?: string;
  smsTemplateKey?: string;
  extraVars?: (cand: Candidate) => Record<string, string>;
  getCandidates: () => Candidate[];
}

const evalCondition = (key: string, cand: Candidate): boolean => {
  switch (key) {
    case "estimate_pending": return cand.estimate?.status === "pending";
    case "estimate_not_viewed": return !cand.estimate?.viewed;
    case "estimate_viewed": return !!cand.estimate?.viewed;
    case "estimate_not_approved": return cand.estimate?.status !== "approved";
    case "estimate_approved": return cand.estimate?.status === "approved";
    case "invoice_unpaid": return !!cand.estimate?.invoiced && !cand.estimate?.paidAt;
    case "invoice_paid": return !!cand.estimate?.paidAt;
    case "job_completed": return cand.job?.status === "completed";
    default: return true; // unrecognized custom condition keys don't block sends
  }
};

interface Directive {
  stepId: string;
  delayMinutes: number;
  explicitDelay: boolean;
  conditions: string[];
  channel: string;
  messageBody?: string;
  templateKey?: string;
  label: string;
}

// Walks every step after the trigger, accumulating "wait" time and condition
// checks in order, and turns each action/webhook step into its own Directive
// carrying the cumulative delay + conditions gathered up to that point — this
// is what lets a multi-touch drip (e.g. AUTOMATION_TEMPLATES' abandoned
// estimate: wait 3d -> nudge -> wait 4 more days -> urgency) actually fire
// each touch at its own real offset instead of just the first one.
const extractDirectives = (steps: AutomationStep[]): Directive[] => {
  const directives: Directive[] = [];
  let delayMinutes = 0;
  let explicitDelay = false;
  let conditions: string[] = [];
  for (let i = 1; i < steps.length; i++) {
    const s: any = steps[i];
    if (s.type === "delay") {
      const unitMin = s.unit === "hour" ? 60 : s.unit === "week" ? 10080 : 1440;
      delayMinutes += (s.duration || 1) * unitMin;
      explicitDelay = true;
    } else if (s.type === "condition") {
      if (typeof s.delay === "number") { delayMinutes += s.delay; explicitDelay = true; }
      if (s.check || s.condition) conditions.push(s.check || s.condition);
    } else if (s.type === "action" || s.type === "webhook") {
      directives.push({
        stepId: s.id, delayMinutes, explicitDelay, conditions: [...conditions],
        channel: s.type === "webhook" ? "webhook" : (s.channel || "sms"),
        messageBody: s.messageBody, templateKey: s.template, label: s.label || "",
      });
    }
    // branch/tag steps aren't modeled as real branching/tagging yet — later
    // steps are still processed in sequence as a simplification.
  }
  return directives;
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
      const now = new Date();
      const hour = now.getHours();
      const mmdd = todayStr.slice(5);

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

      const reviewLink = (c: Customer) =>
        `${window.location.origin}${window.location.pathname}#/rate?c=${encodeURIComponent(c.id)}&n=${encodeURIComponent(c.firstName)}&g=${encodeURIComponent((settings as any).googlePlaceId ?? "")}&co=${encodeURIComponent((settings as any).companyName ?? "Crew Boss")}`;
      const paymentLink = (estId: string) => `${window.location.origin}${window.location.pathname}#/estimate/${estId}`;

      // ── Category specs — built fresh each tick so candidate lists reflect
      // the latest jobs/customers/estimates/referrals. ────────────────────
      const specs: Record<Category, CategorySpec> = {
        new_lead: {
          direction: "after", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "new_lead",
          getCandidates: () => customers
            .filter(c => Date.now() - new Date(c.createdAt).getTime() < 24 * 3600000)
            .map(c => ({ key: c.id, customer: c, anchorMs: new Date(c.createdAt).getTime() })),
        },
        estimate_expiring: {
          direction: "before", defaultDelayMinutes: 2880, defaultCooldownDays: 30, smsTemplateKey: "estimate_expiring",
          extraVars: cand => ({ payment_link: paymentLink(cand.estimate!.id) }),
          getCandidates: () => estimates.filter(e => e.status === "pending" && e.validUntil).map(e => {
            const c = customers.find(x => x.id === e.customerId);
            return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.validUntil).getTime() } : null;
          }).filter(Boolean) as Candidate[],
        },
        job_reminder: {
          direction: "before", defaultDelayMinutes: 1440, defaultCooldownDays: 1, smsTemplateKey: "job_reminder",
          getCandidates: () => jobs.filter(j => j.status === "scheduled" && j.scheduledDate).map(j => {
            const c = customers.find(x => x.id === j.customerId);
            if (!c) return null;
            const t = j.scheduledTime ? new Date(`${j.scheduledDate}T${j.scheduledTime}`) : new Date(`${j.scheduledDate}T08:00:00`);
            return { key: j.id, customer: c, job: j, anchorMs: t.getTime() };
          }).filter(Boolean) as Candidate[],
        },
        job_reminder_morning: {
          direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 1, smsTemplateKey: "job_reminder",
          getCandidates: () => hour >= 6 && hour < 10
            ? jobs.filter(j => j.status === "scheduled" && j.scheduledDate === todayStr).map(j => {
                const c = customers.find(x => x.id === j.customerId);
                return c ? { key: j.id, customer: c, job: j, anchorMs: Date.now() } : null;
              }).filter(Boolean) as Candidate[]
            : [],
        },
        crew_starts: {
          direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 1, smsTemplateKey: "crew_starts",
          getCandidates: () => jobs.filter(j => j.status === "in_progress" && j.scheduledDate === todayStr).map(j => {
            const c = customers.find(x => x.id === j.customerId);
            return c ? { key: j.id, customer: c, job: j, anchorMs: Date.now() } : null;
          }).filter(Boolean) as Candidate[],
        },
        job_scheduled: {
          direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "job_scheduled",
          getCandidates: () => jobs.filter(j => j.status === "scheduled" && daysSince((j as any).createdAt || j.scheduledDate) <= 2).map(j => {
            const c = customers.find(x => x.id === j.customerId);
            return c ? { key: j.id, customer: c, job: j, anchorMs: Date.now() } : null;
          }).filter(Boolean) as Candidate[],
        },
        review_request: {
          direction: "after", defaultDelayMinutes: 2880, defaultCooldownDays: 3650, smsTemplateKey: "review_request",
          extraVars: cand => ({ review_link: reviewLink(cand.customer) }),
          getCandidates: () => jobs.filter(j => j.status === "completed").map(j => {
            const c = customers.find(x => x.id === j.customerId);
            if (!c) return null;
            const completedDate = j.signOff?.timestamp?.slice(0, 10) || j.scheduledDate;
            if (!completedDate || daysSince(completedDate) > 14) return null; // don't blast old completed-job backlog
            if (c.reviewRequested && daysSince(c.reviewRequested) < 90) return null;
            const anchorMs = j.signOff?.timestamp ? new Date(j.signOff.timestamp).getTime() : new Date(completedDate).getTime();
            return { key: j.id, customer: c, job: j, anchorMs };
          }).filter(Boolean) as Candidate[],
        },
        estimate_followup: {
          direction: "after", defaultDelayMinutes: 1440, defaultCooldownDays: 3, conditionKey: "estimate_not_viewed", smsTemplateKey: "estimate_followup",
          getCandidates: () => estimates.filter(e => e.status === "pending" && e.sentAt).map(e => {
            const c = customers.find(x => x.id === e.customerId);
            return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.sentAt!).getTime() } : null;
          }).filter(Boolean) as Candidate[],
        },
        estimate_viewed: {
          direction: "after", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "estimate_viewed_ack",
          getCandidates: () => estimates.filter(e => e.viewed && e.sentAt && daysSince(e.viewedAt || e.sentAt!) <= 3).map(e => {
            const c = customers.find(x => x.id === e.customerId);
            return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.viewedAt || e.sentAt!).getTime() } : null;
          }).filter(Boolean) as Candidate[],
        },
        estimate_accepted: {
          direction: "after", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "estimate_accepted",
          getCandidates: () => estimates.filter(e => e.status === "approved" && daysSince(e.signedAt || e.sentAt || e.createdAt) <= 3).map(e => {
            const c = customers.find(x => x.id === e.customerId);
            return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.signedAt || e.sentAt || e.createdAt).getTime() } : null;
          }).filter(Boolean) as Candidate[],
        },
        payment_received: {
          direction: "after", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "payment_received",
          getCandidates: () => estimates.filter(e => e.invoiced && e.paidAt && daysSince(e.paidAt) <= 3).map(e => {
            const c = customers.find(x => x.id === e.customerId);
            return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.paidAt!).getTime() } : null;
          }).filter(Boolean) as Candidate[],
        },
        payment_overdue: {
          direction: "after", defaultDelayMinutes: 10080, defaultCooldownDays: 3650, conditionKey: "invoice_unpaid",
          extraVars: cand => ({ payment_link: paymentLink(cand.estimate!.id) }),
          getCandidates: () => estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt).map(e => {
            const c = customers.find(x => x.id === e.customerId);
            return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.invoicedAt!).getTime() } : null;
          }).filter(Boolean) as Candidate[],
        },
        maintenance: {
          direction: "after", defaultDelayMinutes: 90 * 1440, defaultCooldownDays: 90, smsTemplateKey: "maintenance_reminder",
          getCandidates: () => customers.map(c => {
            const last = lastServiceDate(jobs, c.id);
            return last ? { key: c.id + ":" + last, customer: c, anchorMs: new Date(last).getTime() } : null;
          }).filter(Boolean) as Candidate[],
        },
        birthday: {
          direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 300, smsTemplateKey: "birthday",
          getCandidates: () => hour >= 8 && hour < 9
            ? customers.filter(c => c.birthday && c.birthday.slice(5) === mmdd).map(c => ({ key: c.id + ":" + now.getFullYear(), customer: c, anchorMs: Date.now() }))
            : [],
        },
        seasonal_spring: {
          direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 300, smsTemplateKey: "seasonal_spring",
          getCandidates: () => (now.getMonth() === 2 && now.getDate() <= 3)
            ? customers.map(c => ({ key: c.id + ":" + now.getFullYear(), customer: c, anchorMs: Date.now() }))
            : [],
        },
        seasonal_fall: {
          direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 300, smsTemplateKey: "seasonal_fall",
          getCandidates: () => (now.getMonth() === 9 && now.getDate() <= 3)
            ? customers.map(c => ({ key: c.id + ":" + now.getFullYear(), customer: c, anchorMs: Date.now() }))
            : [],
        },
        abandoned_estimate: {
          direction: "after", defaultDelayMinutes: 3 * 1440, defaultCooldownDays: 3650, conditionKey: "estimate_not_approved",
          getCandidates: () => estimates.filter(e => e.status === "pending" && e.sentAt).map(e => {
            const c = customers.find(x => x.id === e.customerId);
            return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.sentAt!).getTime() } : null;
          }).filter(Boolean) as Candidate[],
        },
        reengage: {
          direction: "after", defaultDelayMinutes: 180 * 1440, defaultCooldownDays: 90, smsTemplateKey: "reengage",
          getCandidates: () => customers.map(c => {
            const last = lastServiceDate(jobs, c.id);
            return last ? { key: c.id + ":" + last, customer: c, anchorMs: new Date(last).getTime() } : null;
          }).filter(Boolean) as Candidate[],
        },
        anniversary: {
          direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 300, smsTemplateKey: "anniversary",
          getCandidates: () => customers.filter(c => c.createdAt && daysSince(c.createdAt) >= 365 && c.createdAt.slice(5, 10) === mmdd)
            .map(c => ({ key: c.id + ":" + now.getFullYear(), customer: c, anchorMs: Date.now() })),
        },
        referral_ask: {
          direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "referral_ask",
          getCandidates: () => customers.filter(c => jobs.filter(j => j.customerId === c.id && j.status === "completed").length >= 3)
            .map(c => ({ key: c.id, customer: c, anchorMs: Date.now() })),
        },
        referral_reward: {
          direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "referral_reward",
          extraVars: cand => ({ reward: String(cand.referral?.reward ?? "") }),
          getCandidates: () => referrals.filter(r => r.status === "completed" && r.reward).map(r => {
            const c = customers.find(x => x.id === r.referrerId);
            return c ? { key: r.id, customer: c, referral: r, anchorMs: Date.now() } : null;
          }).filter(Boolean) as Candidate[],
        },
        referral_booked: {
          direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "referral_booked",
          getCandidates: () => referrals.filter(r => r.status === "booked" && daysSince(r.createdAt) <= 14).map(r => {
            const c = customers.find(x => x.id === r.referrerId);
            return c ? { key: r.id, customer: c, referral: r, anchorMs: Date.now() } : null;
          }).filter(Boolean) as Candidate[],
        },
        // No live "reviews" feed is wired into this hook yet — these
        // categories classify correctly (no more console warnings) but have
        // no candidates until a `reviews` prop is threaded through.
        review_good: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 3650, getCandidates: () => [] },
        review_bad: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 3650, getCandidates: () => [] },
        manual: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 3650, getCandidates: () => [] },
        weekly_scheduled: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 3650, getCandidates: () => [] },
      };

      const buildMessage = (auto: Automation, dir: Directive, spec: CategorySpec, cand: Candidate) => {
        const vars: Record<string, string> = {
          first_name: cand.customer.firstName,
          last_name: cand.customer.lastName,
          amount: cand.estimate ? `$${cand.estimate.total}` : "",
          date: cand.job?.scheduledDate || "",
          address: cand.customer.address || "",
          review_link: "", payment_link: "", reward: "",
          company_phone: (settings as any).companyPhone || (settings as any).twilioFrom || "",
          ...(spec.extraVars ? spec.extraVars(cand) : {}),
        };
        const raw = dir.messageBody
          || (dir.templateKey && SMS_TEMPLATES[dir.templateKey])
          || (spec.smsTemplateKey && SMS_TEMPLATES[spec.smsTemplateKey])
          || `Hi {{first_name}}, ${dir.label || auto.action || auto.name}. — Crew Boss`;
        return { subject: auto.name || dir.label || "Update from Crew Boss", body: fillTemplate(raw, vars) };
      };

      const sendDirective = async (auto: Automation, channel: string, cand: Candidate, subject: string, body: string, dedupKey: string): Promise<boolean> => {
        const c = cand.customer;
        if (channel === "email") {
          if (!c.email) return false;
          try {
            await sendOwnerGmailOnly(settings as any, c.email, subject, emailShell((settings as any).companyName || "Crew Boss", subject, `<p>${body.replace(/\n/g, "<br/>")}</p>`));
            recordSend(auto, dedupKey, c.firstName + " " + c.lastName);
            toast(`📧 ${auto.name} → ${c.firstName}`);
            return true;
          } catch (e: any) {
            // BLOCKER 1b — same one-warning-per-automation-per-session
            // throttle as the SMS branch below, for the "not configured"
            // case specifically; genuine per-message failures still log
            // every time since those are actionable per-customer issues.
            const msg = e?.message || String(e);
            if (msg.includes("Gmail not connected")) {
              const key = `${auto.id}:none-configured`;
              if (!notConfiguredWarnedThisSession.has(key)) {
                notConfiguredWarnedThisSession.add(key);
                console.warn(`[Automations] "${auto.name}" — email failed: ${msg} Configure Google in Settings → Integrations. (further attempts for this automation are logged only once per session)`);
              }
            } else {
              console.error("[Automations]", auto.name, "— email failed for", c.firstName, ":", msg);
            }
            return false;
          }
        }
        if (channel === "webhook") return false; // no reliable webhook URL field wired from the builder yet
        if (!c.phone || c.smsOptOut) return false;
        try {
          await twilioSend(settings, c.phone, body);
          logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body }).catch(() => {});
          recordSend(auto, dedupKey, c.firstName + " " + c.lastName);
          toast(`📱 ${auto.name} → ${c.firstName}`);
          return true;
        } catch (e: any) {
          const msg = e?.message || String(e);
          const isTwilioNotConfigured = msg.includes("Twilio not configured");
          // BLOCKER 1a — SMS can't go out because Twilio isn't set up, but the
          // automation itself still has something worth telling the customer.
          // Fall back to the owner's Gmail rather than just failing, same as
          // the "email" channel branch above.
          if (isTwilioNotConfigured && c.email) {
            const fallbackKey = `${auto.id}:twilio-fallback`;
            if (!notConfiguredWarnedThisSession.has(fallbackKey)) {
              notConfiguredWarnedThisSession.add(fallbackKey);
              console.warn(`[Automations] Twilio not configured — falling back to email for ${auto.name}`);
            }
            try {
              await sendOwnerGmailOnly(settings as any, c.email, subject, emailShell((settings as any).companyName || "Crew Boss", subject, `<p>${body.replace(/\n/g, "<br/>")}</p>`));
              recordSend(auto, dedupKey, c.firstName + " " + c.lastName);
              toast(`📧 ${auto.name} → ${c.firstName} (SMS unavailable — sent via email)`);
              return true;
            } catch (emailErr: any) {
              // BLOCKER 1b — neither channel is actually usable. One warning
              // per automation per session, not one per candidate per tick.
              const noneKey = `${auto.id}:none-configured`;
              if (!notConfiguredWarnedThisSession.has(noneKey)) {
                notConfiguredWarnedThisSession.add(noneKey);
                console.warn(`[Automations] "${auto.name}" — SMS unavailable (Twilio not configured) and email fallback also failed (${emailErr?.message || "Gmail not connected"}). Configure Twilio or Google in Settings → Integrations. (further attempts for this automation are logged only once per session)`);
              }
              return false;
            }
          }
          if (isTwilioNotConfigured) {
            // No email on file to fall back to, either — still throttled.
            const noneKey = `${auto.id}:none-configured`;
            if (!notConfiguredWarnedThisSession.has(noneKey)) {
              notConfiguredWarnedThisSession.add(noneKey);
              console.warn(`[Automations] "${auto.name}" — Twilio not configured, and ${c.firstName} ${c.lastName} has no email on file to fall back to. Configure Twilio in Settings → Integrations. (further attempts for this automation are logged only once per session)`);
            }
            return false;
          }
          // A genuine per-message send failure (bad number, Twilio rejected
          // it, etc.) — not a "not configured" case, so always surface it.
          console.error("[Automations]", auto.name, "— failed for", c.firstName, ":", msg);
          return false;
        }
      };

      for (const auto of automations) {
        if (!auto.active) continue;
        const steps = auto.steps || [];
        const isLegacy = steps.length === 0;
        const triggerLabel = steps[0]?.label || auto.trigger || "";
        const category = classifyTrigger(triggerLabel) || classifyTrigger(auto.trigger);
        if (!category) {
          console.warn(`[Automations] "${auto.name}" (trigger: "${auto.trigger}") has no matching engine handler yet.`);
          continue;
        }
        const spec = specs[category];

        let directives: Directive[];
        if (isLegacy) {
          const legacy: Directive = {
            stepId: "legacy", delayMinutes: spec.defaultDelayMinutes, explicitDelay: false,
            conditions: spec.conditionKey ? [spec.conditionKey] : [], channel: "sms",
            templateKey: spec.smsTemplateKey, label: auto.action || auto.name,
          };
          if (category === "payment_overdue") {
            const days = deriveDaysFromLabel(triggerLabel, 7);
            legacy.delayMinutes = days * 1440;
            legacy.templateKey = days <= 3 ? "payment_overdue_3" : days <= 10 ? "payment_overdue_7" : "payment_overdue_14";
          } else if (category === "abandoned_estimate") {
            const days = deriveDaysFromLabel(triggerLabel, 3);
            legacy.delayMinutes = days * 1440;
            legacy.templateKey = days <= 3 ? "abandoned_estimate_1" : days <= 10 ? "abandoned_estimate_2" : "abandoned_estimate_3";
          } else {
            legacy.delayMinutes = deriveDelayMinutesFromLabel(triggerLabel, spec.defaultDelayMinutes);
          }
          directives = [legacy];
        } else {
          directives = extractDirectives(steps);
        }

        for (const dir of directives) {
          const effectiveDelay = dir.explicitDelay ? dir.delayMinutes : dir.delayMinutes || spec.defaultDelayMinutes;
          for (const cand of spec.getCandidates()) {
            if (dir.conditions.some(c => !evalCondition(c, cand))) continue;
            let ok: boolean;
            if (spec.direction === "before") {
              const untilMs = cand.anchorMs - Date.now();
              ok = untilMs <= effectiveDelay * 60000 && untilMs > -3600000;
            } else if (spec.direction === "after") {
              ok = Date.now() - cand.anchorMs >= effectiveDelay * 60000;
            } else {
              ok = true;
            }
            if (!ok) continue;
            const dedupKey = `${category}:${dir.stepId}:${cand.key}`;
            const cooldownDays = dir.stepId === "legacy" ? spec.defaultCooldownDays : 3650;
            if (alreadySent(auto, dedupKey, cooldownDays)) continue;
            const { subject, body } = buildMessage(auto, dir, spec, cand);
            await sendDirective(auto, dir.channel, cand, subject, body, dedupKey);
          }
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

    run();
    const interval = setInterval(run, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [automations, jobs, customers, estimates, referrals, settings]); // eslint-disable-line
}
