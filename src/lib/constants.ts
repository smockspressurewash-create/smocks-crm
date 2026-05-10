import { uid } from './utils';
import { FileText, Briefcase, DollarSign, Star, Heart, Award, Workflow } from 'lucide-react';

export const AUTOMATION_TEMPLATES = [
  {
    id: "tpl_lead_nurture",
    name: "Lead Nurture Sequence",
    category: "estimates",
    icon: "📥",
    description: "Welcome new leads, follow up if they don't respond, then escalate.",
    steps: [
      { id: uid(), type: "trigger", label: "New customer added", icon: "👤" },
      { id: uid(), type: "delay", label: "Wait 5 minutes", duration: 5, unit: "min" },
      { id: uid(), type: "action", label: "Send welcome email", channel: "email", template: "welcome" },
      { id: uid(), type: "delay", label: "Wait 2 days", duration: 2, unit: "day" },
      { id: uid(), type: "condition", label: "If no estimate accepted", check: "no_estimate_accepted" },
      { id: uid(), type: "action", label: "Send follow-up SMS", channel: "sms", template: "followup1" },
      { id: uid(), type: "delay", label: "Wait 5 days", duration: 5, unit: "day" },
      { id: uid(), type: "action", label: "Notify owner — call this lead", channel: "internal", target: "owner" }
    ]
  },
  {
    id: "tpl_quote_followup",
    name: "Stale Quote Recovery",
    category: "estimates",
    icon: "💰",
    description: "Auto-recover quotes that aren't responded to within 7 days.",
    steps: [
      { id: uid(), type: "trigger", label: "Estimate sent", icon: "📤" },
      { id: uid(), type: "delay", label: "Wait 3 days", duration: 3, unit: "day" },
      { id: uid(), type: "condition", label: "If quote not viewed", check: "quote_not_viewed" },
      { id: uid(), type: "action", label: "Send reminder email", channel: "email", template: "quote_reminder" },
      { id: uid(), type: "delay", label: "Wait 4 days", duration: 4, unit: "day" },
      { id: uid(), type: "condition", label: "If still pending", check: "estimate_pending" },
      { id: uid(), type: "action", label: "Send 5% off incentive", channel: "email", template: "discount_offer" },
      { id: uid(), type: "action", label: "Add task: Personal call", channel: "task", target: "owner" }
    ]
  },
  {
    id: "tpl_job_lifecycle",
    name: "Complete Job Lifecycle",
    category: "jobs",
    icon: "🚚",
    description: "Confirm → On-the-way → Complete → Review request → Re-engagement.",
    steps: [
      { id: uid(), type: "trigger", label: "Job scheduled", icon: "📅" },
      { id: uid(), type: "delay", label: "24h before job", duration: -24, unit: "hour" },
      { id: uid(), type: "action", label: "Send confirmation SMS", channel: "sms", template: "confirm" },
      { id: uid(), type: "trigger", label: "On crew arrival", icon: "📍" },
      { id: uid(), type: "action", label: "Send 'on the way' text", channel: "sms", template: "otw" },
      { id: uid(), type: "trigger", label: "Job complete", icon: "✅" },
      { id: uid(), type: "delay", label: "Wait 2 hours", duration: 2, unit: "hour" },
      { id: uid(), type: "action", label: "Send invoice + review request", channel: "email", template: "review" },
      { id: uid(), type: "delay", label: "Wait 6 months", duration: 6, unit: "month" },
      { id: uid(), type: "action", label: "Send seasonal re-engagement", channel: "email", template: "reengage" }
    ]
  },
  {
    id: "tpl_collections",
    name: "Smart Collections",
    category: "payments",
    icon: "🧾",
    description: "Polite → firm → escalate ladder for unpaid invoices.",
    steps: [
      { id: uid(), type: "trigger", label: "Invoice unpaid 3 days", icon: "💸" },
      { id: uid(), type: "action", label: "Send polite reminder email", channel: "email", template: "reminder1" },
      { id: uid(), type: "delay", label: "Wait 4 days", duration: 4, unit: "day" },
      { id: uid(), type: "condition", label: "Still unpaid", check: "invoice_unpaid" },
      { id: uid(), type: "action", label: "Send firm follow-up SMS", channel: "sms", template: "reminder2" },
      { id: uid(), type: "delay", label: "Wait 7 days", duration: 7, unit: "day" },
      { id: uid(), type: "condition", label: "Still unpaid (14+ days)", check: "invoice_unpaid" },
      { id: uid(), type: "action", label: "Add 1.5% late fee", channel: "internal", target: "billing" },
      { id: uid(), type: "action", label: "Escalate to owner", channel: "internal", target: "owner" }
    ]
  },
  {
    id: "tpl_review_engine",
    name: "Review Engine",
    category: "reviews",
    icon: "⭐",
    description: "Get more 5-star reviews; intercept bad ones before they go public.",
    steps: [
      { id: uid(), type: "trigger", label: "Job complete + 2 hours", icon: "🎉" },
      { id: uid(), type: "action", label: "Send rating SMS (1-5 stars)", channel: "sms", template: "rate" },
      { id: uid(), type: "branch", label: "Branch on rating", branches: ["4-5 stars", "1-3 stars"] },
      { id: uid(), type: "action", label: "→ Send Google review link", channel: "email", template: "google_review", branch: 0 },
      { id: uid(), type: "action", label: "→ Notify owner privately", channel: "internal", target: "owner", branch: 1 }
    ]
  },
  {
    id: "tpl_referral_engine",
    name: "Referral Engine",
    category: "referrals",
    icon: "🎁",
    description: "Activate happy customers as referral sources after 30 days.",
    steps: [
      { id: uid(), type: "trigger", label: "30 days after first job", icon: "🗓️" },
      { id: uid(), type: "condition", label: "Customer rated 5 stars", check: "rated_5" },
      { id: uid(), type: "action", label: "Send referral code email", channel: "email", template: "referral_invite" },
      { id: uid(), type: "delay", label: "Wait 14 days", duration: 14, unit: "day" },
      { id: uid(), type: "condition", label: "If no referrals yet", check: "zero_referrals" },
      { id: uid(), type: "action", label: "Send reminder + sweetener", channel: "email", template: "referral_boost" }
    ]
  },
  {
    id: "tpl_seasonal_blast",
    name: "Seasonal Campaign Blast",
    category: "lifecycle",
    icon: "🌸",
    description: "Annual reminders timed to spring/fall seasons.",
    steps: [
      { id: uid(), type: "trigger", label: "March 1st annually", icon: "🌷" },
      { id: uid(), type: "condition", label: "Last service > 6 months", check: "stale_customer" },
      { id: uid(), type: "action", label: "Send spring house wash offer", channel: "email", template: "spring" },
      { id: uid(), type: "delay", label: "Wait 14 days", duration: 14, unit: "day" },
      { id: uid(), type: "condition", label: "If no booking", check: "no_booking" },
      { id: uid(), type: "action", label: "Resend with $50 off", channel: "email", template: "spring_discount" }
    ]
  },
];

export const CATEGORY_META: any = {
  estimates: { label: "Estimates", icon: FileText, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  jobs: { label: "Jobs", icon: Briefcase, color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  payments: { label: "Payments", icon: DollarSign, color: "#16a34a", bg: "rgba(22,163,74,0.1)" },
  reviews: { label: "Reviews", icon: Star, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  lifecycle: { label: "Lifecycle", icon: Heart, color: "#ec4899", bg: "rgba(236,72,153,0.1)" },
  referrals: { label: "Referrals", icon: Award, color: "#a855f7", bg: "rgba(168,85,247,0.1)" },
  other: { label: "Other", icon: Workflow, color: "#64748b", bg: "rgba(100,116,139,0.1)" }
};

export const MODELS: any = {
  claude: {
    id: "claude",
    name: "Claude",
    label: "Claude Sonnet 4",
    provider: "Anthropic",
    color: "from-orange-500 to-red-600",
    accent: "text-orange-400",
    supportsTools: true,
    needsKey: false,
    keyUrl: null,
    apiLabel: "Built-in",
    resetWindow: null
  },
  openai: {
    id: "openai",
    name: "ChatGPT",
    label: "GPT-4o mini",
    provider: "OpenAI",
    color: "from-green-500 to-emerald-700",
    accent: "text-green-400",
    supportsTools: true,
    needsKey: true,
    keyUrl: "https://platform.openai.com/api-keys",
    apiLabel: "OpenAI API",
    resetWindow: 60 * 60 * 1000
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    label: "Gemini 2.0 Flash",
    provider: "Google",
    color: "from-blue-500 to-indigo-600",
    accent: "text-blue-400",
    supportsTools: true,
    needsKey: true,
    keyUrl: "https://aistudio.google.com/apikey",
    apiLabel: "Google AI Studio",
    resetWindow: 24 * 60 * 60 * 1000
  },
  groq: {
    id: "groq",
    name: "Groq",
    label: "Llama 3.1 70B",
    provider: "Groq",
    color: "from-orange-400 to-amber-600",
    accent: "text-orange-400",
    supportsTools: true,
    needsKey: true,
    keyUrl: "https://console.groq.com/keys",
    apiLabel: "Groq Console",
    resetWindow: 60 * 60 * 1000
  }
};

export const campaignTemplates = [
  { id: "t1", name: "Spring Special (15% Off)", subject: "Spring is here! 🏡✨", body: "Hi {{first_name}}, spring is finally here! We're offering 15% off house soft washes and gutter cleaning this month. Reply BOOK or call (717) 555-0100 to lock in your spot. — Smock's" },
  { id: "t2", name: "Fall Prep (Gutter Focus)", subject: "Don't let your gutters overflow 🍂", body: "Hi {{first_name}}, fall is just around the corner. Get ahead of the leaves with a professional gutter cleaning and roof inspection. Reply or call (717) 555-0100. — Smock's" },
  { id: "t3", name: "Review Request (Manual)", subject: "Quick question about your service", body: "Hi {{first_name}}! Hope you're loving the results from Smock's. If you have a moment, a quick Google review helps us out a ton: smocks.com/reviews — Thanks, Will" },
  { id: "t4", name: "Payment Reminder", subject: "Friendly reminder from Smock's", body: "Hi {{first_name}}, just a friendly reminder that your invoice of {{amount}} is still pending. You can pay securely online at smocks.com/pay. Thanks! — Will" }
];


