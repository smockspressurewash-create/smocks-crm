import { daysFromNow, today } from './utils';
import { seedWeather as sw } from './weather';

export const seedWeather = sw;

export const seedCustomers = [
  { id: "c1", firstName: "Mike", lastName: "Harrison", email: "mike.h@gmail.com", phone: "(717) 555-0142", address: "412 Oak Ridge Ln, York PA", totalSpent: 2450, createdAt: "2025-08-12", notes: "Prefers morning appointments.", gateCode: "1234", hasDog: true, dogName: "Rex", sensitivePlants: "Hydrangeas by front porch" },
  { id: "c2", firstName: "Jennifer", lastName: "Walsh", email: "jwalsh@outlook.com", phone: "(717) 555-0198", address: "88 Maple Ct, Dover PA", totalSpent: 1200, createdAt: "2025-09-03", notes: "", gateCode: "", hasDog: false, dogName: "", sensitivePlants: "" },
  { id: "c3", firstName: "Dave", lastName: "Kellerman", email: "dkeller@yahoo.com", phone: "(717) 555-0276", address: "1201 Cedar Rd, Weigelstown PA", totalSpent: 3800, createdAt: "2025-07-22", notes: "HOA president.", gateCode: "", hasDog: true, dogName: "Bella", sensitivePlants: "" },
  { id: "c4", firstName: "Ashley", lastName: "Nguyen", email: "a.nguyen@gmail.com", phone: "(717) 555-0355", address: "67 Pine View Dr, York PA", totalSpent: 875, createdAt: "2026-01-14", notes: "", gateCode: "", hasDog: false, dogName: "", sensitivePlants: "" },
  { id: "c5", firstName: "Roberto", lastName: "Santana", email: "rsantana@gmail.com", phone: "(717) 555-0411", address: "923 Birch Ave, Spring Grove PA", totalSpent: 4650, createdAt: "2025-06-08", notes: "Commercial. COI on file.", gateCode: "4455", hasDog: false, dogName: "", sensitivePlants: "Rose bushes on east side" }
];

export const seedEstimates = [
  { id: "e1", customerId: "c1", lineItems: [{ id: "l1", description: "House Soft Wash", quantity: 1, unitPrice: 450 }, { id: "l2", description: "Driveway Pressure Wash", quantity: 1, unitPrice: 250 }], subtotal: 700, discount: 0, depositRequired: 0, tax: 42, total: 742, status: "approved", createdAt: "2026-03-18", validUntil: "2026-04-18", viewed: true, viewedAt: "2026-03-19" },
  { id: "e2", customerId: "c3", lineItems: [{ id: "l3", description: "Deck Cleaning & Seal Prep", quantity: 1, unitPrice: 650 }], subtotal: 650, discount: 0, depositRequired: 100, tax: 39, total: 689, status: "pending", createdAt: "2026-04-02", validUntil: "2026-04-22", viewed: true, viewedAt: "2026-04-03" },
  { id: "e3", customerId: "c5", lineItems: [{ id: "l4", description: "Commercial Storefront Wash", quantity: 1, unitPrice: 1200 }, { id: "l5", description: "Sidewalk Degreasing", quantity: 1, unitPrice: 380 }], subtotal: 1580, discount: 50, depositRequired: 500, tax: 91.8, total: 1621.8, status: "pending", createdAt: "2026-04-10", validUntil: "2026-05-10", viewed: false, viewedAt: null }
];

export const seedJobs = [
  { id: "j1", customerId: "c1", scheduledDate: "2026-04-20", status: "scheduled", pipelineStage: "scheduled", address: "412 Oak Ridge Ln, York PA", amount: 742, lat: 39.9626, lng: -76.7277, photos: [], checklist: [{ text: "Confirm water access", done: true }, { text: "Load SH mix", done: false }], isRecurring: false, recurringFreq: "monthly", cancelReason: "", noShow: false, crew: ["emp1"], duration: 3, internalNotes: "Back gate sticks", chemicalsUsed: [{ name: "SH 12.5%", gallons: 2, cost: 12 }], equipment: ["Pressure Washer", "Soft Wash", "Surface Cleaner"], commLog: [{ id: "cl1", type: "text", date: "2026-04-18", note: "Confirmed time" }], priority: "normal", tags: [], loggedHours: 0, clockInAt: null, attachments: [{ id: "at1", name: "HOA_approval.pdf", type: "pdf" }], laborCost: 84, materialCost: 22 },
  { id: "j2", customerId: "c3", scheduledDate: "2026-04-16", status: "in_progress", pipelineStage: "scheduled", address: "1201 Cedar Rd, Weigelstown PA", amount: 1100, lat: 40.0087, lng: -76.8012, photos: [], checklist: [{ text: "Pre-wet landscaping", done: true }, { text: "Soft wash siding", done: true }, { text: "Rinse thoroughly", done: false }], isRecurring: true, recurringFreq: "quarterly", cancelReason: "", noShow: false, crew: ["emp1", "emp2"], duration: 4, internalNotes: "", chemicalsUsed: [], equipment: ["Pressure Washer", "Soft Wash"], commLog: [], priority: "high", tags: ["VIP", "HOA"], loggedHours: 0, clockInAt: null, attachments: [], laborCost: 200, materialCost: 45 },
  { id: "j3", customerId: "c2", scheduledDate: "2026-04-10", status: "completed", pipelineStage: "paid", address: "88 Maple Ct, Dover PA", amount: 1200, lat: 40.0034, lng: -76.8521, photos: [], checklist: [{ text: "Complete", done: true }], isRecurring: false, recurringFreq: "monthly", cancelReason: "", noShow: false, crew: ["emp1"], duration: 2.5, internalNotes: "", chemicalsUsed: [], equipment: [], commLog: [], priority: "normal", tags: [], loggedHours: 2.3, clockInAt: null, attachments: [], laborCost: 64, materialCost: 18 },
  { id: "j4", customerId: "c5", scheduledDate: "2026-04-22", status: "scheduled", pipelineStage: "estimate_sent", address: "923 Birch Ave, Spring Grove PA", amount: 1674.8, lat: 39.8765, lng: -76.8634, photos: [], checklist: [{ text: "Site survey", done: false }], isRecurring: false, recurringFreq: "monthly", cancelReason: "", noShow: false, crew: [], duration: 5, internalNotes: "", chemicalsUsed: [], equipment: [], commLog: [], priority: "urgent", tags: ["Commercial"], loggedHours: 0, clockInAt: null, attachments: [{ id: "at2", name: "COI_2026.pdf", type: "pdf" }, { id: "at3", name: "site_map.jpg", type: "image" }], laborCost: 280, materialCost: 95 },
  { id: "j5", customerId: "c4", scheduledDate: "2026-03-28", status: "completed", pipelineStage: "completed", address: "67 Pine View Dr, York PA", amount: 875, lat: 39.9421, lng: -76.7315, photos: [], checklist: [{ text: "Complete", done: true }], isRecurring: false, recurringFreq: "monthly", cancelReason: "", noShow: false, crew: [], duration: 2, internalNotes: "", chemicalsUsed: [], equipment: [], commLog: [], priority: "low", tags: ["Warranty"], loggedHours: 1.8, clockInAt: null, attachments: [], laborCost: 50, materialCost: 12 }
];

export const seedEmployees = [
  { id: "emp1", firstName: "Tyler", lastName: "Brooks", role: "Lead Technician", phone: "(717) 555-0501", hourlyRate: 28, status: "active" },
  { id: "emp2", firstName: "Sam", lastName: "Reyes", role: "Technician", phone: "(717) 555-0502", hourlyRate: 22, status: "active" },
  { id: "emp3", firstName: "Jordan", lastName: "Pike", role: "Crew Chief", phone: "(717) 555-0503", hourlyRate: 32, status: "active" },
  { id: "emp4", firstName: "Casey", lastName: "Morgan", role: "Technician", phone: "(717) 555-0504", hourlyRate: 20, status: "inactive" }
];

export const seedVehicles = [
  { id: "v1", name: "Red Rig", year: 2022, make: "Ford", model: "F-250", licensePlate: "PA-SMK-01", mileage: 42180, status: "active" },
  { id: "v2", name: "The Beast", year: 2020, make: "Chevrolet", model: "Silverado 2500", licensePlate: "PA-SMK-02", mileage: 78420, status: "active" }
];

export const seedExpenses = [
  { id: "ex1", date: "2026-04-12", category: "Fuel", description: "Diesel fill-up Red Rig", amount: 142.50, vendor: "Sheetz" },
  { id: "ex2", date: "2026-04-10", category: "Chemicals", description: "SH 12.5% 55gal drum", amount: 310, vendor: "Pressure Tek" },
  { id: "ex3", date: "2026-04-08", category: "Equipment", description: "Surface cleaner", amount: 485, vendor: "Amazon" },
  { id: "ex4", date: "2026-04-05", category: "Insurance", description: "General liability monthly", amount: 220, vendor: "NEXT" }
];

export const seedChemicals = [
  { id: "ch1", name: "Sodium Hypochlorite 12.5%", brand: "Pressure Tek", category: "Sanitizer", stock: 35, reorderLevel: 20, unitCost: 5.65 },
  { id: "ch2", name: "Elemonator", brand: "Pressure Tek", category: "Surfactant", stock: 4, reorderLevel: 6, unitCost: 42 },
  { id: "ch3", name: "F9 BARC", brand: "F9", category: "Specialty", stock: 2, reorderLevel: 3, unitCost: 52 }
];

export const seedServices = [
  { id: "s1", name: "House Soft Wash", description: "Low-pressure siding cleaning", price: 450 },
  { id: "s2", name: "Driveway Pressure Wash", description: "Concrete cleaning", price: 250 },
  { id: "s3", name: "Deck Cleaning", description: "Wood-safe cleaning", price: 325 },
  { id: "s4", name: "Roof Soft Wash", description: "Algae/moss treatment", price: 650 }
];

export const seedRevenue = [
  { month: "Nov", revenue: 8200 }, { month: "Dec", revenue: 6800 }, { month: "Jan", revenue: 7500 },
  { month: "Feb", revenue: 9200 }, { month: "Mar", revenue: 11400 }, { month: "Apr", revenue: 13800 }
];

// seedWeather removed here, moved to weather.ts

export const seedLeadSrc = [
  { source: "Google Ads", value: 32, color: "#e11d48" },
  { source: "Referral", value: 28, color: "#be123c" },
  { source: "Facebook", value: 18, color: "#f43f5e" },
  { source: "Nextdoor", value: 12, color: "#9f1239" },
  { source: "Website", value: 6, color: "#881337" },
  { source: "Other", value: 4, color: "#4c0519" }
];

export const seedAutomations = [
  { id: "a1", name: "New lead auto-response", trigger: "New inquiry submitted", action: "Send welcome text within 5 min", active: true, lastTriggered: daysFromNow(-1), count: 34 },
  { id: "a2", name: "Estimate follow-up", trigger: "Estimate sent, 24h no open", action: "Send follow-up email", active: true, lastTriggered: daysFromNow(-2), count: 18 },
  { id: "a3", name: "Estimate expiring reminder", trigger: "Estimate expires in 3 days", action: "Send reminder text", active: true, lastTriggered: daysFromNow(-5), count: 9 },
  { id: "a4", name: "Job reminder 24h", trigger: "24h before scheduled job", action: "Send SMS confirmation", active: true, lastTriggered: daysFromNow(-1), count: 41 },
  { id: "a5", name: "ETA message", trigger: "Crew starts job", action: "Send on-the-way text", active: false, lastTriggered: null, count: 0 },
  { id: "a6", name: "Post-job review request", trigger: "Job complete plus 2h", action: "Send review request", active: true, lastTriggered: today(), count: 27 },
  { id: "a7", name: "Payment overdue 3-day", trigger: "Invoice unpaid 3 days", action: "Send polite reminder", active: true, lastTriggered: daysFromNow(-3), count: 6 },
  { id: "a8", name: "Payment overdue 7-day", trigger: "Invoice unpaid 7 days", action: "Send firm follow-up", active: true, lastTriggered: daysFromNow(-7), count: 3 },
  { id: "a9", name: "Payment overdue 14-day", trigger: "Invoice unpaid 14 days", action: "Escalate to owner", active: true, lastTriggered: null, count: 1 },
  { id: "a10", name: "Abandoned estimate nurture", trigger: "Quote unviewed 5 days", action: "Send 5% off incentive email", active: true, lastTriggered: daysFromNow(-4), count: 12 },
  { id: "a11", name: "Customer anniversary", trigger: "1 year since first service", action: "Send thank-you + 20% off", active: true, lastTriggered: daysFromNow(-10), count: 4 },
  { id: "a12", name: "Birthday message", trigger: "Customer birthday", action: "Send greeting plus 10% off", active: true, lastTriggered: daysFromNow(-2), count: 8 },
  { id: "a13", name: "Spring seasonal reminder", trigger: "March 1 annual", action: "Send spring house wash campaign", active: true, lastTriggered: "2026-03-01", count: 142 },
  { id: "a14", name: "Fall gutter reminder", trigger: "October 1 annual", action: "Send fall gutter campaign", active: true, lastTriggered: "2025-10-01", count: 98 },
  { id: "a15", name: "Recurring customer re-engage", trigger: "6 months since last wash", action: "Send time-to-wash-again email", active: true, lastTriggered: daysFromNow(-12), count: 23 },
  { id: "a16", name: "Referral reward earned", trigger: "Referred customer books", action: "Credit referrer + notify", active: true, lastTriggered: daysFromNow(-5), count: 11 }
];

export const seedEmailTemplates = [
  { id: "et1", name: "Welcome new lead", subject: "Thanks for reaching out!", body: "Hi {{first_name}},\n\nThanks for the inquiry! We'll follow up within 24 hours with a quote.\n\nSmock's Pressure Washing" },
  { id: "et2", name: "Estimate follow-up", subject: "Any questions about your quote?", body: "Hi {{first_name}},\n\nJust checking in on the quote we sent. Happy to answer any questions.\n\n-- Smock's" },
  { id: "et3", name: "Review request", subject: "How did we do?", body: "Hi {{first_name}},\n\nThanks for choosing us! If you have 30 seconds, we'd love a review:\n{{review_link}}\n\n-- Smock's" },
  { id: "et4", name: "Abandoned estimate nurture", subject: "Still thinking about your quote?", body: "Hi {{first_name}},\n\nHaven't heard back on quote #{{quote_id}}. Any questions? We can also offer 5% off if you book this week.\n\n-- Smock's" },
  { id: "et5", name: "Birthday message", subject: "Happy Birthday from Smock's!", body: "Hi {{first_name}},\n\nHappy birthday! Enjoy 10% off any service this month — code BDAY10.\n\n-- Smock's" },
  { id: "et6", name: "Spring seasonal reminder", subject: "Time for your spring wash?", body: "Hi {{first_name}},\n\nSpring's here — pollen, dirt, mildew. Book your house soft wash and save 15%.\n\n-- Smock's" },
  { id: "et7", name: "Fall gutter reminder", subject: "Fall gutter cleaning season", body: "Hi {{first_name}},\n\nLeaves are falling. Get your gutters cleaned before winter storms hit.\n\n-- Smock's" },
  { id: "et8", name: "Anniversary thank you", subject: "Happy customer anniversary!", body: "Hi {{first_name}},\n\nIt's been a year since your first service with us. Thanks for trusting Smock's!\n\nEnjoy 20% off your next booking.\n\n-- Smock's" },
  { id: "et9", name: "Weather reschedule", subject: "Weather update for your service", body: "Hi {{first_name}},\n\nRain is forecast for your scheduled date. Let's reschedule — what day works?\n\n-- Smock's" },
  { id: "et10", name: "Payment overdue", subject: "Friendly payment reminder", body: "Hi {{first_name}},\n\nYour invoice #{{inv_id}} is past due. Pay here: {{pay_link}}\n\nQuestions? Just reply.\n\n-- Smock's" }
];

export const seedSmsTemplates = [
  { id: "st1", name: "Job reminder", body: "Hi {{first_name}}, reminder that your wash is tomorrow. Reply C to confirm. -- Smock's" },
  { id: "st2", name: "On the way", body: "Hi {{first_name}}, the crew is on the way! ETA 20 min. -- Smock's" },
  { id: "st3", name: "Payment reminder", body: "Hi {{first_name}}, friendly reminder your invoice is past due. Pay here: {{pay_link}}" },
  { id: "st4", name: "Estimate expiring", body: "Hi {{first_name}}, your quote expires in 3 days. Book now to lock in pricing. -- Smock's" },
  { id: "st5", name: "Weather alert", body: "Hi {{first_name}}, weather looks rough for tomorrow. Can we reschedule? -- Smock's" },
  { id: "st6", name: "Job complete", body: "Hi {{first_name}}, all done! Review: {{review_link}}. Thanks! -- Smock's" },
  { id: "st7", name: "Referral reward", body: "Hi {{first_name}}, you earned a $25 credit from a referral! -- Smock's" }
];

export const seedRewardTiers = [
  { refs: 1, reward: "$25 credit", icon: "🥉" },
  { refs: 3, reward: "$100 credit + free add-on", icon: "🥈" },
  { refs: 5, reward: "$250 credit + VIP status", icon: "🥇" },
  { refs: 10, reward: "$500 credit + annual membership", icon: "💎" }
];

export const seedReferrals = {
  c1: { code: "MIKE-SMK01", count: 2, revenue: 1575 },
  c2: { code: "JEN-SMK02", count: 1, revenue: 742 },
  c3: { code: "DAVE-SMK03", count: 3, revenue: 2450 },
  c4: { code: "ASH-SMK04", count: 0, revenue: 0 },
  c5: { code: "ROB-SMK05", count: 4, revenue: 3200 }
};

export const seedMaintenance = [
  { id: "m1", vehicleId: "v1", date: "2026-02-15", type: "Oil Change", cost: 85, mileageAt: 41200, notes: "Synthetic blend" },
  { id: "m2", vehicleId: "v2", date: "2026-04-01", type: "Oil Change", cost: 85, mileageAt: 77900, notes: "" },
  { id: "m3", vehicleId: "v2", date: "2026-01-20", type: "Brake Service", cost: 420, mileageAt: 74800, notes: "Front pads" }
];

export const seedCampaigns: any[] = [];

export const seedSocialPosts = [
  { id: "sp1", platform: "instagram", type: "before_after", caption: "Another house transformed today. DM for a quote. #pressurewashing #softwash #yorkpa", scheduledFor: daysFromNow(1), status: "scheduled" }
];

export const seedTimeline = {
  c1: [{ id: "t1", type: "call", date: "2025-08-12", note: "Initial inquiry", author: "Tyler" }, { id: "t2", type: "estimate", date: "2025-08-14", note: "Sent estimate for $742", author: "System" }, { id: "t3", type: "job", date: "2026-03-18", note: "House wash completed", author: "Tyler" }],
  c3: [{ id: "t4", type: "email", date: "2026-04-01", note: "Follow-up on deck quote", author: "Sam" }, { id: "t5", type: "text", date: "2026-04-14", note: "Confirmed job 4/16", author: "Jordan" }],
  c5: [{ id: "t6", type: "call", date: "2026-04-09", note: "Storefront quote request", author: "Tyler" }]
};

export const campaignTemplates = [
  { id: "ct1", name: "🌸 Spring Special", subject: "Spring special — 15% off", body: "Hi {{first_name}},\n\nSpring's here! Get 15% off any house soft wash booked this month.\n\nYour home will look brand new. Reply to schedule.\n\n— Smock's Pressure Washing\n📞 (717) 555-0100" },
  { id: "ct2", name: "❄️ Winter Prep", subject: "Protect your roof before winter", body: "Hi {{first_name}},\n\nWinter's coming. Algae and moss hold moisture that can damage your roof.\n\nBook a soft wash now before the freeze. Reply for a free quote.\n\n— Smock's" },
  { id: "ct3", name: "🤝 Referral Ask", subject: "Know a neighbor who needs us?", body: "Hi {{first_name}},\n\nIf you loved our work, share us with a neighbor! Use code {{referral_code}} — you get $25 off your next service, they get 10% off.\n\nSimply text us their name.\n\n— Smock's" },
  { id: "ct4", name: "🎄 Holiday Greeting", subject: "Happy Holidays from Smock's!", body: "Hi {{first_name}},\n\nFrom our family to yours — wishing you a wonderful holiday season! 🎄\n\nLook for our New Year special coming in January. Stay warm!\n\n— Will & the Smock's team" },
  { id: "ct5", name: "🎊 New Year Offer", subject: "New year, fresh home — 20% off", body: "Hi {{first_name}},\n\nHappy New Year! Kick off 2026 with a clean home.\n\n20% off all services booked in January. Limited slots — reply to reserve yours.\n\n— Smock's Pressure Washing" },
  { id: "ct6", name: "😴 Win-Back (Inactive)", subject: "We miss you, {{first_name}}!", body: "Hi {{first_name}},\n\nIt's been a while since we last served you. Your home might be ready for some attention.\n\nReply \"BOOK\" and we'll get you on the schedule — 10% off as a welcome back.\n\n— Smock's" },
  { id: "ct7", name: "⭐ Review Request", subject: "How'd we do?", body: "Hi {{first_name}},\n\nThank you for choosing Smock's! We'd love to hear about your experience.\n\nLeave us a quick review: {{review_link}}\n\nIt only takes 30 seconds and means the world to a small business.\n\n— Will @ Smock's" },
  { id: "ct8", name: "🍂 Fall Cleanup", subject: "Fall roof wash — beat the leaves", body: "Hi {{first_name}},\n\nFall leaves trap moisture that causes moss and algae. A soft wash now prevents costly damage later.\n\nBook a fall roof or gutter clean before slots fill up. Reply to schedule.\n\n— Smock's" }
];
