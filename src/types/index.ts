// ─── Customer ─────────────────────────────────────────────────────────────────

export interface CustomField {
  key: string;
  value: string;
}

export interface CustomerAddress {
  id: string;
  label?: string;
  street: string;
  city?: string;
  state?: string;
  zip?: string;
  propertyType?: "residential" | "commercial";
  sqFootage?: number;
  notes?: string;
  isPrimary?: boolean;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  sqFootage?: number;
  tags: string[];
  notes?: string;
  totalSpent: number;
  createdAt: string;
  gateCode?: string;
  hasDog?: boolean;
  dogName?: string;
  sensitivePlants?: string;
  leadSource?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  smsOptOut?: boolean;
  optOutDate?: string;
  customFields?: CustomField[];
  birthday?: string;
  referredBy?: string;
  reviewRequested?: string;
  portalToken?: string;
  addresses?: CustomerAddress[];
}

// ─── Estimate ─────────────────────────────────────────────────────────────────

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  catalogPrice?: number;
  photo?: string;
  notes?: string;
  notesInternal?: boolean;
  optional?: boolean;
}

export interface EstimatePackage {
  id: string;
  name: string;
  description?: string;
  lineItems: LineItem[];
  subtotal: number;
}

export interface Estimate {
  id: string;
  customerId: string;
  estimateType?: "standard" | "options" | "package";
  packages?: EstimatePackage[];
  lineItems: LineItem[];
  subtotal: number;
  discount: number;
  depositRequired: number;
  tax: number;
  total: number;
  status: "pending" | "approved" | "rejected" | "expired";
  createdAt: string;
  validUntil: string;
  sentAt?: string;
  signedAt?: string;
  paidAt?: string;
  sigData?: string;
  sigType?: "draw" | "type";
  notes?: string;
  internalNote?: string;
  terms?: string;
  viewed?: boolean;
  viewedAt?: string;
  invoiced?: boolean;
  invoicedAt?: string;
  paidDeposit?: number;
  paidFull?: number;
  partialPaid?: number;
  googleEventId?: string;
  conversions?: number;
  stripePaymentIntentId?: string;
  stripePaymentStatus?: "unpaid" | "paid" | "refunded";
}

// ─── Job ──────────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface Photo {
  id: string;
  type: "before" | "after" | "general";
  dataUrl: string;
  caption?: string;
  uploadedAt?: string;
}

export interface ChecklistPhoto {
  id: string;
  dataUrl: string;
  caption?: string;
}

export interface JobChecklistItem {
  id: string;
  label: string;
  done: boolean;
  photos?: ChecklistPhoto[];
  videos?: ChecklistPhoto[];
  notes?: string;
}

export interface JobVideo {
  id: string;
  dataUrl: string;
  caption?: string;
  addedAt?: string;
}

export interface JobSignOff {
  signerName: string;
  timestamp: string;
  sigData?: string;
  sigType?: "type" | "draw";
}

export interface ChemicalUsed {
  name: string;
  amount: string;
  unit: string;
  cost: number;
}

export interface CommLogEntry {
  id: string;
  type: "sms" | "email" | "call" | "note";
  note: string;
  date: string;
  direction?: "in" | "out";
}

export interface Job {
  id: string;
  customerId: string;
  address: string;
  amount: number;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  scheduledDate: string;
  scheduledTime?: string;
  duration?: number;
  estimatedDuration?: number;
  priority: "low" | "normal" | "high" | "urgent";
  crew: string[];
  checklist: ChecklistItem[];
  photos: Photo[];
  notes?: string;
  internalNotes?: string;
  commLog: CommLogEntry[];
  chemicalsUsed: ChemicalUsed[];
  equipment: string[];
  requiredChemicals?: string[];
  equipmentChecked?: boolean;
  tags: string[];
  loggedHours?: number;
  laborCost?: number;
  materialCost?: number;
  clockInAt?: number | null;
  lunchStartAt?: number | null;
  lunchMinutes?: number;
  lunchExceeded?: boolean;
  isRecurring?: boolean;
  recurringFreq?: string;
  isCash?: boolean;
  tip?: number;
  noShow?: boolean;
  cancelReason?: string;
  googleEventId?: string;
  pipelineStage?: string;
  stageChangedAt?: string;
  createdAt?: string;
  lostReason?: string;
  lat?: number;
  lng?: number;
  _showProfit?: boolean;
  paymentType?: "Cash" | "Check" | "Card" | "Zelle" | "Venmo" | "Invoice";
  paymentStatus?: "Pending" | "Partial" | "Paid";
  amountCollected?: number;
  surfaceType?: string;
  chemMixRatio?: string;
  customerAccepted?: boolean;
  preChecklist?: JobChecklistItem[];
  duringChecklist?: JobChecklistItem[];
  postChecklist?: JobChecklistItem[];
  videos?: JobVideo[];
  signOff?: JobSignOff;
  rainGuarantee?: boolean;
  rainGuaranteeDate?: string | null;
  weatherOverride?: boolean;
  sqFootage?: number;
  sqFtRate?: number;
  attachments?: { id: string; name: string; type: string }[];
  signOffTerms?: string;
}

// ─── Employee ─────────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  status: "active" | "inactive";
  hourlyRate: number;
  phone?: string;
  email?: string;
  startDate?: string;
  emergencyContact?: string;
  notes?: string;
  autoSyncCalendar?: boolean;
  homeBaseAddress?: string;
  ratingScore?: number;
  lastPaidThrough?: string;
}

// ─── Vehicle / Fleet ──────────────────────────────────────────────────────────

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  plate?: string;
  mileage: number;
  lastOilChange?: number;
  lastOilChangeDate?: string;
  notes?: string;
  status?: "active" | "inactive";
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  type: string;
  date: string;
  mileage: number;
  cost: number;
  notes?: string;
}

// ─── Expense ──────────────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  vendor?: string;
  receiptDataUrl?: string;
  isBusiness?: boolean;
  isCash?: boolean;
  isDeductible?: boolean;
}

// ─── Chemical ─────────────────────────────────────────────────────────────────

export interface Chemical {
  id: string;
  name: string;
  stock: number;
  unit: string;
  unitCost: number;
  reorderLevel: number;
  supplier?: string;
  notes?: string;
  lastOrdered?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export interface Service {
  id: string;
  name: string;
  description?: string;
  customerDescription?: string;
  internalNotes?: string;
  basePrice: number;
  minPrice?: number;
  maxPrice?: number;
  unit?: string;
  taxable?: boolean;
  active?: boolean;
}

// ─── Campaign ─────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  ch: "sms" | "email";
  subject?: string;
  body: string;
  status: "draft" | "scheduled" | "sent";
  sendAt?: string;
  sentAt?: string;
  recipientCount?: number;
  matches?: string[];
  conversions?: number;
  segment?: SegmentFilter;
}

export interface SegmentFilter {
  tags?: string[];
  city?: string;
  lastServiceBefore?: number;
  lastServiceAfter?: number;
  serviceType?: string;
  minSpent?: number;
  maxSpent?: number;
}

// ─── Automation ───────────────────────────────────────────────────────────────

export interface AutomationStep {
  id: string;
  type: string;
  label: string;
  icon?: string;
  channel?: string;
  template?: string;
  delay?: number;
  condition?: string;
  value?: string | number;
}

export interface Automation {
  id: string;
  name: string;
  trigger: string;
  action: string;
  active: boolean;
  lastTriggered?: string | null;
  count?: number;
  steps: AutomationStep[];
  description?: string;
}

// ─── Review ───────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  customerId: string;
  customerName?: string;
  rating: number;
  text?: string;
  response?: string;
  createdAt: string;
  source?: string;
  status?: "pending" | "responded" | "private";
}

// ─── Inbox ────────────────────────────────────────────────────────────────────

export interface InboxMessage {
  id: string;
  role: "customer" | "owner";
  body: string;
  ts: string;
  status?: "sent" | "delivered" | "read" | "failed";
  channel?: "sms" | "whatsapp" | "email";
}

export interface InboxThread {
  id: string;
  customerId?: string;
  customerName?: string;
  phone?: string;
  channel: "sms" | "whatsapp" | "email";
  messages: InboxMessage[];
  lastMessageAt: string;
  unread?: boolean;
  smsOptOut?: boolean;
}

// ─── Social ───────────────────────────────────────────────────────────────────

export interface SocialPost {
  id: string;
  platform: "instagram" | "facebook" | "tiktok" | "google" | "nextdoor";
  type: string;
  caption: string;
  scheduledFor?: string;
  publishedAt?: string;
  hashtags?: string;
  status: "scheduled" | "published" | "draft";
  likes?: number;
  shares?: number;
  comments?: number;
  reach?: number;
  autoGenerated?: boolean;
  _imageData?: { data: string; mediaType: string };
}

// ─── Accountability ───────────────────────────────────────────────────────────

export interface AccountabilityEntry {
  id: string;
  date: string;
  sleep: number;
  water: number;
  steps: number;
  gymMinutes: number;
  meditationMinutes?: number;
  mood: number;
  notes?: string;
  gym?: boolean;
  lunchTaken?: boolean;
  stretchDone?: boolean;
}

export interface Goal {
  id: string;
  category: string;
  label: string;
  target: number;
  current: number;
  unit: string;
  deadline?: string;
}

export interface Win {
  id: string;
  text: string;
  date: string;
  category?: string;
}

export interface Reminder {
  id: string;
  text: string;
  frequency: "daily" | "weekly" | "monthly";
  emoji?: string;
  lastDone?: string | null;
}

// ─── Alfred ───────────────────────────────────────────────────────────────────

export interface AlfredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: string;
  thinking?: boolean;
}

export interface AlfredConversation {
  id: string;
  title: string;
  messages: AlfredMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AlfredMemory {
  id: string;
  category: string;
  content: string;
  createdAt: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  // Company
  companyName?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  logoUrl?: string;
  brandColor?: string;
  brandAccent?: string;

  // Owner
  ownerName?: string;
  ownerRole?: string;
  myPhone?: string;
  myEmail?: string;

  // Crew policy
  maxLunchMinutes?: number;
  homeBaseAddress?: string;
  paidLunchBreaks?: boolean;

  // Onboarding — explicitly false only for brand-new owner registrations;
  // undefined (pre-existing accounts) is treated as already complete.
  onboardingComplete?: boolean;
  onboardingYearsInBusiness?: number;
  onboardingServicesOffered?: string[];
  onboardingTeamSize?: number;

  // API keys
  twilioSid?: string;
  twilioToken?: string;
  twilioPhone?: string;
  twilioBackendUrl?: string;
  geminiKey?: string;
  openaiKey?: string;
  anthropicKey?: string;
  groqKey?: string;
  mistralKey?: string;
  minimaxKey?: string;
  elevenlabsKey?: string;
  elevenlabsVoiceId?: string;
  owmKey?: string;
  mapsKey?: string;
  stripeKey?: string;
  stripeConnected?: boolean;
  stripePublishableKey?: string;
  // Secret key is obfuscated (see lib/crypto.ts) before being persisted — not real
  // encryption, but keeps it from sitting in localStorage as plain text.
  stripeSecretKeyEnc?: string;
  resendKey?: string;
  fromEmail?: string;
  resendBackendUrl?: string;

  // Google
  googleConnected?: boolean;
  googleToken?: string;
  googleEmail?: string;
  googleCalendarId?: string;
  googleBackendUrl?: string;
  googlePlaceId?: string;

  // Integrations
  telegramBotToken?: string;
  telegramChatId?: string;
  whatsappFrom?: string;

  // Notifications
  notifyReviews?: boolean;
  notifyOverdue?: boolean;
  notifyLowStock?: boolean;
  notifyMaintenance?: boolean;
  notifyWeather?: boolean;
  autoPostCompletedJobs?: boolean;
  instaBridge?: boolean;
  reviewShowcaseMinRating?: number;

  // Business rules
  monthlyRevenueGoal?: number;
  monthlyJobsGoal?: number;
  taxRate?: number;
  defaultDepositPct?: number;
  termsAndConditions?: string;
  terms?: string;
  estimateValidDays?: number;

  // Integrations misc
  bufferTime?: number;
  googleCalendarColor?: boolean;

  // Models
  selectedModel?: string;
  ttsEnabled?: boolean;

  // Extended/misc
  googleMapsKey?: string;
  googleScopes?: Record<string, boolean>;
  activeModel?: string;
  modelPriority?: string[];
  modelKeys?: Record<string, string>;
  failoverEnabled?: boolean;
  openAiKey?: string;
  twilioFrom?: string;

  // Dashboard / business goals
  dashboardWidgets?: string[];
  quarterlyRevenueGoal?: number;
  annualRevenueGoal?: number;
  weeklyJobsGoal?: number;

  // Misc settings used across pages
  instagramHandle?: string;
  facebookHandle?: string;
  tiktokHandle?: string;
  reviewLink?: string;
  portalUrl?: string;
  minimaxGroupId?: string;
  googleCalendarSyncEnabled?: boolean;
  googleContacts?: boolean;
  [key: string]: any;
}

// ─── Referral ─────────────────────────────────────────────────────────────────

export interface Referral {
  id: string;
  referrerId: string;
  referredName: string;
  referredPhone?: string;
  status: "pending" | "booked" | "completed";
  reward?: number;
  createdAt: string;
}

export interface RewardTier {
  id: string;
  label: string;
  minReferrals: number;
  reward: string;
  icon: string;
  refs?: number;
}

// ─── Mileage ─────────────────────────────────────────────────────────────────

export interface MileageLog {
  id: string;
  date: string;
  from: string;
  to: string;
  miles: number;
  purpose: string;
  vehicleId?: string;
  deduction?: number;
}

// ─── Budget ───────────────────────────────────────────────────────────────────

export interface PersonalTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category?: string;
}

// ─── Timeline ────────────────────────────────────────────────────────────────

export interface TimelineEntry {
  id: string;
  type: "estimate" | "job" | "note" | "call" | "email" | "sms" | "review";
  note: string;
  date: string;
  amount?: number;
  link?: string;
}

export type Timeline = Record<string, TimelineEntry[]>;

// ─── Google Workspace data ────────────────────────────────────────────────────

export interface GoogleWorkspaceData {
  files: import("../lib/google").GoogleDriveFile[];
  emails: Array<{ id: string; from: string; subject: string; snippet: string; date: string }>;
}

// ─── Model status ─────────────────────────────────────────────────────────────

export type ModelStatus = Record<string, "connected" | "error" | "testing" | undefined>;
