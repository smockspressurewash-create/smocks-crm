import { useEffect, useRef, useState, useCallback } from "react";
import type { Automation, AutomationStep, Job, Customer, Estimate, Referral, AppSettings, Employee, Goal } from "../types";
import { today, daysSince } from "../lib/utils";
import { twilioSend, logOutboundSmsToInbox, sendOwnerGmailOnly, emailShell } from "../lib/messaging";

interface AutomationEngineProps {
  automations: Automation[];
  setAutomations: React.Dispatch<React.SetStateAction<Automation[]>>;
  jobs: Job[];
  customers: Customer[];
  estimates: Estimate[];
  referrals?: Referral[];
  // FEATURE — owner/employee-facing report automations (end-of-day summary,
  // quarterly/yearly summary, weekly progress report, shift summary,
  // performance report) need employee records (to notify a specific tech)
  // and goals (to summarize KPI progress). Both optional/default-empty so
  // every existing caller of this hook keeps compiling unchanged.
  employees?: Employee[];
  goals?: Goal[];
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
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

// CRITICAL (automation spam incident) — a second, independent layer of
// defense on top of the sentLog/cooldown check in `alreadySent` below.
// sentLog persistence relies on a round trip through React state
// (setAutomations) and usePersistent's localStorage write. This module-scope
// Set is synchronous and survives every re-render for the life of this
// browser tab: once a given automation+recipient combination is actually
// sent (approved), it can never be sent a second time in this session no
// matter what happens to sentLog. It is NOT a substitute for sentLog (a
// fresh page load starts this Set empty) — it's a same-tab circuit breaker
// against a double "Send All" click or an overlapping approve call.
const firedThisSession = new Set<string>();
let automationsPausedLoggedThisSession = false;

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
  | "referral_reward" | "referral_booked" | "review_good" | "review_bad" | "manual" | "weekly_scheduled"
  // FEATURE — owner/employee report automations. These target the owner's
  // or an employee's own inbox instead of a customer, using a synthetic
  // Candidate whose `customer` field is actually a pseudo-recipient (see
  // ownerCandidate()/employee candidate builders below) so the rest of the
  // pipeline (buildMessage, sendOne, dedup, daily cap) doesn't need to know
  // the difference.
  | "owner_daily_summary" | "owner_periodic_summary" | "employee_shift_summary" | "employee_performance_report";

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
  // AutomationEditor.tsx's simple dropdown labels this trigger "1 year since
  // first service" (no literal "anniversary" in the text at all — and it
  // doesn't match the "maintenance" pattern above either, since that requires
  // the exact substring "since service", not "since first service") — that
  // mismatch was the actual reason "Customer anniversary" kept logging "no
  // matching engine handler yet" even though the anniversary category/spec
  // below has always existed and works fine once classified correctly.
  if (/anniversary|1 year since|year since first service/.test(t)) return "anniversary";
  if (/reward earned|referr.*reward/.test(t)) return "referral_reward";
  if (/referr.*book/.test(t)) return "referral_booked";
  if (/review submitted|5 star/.test(t) && /review/.test(t)) return "review_good";
  if (/negative review|≤3|low.?rating/.test(t)) return "review_bad";
  if (/manual/.test(t)) return "manual";
  // Owner/employee report categories — matched before the generic "weekly"
  // check below so a label like "Weekly performance report" classifies as
  // employee_performance_report, not the generic weekly_scheduled bucket.
  if (/end of day|daily (business )?summary|eod summary/.test(t)) return "owner_daily_summary";
  if (/quarterly|year-?end|yearly (business )?summary|annual (business )?summary/.test(t)) return "owner_periodic_summary";
  if (/shift (summary|ended?|end)\b|end of shift|clock(ed)? out/.test(t)) return "employee_shift_summary";
  if (/performance (report|summary)/.test(t)) return "employee_performance_report";
  if (/every monday|weekly/.test(t)) return "weekly_scheduled";
  return null;
};

interface Candidate {
  key: string;
  // For owner/employee report categories, `customer` is a synthetic
  // pseudo-recipient (id "owner:..."/"employee:<id>", firstName/email/phone
  // populated from settings or the real Employee row) — this keeps
  // buildMessage/sendOne/dedup/daily-cap logic identical for every category
  // instead of forking a separate send path for internal reports.
  customer: Customer;
  job?: Job;
  estimate?: Estimate;
  referral?: Referral;
  // Set only for employee_shift_summary/employee_performance_report — the
  // real Employee row backing the pseudo `customer` above, so extraVars can
  // read actual shift/rating data without re-deriving it from the pseudo id.
  employee?: Employee;
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

// ── Batch-approval types (owner review gate) ────────────────────────────────
// A tick no longer sends anything directly. It gathers every candidate that
// passes every check (active, category matched, timing window, condition,
// per-invoice cooldown, per-customer daily cap) into a batch and hands it to
// the owner via pendingBatch; nothing goes out until they click "Send All" in
// AutomationBatchModal (rendered from App.tsx). "Skip" discards the batch
// with zero sends. "Pause Automations" flips the existing kill switch.
export interface PendingAutomationItem {
  id: string;
  autoId: string;
  autoName: string;
  category: Category;
  dedupKey: string;
  channel: string;
  subject: string;
  body: string;
  customerId: string;
  customerName: string;
  estimateId?: string;
  jobId?: string;
  referralId?: string;
  conditions: string[];
}
export interface PendingAutomationBatch {
  items: PendingAutomationItem[];
  createdAt: number;
  // FEATURE — how many additional candidates cleared every other check but
  // were held back by the daily send cap (settings.automationMaxSendsPerDay).
  // 0 when nothing was capped.
  heldBackCount: number;
  // FEATURE — A2P 10DLC campaign compliance ("ATP checking"). Non-null only
  // when a Messaging Service SID is configured AND its last-checked status
  // (Settings → Integrations → Twilio → Check Campaign Status) isn't
  // VERIFIED — surfaced as a warning in AutomationBatchModal before the
  // owner approves a send, not a hard block (the cached check can go stale,
  // and 1:1 replies/manual sends aren't gated on this at all).
  campaignWarning: string | null;
}
export interface AutomationEngineResult {
  pendingBatch: PendingAutomationBatch | null;
  approveBatch: () => Promise<void>;
  skipBatch: () => void;
}

export function useAutomationEngine({
  automations,
  setAutomations,
  jobs,
  customers,
  estimates,
  referrals = [],
  employees = [],
  goals = [],
  settings,
  setSettings,
  toast,
}: AutomationEngineProps): AutomationEngineResult {
  const lastRunRef = useRef<string>("");
  // FIX 1 (automations firing repeatedly for the same person) — root cause:
  // this effect used to depend directly on [automations, jobs, customers,
  // estimates, referrals, settings], and jobs/customers/estimates/settings
  // all get brand-new array/object references on every 3-10s poll refresh
  // (App.tsx's refetchData/refetchEmployees). Every one of those poll ticks
  // tore this effect down and re-ran it — and re-running called run()
  // immediately, so the 15-minute setInterval never actually governed
  // anything. Fix: the interval is now set up once ([] deps) and reads the
  // latest jobs/customers/estimates/referrals/settings/automations from refs
  // at execution time, so fresh poll data no longer restarts the timer, and
  // an isRunningRef guard blocks a new run from overlapping a still-in-flight
  // one entirely.
  const isRunningRef = useRef(false);
  const automationsRef = useRef(automations);
  const jobsRef = useRef(jobs);
  const customersRef = useRef(customers);
  const estimatesRef = useRef(estimates);
  const referralsRef = useRef(referrals);
  const employeesRef = useRef(employees);
  const goalsRef = useRef(goals);
  const settingsRef = useRef(settings);
  const toastRef = useRef(toast);
  const setAutomationsRef = useRef(setAutomations);
  const setSettingsRef = useRef(setSettings);
  automationsRef.current = automations;
  jobsRef.current = jobs;
  customersRef.current = customers;
  estimatesRef.current = estimates;
  referralsRef.current = referrals;
  employeesRef.current = employees;
  goalsRef.current = goals;
  settingsRef.current = settings;
  toastRef.current = toast;
  setAutomationsRef.current = setAutomations;
  setSettingsRef.current = setSettings;

  const [pendingBatch, setPendingBatch] = useState<PendingAutomationBatch | null>(null);
  const pendingBatchRef = useRef<PendingAutomationBatch | null>(null);
  pendingBatchRef.current = pendingBatch;
  const isApprovingRef = useRef(false);

  const reviewLink = (c: Customer, settings: AppSettings) =>
    `${window.location.origin}${window.location.pathname}#/rate?c=${encodeURIComponent(c.id)}&n=${encodeURIComponent(c.firstName)}&g=${encodeURIComponent((settings as any).googlePlaceId ?? "")}&rl=${encodeURIComponent((settings as any).googleReviewLink ?? "")}&co=${encodeURIComponent((settings as any).companyName ?? "Crew Boss")}`;
  const paymentLink = (estId: string) => `${window.location.origin}${window.location.pathname}#/estimate/${estId}`;
  // Same link format ReferralsPage.tsx/ClientAuthPortal.tsx/ReferralLanding.tsx
  // already use for a customer's referral code — reused here rather than
  // inventing a second referral-link scheme.
  const referralLink = (c: Customer) =>
    `${window.location.origin}${window.location.pathname}#/referral?ref=${encodeURIComponent(c.referralCode || "")}`;

  // ── Owner/employee pseudo-recipients ──────────────────────────────────────
  // sendOne/buildMessage only know how to address a Candidate's `customer`
  // field — rather than forking a second send path for "internal" reports,
  // these build a minimal Customer-shaped object carrying the owner's or an
  // employee's real email/phone so the exact same send/dedup/cap machinery
  // handles them. `id` is prefixed so it can never collide with a real
  // customer id in dailyLog/sentLog/firedThisSession bookkeeping.
  const ownerCandidate = (settings: AppSettings, key: string): Candidate | null => {
    const email = (settings as any).companyEmail || (settings as any).myEmail || (settings as any).googleEmail;
    if (!email) return null;
    const rawName = ((settings as any).ownerName || (settings as any).companyName || "Owner").trim();
    const [firstName, ...rest] = rawName.split(/\s+/);
    const pseudo = {
      id: `owner:${key}`, firstName: firstName || "Owner", lastName: rest.join(" "), email, phone: "",
      address: "", tags: [], totalSpent: 0, createdAt: "",
    } as unknown as Customer;
    return { key: `owner:${key}`, customer: pseudo, anchorMs: Date.now() };
  };
  const employeeCandidates = (employees: Employee[], keySuffix: string): Candidate[] =>
    employees.filter(e => e.status === "active" && e.email).map(e => {
      const pseudo = {
        id: `employee:${e.id}`, firstName: e.firstName, lastName: e.lastName, email: e.email, phone: e.phone || "",
        address: "", tags: [], totalSpent: 0, createdAt: "",
      } as unknown as Customer;
      return { key: `employee:${e.id}:${keySuffix}`, customer: pseudo, employee: e, anchorMs: Date.now() };
    });

  const buildMessage = (auto: Automation, dir: Directive, spec: CategorySpec, cand: Candidate, settings: AppSettings) => {
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
    // ISSUE 23 (round 3) — SMS_TEMPLATES above is a static module-level
    // Record with "Crew Boss" baked into ~20 templates; turning each into a
    // function of settings would be a much bigger diff for the same result.
    // Every automated send passes through here, so substituting the brand
    // name once at build time covers all of them (and dir.messageBody /
    // the inline fallback above) without touching the template table.
    const coName = (settings as any).companyName || "Crew Boss";
    const branded = coName === "Crew Boss" ? raw : raw.replace(/Crew Boss/g, coName);
    return { subject: auto.name || dir.label || `Update from ${coName}`, body: fillTemplate(branded, vars) };
  };

  // Actually performs one send (email or SMS, with the existing Twilio ->
  // email fallback). Only ever called from approveBatch, i.e. only after the
  // owner has explicitly clicked "Send All" on a reviewed batch.
  const sendOne = async (auto: Automation, channel: string, cand: Candidate, subject: string, body: string, settings: AppSettings, toast: (msg: string) => void, onSent: () => void): Promise<boolean> => {
    const c = cand.customer;
    if (channel === "email") {
      if (!c.email) return false;
      try {
        await sendOwnerGmailOnly(settings as any, c.email, subject, emailShell(settings as any,subject, `<p>${body.replace(/\n/g, "<br/>")}</p>`));
        onSent();
        toast(`📧 ${auto.name} → ${c.firstName}`);
        return true;
      } catch (e: any) {
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
      onSent();
      toast(`📱 ${auto.name} → ${c.firstName}`);
      return true;
    } catch (e: any) {
      const msg = e?.message || String(e);
      const isTwilioNotConfigured = msg.includes("Twilio not configured");
      if (isTwilioNotConfigured && c.email) {
        const fallbackKey = `${auto.id}:twilio-fallback`;
        if (!notConfiguredWarnedThisSession.has(fallbackKey)) {
          notConfiguredWarnedThisSession.add(fallbackKey);
          console.warn(`[Automations] Twilio not configured — falling back to email for ${auto.name}`);
        }
        try {
          await sendOwnerGmailOnly(settings as any, c.email, subject, emailShell(settings as any,subject, `<p>${body.replace(/\n/g, "<br/>")}</p>`));
          onSent();
          toast(`📧 ${auto.name} → ${c.firstName} (SMS unavailable — sent via email)`);
          return true;
        } catch (emailErr: any) {
          const noneKey = `${auto.id}:none-configured`;
          if (!notConfiguredWarnedThisSession.has(noneKey)) {
            notConfiguredWarnedThisSession.add(noneKey);
            console.warn(`[Automations] "${auto.name}" — SMS unavailable (Twilio not configured) and email fallback also failed (${emailErr?.message || "Gmail not connected"}). Configure Twilio or Google in Settings → Integrations. (further attempts for this automation are logged only once per session)`);
          }
          return false;
        }
      }
      if (isTwilioNotConfigured) {
        const noneKey = `${auto.id}:none-configured`;
        if (!notConfiguredWarnedThisSession.has(noneKey)) {
          notConfiguredWarnedThisSession.add(noneKey);
          console.warn(`[Automations] "${auto.name}" — Twilio not configured, and ${c.firstName} ${c.lastName} has no email on file to fall back to. Configure Twilio in Settings → Integrations. (further attempts for this automation are logged only once per session)`);
        }
        return false;
      }
      console.error("[Automations]", auto.name, "— failed for", c.firstName, ":", msg);
      return false;
    }
  };

  useEffect(() => {
    const run = async () => {
      const nowKey = new Date().toISOString().slice(0, 16); // minute precision
      if (lastRunRef.current === nowKey) return;
      if (isRunningRef.current) return; // a previous tick is still gathering — never overlap
      // GUARDRAIL (batch approval) — never gather a second batch while one is
      // still awaiting the owner's Send All / Skip decision. Resolve the
      // current one first.
      if (pendingBatchRef.current) return;
      lastRunRef.current = nowKey;
      isRunningRef.current = true;

      const automations = automationsRef.current;
      const jobs = jobsRef.current;
      const customers = customersRef.current;
      const estimates = estimatesRef.current;
      const referrals = referralsRef.current;
      const employees = employeesRef.current;
      const goals = goalsRef.current;
      const settings = settingsRef.current;

      try {

      // CRITICAL — kill switch (automation spam incident). Defaults to
      // paused for every existing owner (undefined reads as paused via
      // `!== false`) until they explicitly re-enable it in the Automations
      // page. Nothing below this check runs at all while paused.
      if (settings.automationsPaused !== false) {
        if (!automationsPausedLoggedThisSession) {
          automationsPausedLoggedThisSession = true;
          console.log("[Automations] paused (kill switch) — enable in the Automations page to resume sending.");
        }
        return;
      }

      const todayStr = today();
      const now = new Date();
      const hour = now.getHours();
      const mmdd = todayStr.slice(5);

      const alreadySent = (auto: Automation, key: string, cooldownDays: number): boolean => {
        const last = auto.sentLog?.[key];
        return !!last && daysSince(last) < cooldownDays;
      };

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
          extraVars: cand => ({ review_link: reviewLink(cand.customer, settings) }),
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
          // extraVars adds referral_link/referral_code (reusing the same
          // #/referral?ref=CODE format ReferralsPage.tsx/ClientAuthPortal.tsx
          // already use) for the "Client: Referral Request" template — every
          // other payment_received template just ignores these vars.
          extraVars: cand => ({ referral_link: referralLink(cand.customer), referral_code: cand.customer.referralCode || "" }),
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
        // FEATURE — owner weekly progress report (goals/KPI summary). Fires
        // Monday mornings 8-9am. weekly_scheduled previously classified
        // correctly but always returned zero candidates ("not wired yet") —
        // reused here rather than adding a parallel "weekly" category.
        weekly_scheduled: {
          direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 5,
          extraVars: () => ({
            goals_summary: goals.length
              ? goals.map(g => `${g.label}: ${g.current}/${g.target}${g.unit ? " " + g.unit : ""}`).join("; ")
              : "No goals set yet — add some in Accountability → Goals.",
          }),
          getCandidates: () => (now.getDay() === 1 && hour === 8) ? [ownerCandidate(settings, "weekly-progress")].filter(Boolean) as Candidate[] : [],
        },
        // FEATURE — owner end-of-day summary. Fires once in the configured
        // hour window (defaults to 6-7pm, matching the metrics the manual
        // "Send Daily Briefing Now" button already computes — App.tsx
        // sendDailyBriefingNow — so both surfaces report the same numbers).
        // AUDIT — "daily (or admin-configurable frequency)": the owner can
        // change the hour it fires (settings.ownerSummaryHour, Automations
        // page) and switch cadence to weekly-only (settings.ownerSummaryFreq
        // === "weekly", Monday only) instead of every day — read fresh off
        // settings every tick so a change takes effect on the next 15-min
        // poll without needing a reload.
        owner_daily_summary: {
          direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 1,
          extraVars: () => {
            const todaysJobs = jobs.filter(j => j.scheduledDate === todayStr);
            const completed = todaysJobs.filter(j => j.status === "completed");
            const revenue = completed.reduce((s, j) => s + (Number(j.amount) || 0), 0);
            const newLeads = customers.filter(c => (c.createdAt || "").slice(0, 10) === todayStr).length;
            return {
              jobs_completed: String(completed.length),
              jobs_total: String(todaysJobs.length),
              revenue: `$${revenue.toFixed(2)}`,
              new_leads: String(newLeads),
            };
          },
          getCandidates: () => {
            const cfgHour = Number((settings as any).ownerSummaryHour);
            const targetHour = Number.isFinite(cfgHour) && cfgHour >= 0 && cfgHour <= 23 ? cfgHour : 18;
            const freq = (settings as any).ownerSummaryFreq || "daily";
            if (hour !== targetHour) return [];
            if (freq === "weekly" && now.getDay() !== 1) return [];
            if (freq === "off") return [];
            return [ownerCandidate(settings, "eod")].filter(Boolean) as Candidate[];
          },
        },
        // FEATURE — owner quarterly/yearly business summary. The engine has
        // no arbitrary cron scheduler (see classifyTrigger's comment block
        // above this file's trigger classification section) — this reuses
        // the same "match a specific calendar date + hour window on every
        // 15-min tick" mechanism the existing seasonal/birthday/anniversary
        // categories already rely on, firing on the 1st of each calendar
        // quarter (Jan/Apr/Jul/Oct) — the closest supported cadence to
        // "quarterly", and a strict superset that also covers "yearly"
        // (Jan 1st is both a quarter-start and a year-start).
        owner_periodic_summary: {
          direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 80,
          extraVars: () => {
            const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
            const qStart = new Date(now.getFullYear(), qStartMonth, 1).toISOString().slice(0, 10);
            const qJobs = jobs.filter(j => j.status === "completed" && j.scheduledDate >= qStart && j.scheduledDate <= todayStr);
            const revenue = qJobs.reduce((s, j) => s + (Number(j.amount) || 0), 0);
            const newCustomers = customers.filter(c => (c.createdAt || "").slice(0, 10) >= qStart).length;
            return {
              period_jobs: String(qJobs.length),
              period_revenue: `$${revenue.toFixed(2)}`,
              period_new_customers: String(newCustomers),
            };
          },
          getCandidates: () => ([0, 3, 6, 9].includes(now.getMonth()) && now.getDate() === 1 && hour === 8)
            ? [ownerCandidate(settings, "periodic")].filter(Boolean) as Candidate[] : [],
        },
        // FEATURE — employee end-of-shift summary. lastShiftDate/
        // lastShiftHours are written once, at the moment an employee taps
        // "End My Day" in EmployeePortal.tsx, so `lastShiftDate === todayStr`
        // (with dayClockInAt already cleared) is the real "shift just ended
        // today" signal, not a guess.
        employee_shift_summary: {
          direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 1,
          extraVars: cand => {
            const emp = cand.employee!;
            const empJobsToday = jobs.filter(j => (j.crew || []).includes(emp.id) && j.scheduledDate === todayStr);
            return {
              hours_worked: Number(emp.lastShiftHours || 0).toFixed(1),
              jobs_completed: String(empJobsToday.filter(j => j.status === "completed").length),
              jobs_total: String(empJobsToday.length),
            };
          },
          // BUG FIX — this duplicated a send that already happens
          // unconditionally: EmployeePortal.tsx's sendEndOfDaySummary fires
          // the moment "End My Day" is tapped, no automation/approval gate
          // involved, emailing BOTH the employee and the owner directly with
          // a fuller breakdown (hours, pay, checklist rate) than this
          // template's single line. An owner who'd added the "Employee:
          // Shift Summary" automation template (still selectable from the
          // library — kept for anyone who wants to customize it themselves)
          // saw the SAME shift they already got emailed about show up again
          // minutes later in the "review before sending" popup, reading as
          // "this already sent, why is it asking again." Always return no
          // candidates so this built-in trigger can never re-queue what the
          // direct send already covered.
          getCandidates: () => [],
        },
        // FEATURE — employee performance report (weekly, Monday mornings).
        // Reports the trailing 7 days of that employee's completed jobs plus
        // their existing ratingScore field (EmployeesPage.tsx) rather than
        // fabricating a metric this app doesn't actually track.
        employee_performance_report: {
          direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 5,
          extraVars: cand => {
            const emp = cand.employee!;
            const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
            const recentJobs = jobs.filter(j => (j.crew || []).includes(emp.id) && j.status === "completed" && j.scheduledDate >= weekAgo);
            return {
              jobs_completed: String(recentJobs.length),
              rating: emp.ratingScore ? emp.ratingScore.toFixed(1) : "N/A",
            };
          },
          getCandidates: () => (now.getDay() === 1 && hour === 9) ? employeeCandidates(employees, "perf-" + todayStr) : [],
        },
      };

      // ── Gather phase — no sends happen here. Every candidate that clears
      // every check becomes a PendingAutomationItem for the owner to review.
      const gathered: PendingAutomationItem[] = [];
      const dailyLog = settings.automationDailySendLog || {};
      const claimedCustomersThisBatch = new Set<string>();
      // GUARDRAIL — explicit total-sends-per-day cap across every automation
      // combined (settings.automationMaxSendsPerDay, default 50), separate
      // from the one-touch-per-customer-per-day rule below. That rule stops
      // any ONE customer being messaged twice — nothing previously stopped a
      // single automation from legitimately matching e.g. 200 customers at
      // once and queuing all 200 into one approval batch.
      const maxSendsPerDay = Math.max(1, Number(settings.automationMaxSendsPerDay) || 50);
      const alreadySentTodayCount = Object.values(dailyLog).filter(d => d === todayStr).length;
      let heldBackCount = 0;

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
          // AUTOMATION SPAM FIX — extractDirectives only attaches conditions
          // from explicit "condition"-type steps the owner dragged into the
          // workflow; it has no idea what category this automation classified
          // as, so it never re-checks payment/response status on its own. The
          // legacy branch above always attaches spec.conditionKey (e.g.
          // "invoice_unpaid" for payment_overdue, "estimate_not_viewed" for
          // estimate_followup) — a multi-step workflow drip (3-day -> 7-day ->
          // 14-day overdue reminders) got no such safety net unless the owner
          // happened to also build an explicit "still unpaid" condition step.
          // Every directive from a workflow now also carries the category's
          // baseline condition, in addition to whatever the workflow itself
          // explicitly checks.
          const raw = extractDirectives(steps);
          directives = spec.conditionKey
            ? raw.map(d => d.conditions.includes(spec.conditionKey!) ? d : { ...d, conditions: [...d.conditions, spec.conditionKey!] })
            : raw;
        }

        for (const dir of directives) {
          const effectiveDelay = dir.explicitDelay ? dir.delayMinutes : dir.delayMinutes || spec.defaultDelayMinutes;
          for (const cand of spec.getCandidates()) {
            // AUDIT FIX — an opted-out (STOP) customer used to still get
            // gathered into the batch every 15 minutes, silently fail inside
            // sendOne (return false, no log), then get re-gathered forever —
            // never actually sent, but a confusing perpetual entry in the
            // owner's approval modal. Skip them before they ever reach it.
            if (dir.channel === "sms" && cand.customer.smsOptOut) continue;
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
            // GUARDRAIL — at most one automation touch per customer per day,
            // across ALL automations (not just this one). Checks both the
            // persisted record (a batch approved earlier today) and this same
            // gather pass (two different automations both wanting to reach
            // the same customer in one tick only get one of them queued).
            if (dailyLog[cand.customer.id] === todayStr) continue;
            if (claimedCustomersThisBatch.has(cand.customer.id)) continue;
            const sessionKey = `${auto.id}:${dedupKey}`;
            if (firedThisSession.has(sessionKey)) continue;
            if (alreadySentTodayCount + gathered.length >= maxSendsPerDay) { heldBackCount++; continue; }
            claimedCustomersThisBatch.add(cand.customer.id);
            const { subject, body } = buildMessage(auto, dir, spec, cand, settings);
            gathered.push({
              id: sessionKey,
              autoId: auto.id, autoName: auto.name, category, dedupKey, channel: dir.channel,
              subject, body, customerId: cand.customer.id, customerName: `${cand.customer.firstName} ${cand.customer.lastName}`,
              estimateId: cand.estimate?.id, jobId: cand.job?.id, referralId: cand.referral?.id,
              conditions: dir.conditions,
            });
          }
        }
      }

      // GUARDRAIL (batch approval popup) — hand the whole tick's findings to
      // the owner instead of sending anything. AutomationBatchModal
      // (rendered from App.tsx) shows count + first few names + Send All /
      // Skip / Pause Automations.
      if (gathered.length > 0 || heldBackCount > 0) {
        const campaignWarning = settings.twilioMessagingServiceSid && settings.twilioA2pCampaignStatus && settings.twilioA2pCampaignStatus !== "VERIFIED"
          ? `Your Twilio A2P campaign status was last checked as "${settings.twilioA2pCampaignStatus}", not VERIFIED — carriers may filter or block these texts. Check Settings → Integrations → Twilio.`
          : null;
        setPendingBatch({ items: gathered, createdAt: Date.now(), heldBackCount, campaignWarning });
      }
      if (heldBackCount > 0) {
        console.warn(`[Automations] ${heldBackCount} candidate(s) held back — daily send cap of ${maxSendsPerDay} reached (Settings → Automations → Max Automation Sends Per Day to raise it)`);
      }

      } finally {
        isRunningRef.current = false;
      }
    };

    run();
    const interval = setInterval(run, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-verifies a pending item's original conditions against the LATEST
  // customer/job/estimate/referral state before actually sending — a batch
  // can sit awaiting approval for a while (owner away from the screen), and
  // an invoice could get paid, or an estimate get viewed, in the meantime.
  // Re-checking here closes that window instead of trusting stale gather-time
  // data at send time.
  const stillQualifies = (item: PendingAutomationItem): { cand: Candidate; auto: Automation } | null => {
    const auto = automationsRef.current.find(a => a.id === item.autoId);
    if (!auto || !auto.active) return null;
    const customer = customersRef.current.find(c => c.id === item.customerId);
    if (!customer) return null;
    const job = item.jobId ? jobsRef.current.find(j => j.id === item.jobId) : undefined;
    const estimate = item.estimateId ? estimatesRef.current.find(e => e.id === item.estimateId) : undefined;
    const referral = item.referralId ? referralsRef.current.find(r => r.id === item.referralId) : undefined;
    const cand: Candidate = { key: item.dedupKey, customer, job, estimate, referral, anchorMs: Date.now() };
    if (item.conditions.some(c => !evalCondition(c, cand))) return null;
    // Also re-check the daily cap and dedup one more time — belt and
    // suspenders against a batch that's been sitting a while.
    const settings = settingsRef.current;
    if ((settings.automationDailySendLog || {})[item.customerId] === today()) return null;
    return { cand, auto };
  };

  // AUDIT FIX — the per-day cap (settings.automationMaxSendsPerDay) only ever
  // limited the TOTAL, not the RATE — an approved 200-customer batch still
  // fired all 200 sends back-to-back in the same second, which is exactly
  // the kind of burst carrier A2P filtering flags as spam. These two new
  // settings (automationMaxSendsPerHour/PerMinute, Settings → Automations)
  // throttle the actual send loop below; 0/unset on either means no limit.
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const computeThrottleDelayMs = (settings: any): number => {
    const perHour = Number(settings.automationMaxSendsPerHour) || 0;
    const perMinute = Number(settings.automationMaxSendsPerMinute) || 0;
    const delays = [
      perHour > 0 ? 3600000 / perHour : 0,
      perMinute > 0 ? 60000 / perMinute : 0,
    ].filter(d => d > 0);
    return delays.length > 0 ? Math.max(...delays) : 0;
  };

  const approveBatch = useCallback(async () => {
    const batch = pendingBatchRef.current;
    if (!batch || isApprovingRef.current) return;
    isApprovingRef.current = true;
    setPendingBatch(null); // clear immediately so the modal can't be double-submitted
    try {
      const todayStr = today();
      const patchesByAutoId: Record<string, { sentTo: Record<string, string>; sent: number }> = {};
      const newDailyLog: Record<string, string> = { ...(settingsRef.current.automationDailySendLog || {}) };
      const sentThisApprovalForCustomer = new Set<string>();
      const throttleDelayMs = computeThrottleDelayMs(settingsRef.current);
      let sentCountThisApproval = 0;
      let failedCountThisApproval = 0;

      for (const item of batch.items) {
        // GUARDRAIL — never send twice to the same customer in this approval
        // even if the batch (gathered up to 15 minutes ago) somehow still
        // had two entries for them.
        if (sentThisApprovalForCustomer.has(item.customerId)) continue;
        if (firedThisSession.has(item.id)) continue;
        const fresh = stillQualifies(item);
        if (!fresh) { console.log("[Automations] skipped at send time (no longer qualifies):", item.autoName, "→", item.customerName); continue; }
        if (throttleDelayMs > 0 && sentCountThisApproval > 0) {
          console.log("[Automations] throttling —", Math.round(throttleDelayMs), "ms before next send (per-hour/per-minute limit)");
          await sleep(throttleDelayMs);
        }
        firedThisSession.add(item.id);
        sentCountThisApproval++;
        const sent = await sendOne(fresh.auto, item.channel, fresh.cand, item.subject, item.body, settingsRef.current, toastRef.current, () => {
          if (!patchesByAutoId[item.autoId]) patchesByAutoId[item.autoId] = { sentTo: {}, sent: 0 };
          patchesByAutoId[item.autoId].sentTo[item.dedupKey] = todayStr;
          patchesByAutoId[item.autoId].sent += 1;
          console.log("[Automations] fired:", item.autoName, "->", item.customerName);
        });
        if (sent) {
          newDailyLog[item.customerId] = todayStr;
          sentThisApprovalForCustomer.add(item.customerId);
        } else {
          failedCountThisApproval++;
          firedThisSession.delete(item.id); // failed send — allow a real retry next batch
        }
      }

      if (Object.keys(patchesByAutoId).length > 0) {
        setAutomationsRef.current(prev => prev.map(a => {
          const patch = patchesByAutoId[a.id];
          if (!patch) return a;
          return { ...a, lastTriggered: todayStr, count: (a.count ?? 0) + patch.sent, sentLog: { ...(a.sentLog || {}), ...patch.sentTo } };
        }));
      }
      setSettingsRef.current((s: any) => ({ ...s, automationDailySendLog: newDailyLog }));
      // AUDIT (mobile round 10) — per-item send failures were only ever
      // console-logged (see sendOne above); the owner clicking "Send All"
      // had no way to know anything failed. Every success already toasts
      // individually via toastRef inside sendOne — this adds the missing
      // aggregate signal for failures once the whole batch is done.
      if (failedCountThisApproval > 0) {
        toastRef.current(`⚠ ${failedCountThisApproval} automation send${failedCountThisApproval !== 1 ? "s" : ""} failed — check console for reasons (Twilio/Gmail may not be configured)`);
      }
    } finally {
      isApprovingRef.current = false;
    }
  }, []);

  // BUG FIX — this used to only clear the in-memory `pendingBatch` state,
  // which reset on every page reload (React state doesn't survive that) —
  // so the exact same candidates got re-gathered on the next tick and the
  // SAME modal popped right back up, making "Skip This Batch" look
  // completely broken ("keeps popping up every time I reload"). Reuses the
  // EXACT same per-customer-per-day guardrail approveBatch already writes
  // on a real send (`settings.automationDailySendLog[customerId] = today`,
  // checked at the top of this file's gather loop) so a skipped item is
  // excluded from re-gathering for the rest of today, the same way an
  // actually-sent one already was — no new mechanism invented.
  const skipBatch = useCallback(() => {
    const batch = pendingBatchRef.current;
    if (batch) {
      const todayStr = today();
      const newDailyLog = { ...(settingsRef.current.automationDailySendLog || {}) };
      for (const item of batch.items) newDailyLog[item.customerId] = todayStr;
      setSettingsRef.current((s: any) => ({ ...s, automationDailySendLog: newDailyLog }));
    }
    setPendingBatch(null);
  }, []);

  return { pendingBatch, approveBatch, skipBatch };
}
