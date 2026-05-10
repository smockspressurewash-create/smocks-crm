// ===== ALL TYPESCRIPT INTERFACES =====
// Central type definitions for Smock's CRM

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  totalSpent: number;
  createdAt: string;
  notes?: string;
  gateCode?: string;
  hasDog?: boolean;
  dogName?: string;
  sensitivePlants?: string;
  leadSource?: string;
  tags?: string[];
  sqFootage?: string;
  pipelineStage?: string;
  birthday?: string;
}

export interface Estimate {
  id: string;
  customerId: string;
  lineItems: LineItem[];
  subtotal: number;
  discount: number;
  depositRequired: number;
  tax: number;
  total: number;
  status: string;
  createdAt: string;
  validUntil?: string;
  viewed?: boolean;
  viewedAt?: string | null;
  sentAt?: string;
  signedAt?: string;
  sigData?: string;
  paidAt?: string;
  paidDeposit?: number;
  paidFull?: number;
  invoiced?: boolean;
  invoicedAt?: string;
  followedUp?: boolean;
  tip?: number;
  notes?: string;
}

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface ChemicalUsed {
  name: string;
  gallons: number;
  cost: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
}

export interface CommLogEntry {
  id: string;
  type: string;
  date: string;
  note: string;
}

export interface Job {
  id: string;
  customerId: string;
  scheduledDate: string;
  status: string;
  pipelineStage: string;
  address: string;
  amount: number;
  lat?: number;
  lng?: number;
  photos?: string[];
  checklist?: ChecklistItem[];
  isRecurring?: boolean;
  recurringFreq?: string;
  cancelReason?: string;
  noShow?: boolean;
  crew?: string[];
  duration?: number;
  internalNotes?: string;
  chemicalsUsed?: ChemicalUsed[];
  equipment?: string[];
  commLog?: CommLogEntry[];
  priority?: string;
  tags?: string[];
  loggedHours?: number;
  clockInAt?: string | null;
  attachments?: Attachment[];
  laborCost?: number;
  materialCost?: number;
  stageChangedAt?: string;
  createdAt?: string;
  tip?: number;
  isCash?: boolean;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  phone: string;
  hourlyRate: number;
  status: string;
}

export interface Vehicle {
  id: string;
  name: string;
  year: number;
  make: string;
  model: string;
  licensePlate: string;
  mileage: number;
  status: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  vendor: string;
}

export interface Chemical {
  id: string;
  name: string;
  brand: string;
  category: string;
  stock: number;
  reorderLevel: number;
  unitCost: number;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface AutomationStep {
  id: string;
  type: string;
  label: string;
  channel?: string;
  delay?: number;
  condition?: string;
  template?: string;
}

export interface Automation {
  id: string;
  name: string;
  trigger: string;
  action: string;
  active: boolean;
  lastTriggered: string | null;
  count: number;
  steps?: AutomationStep[];
  icon?: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject?: string;
  body?: string;
  channel?: string;
  status?: string;
  sentAt?: string;
  recipientCount?: number;
  openRate?: number;
  replyRate?: number;
  scheduledFor?: string;
  template?: string;
  segment?: string;
}

export interface SocialPost {
  id: string;
  platform: string;
  type: string;
  caption: string;
  scheduledFor?: string;
  status: string;
  imageUrl?: string;
}

export interface Review {
  id: string;
  jobId: string;
  token: string;
  status: string;
  rating: number;
  feedback: string;
  sentAt: string | null;
  createdAt: string;
  customerName?: string;
  platform?: string;
}

export interface InboxMessage {
  id: string;
  dir: 'in' | 'out';
  body: string;
  ts: number;
  subject?: string;
}

export interface InboxThread {
  id: string;
  channel: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  customerId?: string;
  unread: boolean;
  messages: InboxMessage[];
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface SmsTemplate {
  id: string;
  name: string;
  body: string;
}

export interface GoogleScopes {
  gmail: boolean;
  calendar: boolean;
  drive: boolean;
  contacts: boolean;
  tasks: boolean;
  meet: boolean;
}

export interface DashboardWidgets {
  quickActions: boolean;
  kpis: boolean;
  revenuePeriods: boolean;
  goals: boolean;
  outstanding: boolean;
  charts: boolean;
  activity: boolean;
  yoy?: boolean;
  invoices?: boolean;
  weather?: boolean;
}

export interface Settings {
  geminiKey: string;
  companyName: string;
  companyPhone: string;
  companyEmail: string;
  myPhone: string;
  logoUrl: string;
  privacyPolicy: string;
  termsOfService: string;
  monthlyRevenueGoal: number;
  monthlyJobsGoal: number;
  quarterlyRevenueGoal?: number;
  taxRate: number;
  stripeConnected: boolean;
  quickbooksConnected: boolean;
  twilioSid: string;
  twilioToken: string;
  twilioFrom: string;
  twilioWhatsAppFrom?: string;
  unsubscribedEmails: string[];
  notifyReviews: boolean;
  notifyOverdue: boolean;
  notifyLowStock: boolean;
  notifyMaintenance: boolean;
  notifyWeather: boolean;
  reviewShowcaseMinRating: number;
  dashboardWidgets: DashboardWidgets;
  googleConnected: boolean;
  googleEmail: string;
  googleCalendarSync: boolean;
  googleDriveSync: boolean;
  googleGmailSync: boolean;
  googleScopes: GoogleScopes;
  googleToken: string;
  googleRefreshToken: string;
  googleBackendUrl: string;
  googleTokenExpiry: number | null;
  googleCalendarId?: string;
  activeModel: string;
  failoverEnabled: boolean;
  modelPriority: string[];
  modelKeys: Record<string, string>;
  brandColor: string;
  accentColor: string;
  userName: string;
  userRole: string;
  owmKey?: string;
  googleMapsKey?: string;
  resendKey?: string;
  notifications?: {
    estimateExpiring?: boolean;
    reviewRequests?: boolean;
  };
}

export interface WeatherDay {
  day: string;
  temp: number;
  rainChance: number;
  wind: number;
  lowTemp?: number;
  condition?: string;
}

export interface WeatherCurrent {
  temp: number;
  condition: string;
  rainChance: number;
  wind: number;
  humidity: number;
  description?: string;
}

export interface WeatherData {
  current: WeatherCurrent;
  forecast: WeatherDay[];
}

export interface GoogleEmail {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
  read: boolean;
  labels: string[];
}

export interface GoogleEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  attendees?: string[];
  color?: string;
}

export interface GoogleTask {
  id: string;
  title: string;
  due?: string;
  status: string;
  notes?: string;
  listTitle?: string;
}

export interface GoogleContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  notes?: string;
}

export interface GoogleFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface GoogleData {
  lastSync: string | null;
  emails: GoogleEmail[];
  events: GoogleEvent[];
  tasks: GoogleTask[];
  contacts: GoogleContact[];
  files: GoogleFile[];
  syncErrors?: string[];
}

export interface ModelStatusEntry {
  lockedUntil?: number;
  lastError?: string;
}

export interface Toast {
  id: string;
  msg: string;
  type: 'success' | 'error';
}

export interface NavItem {
  id: string;
  label: string;
  icon: any;
  badge?: number | null;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export interface Referral {
  code: string;
  count: number;
  revenue: number;
}

export interface RewardTier {
  refs: number;
  reward: string;
  icon: string;
}

export interface Maintenance {
  id: string;
  vehicleId: string;
  date: string;
  type: string;
  cost: number;
  mileageAt: number;
  notes: string;
}

export interface TimelineEntry {
  id: string;
  type: string;
  date: string;
  note: string;
  author: string;
}

export type Timeline = Record<string, TimelineEntry[]>;

export interface AlfredMessage {
  id: string;
  role: 'user' | 'alfred' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AlfredConversation {
  id: string;
  title: string;
  personality: string;
  createdAt: string;
  updatedAt: number;
  messages: AlfredMessage[];
}

export interface MemoryItem {
  id: string;
  text: string;
  category: string;
  createdAt: string;
}

export interface LeadSrc {
  source: string;
  value: number;
  color: string;
}

export interface RevenueMonth {
  month: string;
  revenue: number;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface PipelineStage {
  key: string;
  label: string;
  color: string;
  border: string;
  text: string;
}

export interface PriorityLevel {
  key: string;
  label: string;
  color: string;
  tone: string;
}

export interface Personality {
  name: string;
  icon: any;
  color: string;
  greeting: string;
}

export interface Goal {
  id: string;
  text: string;
  target?: number;
  current?: number;
  unit?: string;
  deadline?: string;
  done?: boolean;
}

export interface Win {
  id: string;
  text: string;
  date: string;
  category?: string;
}

export interface AccountabilityEntry {
  id: string;
  date: string;
  revenue?: number;
  jobs?: number;
  newCustomers?: number;
  callsMade?: number;
  reviewsRequested?: number;
  notes?: string;
}
