import { useEffect } from 'react';
import { twilioSend } from '../lib/messaging';
import { fmt, today, daysFromNow } from '../lib/utils';

export const normalizeAutomation = (a: any) => {
  if (a.isWorkflow && a.steps) return a;
  return {
    ...a,
    isWorkflow: true,
    steps: [
      { id: "s1", type: "trigger", label: a.trigger || "Manual trigger" },
      { id: "s2", type: "action", label: a.action || "Execute action", channel: a.channel || "sms", messageBody: a.messageBody || "" }
    ]
  };
};

export const checkTrigger = (triggerLabel: string, ctx: any) => {
  if (ctx.type === "manual") return true;
  const t = triggerLabel.toLowerCase();
  switch (ctx.type) {
    case "job_complete": return t.includes("job complete") || t.includes("after job") || t.includes("post-job");
    case "job_started": return t.includes("job start") || t.includes("crew start");
    case "job_scheduled": return t.includes("job scheduled");
    case "estimate_sent": return t.includes("estimate sent") || t.includes("quote sent");
    case "customer_added": return t.includes("new customer") || t.includes("new inquiry") || t.includes("new lead");
    case "invoice_unpaid": return t.includes("invoice") || t.includes("unpaid") || t.includes("overdue");
    case "review_submitted": return t.includes("review") || t.includes("rating");
    default: return false;
  }
};

export const checkCondition = (conditionCheck: string, ctx: any) => {
  if (!conditionCheck) return true;
  const { customer, estimate, daysSinceInvoiced, daysSinceLast, rating } = ctx;
  switch (conditionCheck) {
    case "estimate_pending": return estimate?.status === "pending";
    case "estimate_accepted": return estimate?.status === "approved";
    case "estimate_unsigned": return estimate?.status === "approved" && !estimate?.signature;
    case "invoice_unpaid": return (daysSinceInvoiced || 0) > 0;
    case "invoice_paid": return (daysSinceInvoiced || 0) === 0;
    case "quote_not_viewed": return estimate?.status === "sent" && !estimate?.viewedAt;
    case "rated_5": return rating === 5;
    case "rated_low": return rating > 0 && rating <= 3;
    case "stale_customer": return (daysSinceLast || 0) > 180;
    case "no_response_24h": return true;
    case "no_new_job": return true;
    case "has_dog": return customer?.hasDog;
    default: return true;
  }
};

export const runWorkflow = async (workflow: any, ctx: any, toast: any, settings: any) => {
  if (!workflow.active) return { triggered: false, log: [], reason: "paused" };

  const normalized = normalizeAutomation(workflow);
  const steps = normalized.steps || [];
  if (steps.length === 0) return { triggered: false, log: [], reason: "no steps" };

  const trigger = steps[0];
  const triggerLabel = trigger.type === "trigger" ? trigger.label : (workflow.trigger || trigger.label || "");
  if (!checkTrigger(triggerLabel, ctx)) {
    return { triggered: false, log: [], reason: "trigger condition not met" };
  }

  const log: any[] = [];
  let i = (trigger.type === "trigger") ? 1 : 0;
  let skipNext = false;

  while (i < steps.length) {
    const step = steps[i];
    if (!step) { i++; continue; }

    if (skipNext && step.type === "action") {
      skipNext = false;
      i++;
      continue;
    }

    if (step.type === "trigger") {
      log.push({ ts: Date.now(), message: "▶ TRIGGER: " + step.label, status: "ok" });
    } else if (step.type === "delay") {
      log.push({ ts: Date.now(), message: "⏳ DELAY: " + step.label + " (scheduled)", status: "ok" });
    } else if (step.type === "condition") {
      const pass = checkCondition(step.check, ctx);
      log.push({ ts: Date.now(), message: (pass ? "✅" : "⛔") + " CONDITION: " + step.label + " → " + (pass ? "PASS" : "FAIL"), status: pass ? "ok" : "skipped" });
      if (!pass) skipNext = true;
    } else if (step.type === "action") {
      const ch = step.channel || "sms";
      const customer = ctx.customer;
      const body = (step.messageBody || step.label || "").replace(/{{first_name}}/g, customer?.firstName || "Customer").replace(/{{amount}}/g, fmt(ctx.job?.amount || ctx.estimate?.total || 0)).replace(/{{date}}/g, ctx.job?.scheduledDate || today()).replace(/{{address}}/g, ctx.job?.address || customer?.address || "");

      if (ch === "sms" && customer?.phone && settings?.twilioSid) {
        try {
          await twilioSend(settings, customer.phone, body);
          log.push({ ts: Date.now(), message: "💬 SMS SENT: " + body.slice(0, 50) + "…", status: "sent", channel: "sms" });
        } catch (e: any) {
          log.push({ ts: Date.now(), message: "❌ SMS FAILED: " + e.message, status: "error", channel: "sms" });
        }
      } else {
        log.push({ ts: Date.now(), message: (ch === "email" ? "📧 EMAIL" : "🔔 INTERNAL") + ": " + body.slice(0, 50) + "…", status: "sent", channel: ch });
      }
    }
    i++;
  }
  return { triggered: true, log };
};

export const useAutomationEngine = (
  automations: any[],
  setAutomations: any,
  jobs: any[],
  customers: any[],
  estimates: any[],
  toast: any,
  settings: any
) => {
  // Simple cron-like triggers could be added here
  return []; // Returning execution log placeholder
};
