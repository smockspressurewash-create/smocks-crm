import { useEffect, useRef } from "react";
import type { Automation, Job, Customer, Estimate } from "../types";
import { today, daysSince } from "../lib/utils";
import { twilioSend } from "../lib/messaging";
import type { AppSettings } from "../types";

interface AutomationEngineProps {
  automations: Automation[];
  setAutomations: React.Dispatch<React.SetStateAction<Automation[]>>;
  jobs: Job[];
  customers: Customer[];
  estimates: Estimate[];
  settings: AppSettings;
  toast: (msg: string) => void;
}

const SMS_TEMPLATES: Record<string, string> = {
  new_lead:         "Hi {{first_name}}! Thanks for reaching out to Smock's. I'll send your estimate shortly. — Will",
  estimate_followup: "Hi {{first_name}}, just checking in on your estimate. Any questions? Ready to schedule? — Will @ Smock's",
  job_reminder:     "Hi {{first_name}}, reminder: your Smock's service is tomorrow. We'll text when on the way. — Smock's",
  review_request:   "Hi {{first_name}}, how did we do? A quick Google review means a lot: {{review_link}} — Will",
  payment_overdue:  "Hi {{first_name}}, your invoice is past due. Pay here: {{payment_link}} — Smock's",
  birthday:         "Hi {{first_name}}! Happy birthday 🎂 Enjoy 10% off your next service — code BDAY10. — Smock's",
};

const fillTemplate = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);

export function useAutomationEngine({
  automations,
  setAutomations,
  jobs,
  customers,
  estimates,
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

      for (const auto of automations) {
        if (!auto.active) continue;
        // Don't run same automation twice in same day
        if (auto.lastTriggered === todayStr) continue;

        let fired = false;

        // ── Trigger: job scheduled confirmation ──────────────────────────────
        if (auto.trigger.toLowerCase().includes("24h before job") && hour >= 7 && hour < 9) {
          const tomorrowJobs = jobs.filter(j =>
            j.status === "scheduled" &&
            j.scheduledDate === new Date(Date.now() + 86400000).toISOString().slice(0, 10)
          );
          for (const job of tomorrowJobs) {
            const c = customers.find(x => x.id === job.customerId);
            if (!c?.phone || c.smsOptOut) continue;
            const msg = fillTemplate(SMS_TEMPLATES.job_reminder, {
              first_name: c.firstName,
              time: job.scheduledTime || "the scheduled time",
            });
            try {
              await twilioSend(settings, c.phone, msg);
              toast(`📱 Job reminder sent to ${c.firstName}`);
              fired = true;
            } catch { /* continue */ }
          }
        }

        // ── Trigger: estimate follow-up (3 days after sending, still unviewed) ──
        if (auto.trigger.toLowerCase().includes("estimate sent") && hour >= 9 && hour < 11) {
          const staleEstimates = estimates.filter(e =>
            e.status === "pending" &&
            e.sentAt &&
            daysSince(e.sentAt) >= 3 &&
            !e.viewed
          );
          for (const est of staleEstimates.slice(0, 5)) {
            const c = customers.find(x => x.id === est.customerId);
            if (!c?.phone || c.smsOptOut) continue;
            const msg = fillTemplate(SMS_TEMPLATES.estimate_followup, {
              first_name: c.firstName,
              amount: `$${est.total}`,
            });
            try {
              await twilioSend(settings, c.phone, msg);
              toast(`📱 Estimate follow-up sent to ${c.firstName}`);
              fired = true;
            } catch { /* continue */ }
          }
        }

        // ── Trigger: review request (48h after completion) ───────────────────
        // Prefer the real completion timestamp recorded on the customer's
        // sign-off (set the moment the employee closes out the job) over
        // scheduledDate, which can be days off if a job ran long or slipped.
        if (auto.trigger.toLowerCase().includes("job completed") && hour >= 10 && hour < 12) {
          const recentJobs = jobs.filter(j => {
            if (j.status !== "completed") return false;
            const completedDate = j.signOff?.timestamp?.slice(0, 10) || j.scheduledDate;
            return completedDate && daysSince(completedDate) === 2;
          });
          for (const job of recentJobs) {
            const c = customers.find(x => x.id === job.customerId);
            if (!c?.phone || c.smsOptOut) continue;
            // Check throttle
            if (c.reviewRequested && daysSince(c.reviewRequested) < 90) continue;
            const msg = fillTemplate(SMS_TEMPLATES.review_request, {
              first_name: c.firstName,
              review_link: `https://g.page/r/${settings.googlePlaceId ?? "smocks-pressure-washing"}/review`,
            });
            try {
              await twilioSend(settings, c.phone, msg);
              toast(`⭐ Review request sent to ${c.firstName}`);
              fired = true;
            } catch { /* continue */ }
          }
        }

        // ── Trigger: overdue invoice ─────────────────────────────────────────
        if (auto.trigger.toLowerCase().includes("overdue") && hour >= 9 && hour < 10) {
          const overdueEsts = estimates.filter(e =>
            e.invoiced && !e.paidAt &&
            e.invoicedAt && daysSince(e.invoicedAt) >= 7
          );
          for (const est of overdueEsts.slice(0, 5)) {
            const c = customers.find(x => x.id === est.customerId);
            if (!c?.phone || c.smsOptOut) continue;
            const msg = fillTemplate(SMS_TEMPLATES.payment_overdue, {
              first_name: c.firstName,
              amount: `$${est.total}`,
              payment_link: `smocks.com/portal/${est.id}`,
            });
            try {
              await twilioSend(settings, c.phone, msg);
              toast(`💰 Payment reminder sent to ${c.firstName}`);
              fired = true;
            } catch { /* continue */ }
          }
        }

        // ── Trigger: birthday ────────────────────────────────────────────────
        if (auto.trigger.toLowerCase().includes("birthday") && hour >= 8 && hour < 9) {
          const mmdd = todayStr.slice(5);
          const birthdayCustomers = customers.filter(c =>
            c.birthday && c.birthday.slice(5) === mmdd && !c.smsOptOut
          );
          for (const c of birthdayCustomers) {
            const msg = fillTemplate(SMS_TEMPLATES.birthday, { first_name: c.firstName });
            try {
              await twilioSend(settings, c.phone, msg);
              toast(`🎂 Birthday message sent to ${c.firstName}`);
              fired = true;
            } catch { /* continue */ }
          }
        }

        if (fired) {
          setAutomations(prev =>
            prev.map(a => a.id === auto.id
              ? { ...a, lastTriggered: todayStr, count: (a.count ?? 0) + 1 }
              : a
            )
          );
        }
      }
    };

    // Run immediately then every 15 minutes
    run();
    const interval = setInterval(run, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [automations, jobs, customers, estimates, settings]); // eslint-disable-line
}
