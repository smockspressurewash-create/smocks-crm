// ===== SHARED CONSTANTS =====
// This file has NO dependencies to avoid circular imports.

export const TIMEFRAMES = [
  { key: "7d",  label: "7D",  days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "6m",  label: "6M",  days: 182 },
  { key: "1y",  label: "1Y",  days: 365 },
  { key: "3y",  label: "3Y",  days: 1095 },
  { key: "5y",  label: "5Y",  days: 1825 },
  { key: "all", label: "All", days: 99999 }
];

export const pipelineStages = [
  { key: "lead", label: "Lead", color: "bg-gray-600", border: "border-gray-600/40", text: "text-gray-300" },
  { key: "contacted", label: "Contacted", color: "bg-blue-600", border: "border-blue-600/40", text: "text-blue-300" },
  { key: "estimate_sent", label: "Est Sent", color: "bg-purple-600", border: "border-purple-600/40", text: "text-purple-300" },
  { key: "approved", label: "Approved", color: "bg-yellow-500", border: "border-yellow-500/40", text: "text-yellow-300" },
  { key: "scheduled", label: "Scheduled", color: "bg-orange-500", border: "border-orange-500/40", text: "text-orange-300" },
  { key: "completed", label: "Completed", color: "bg-green-600", border: "border-green-600/40", text: "text-green-300" },
  { key: "paid", label: "Paid", color: "bg-emerald-500", border: "border-emerald-500/40", text: "text-emerald-300" },
  { key: "lost", label: "Lost", color: "bg-red-800", border: "border-red-800/40", text: "text-red-400" }
];

export const cancelReasons = ["Weather", "Customer request", "No show", "Equipment failure", "Other"];
export const expenseCats = ["Fuel", "Chemicals", "Equipment", "Maintenance", "Insurance", "Marketing", "Other"];
export const equipmentList = ["Pressure Washer", "Soft Wash", "Surface Cleaner", "Gutter Wand", "Ladder", "X-Jet", "Ball Valve"];
export const recurringFreqs = ["weekly", "bi-weekly", "monthly", "quarterly", "annually"];

export const priorityLevels = [
  { key: "low", label: "Low", color: "bg-gray-600", tone: "gray" },
  { key: "normal", label: "Normal", color: "bg-blue-600", tone: "blue" },
  { key: "high", label: "High", color: "bg-yellow-600", tone: "yellow" },
  { key: "urgent", label: "Urgent", color: "bg-red-600", tone: "red" }
];

export const jobTagOptions = ["Emergency", "Warranty", "Follow-up", "HOA", "Commercial", "VIP"];

export const CATEGORY_META: Record<string, any> = {
  estimates: { label: "Estimates", icon: "📋", color: "text-blue-400" },
  jobs: { label: "Jobs", icon: "🔨", color: "text-orange-400" },
  payments: { label: "Payments", icon: "💸", color: "text-green-400" },
  reviews: { label: "Reviews", icon: "⭐", color: "text-yellow-400" },
  lifecycle: { label: "Lifecycle", icon: "🌱", color: "text-emerald-400" },
  referrals: { label: "Referrals", icon: "🤝", color: "text-pink-400" },
  other: { label: "Other", icon: "⚡", color: "text-purple-400" }
};

export const AUTOMATION_TEMPLATES = [
  {
    id: "tpl_lead_resp",
    name: "Instant Lead Response",
    icon: "⚡",
    description: "Send an immediate text & email when a new inquiry arrives.",
    category: "other",
    steps: [
      { id: "s1", type: "trigger", label: "New inquiry submitted" },
      { id: "s2", type: "action", label: "Send welcome text", channel: "sms", messageBody: "Hi {{first_name}}, thanks for reaching out! We'll have a quote for you within 24h. — Smock's" }
    ]
  },
  {
    id: "tpl_est_follow",
    name: "Estimate Follow-up (24h)",
    icon: "📋",
    description: "Follow up automatically if a quote isn't opened within 24 hours.",
    category: "estimates",
    steps: [
      { id: "s1", type: "trigger", label: "Quote unviewed 24h" },
      { id: "s2", type: "action", label: "Send follow-up email", channel: "email", messageBody: "Hi {{first_name}}, just checking in on that quote we sent yesterday. Any questions?" }
    ]
  },
  {
    id: "tpl_rev_req",
    name: "Post-Job Review Request",
    icon: "⭐",
    description: "Ask for a review 2 hours after a job is marked complete.",
    category: "reviews",
    steps: [
      { id: "s1", type: "trigger", label: "Job complete + 2h" },
      { id: "s2", type: "action", label: "Send review request", channel: "sms", messageBody: "Hi {{first_name}}, all done! We'd love a quick review if you're happy with the work: {{review_link}}" }
    ]
  },
  {
    id: "tpl_pay_rem",
    name: "Payment Reminder (3d)",
    icon: "💸",
    description: "Send a friendly reminder if an invoice is still unpaid after 3 days.",
    category: "payments",
    steps: [
      { id: "s1", type: "trigger", label: "Invoice unpaid 3 days" },
      { id: "s2", type: "action", label: "Send reminder text", channel: "sms", messageBody: "Hi {{first_name}}, just a friendly reminder about invoice #{{id}}. You can pay here: {{portal_link}}" }
    ]
  }
];

export const personalities: Record<string, any> = {
  drill: { name: "Drill Sergeant", color: "from-red-600 to-red-900", greeting: "LISTEN UP. What's the situation? Alfred out." },
  butler: { name: "Butler", color: "from-red-500 to-red-800", greeting: "Good day, sir. How may I help?" },
  quiet: { name: "Quiet Pro", color: "from-red-700 to-black", greeting: "Operations online. State your request." },
  savage: { name: "Savage", color: "from-red-600 to-pink-900", greeting: "Oh look, you're back. Fire away." }
};
