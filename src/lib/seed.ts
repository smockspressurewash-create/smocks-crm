import { uid, today, daysFromNow } from "./utils";
import type {
  Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord,
  Expense, Chemical, Service, Campaign, Automation, Review,
  SocialPost, AccountabilityEntry, Goal, Reminder, RewardTier,
  Referral, MileageLog,
} from "../types";

// ─── Seed customers ───────────────────────────────────────────────────────────

export const seedCustomers: Customer[] = [
  {
    id: "c1", firstName: "Jennifer", lastName: "Walsh", email: "jennifer.walsh@email.com",
    phone: "(717) 555-0191", address: "412 Maple St, York, PA 17401",
    tags: ["Repeat", "VIP"], notes: "Gate code: 1234. Has dog — keep gate closed.", totalSpent: 1247,
    createdAt: daysFromNow(-180), leadSource: "Google", sqFootage: 2400,
    gateCode: "1234", hasDog: true, dogName: "Max", customFields: [],
  },
  {
    id: "c2", firstName: "Mike", lastName: "Johnson", email: "mike.j@gmail.com",
    phone: "(717) 555-0284", address: "728 Oak Ave, York, PA 17403",
    tags: ["Residential"], notes: "Prefers Saturday morning appointments.", totalSpent: 485,
    createdAt: daysFromNow(-90), leadSource: "Referral", sqFootage: 1800, customFields: [],
  },
  {
    id: "c3", firstName: "Springfield", lastName: "HOA", email: "hoa.springfield@gmail.com",
    phone: "(717) 555-0312", address: "100 Community Dr, York, PA 17402",
    tags: ["HOA", "Commercial"], notes: "Quarterly contract. Contact Tom Reeves.", totalSpent: 3840,
    createdAt: daysFromNow(-365), leadSource: "Website", sqFootage: 8500, customFields: [],
  },
  {
    id: "c4", firstName: "Sarah", lastName: "Davis", email: "sarah.davis@yahoo.com",
    phone: "(717) 555-0445", address: "56 Elm Road, Red Lion, PA 17356",
    tags: ["Seasonal"], notes: "", totalSpent: 299,
    createdAt: daysFromNow(-60), leadSource: "Facebook", sqFootage: 2100, customFields: [],
  },
  {
    id: "c5", firstName: "Tom", lastName: "Wilson", email: "tom.wilson@gmail.com",
    phone: "(717) 555-0563", address: "889 Pine St, Dallastown, PA 17313",
    tags: ["Repeat"], notes: "Loves the soft wash. Wants bi-annual.", totalSpent: 698,
    createdAt: daysFromNow(-200), leadSource: "Google", sqFootage: 2600, customFields: [],
  },
];

// ─── Seed estimates ───────────────────────────────────────────────────────────

export const seedEstimates: Estimate[] = [
  {
    id: "e1", customerId: "c1",
    lineItems: [{ id: "li1", description: "House Soft Wash", quantity: 1, unitPrice: 399 }],
    subtotal: 399, discount: 0, depositRequired: 100, tax: 23.94, total: 422.94,
    status: "approved", createdAt: daysFromNow(-14), validUntil: daysFromNow(16),
    sentAt: daysFromNow(-13), signedAt: daysFromNow(-12), paidAt: daysFromNow(-12),
    notes: "Thank you for choosing Crew Boss!", internalNote: "VIP — priority scheduling",
    viewed: true, invoiced: true, invoicedAt: daysFromNow(-12),
  },
  {
    id: "e2", customerId: "c2",
    lineItems: [
      { id: "li2", description: "Driveway Wash", quantity: 1, unitPrice: 175 },
      { id: "li3", description: "Walkway Wash",  quantity: 1, unitPrice: 85  },
    ],
    subtotal: 260, discount: 0, depositRequired: 0, tax: 15.6, total: 275.6,
    status: "pending", createdAt: daysFromNow(-3), validUntil: daysFromNow(27),
    sentAt: daysFromNow(-2), viewed: true, viewedAt: daysFromNow(-1),
  },
  {
    id: "e3", customerId: "c3",
    lineItems: [{ id: "li4", description: "HOA Quarterly Wash — 8 buildings", quantity: 8, unitPrice: 480 }],
    subtotal: 3840, discount: 384, depositRequired: 1000, tax: 206.64, total: 3662.64,
    status: "approved", createdAt: daysFromNow(-30), validUntil: daysFromNow(0),
    sentAt: daysFromNow(-28), signedAt: daysFromNow(-25), paidAt: daysFromNow(-25),
    invoiced: true, invoicedAt: daysFromNow(-25),
  },
];

// ─── Seed jobs ────────────────────────────────────────────────────────────────

export const seedJobs: Job[] = [
  {
    id: "j1", customerId: "c1", address: "412 Maple St, York, PA 17401",
    amount: 422.94, status: "scheduled", scheduledDate: daysFromNow(1),
    scheduledTime: "09:00", duration: 3, estimatedDuration: 3,
    priority: "high", crew: [], checklist: [
      { label: "Pre-rinse siding", done: false },
      { label: "Apply soft wash solution", done: false },
      { label: "Dwell 10 min", done: false },
      { label: "Rinse thoroughly", done: false },
      { label: "Inspect gutters", done: false },
    ],
    photos: [], notes: "Gate code 1234. Dog named Max.", internalNotes: "VIP client",
    commLog: [], chemicalsUsed: [], equipment: [], tags: ["VIP"],
    isRecurring: false, isCash: false, pipelineStage: "scheduled", createdAt: daysFromNow(-14),
  },
  {
    id: "j2", customerId: "c2", address: "728 Oak Ave, York, PA 17403",
    amount: 275.6, status: "in_progress", scheduledDate: today(),
    scheduledTime: "10:00", duration: 2, estimatedDuration: 2,
    priority: "normal", crew: [], checklist: [
      { label: "Set up pressure washer", done: true },
      { label: "Pre-soak driveway", done: true },
      { label: "Surface clean driveway", done: false },
      { label: "Rinse and inspect", done: false },
    ],
    photos: [], notes: "", internalNotes: "",
    commLog: [{ id: uid(), type: "sms", note: "Confirmed appointment", date: daysFromNow(-1), direction: "out" }],
    chemicalsUsed: [{ name: "Degreaser", amount: "2", unit: "gal", cost: 12 }],
    equipment: ["4GPM Cold Water Pressure Washer", "Surface Cleaner (20\")"],
    tags: [], isRecurring: false, isCash: false, pipelineStage: "scheduled", createdAt: daysFromNow(-7),
  },
  {
    id: "j3", customerId: "c3", address: "100 Community Dr, York, PA 17402",
    amount: 3662.64, status: "completed", scheduledDate: daysFromNow(-7),
    scheduledTime: "08:00", duration: 8, estimatedDuration: 8,
    priority: "urgent", crew: [], checklist: [],
    photos: [], notes: "8-building HOA complex", internalNotes: "",
    commLog: [], chemicalsUsed: [
      { name: "SH (12.5%)", amount: "15", unit: "gal", cost: 67.5 },
      { name: "Surfactant", amount: "0.5", unit: "gal", cost: 8 },
    ],
    equipment: ["8GPM Hot Water Pressure Washer", "Roof Pump (12V)", "Buffer Tank (65gal)"],
    tags: ["HOA", "Commercial"], isRecurring: true, recurringFreq: "quarterly",
    isCash: false, laborCost: 480, materialCost: 75.5,
    pipelineStage: "completed", createdAt: daysFromNow(-30),
  },
  {
    id: "j4", customerId: "c5", address: "889 Pine St, Dallastown, PA 17313",
    amount: 349, status: "completed", scheduledDate: daysFromNow(-14),
    scheduledTime: "13:00", duration: 2.5, estimatedDuration: 2.5,
    priority: "normal", crew: [], checklist: [],
    photos: [], notes: "Roof + gutters", internalNotes: "",
    commLog: [], chemicalsUsed: [{ name: "SH (12.5%)", amount: "5", unit: "gal", cost: 22.5 }],
    equipment: ["Roof Pump (12V)", "Telescoping Wand (24ft)"],
    tags: [], isRecurring: false, isCash: true, tip: 40,
    pipelineStage: "paid", createdAt: daysFromNow(-21),
  },
];

// ─── Seed employees ───────────────────────────────────────────────────────────

export const seedEmployees: Employee[] = [
  {
    id: "emp1", firstName: "Will", lastName: "Smock", role: "Owner",
    status: "active", hourlyRate: 0, phone: "(717) 555-0100",
    email: "will@smocks.com", startDate: daysFromNow(-730),
  },
  {
    id: "emp2", firstName: "Jake", lastName: "Torres", role: "Lead Technician",
    status: "active", hourlyRate: 22, phone: "(717) 555-0187",
    email: "jake.t@gmail.com", startDate: daysFromNow(-365),
  },
  {
    id: "emp3", firstName: "Devon", lastName: "Parks", role: "Technician",
    status: "active", hourlyRate: 18, phone: "(717) 555-0293",
    startDate: daysFromNow(-180),
  },
];

// ─── Seed vehicles ────────────────────────────────────────────────────────────

export const seedVehicles: Vehicle[] = [
  {
    id: "v1", year: 2021, make: "Ford", model: "F-250",
    plate: "PA-SMK001", mileage: 48320, lastOilChange: 45100,
    lastOilChangeDate: daysFromNow(-62), status: "active",
    notes: "Primary work truck. 8GPM hot unit mounted.",
  },
  {
    id: "v2", year: 2019, make: "Chevrolet", model: "Express 2500",
    plate: "PA-SMK002", mileage: 72180, lastOilChange: 70000,
    lastOilChangeDate: daysFromNow(-44), status: "active",
    notes: "Secondary van. Cold water unit + supplies.",
  },
];

// ─── Seed maintenance ─────────────────────────────────────────────────────────

export const seedMaintenance: MaintenanceRecord[] = [
  { id: "m1", vehicleId: "v1", type: "Oil Change", date: daysFromNow(-62), mileage: 45100, cost: 89, notes: "Full synthetic" },
  { id: "m2", vehicleId: "v1", type: "Tire Rotation", date: daysFromNow(-120), mileage: 43200, cost: 45, notes: "" },
  { id: "m3", vehicleId: "v2", type: "Oil Change", date: daysFromNow(-44), mileage: 70000, cost: 79, notes: "" },
  { id: "m4", vehicleId: "v2", type: "Brake Pads", date: daysFromNow(-90), mileage: 68500, cost: 320, notes: "Front pads replaced" },
];

// ─── Seed expenses ────────────────────────────────────────────────────────────

export const seedExpenses: Expense[] = [
  { id: "ex1", date: daysFromNow(-2),  description: "SH (12.5%) — 30 gal",   amount: 135, category: "Chemicals",  isBusiness: true, isDeductible: true },
  { id: "ex2", date: daysFromNow(-3),  description: "Fuel — F-250",           amount: 87,  category: "Fuel",       isBusiness: true, isDeductible: true },
  { id: "ex3", date: daysFromNow(-7),  description: "Google Ads",             amount: 150, category: "Marketing",  isBusiness: true, isDeductible: true },
  { id: "ex4", date: daysFromNow(-10), description: "Surfactant — 1 gal",     amount: 24,  category: "Chemicals",  isBusiness: true, isDeductible: true },
  { id: "ex5", date: daysFromNow(-14), description: "Truck payment — F-250",  amount: 689, category: "Truck Payment", isBusiness: true, isDeductible: true },
  { id: "ex6", date: daysFromNow(-20), description: "Commercial liability ins", amount: 220, category: "Insurance", isBusiness: true, isDeductible: true },
];

// ─── Seed chemicals ───────────────────────────────────────────────────────────

export const seedChemicals: Chemical[] = [
  { id: "ch1", name: "Sodium Hypochlorite (12.5%)", stock: 30, unit: "gal", unitCost: 4.5, reorderLevel: 10, supplier: "Local Chem Supplier" },
  { id: "ch2", name: "Elemonator Surfactant",       stock: 2,  unit: "gal", unitCost: 32,  reorderLevel: 1,  supplier: "Pressuretek" },
  { id: "ch3", name: "Simple Cherry Degreaser",     stock: 1,  unit: "gal", unitCost: 28,  reorderLevel: 1,  supplier: "Pressuretek" },
  { id: "ch4", name: "F13 (Fertilizer Blend)",      stock: 5,  unit: "gal", unitCost: 18,  reorderLevel: 2,  supplier: "Local Chem" },
  { id: "ch5", name: "Downstream Injector Tips",    stock: 8,  unit: "ea",  unitCost: 3.5, reorderLevel: 3,  supplier: "Amazon" },
];

// ─── Seed services ────────────────────────────────────────────────────────────

export const seedServices: Service[] = [
  { id: "s1", name: "House Soft Wash",       basePrice: 349, unit: "job", taxable: true,  active: true, description: "Full exterior soft wash with biodegradable solution" },
  { id: "s2", name: "Roof Soft Wash",        basePrice: 449, unit: "job", taxable: true,  active: true, description: "Low-pressure roof cleaning, kills algae and moss" },
  { id: "s3", name: "Driveway Wash",         basePrice: 175, unit: "job", taxable: true,  active: true, description: "Concrete or paver driveway pressure cleaning" },
  { id: "s4", name: "Deck / Patio Wash",     basePrice: 225, unit: "job", taxable: true,  active: true, description: "Wood or composite deck restoration" },
  { id: "s5", name: "Gutter Cleaning",       basePrice: 149, unit: "job", taxable: true,  active: true, description: "Clean and flush gutters and downspouts" },
  { id: "s6", name: "Fence Wash",            basePrice: 149, unit: "job", taxable: true,  active: true, description: "Privacy or picket fence cleaning" },
  { id: "s7", name: "Commercial Exterior",   basePrice: 799, unit: "job", taxable: true,  active: true, description: "Full commercial building exterior" },
  { id: "s8", name: "HOA Common Areas",      basePrice: 480, unit: "building", taxable: true, active: true, description: "HOA common area per building pricing" },
];

// ─── Seed email templates ─────────────────────────────────────────────────────

export const seedEmailTemplates = [
  {
    id: "et1", name: "Estimate Ready", subject: "Your Estimate from Crew Boss",
    body: "Hi {{first_name}},\n\nYour estimate is ready. Click below to view, approve, and sign.\n\n{{estimate_link}}\n\nValid for {{valid_days}} days. Questions? Call (717) 555-0100.\n\n— Will @ Crew Boss",
  },
  {
    id: "et2", name: "Job Confirmation", subject: "✅ Job Confirmed — Crew Boss",
    body: "Hi {{first_name}},\n\nYour service is confirmed for {{date}} at approximately {{time}}.\n\nAddress: {{address}}\n\nWe'll text you when we're on the way. See you then!\n\n— Will @ Crew Boss",
  },
  {
    id: "et3", name: "Review Request", subject: "Quick favor? Leave us a review 🌟",
    body: "Hi {{first_name}},\n\nThank you for choosing Crew Boss! We hope your property is looking great.\n\nWould you mind leaving us a quick Google review? It only takes 60 seconds and means the world to us.\n\n{{review_link}}\n\nThank you! — Will @ Crew Boss",
  },
  {
    id: "et4", name: "Payment Receipt", subject: "Payment Received — Crew Boss",
    body: "Hi {{first_name}},\n\nWe received your payment of {{amount}}. Thank you!\n\nReceipt: {{receipt_link}}\n\n— Will @ Crew Boss",
  },
  {
    id: "et5", name: "Birthday Message", subject: "Happy Birthday from Crew Boss!",
    body: "Hi {{first_name}},\n\nHappy birthday! Enjoy 10% off any service this month — code BDAY10.\n\n— Crew Boss",
  },
];

// ─── Seed SMS templates ───────────────────────────────────────────────────────

export const seedSmsTemplates = [
  { id: "st1", name: "New Lead Response",   body: "Hi {{first_name}}! Thanks for reaching out to Crew Boss. I'll send your estimate within the hour. Questions? Call/text (717) 555-0100. — Will" },
  { id: "st2", name: "Job Reminder",        body: "Hi {{first_name}}, reminder: your Crew Boss service is tomorrow at {{time}}. We'll text when on the way. Reply STOP to unsubscribe." },
  { id: "st3", name: "On My Way",           body: "Hi {{first_name}}, Will from Crew Boss — heading your way now! ETA: {{eta}}. Live location: {{location_link}}" },
  { id: "st4", name: "Job Complete",        body: "Hi {{first_name}}, all done! Your property is looking great 🙌 Thank you for choosing Crew Boss. — Will" },
  { id: "st5", name: "Review Request",      body: "Hi {{first_name}}, loved your service today? A quick Google review means the world: {{review_link}} — Will @ Crew Boss" },
  { id: "st6", name: "Payment Overdue",     body: "Hi {{first_name}}, just a reminder that your invoice for {{amount}} is past due. Pay here: {{payment_link}} Questions? (717) 555-0100." },
  { id: "st7", name: "Estimate Follow-Up",  body: "Hi {{first_name}}, just checking in on your estimate for {{amount}}. Any questions? Ready to schedule? — Will @ Crew Boss" },
  { id: "st8", name: "Weather Reschedule",  body: "Hi {{first_name}}, due to rain in the forecast we're rescheduling your service. We'll reach out with new options. Sorry for any inconvenience! — Crew Boss" },
];

// ─── Seed automations ─────────────────────────────────────────────────────────

export const seedAutomations: Automation[] = [
  { id: "a1",  name: "New lead auto-response",    trigger: "New lead form submitted",   action: "Send instant SMS",          active: true,  lastTriggered: daysFromNow(-1), count: 42, steps: [], description: "Texts every new lead within 60 seconds" },
  { id: "a2",  name: "Estimate follow-up (24h)",  trigger: "Estimate sent, unopened",   action: "Send follow-up SMS",        active: true,  lastTriggered: daysFromNow(-2), count: 18, steps: [] },
  { id: "a3",  name: "Job reminder (24h)",        trigger: "24h before job",            action: "Send reminder to customer", active: true,  lastTriggered: daysFromNow(-1), count: 67, steps: [] },
  { id: "a4",  name: "Review request (48h)",      trigger: "Job completed + 48h",       action: "Send review request",       active: true,  lastTriggered: daysFromNow(-2), count: 31, steps: [] },
  { id: "a5",  name: "Payment overdue (7d)",      trigger: "Invoice overdue 7 days",    action: "Send payment reminder",     active: true,  lastTriggered: daysFromNow(-3), count: 9,  steps: [] },
  { id: "a6",  name: "Maintenance reminder (90d)", trigger: "90 days since service",    action: "Send maintenance reminder", active: false, lastTriggered: null,            count: 0,  steps: [] },
  { id: "a7",  name: "Birthday message",          trigger: "Customer birthday",         action: "Send greeting + 10% off",   active: true,  lastTriggered: daysFromNow(-2), count: 8,  steps: [] },
  { id: "a8",  name: "Seasonal — spring",         trigger: "March 1st annually",        action: "Send spring campaign",      active: true,  lastTriggered: null,            count: 0,  steps: [] },
  { id: "a9",  name: "Seasonal — fall gutter",    trigger: "October 1st annually",      action: "Send fall gutter campaign", active: true,  lastTriggered: null,            count: 0,  steps: [] },
  { id: "a10", name: "Abandoned estimate (3d)",   trigger: "Estimate not approved 3d",  action: "3-touch nurture sequence",  active: false, lastTriggered: null,            count: 0,  steps: [] },
  { id: "a11", name: "Re-engagement (6mo)",       trigger: "No service in 6 months",    action: "Send win-back SMS",         active: false, lastTriggered: null,            count: 0,  steps: [] },
  { id: "a12", name: "Referral request",          trigger: "Job completed (3rd+)",      action: "Send referral ask",         active: false, lastTriggered: null,            count: 0,  steps: [] },
  { id: "a13", name: "Estimate expiring (48h)",   trigger: "Estimate expiring in 48h",  action: "Send expiring reminder",     active: true,  lastTriggered: null,            count: 0,  steps: [] },
  { id: "a14", name: "Customer anniversary",      trigger: "Customer anniversary",      action: "Send anniversary discount", active: false, lastTriggered: null,            count: 0,  steps: [] },
  { id: "a15", name: "Referral reward earned",    trigger: "Referral reward earned",    action: "Notify referrer of reward", active: true,  lastTriggered: null,            count: 0,  steps: [] },
];

// ─── Seed reviews ─────────────────────────────────────────────────────────────

export const seedReviews: Review[] = [
  { id: "r1", customerId: "c1", customerName: "Jennifer Walsh", rating: 5, text: "Will and his team did an incredible job on our house! The siding looks brand new.", createdAt: daysFromNow(-10), source: "Google", status: "responded", response: "Thank you Jennifer! It was a pleasure working with you." },
  { id: "r2", customerId: "c5", customerName: "Tom Wilson",    rating: 5, text: "Professional, fast, and great results. Driveway looks amazing.", createdAt: daysFromNow(-14), source: "Google", status: "pending" },
  { id: "r3", customerId: "c4", customerName: "Sarah Davis",   rating: 3, text: "Good job overall but took longer than expected.", createdAt: daysFromNow(-21), source: "Google", status: "pending" },
];

// ─── Seed social posts ────────────────────────────────────────────────────────

export const seedSocialPosts: SocialPost[] = [
  {
    id: "sp1", platform: "instagram", type: "before_after",
    caption: "Before → After on this house in York PA 🏠✨ The difference speaks for itself! Free quotes at (717) 555-0100",
    hashtags: "#pressurewashing #softwash #yorkpa #homeimprovement #beforeandafter",
    status: "published", publishedAt: daysFromNow(-7), likes: 124, shares: 8, comments: 14, reach: 1840,
  },
  {
    id: "sp2", platform: "facebook", type: "promo",
    caption: "🌸 Spring Special — 15% off house soft washes booked this month! Limited slots. Call or DM to book.",
    hashtags: "#spring #pressurewashing #yorkpa",
    status: "published", publishedAt: daysFromNow(-14), likes: 47, shares: 12, comments: 6, reach: 920,
  },
  {
    id: "sp3", platform: "instagram", type: "before_after",
    caption: "Driveway transformation in Dallastown! 💪 Years of staining gone in 2 hours.",
    hashtags: "#driveway #pressurewashing #dallastown #curb appeal",
    status: "scheduled", scheduledFor: daysFromNow(2), likes: 0, shares: 0, comments: 0, reach: 0,
  },
];

// ─── Seed reward tiers ────────────────────────────────────────────────────────

export const seedRewardTiers: RewardTier[] = [
  { id: "rt1", label: "First Referral",    minReferrals: 1, reward: "$25 off next service",        icon: "🥉" },
  { id: "rt2", label: "Refer 3 Friends",   minReferrals: 3, reward: "Free driveway wash ($175)",   icon: "🥈" },
  { id: "rt3", label: "Refer 5 Friends",   minReferrals: 5, reward: "Free house wash ($349)",      icon: "🥇" },
  { id: "rt4", label: "Referral Champion", minReferrals: 10, reward: "Annual free service + VIP",  icon: "👑" },
];

// ─── Seed referrals ───────────────────────────────────────────────────────────

export const seedReferrals: Referral[] = [
  { id: "ref1", referrerId: "c1", referredName: "Bob Andrews",  referredPhone: "(717) 555-0811", status: "completed", reward: 25, createdAt: daysFromNow(-45) },
  { id: "ref2", referrerId: "c1", referredName: "Lisa Chen",    referredPhone: "(717) 555-0724", status: "booked",    reward: 0,  createdAt: daysFromNow(-12) },
  { id: "ref3", referrerId: "c5", referredName: "Ray Martinez", referredPhone: "(717) 555-0631", status: "pending",   reward: 0,  createdAt: daysFromNow(-3)  },
];

// ─── Seed reminders (accountability) ─────────────────────────────────────────

export const seedReminders: Reminder[] = [
  { id: "rem1", text: "Call Mom",         frequency: "weekly",  emoji: "📞", lastDone: null },
  { id: "rem2", text: "Review finances",  frequency: "weekly",  emoji: "💰", lastDone: null },
  { id: "rem3", text: "Team check-in",    frequency: "weekly",  emoji: "👥", lastDone: null },
];

// ─── Seed goals ───────────────────────────────────────────────────────────────

export const seedGoals: Goal[] = [
  { id: "g1", category: "business", label: "Monthly Revenue",  target: 8000,  current: 3247, unit: "$",     deadline: daysFromNow(14) },
  { id: "g2", category: "business", label: "Jobs Completed",   target: 20,    current: 11,   unit: "jobs",  deadline: daysFromNow(14) },
  { id: "g3", category: "fitness",  label: "Gym Days / Week",  target: 5,     current: 3,    unit: "days",  deadline: daysFromNow(7)  },
  { id: "g4", category: "fitness",  label: "Steps Per Day",    target: 10000, current: 7200, unit: "steps", deadline: daysFromNow(1)  },
];

// ─── Seed accountability entries ───────────────────────────────────────────────

export const seedAccountabilityEntries: AccountabilityEntry[] = [
  { id: "acc1", date: daysFromNow(-1), sleep: 7.5, water: 64, steps: 8420, gymMinutes: 45, meditationMinutes: 10, mood: 4, notes: "Good day overall." },
  { id: "acc2", date: daysFromNow(-2), sleep: 6,   water: 48, steps: 5100, gymMinutes: 0,  meditationMinutes: 0,  mood: 3, notes: "Tired. Skipped gym." },
  { id: "acc3", date: daysFromNow(-3), sleep: 8,   water: 80, steps: 9800, gymMinutes: 60, meditationMinutes: 15, mood: 5, notes: "Great day." },
];

// ─── Seed mileage ─────────────────────────────────────────────────────────────

export const seedMileage: MileageLog[] = [
  { id: "ml1", date: daysFromNow(-1),  from: "Home", to: "412 Maple St, York",    miles: 4.2, purpose: "Job — Jennifer Walsh",    vehicleId: "v1", deduction: 2.81 },
  { id: "ml2", date: daysFromNow(-2),  from: "Home", to: "Supply depot",           miles: 12.8, purpose: "Chemical pickup",        vehicleId: "v1", deduction: 8.58 },
  { id: "ml3", date: daysFromNow(-7),  from: "Home", to: "100 Community Dr, York", miles: 6.1, purpose: "HOA complex — 3 buildings", vehicleId: "v2", deduction: 4.09 },
];

// ─── Seed lead sources ────────────────────────────────────────────────────────

export const seedLeadSrc = [
  { source: "Google",    leads: 28, conversions: 18, revenue: 6240, adSpend: 450 },
  { source: "Referral",  leads: 15, conversions: 13, revenue: 4875, adSpend: 0   },
  { source: "Facebook",  leads: 12, conversions: 6,  revenue: 1980, adSpend: 200 },
  { source: "Website",   leads: 8,  conversions: 5,  revenue: 2150, adSpend: 0   },
  { source: "Nextdoor",  leads: 6,  conversions: 4,  revenue: 1420, adSpend: 0   },
  { source: "Drive-by",  leads: 4,  conversions: 3,  revenue: 870,  adSpend: 0   },
];

// ─── Seed timeline ────────────────────────────────────────────────────────────

export const seedTimeline: Record<string, Array<{ id: string; type: string; note: string; date: string }>> = {
  c1: [
    { id: uid(), type: "estimate", note: "Estimate created — $422.94", date: daysFromNow(-14) },
    { id: uid(), type: "sms",      note: "Estimate sent via SMS",       date: daysFromNow(-13) },
    { id: uid(), type: "job",      note: "Job scheduled — House Soft Wash", date: daysFromNow(-12) },
    { id: uid(), type: "note",     note: "VIP client — priority scheduling", date: daysFromNow(-12) },
  ],
  c3: [
    { id: uid(), type: "estimate", note: "Estimate created — $3,662.64", date: daysFromNow(-30) },
    { id: uid(), type: "job",      note: "HOA complex — 8 buildings completed", date: daysFromNow(-7) },
  ],
};

// ─── Campaign templates ───────────────────────────────────────────────────────

// AUDIT FIX — "need more and better templates for campaigns": grew from 6 to
// 14 real, usable templates, and every body now uses {{company_phone}}/
// {{company_name}} tokens instead of a hardcoded "(717) 555-0100"/"Crew
// Boss" — CampaignsPage.tsx's merge() (extended alongside this) fills those
// in from the owner's real settings, same as the default compose body
// already did, so a loaded template reflects the actual business, not a
// placeholder one.
export const campaignTemplates = [
  { id: "ct1",  name: "Spring Special",       subject: "Spring Cleaning Deal — {{company_name}}", body: "Hi {{first_name}}, spring special — 15% off house soft washes this month. Reply BOOK or call {{company_phone}}. — {{company_name}}" },
  { id: "ct2",  name: "Pre-Winter Roof",      subject: "Protect your roof before winter — {{company_name}}", body: "Hi {{first_name}}, algae and moss freeze and damage shingles. Get a roof soft wash before cold hits. Reply ROOF or call {{company_phone}}. — {{company_name}}" },
  { id: "ct3",  name: "Referral Program",     subject: "Refer a friend, get $25 — {{company_name}}", body: "Hi {{first_name}}, refer a friend and get $25 off your next service when they book. Reply REFER or call {{company_phone}}. — {{company_name}}" },
  { id: "ct4",  name: "Holiday Greeting",     subject: "Happy Holidays from {{company_name}}!", body: "Hi {{first_name}}, wishing you a wonderful holiday season! Book early for spring — slots fill fast. — {{company_name}}" },
  { id: "ct5",  name: "New Year Offer",       subject: "New year, clean home — {{company_name}}", body: "Hi {{first_name}}, 10% off any service booked in January. Reply NEWYEAR or call {{company_phone}}. — {{company_name}}" },
  { id: "ct6",  name: "Win-Back",             subject: "We miss you — {{company_name}}", body: "Hi {{first_name}}, it's been a while! Reply BACK for a special returning customer discount. — {{company_name}}" },
  { id: "ct7",  name: "Summer Driveway Sale", subject: "Summer driveway & sidewalk sale — {{company_name}}", body: "Hi {{first_name}}, beat the summer grime — 15% off driveway and sidewalk cleaning this month. Reply DRIVE or call {{company_phone}}. — {{company_name}}" },
  { id: "ct8",  name: "Deck & Patio Refresh", subject: "Get your deck ready for summer — {{company_name}}", body: "Hi {{first_name}}, make your deck or patio party-ready! Book a soft wash before the season gets busy. Reply DECK or call {{company_phone}}. — {{company_name}}" },
  { id: "ct9",  name: "Fall Gutter Cleanout", subject: "Clogged gutters cause ice damage — {{company_name}}", body: "Hi {{first_name}}, don't let clogged gutters cause ice dams this winter. Book a gutter cleanout now. Reply GUTTERS or call {{company_phone}}. — {{company_name}}" },
  { id: "ct10", name: "Black Friday Deal",    subject: "Black Friday special — {{company_name}}", body: "Hi {{first_name}}, our biggest discount of the year — 20% off any service booked this weekend. Reply BF20 or call {{company_phone}}. — {{company_name}}" },
  { id: "ct11", name: "Storm Cleanup",        subject: "Storm cleanup special — {{company_name}}", body: "Hi {{first_name}}, storm debris and stains on your property? We're offering priority storm cleanup this week. Reply STORM or call {{company_phone}}. — {{company_name}}" },
  { id: "ct12", name: "Maintenance Plan",     subject: "Never think about it again — {{company_name}}", body: "Hi {{first_name}}, ask about our seasonal maintenance plan — scheduled washes year-round so your property always looks its best. Reply PLAN or call {{company_phone}}. — {{company_name}}" },
  { id: "ct13", name: "Move-In/Move-Out",     subject: "Moving? Let us handle the exterior — {{company_name}}", body: "Hi {{first_name}}, buying, selling, or moving? A fresh exterior wash makes a huge first impression. Reply MOVE or call {{company_phone}}. — {{company_name}}" },
  { id: "ct14", name: "Commercial Storefront",subject: "Keep your storefront spotless — {{company_name}}", body: "Hi {{first_name}}, a clean storefront brings in customers. Ask about our recurring commercial wash plans. Reply BIZ or call {{company_phone}}. — {{company_name}}" },
];

// ─── Step types ───────────────────────────────────────────────────────────────

export const STEP_TYPES = [
  { type: "trigger",   label: "Trigger",         icon: "⚡", color: "bg-yellow-900/40 border-yellow-700/40" },
  { type: "condition", label: "Condition / Wait", icon: "⏱", color: "bg-blue-900/40 border-blue-700/40"    },
  { type: "action",    label: "Send Message",     icon: "📱", color: "bg-green-900/40 border-green-700/40"  },
  { type: "webhook",   label: "Webhook",          icon: "🔗", color: "bg-purple-900/40 border-purple-700/40"},
  { type: "tag",       label: "Add Tag",          icon: "🏷", color: "bg-orange-900/40 border-orange-700/40"},
];

// ─── Automation templates ─────────────────────────────────────────────────────

export const AUTOMATION_TEMPLATES = [
  {
    id: "tpl_new_lead", name: "New Lead Auto-Response",
    trigger: "New lead received", action: "Send instant SMS",
    description: "Texts every new lead within 60 seconds.",
    steps: [
      { id: uid(), type: "trigger", label: "New lead form submitted", icon: "⚡" },
      { id: uid(), type: "action",  label: "Send SMS: 'Thanks for reaching out...'", channel: "sms", template: "new_lead" },
    ],
  },
  {
    id: "tpl_estimate_followup", name: "Estimate Follow-Up (24h)",
    trigger: "Estimate sent, unopened 24h", action: "Send follow-up SMS",
    description: "Follows up if estimate not opened after 24 hours.",
    steps: [
      { id: uid(), type: "trigger",   label: "Estimate sent",        icon: "⚡" },
      { id: uid(), type: "condition", label: "Wait 24 hours",        delay: 1440 },
      { id: uid(), type: "condition", label: "If NOT viewed",        condition: "estimate_not_viewed" },
      { id: uid(), type: "action",    label: "Send follow-up SMS",   channel: "sms" },
    ],
  },
  {
    id: "tpl_review_request", name: "Post-Job Review Request",
    trigger: "Job completed + 48h", action: "Send review request",
    steps: [
      { id: uid(), type: "trigger",   label: "Job completed",        icon: "⚡" },
      { id: uid(), type: "condition", label: "Wait 48 hours",        delay: 2880 },
      { id: uid(), type: "action",    label: "Send review request",  channel: "sms", template: "review_request" },
    ],
  },
  {
    id: "tpl_birthday", name: "Birthday Message",
    trigger: "Customer birthday (annual)", action: "Send greeting + 10% off",
    steps: [
      { id: uid(), type: "trigger", label: "Customer birthday", icon: "🎂" },
      { id: uid(), type: "action",  label: "Send birthday SMS", channel: "sms", template: "birthday" },
    ],
  },
  {
    id: "tpl_seasonal_spring", name: "Spring House Wash Reminder",
    trigger: "March 1st annually", action: "Send spring campaign",
    steps: [
      { id: uid(), type: "trigger", label: "Date: March 1st",      icon: "🌸" },
      { id: uid(), type: "action",  label: "Send spring promo SMS", channel: "sms" },
    ],
  },
  {
    id: "tpl_abandoned_estimate", name: "Abandoned Estimate Nurture",
    trigger: "Estimate sent, no response 3 days", action: "3-touch nurture sequence",
    steps: [
      { id: uid(), type: "trigger",   label: "Estimate sent",           icon: "⚡" },
      { id: uid(), type: "condition", label: "Wait 3 days",             delay: 4320 },
      { id: uid(), type: "condition", label: "If not approved",         condition: "estimate_not_approved" },
      { id: uid(), type: "action",    label: "Day 3: Soft follow-up",   channel: "sms" },
      { id: uid(), type: "condition", label: "Wait 4 more days",        delay: 5760 },
      { id: uid(), type: "action",    label: "Day 7: Add urgency",      channel: "sms" },
    ],
  },
  // FEATURE — 5 additional templates, each backed by an already-implemented,
  // already-firing engine category (useAutomationEngine.ts specs) — none of
  // the empty-getCandidates() categories (review_good/review_bad/manual/
  // weekly_scheduled/webhook) are templated here, so every template in this
  // gallery actually sends when approved, not just looks like it does.
  {
    id: "tpl_job_reminder", name: "Job Reminder (24h Before)",
    trigger: "24h before scheduled job", action: "Send reminder SMS",
    description: "Reminds the customer the day before their scheduled service.",
    steps: [
      { id: uid(), type: "trigger", label: "24h before scheduled job", icon: "⏰" },
      { id: uid(), type: "action",  label: "Send reminder SMS", channel: "sms", template: "job_reminder" },
    ],
  },
  {
    id: "tpl_payment_overdue", name: "Overdue Invoice Reminder",
    trigger: "Invoice overdue 7 days", action: "Send payment reminder SMS",
    description: "Nudges customers with an unpaid invoice a week past due.",
    steps: [
      { id: uid(), type: "trigger", label: "Invoice overdue 7 days", icon: "💳" },
      { id: uid(), type: "action",  label: "Send payment reminder SMS", channel: "sms" },
    ],
  },
  {
    id: "tpl_maintenance", name: "90-Day Re-Service Reminder",
    trigger: "90 days since last service", action: "Send re-book SMS",
    description: "Reminds a customer it's time for another wash, 90 days after their last one.",
    steps: [
      { id: uid(), type: "trigger", label: "90 days since service", icon: "🔁" },
      { id: uid(), type: "action",  label: "Send re-service SMS", channel: "sms", template: "maintenance_reminder" },
    ],
  },
  {
    id: "tpl_referral_ask", name: "Loyal Customer Referral Ask",
    trigger: "3rd job complete", action: "Ask for a referral",
    description: "Asks a customer to refer a friend after their 3rd completed job with you.",
    steps: [
      { id: uid(), type: "trigger", label: "3rd job complete", icon: "🤝" },
      { id: uid(), type: "action",  label: "Send referral-ask SMS", channel: "sms", template: "referral_ask" },
    ],
  },
  {
    id: "tpl_seasonal_fall", name: "Fall Gutter Reminder",
    trigger: "October 1st annually", action: "Send fall campaign",
    description: "Annual fall reminder about clogged gutters and ice-dam risk.",
    steps: [
      { id: uid(), type: "trigger", label: "October 1st annually", icon: "🍂" },
      { id: uid(), type: "action",  label: "Send fall promo SMS", channel: "sms", template: "seasonal_fall" },
    ],
  },
  // AUDIT FIX — "only 16 [really 10] templates exist, need more, all fully
  // functional (not mock-ups)": every one of these, like the 10 above, is
  // built on an engine category (useAutomationEngine.ts's classifyTrigger +
  // specs) that already has a real, non-empty getCandidates() implementation
  // and an existing SMS_TEMPLATES message — none of the genuinely-unbuilt
  // categories (review_good/review_bad/manual/weekly_scheduled/webhook,
  // still empty candidate lists) are templated here, same rule the original
  // 5 followed. Trigger label wording is deliberately exact-matched against
  // classifyTrigger's regexes (verified against its patterns one at a time,
  // including the "1 year since first service" vs. "since service" mainten-
  // ance-category collision already documented in that function's comments).
  {
    id: "tpl_estimate_expiring", name: "Estimate Expiring Soon",
    trigger: "Estimate expires in 48 hours", action: "Send urgency SMS",
    description: "Nudges a customer with a pending quote right before it expires.",
    steps: [
      { id: uid(), type: "trigger", label: "Estimate expires in 48 hours", icon: "⏳" },
      { id: uid(), type: "action",  label: "Send expiring-quote SMS", channel: "sms", template: "estimate_expiring" },
    ],
  },
  {
    id: "tpl_job_reminder_morning", name: "Morning-Of Job Reminder",
    trigger: "Job day morning", action: "Send day-of reminder SMS",
    description: "A same-day, morning-of text for every job scheduled today (6-10am).",
    steps: [
      { id: uid(), type: "trigger", label: "Job day morning", icon: "🌤" },
      { id: uid(), type: "action",  label: "Send morning-of reminder SMS", channel: "sms", template: "job_reminder" },
    ],
  },
  {
    id: "tpl_crew_starts", name: "Crew Started Notification",
    trigger: "Crew starts job", action: "Send 'on our way in' SMS",
    description: "Lets the customer know the crew has begun work on-site.",
    steps: [
      { id: uid(), type: "trigger", label: "Crew starts job", icon: "🚚" },
      { id: uid(), type: "action",  label: "Send crew-started SMS", channel: "sms", template: "crew_starts" },
    ],
  },
  {
    id: "tpl_job_scheduled", name: "New Booking Confirmation",
    trigger: "Job scheduled", action: "Send booking confirmation SMS",
    description: "Confirms the appointment the moment a job is scheduled.",
    steps: [
      { id: uid(), type: "trigger", label: "Job scheduled", icon: "📅" },
      { id: uid(), type: "action",  label: "Send booking confirmation SMS", channel: "sms", template: "job_scheduled" },
    ],
  },
  {
    id: "tpl_estimate_viewed", name: "Estimate Viewed Follow-Up",
    trigger: "Estimate viewed", action: "Send viewed-acknowledgment SMS",
    description: "Follows up the moment a customer opens their quote, while it's top of mind.",
    steps: [
      { id: uid(), type: "trigger", label: "Estimate viewed", icon: "👀" },
      { id: uid(), type: "action",  label: "Send viewed-ack SMS", channel: "sms", template: "estimate_viewed_ack" },
    ],
  },
  {
    id: "tpl_estimate_accepted", name: "Estimate Accepted Confirmation",
    trigger: "Estimate accepted", action: "Send thank-you + next-steps SMS",
    description: "Confirms approval and sets expectations for scheduling.",
    steps: [
      { id: uid(), type: "trigger", label: "Estimate accepted", icon: "✅" },
      { id: uid(), type: "action",  label: "Send acceptance confirmation SMS", channel: "sms", template: "estimate_accepted" },
    ],
  },
  {
    id: "tpl_payment_received", name: "Payment Received Thank-You",
    trigger: "Payment received", action: "Send thank-you SMS",
    description: "Thanks the customer the moment their payment clears.",
    steps: [
      { id: uid(), type: "trigger", label: "Payment received", icon: "💵" },
      { id: uid(), type: "action",  label: "Send payment thank-you SMS", channel: "sms", template: "payment_received" },
    ],
  },
  {
    id: "tpl_payment_overdue_3", name: "Overdue Invoice — Friendly (3-Day)",
    trigger: "Invoice overdue 3 days", action: "Send friendly payment reminder SMS",
    description: "A soft first nudge, 3 days after an invoice goes past due.",
    steps: [
      { id: uid(), type: "trigger", label: "Invoice overdue 3 days", icon: "💳" },
      { id: uid(), type: "action",  label: "Send friendly reminder SMS", channel: "sms", template: "payment_overdue_3" },
    ],
  },
  {
    id: "tpl_payment_overdue_14", name: "Overdue Invoice — Firm (14-Day)",
    trigger: "Invoice overdue 14 days", action: "Send firm payment reminder SMS",
    description: "A firmer follow-up once an invoice is two-plus weeks overdue.",
    steps: [
      { id: uid(), type: "trigger", label: "Invoice overdue 14 days", icon: "🚨" },
      { id: uid(), type: "action",  label: "Send firm reminder SMS", channel: "sms", template: "payment_overdue_14" },
    ],
  },
  {
    id: "tpl_reengage", name: "Win-Back — 6 Months Inactive",
    trigger: "No service 6 months", action: "Send win-back SMS",
    description: "Re-engages a customer who hasn't booked in half a year.",
    steps: [
      { id: uid(), type: "trigger", label: "No service 6 months", icon: "🔄" },
      { id: uid(), type: "action",  label: "Send win-back SMS", channel: "sms", template: "reengage" },
    ],
  },
  {
    id: "tpl_anniversary", name: "Customer Anniversary",
    trigger: "1 year since first service", action: "Send anniversary SMS",
    description: "Celebrates a full year as a customer with a thank-you and discount.",
    steps: [
      { id: uid(), type: "trigger", label: "1 year since first service", icon: "🎉" },
      { id: uid(), type: "action",  label: "Send anniversary SMS", channel: "sms", template: "anniversary" },
    ],
  },
  {
    id: "tpl_referral_reward", name: "Referral Reward Earned",
    trigger: "Referral reward earned", action: "Send reward notification SMS",
    description: "Tells a customer their referral just earned them a credit.",
    steps: [
      { id: uid(), type: "trigger", label: "Referral reward earned", icon: "🎁" },
      { id: uid(), type: "action",  label: "Send reward SMS", channel: "sms", template: "referral_reward" },
    ],
  },
  {
    id: "tpl_referral_booked", name: "Referral Booked Thank-You",
    trigger: "Referral booked", action: "Send thank-you SMS",
    description: "Thanks the referring customer as soon as their referral books a first job.",
    steps: [
      { id: uid(), type: "trigger", label: "Referral booked", icon: "🤝" },
      { id: uid(), type: "action",  label: "Send referral-booked SMS", channel: "sms", template: "referral_booked" },
    ],
  },
  // FEATURE — owner/employee/client report automations (useAutomationEngine.ts
  // owner_daily_summary/owner_periodic_summary/weekly_scheduled/
  // employee_shift_summary/employee_performance_report categories, plus the
  // two client templates below which reuse the already-firing review_request
  // and payment_received categories with custom messageBody text). Every
  // trigger label here is exact-matched against classifyTrigger's regexes —
  // see that function's comments for why label wording matters.
  {
    id: "tpl_owner_eod_summary", name: "Owner: End-of-Day Summary",
    trigger: "End of day", action: "Email today's business summary",
    description: "Emails you a same-day recap — jobs completed, revenue, and new leads — once in the 6-7pm window.",
    steps: [
      { id: uid(), type: "trigger", label: "End of day", icon: "🌆" },
      { id: uid(), type: "action",  label: "Email end-of-day summary", channel: "email",
        messageBody: "Hi {{first_name}}, here's your end-of-day summary: {{jobs_completed}} of {{jobs_total}} jobs completed today, {{revenue}} in revenue, and {{new_leads}} new lead(s). — Crew Boss Automations" },
    ],
  },
  {
    id: "tpl_owner_periodic_summary", name: "Owner: Quarterly & Yearly Summary",
    trigger: "Quarterly business summary", action: "Email business performance summary",
    // AUDIT — the engine has no arbitrary cron scheduler; this fires on the
    // 1st of each calendar quarter (Jan/Apr/Jul/Oct), the closest supported
    // cadence to "quarterly" — Jan 1st doubles as the yearly firing too. See
    // owner_periodic_summary's comment in useAutomationEngine.ts.
    description: "Emails a business performance summary (jobs, revenue, new customers) on the 1st of each quarter — the closest cadence the engine supports to quarterly/yearly.",
    steps: [
      { id: uid(), type: "trigger", label: "Quarterly business summary", icon: "📊" },
      { id: uid(), type: "action",  label: "Email quarterly/yearly summary", channel: "email",
        messageBody: "Hi {{first_name}}, your quarterly business summary: {{period_jobs}} jobs completed, {{period_revenue}} in revenue, and {{period_new_customers}} new customers this quarter. — Crew Boss Automations" },
    ],
  },
  {
    id: "tpl_owner_progress_report", name: "Owner: Weekly Progress Report",
    trigger: "Weekly progress report", action: "Email goals/KPI progress",
    description: "Emails your weekly goals progress (from Accountability → Goals) every Monday morning.",
    steps: [
      { id: uid(), type: "trigger", label: "Weekly progress report", icon: "🎯" },
      { id: uid(), type: "action",  label: "Email weekly progress report", channel: "email",
        messageBody: "Hi {{first_name}}, here's your weekly goals progress: {{goals_summary}} — Crew Boss Automations" },
    ],
  },
  {
    id: "tpl_employee_shift_summary", name: "Employee: Shift Summary",
    trigger: "Shift ended", action: "Email that employee's shift summary",
    description: "Emails an employee their own shift recap (hours worked, jobs completed) right after they tap \"End My Day.\"",
    steps: [
      { id: uid(), type: "trigger", label: "Shift ended", icon: "⏱" },
      { id: uid(), type: "action",  label: "Email shift summary", channel: "email",
        messageBody: "Hi {{first_name}}, shift summary for today: {{hours_worked}} hours worked, {{jobs_completed}} of {{jobs_total}} jobs completed. Nice work!" },
    ],
  },
  {
    id: "tpl_employee_performance_report", name: "Employee: Performance Report",
    trigger: "Weekly performance report", action: "Email that employee's performance report",
    description: "Emails each active employee a weekly recap of their completed jobs and current rating, every Monday morning.",
    steps: [
      { id: uid(), type: "trigger", label: "Weekly performance report", icon: "📈" },
      { id: uid(), type: "action",  label: "Email performance report", channel: "email",
        messageBody: "Hi {{first_name}}, your weekly performance report: {{jobs_completed}} jobs completed this week, current rating {{rating}}/5. Keep it up!" },
    ],
  },
  {
    id: "tpl_client_post_service_followup", name: "Client: Post-Service Follow-Up",
    trigger: "Job completed", action: "Send thank-you follow-up SMS",
    // Rides the already-implemented review_request engine category (job
    // completed, within a 14-day window) but with a plain thank-you message
    // instead of a review ask — deliberately distinct from the existing
    // "Post-Job Review Request" template so an owner can run both without
    // duplicate wording.
    description: "Thanks a customer 48 hours after their job is marked complete — a warm follow-up, not a review ask.",
    steps: [
      { id: uid(), type: "trigger",   label: "Job completed",      icon: "✅" },
      { id: uid(), type: "condition", label: "Wait 48 hours",      delay: 2880 },
      { id: uid(), type: "action",    label: "Send thank-you SMS", channel: "sms",
        messageBody: "Hi {{first_name}}, thanks for trusting us with your recent service! We hope you're loving the results — reach out anytime if you need anything. — Crew Boss" },
    ],
  },
  {
    id: "tpl_client_referral_request", name: "Client: Referral Request",
    trigger: "Payment received", action: "Send referral request SMS",
    // Rides the already-implemented payment_received engine category (fires
    // within 3 days of an invoice being paid) with an explicit 1-day delay,
    // and reuses the customer's existing referralCode/#/referral link
    // (ReferralsPage.tsx/ClientAuthPortal.tsx) rather than inventing a new
    // referral mechanism.
    description: "Asks a customer for a referral a day after their invoice is paid, linking their existing referral code.",
    steps: [
      { id: uid(), type: "trigger",   label: "Payment received",  icon: "💵" },
      { id: uid(), type: "condition", label: "Wait 1 day",        delay: 1440 },
      { id: uid(), type: "action",    label: "Send referral-request SMS", channel: "sms",
        messageBody: "Hi {{first_name}}, thanks for your payment! Know anyone who could use our services? Share your referral link and you'll both earn rewards: {{referral_link}} — Crew Boss" },
    ],
  },
];

// ─── Seed revenue chart data ───────────────────────────────────────────────────

export const seedRevenue = Array.from({ length: 6 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - (5 - i));
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }),
    revenue: Math.round(3200 + Math.random() * 4800),
    expenses: Math.round(800 + Math.random() * 1200),
    jobs: Math.round(8 + Math.random() * 15),
  };
});
