import { useState, useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard, Users, FileText, Receipt, Briefcase, GitBranch,
  Calendar, MessageSquare, Megaphone, Star, Zap, Share2, UserPlus,
  Bot, Database, Users2, Truck, DollarSign, FlaskConical, BarChart3,
  TrendingUp, PiggyBank, Wallet, Heart, Gift, Monitor, Tag,
  Bell, Settings, X, Lock, Globe, ChevronLeft, ChevronRight, Plus, Undo2, Redo2, CheckCircle, Eye, EyeOff, Menu, AlertTriangle, Trash2, BookOpen, UserCheck, Target, LayoutGrid
} from "lucide-react";

import { useGlobalStyles } from "./hooks/useGlobalStyles";
import { usePersistent } from "./hooks/usePersistent";
import { usePersistentRaw } from "./hooks/usePersistentRaw";
import { usePollGate } from "./hooks/usePollGate";
import { useAutomationEngine } from "./hooks/useAutomationEngine";
import { useScheduledCampaigns } from "./hooks/useScheduledCampaigns";
import { useIsMobile } from "./hooks/useIsMobile";
import { supabase } from "./lib/supabase";
import { getPlanLimits, type PlatformSubscription } from "./lib/planLimits";
import { SafePage } from "./components/ui/ErrorBoundary";
import { CrewBossMark } from "./components/ui/CrewBossMark";
import { PageFade } from "./components/ui/PageFade";
import { GlobalSearch } from "./components/ui/GlobalSearch";

// ─── Pages ────────────────────────────────────────────────────────────────────
import { Dashboard } from "./components/pages/Dashboard";
import { CockpitPage } from "./components/pages/CockpitPage";
import { FeedbackPage } from "./components/pages/FeedbackPage";
import { CustomersPage } from "./components/pages/CustomersPage";
import { CustomerModal } from "./components/ui/CustomerModal";
import { SopModal } from "./components/ui/SopModal";
import { EstimatesPage } from "./components/pages/EstimatesPage";
import { InvoicesPage } from "./components/pages/InvoicesPage";
import { JobsPage } from "./components/pages/JobsPage";
import { PipelinePage } from "./components/pages/PipelinePage";
import { CalendarPage } from "./components/pages/CalendarPage";
import { InboxPage } from "./components/pages/InboxPage";
import { CampaignsPage } from "./components/pages/CampaignsPage";
import { ReviewsPage } from "./components/pages/ReviewsPage";
import { AutomationsPage } from "./components/pages/AutomationsPage";
import { SocialPage } from "./components/pages/SocialPage";
import { LeadIntakePage } from "./components/pages/LeadIntakePage";
import { TrashCanPage } from "./components/pages/TrashCanPage";
import { TrashCanSignupPage } from "./components/pages/TrashCanSignupPage";
import { AlfredPage } from "./components/pages/AlfredPage";
import { GoogleWorkspacePage } from "./components/pages/GoogleWorkspacePage";
import { EmployeesPage } from "./components/pages/EmployeesPage";
import { FleetPage } from "./components/pages/FleetPage";
import { ExpensesPage } from "./components/pages/ExpensesPage";
import { ChemicalsPage } from "./components/pages/ChemicalsPage";
import { NotificationsPage } from "./components/pages/NotificationsPage";
import { ReportsPage } from "./components/pages/ReportsPage";
import { AnalyticsPage } from "./components/pages/AnalyticsPage";
import { BudgetPage } from "./components/pages/BudgetPage";
import { PersonalBudgetPage } from "./components/pages/PersonalBudgetPage";
import { AccountabilityPage } from "./components/pages/AccountabilityPage";
import { GoalsPage } from "./components/pages/GoalsPage";
import { ReferralsPage } from "./components/pages/ReferralsPage";
import { PromotionsPage } from "./components/pages/PromotionsPage";
import { CrewView } from "./components/pages/CrewView";
import { SettingsModal } from "./components/pages/SettingsModal";
import { ClientPortal } from "./components/pages/ClientPortal";
import { ClientAuthPortal } from "./components/pages/ClientAuthPortal";
import { ReferralLanding } from "./components/pages/ReferralLanding";
import { CustomerReviewPage } from "./components/pages/CustomerReviewPage";
import { LeadFormPage } from "./components/pages/LeadFormPage";
import { ApplyPage } from "./components/pages/ApplyPage";
import { HiringPage } from "./components/pages/HiringPage";
import { TermsPage, PrivacyPolicyPage } from "./components/pages/LegalPages";
import { LandingPage } from "./components/pages/LandingPage";
import { InstallAppButton } from "./components/ui/InstallAppButton";
import { PushOptInPrompt } from "./components/ui/PushOptInPrompt";
import { FeaturesPage } from "./components/pages/FeaturesPage";
import { PricingPage } from "./components/pages/PricingPage";
import { AboutPage } from "./components/pages/AboutPage";
import { EmployeePortal } from "./components/pages/EmployeePortal";
import { saveEmpGoogleToken, refreshEmpGoogleToken } from "./lib/googleApi";
import { ResetPassword } from "./components/pages/ResetPassword";
import { OnboardingFlow } from "./components/ui/OnboardingFlow";
import { AutomationBatchModal } from "./components/ui/AutomationBatchModal";

// ─── Seed data ────────────────────────────────────────────────────────────────
import {
  seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles,
  seedExpenses, seedChemicals, seedServices, seedAutomations,
  seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals,
  seedMaintenance, seedSocialPosts, seedTimeline, seedGoals, seedReminders,
  seedAccountabilityEntries, seedMileage, campaignTemplates,
  AUTOMATION_TEMPLATES, automationFromTemplate,
} from "./lib/seed";
import { seedWeather } from "./lib/weather";
import { fetchRealWeather, deriveWeatherLocation } from "./lib/weather";
import { fmt, uid, today, daysSince, daysFromNow, consumeOAuthIntent, getLastOwnerSessionFlag, setLastOwnerSessionFlag, getLastOwnerId, setLastOwnerId, buildChecklistFromServices, withTimeout, normalizeJobRow, totalJobPhotoCount, notifyDesktop, stripLegacyJobFields, getPollIntervalMs, purgeOldJobMedia, computeGoalProgress, localDateKey } from "./lib/utils";
import { sendPushNotification } from "./lib/push";
import { sendEmail, sendOwnerGmailOnly, emailShell, emailButton, buildTomorrowJobsEmailHtml, buildWeeklyScheduleEmailHtml, buildDailyBriefingEmailHtml, buildWeeklyOwnerDigestEmailHtml, setOptedOutPhones, setTestModeContacts, twilioSend, logOutboundSmsToInbox } from "./lib/messaging";
import { exchangeSocialOAuthCode, type SocialPlatform } from "./lib/socialOAuth";
import type {
  Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense,
  Chemical, Service, Campaign, Automation, Review, SocialPost,
  AccountabilityEntry, Goal, Win, Reminder, AppSettings,
  InboxThread, AlfredConversation, AlfredMessage, Timeline, ModelStatus, AppNotification,
} from "./types";

// ─── Toast ────────────────────────────────────────────────────────────────────
interface Toast { id: string; msg: string; tone?: "green" | "red" | "yellow" }

// ─── FAB actions ──────────────────────────────────────────────────────────────
const ALL_FAB_ACTIONS = [
  { id: "customers", label: "New Customer",  dest: "customers", colorClass: "from-green-600 to-green-900"   },
  { id: "estimates", label: "New Quote",      dest: "estimates", colorClass: "from-yellow-600 to-yellow-900" },
  { id: "jobs",      label: "Schedule Job",   dest: "jobs",      colorClass: "from-blue-600 to-blue-900"    },
  { id: "alfred",    label: "Ask Alfred",     dest: "alfred",    colorClass: "from-purple-600 to-purple-900" },
  { id: "expenses",  label: "Log Expense",    dest: "expenses",  colorClass: "from-orange-600 to-orange-900" },
  { id: "intake",    label: "New Lead",       dest: "intake",    colorClass: "from-teal-600 to-teal-900"    },
] as const;

// ─── Nav groups ───────────────────────────────────────────────────────────────
const navGroups = [
  {
    label: "Main",
    items: [
      { id: "dashboard",     label: "Dashboard",     icon: LayoutDashboard },
      { id: "alfred",        label: "Alfred AI",     icon: Bot             },
      { id: "inbox",         label: "Inbox",         icon: MessageSquare   },
      { id: "notifications", label: "Notifications", icon: Bell            },
    ],
  },
  {
    // FEATURE — sidebar reorg: "Jobs should be higher up" — moved Operations
    // (Jobs/Calendar/Crew View/Trash Cans/SOPs) ahead of Sales, right after Main.
    label: "Operations",
    items: [
      { id: "jobs",       label: "Jobs",       icon: Briefcase  },
      { id: "calendar",   label: "Calendar",   icon: Calendar   },
      { id: "crew",       label: "Crew View",  icon: Monitor    },
      { id: "trashcans",  label: "Trash Cans", icon: Trash2     },
      { id: "sops",       label: "SOPs",       icon: BookOpen   },
    ],
  },
  {
    label: "Sales",
    items: [
      { id: "customers",  label: "Customers",  icon: Users     },
      { id: "estimates",  label: "Quotes",     icon: FileText  },
      { id: "invoices",   label: "Invoices",   icon: Receipt   },
      { id: "pipeline",   label: "Pipeline",   icon: GitBranch },
      { id: "intake",     label: "Lead Intake",icon: UserPlus  },
    ],
  },
  {
    label: "Marketing",
    items: [
      { id: "campaigns",   label: "Campaigns",   icon: Megaphone },
      { id: "reviews",     label: "Reviews",     icon: Star      },
      { id: "automations", label: "Automations", icon: Zap       },
      { id: "social",      label: "Social",      icon: Share2    },
    ],
  },
  {
    label: "Growth",
    items: [
      { id: "goals",       label: "Goals",       icon: Target },
      { id: "referrals",   label: "Referrals",   icon: Gift },
      { id: "promotions",  label: "Promotions",  icon: Tag  },
    ],
  },
  {
    label: "Finance",
    items: [
      { id: "expenses",  label: "Expenses",  icon: DollarSign },
      { id: "reports",   label: "Reports",   icon: BarChart3  },
      { id: "analytics", label: "Analytics", icon: TrendingUp },
      { id: "budget",    label: "Budget",    icon: PiggyBank  },
      { id: "personal",  label: "Personal $",icon: Wallet     },
    ],
  },
  {
    label: "Team & Assets",
    items: [
      { id: "employees", label: "Employees", icon: Users2      },
      { id: "hiring",    label: "Hiring",    icon: UserCheck   },
      { id: "fleet",     label: "Fleet",     icon: Truck       },
      { id: "chemicals", label: "Chemicals & Equipment", icon: FlaskConical},
    ],
  },
  {
    label: "Personal",
    items: [
      { id: "accountability", label: "Accountability", icon: Heart    },
      { id: "google",         label: "Workspace",      icon: Database },
      { id: "portal",         label: "Team Portal",    icon: Monitor  },
    ],
  },
];

// ─── Role resolver ────────────────────────────────────────────────────────────
// Local cache of "this user is an employee or manager", keyed by Supabase user
// ID. Checked BEFORE any Supabase query so a momentary race right after an
// OAuth redirect (where a fresh query could come back empty before data has
// propagated) can never misclassify a known employee/manager as an owner.
// Only ever caches "employee"/"manager" — "owner" is never cached, since a
// stale owner cache would block a legitimate employee record created later for
// the same user.
const getCachedRole = (userId: string): "employee" | "manager" | null => {
  try {
    const v = localStorage.getItem("crew_role_" + userId);
    return v === "employee" || v === "manager" ? v : null;
  } catch { return null; }
};
const setCachedRole = (userId: string, role: "employee" | "manager"): void => {
  try { localStorage.setItem("crew_role_" + userId, role); } catch { /* ignore */ }
};

// Determines whether a Supabase session belongs to an owner, a manager, or a
// plain employee. Priority: cached role → employees table (owner role → owner,
// manager role → manager, anything else → employee) → Google identity (no
// employee record → owner) → default employee.
//
// The employees table is checked first (after the cache) and is authoritative:
// once someone is created as an employee/manager, nothing about their session
// (including linking a Google account for calendar sync) can ever reclassify
// them as an owner. A Google identity only means "owner" for a user who isn't
// in the employees table at all. Managers get CRM access like owners (see the
// auth-state handler below) but with Settings restricted to their own profile.
// MULTI-TENANT (Phase C) — now also resolves `ownerId`: the tenant every
// owner_id-scoped Supabase call (see App.tsx's refetch/write paths and the
// new RLS in supabase/migrations/0033_multitenant_owner_scoping.sql) must
// filter/write by. For an owner this is their own auth uid (self-
// referential — matches the owner's employees row, which App.tsx's owner
// self-assign effect already writes as owner_id: <own uid>). For a manager
// or employee it's the OWNING business's id, read off THEIR employees row —
// critically NOT their own session.user.id. Before this fix, every call
// site downstream used the owner's own uid unconditionally (crmUserId =
// session.user.id), which is correct only for an owner session; a manager
// signed into the main CRM would have had every owner_id-scoped query
// resolve to their OWN uid instead of the business they work for, matching
// zero rows.
async function resolveUserRole(session: any): Promise<{ role: "owner" | "manager" | "employee"; ownerId: string }> {
  if (!session?.user) return { role: "owner", ownerId: "" };
  const selfId = session.user.id;

  const cached = getCachedRole(session.user.id);
  if (cached) {
    // Cache only ever stores "employee"/"manager" (see setCachedRole call
    // sites below) — re-resolve ownerId from the employees row even on a
    // cache hit, since the cache predates this field and doesn't store it.
    try {
      const { data } = await (supabase as any).from("employees").select("owner_id").eq("user_id", selfId).maybeSingle();
      if (data?.owner_id) return { role: cached, ownerId: data.owner_id };
    } catch { /* fall through */ }
    return { role: cached, ownerId: selfId };
  }

  try {
    const { data } = await (supabase as any)
      .from("employees")
      .select("id, role, owner_id")
      .eq("user_id", selfId)
      .maybeSingle();
    if (data) {
      const role = (data.role || "").toLowerCase();
      const ownerId = data.owner_id || selfId;
      if (role === "owner") {
        return { role: "owner", ownerId };
      }
      if (role === "manager") {
        setCachedRole(selfId, "manager");
        return { role: "manager", ownerId };
      }
      setCachedRole(selfId, "employee");
      return { role: "employee", ownerId };
    }
  } catch { /* employees table may not exist */ }

  // No row matched by user_id — for a Google sign-in this is normal the
  // FIRST time an employee uses Google (their employees row was created by
  // the owner with just an email, never linked to an auth user_id yet).
  // link_own_employee_by_email() (SECURITY DEFINER RPC, see migration
  // 0033_multitenant_owner_scoping.sql) finds AND links that row by the
  // caller's OWN verified JWT email in one atomic step — a direct table
  // query here can't do this under the new owner_id-scoped RLS, since
  // there's no user_id link yet for current_owner_id() to resolve through.
  if (session.user.email) {
    try {
      const { data: byEmail } = await (supabase as any).rpc("link_own_employee_by_email").maybeSingle();
      if (byEmail) {
        const role = (byEmail.role || "").toLowerCase();
        const ownerId = byEmail.owner_id || selfId;
        if (role === "owner") return { role: "owner", ownerId };
        if (role === "manager") { setCachedRole(selfId, "manager"); return { role: "manager", ownerId }; }
        setCachedRole(selfId, "employee");
        return { role: "employee", ownerId };
      }
    } catch { /* RPC may not exist yet (migration not applied) or no matching row */ }
  }

  const oauthIntent = consumeOAuthIntent();
  if (oauthIntent === "employee") {
    return { role: "employee", ownerId: selfId };
  }

  const identities = session.user.identities || [];
  const hasGoogle = identities.some((i: any) => i.provider === "google");
  if (hasGoogle) {
    return { role: "owner", ownerId: selfId };
  }

  return { role: "employee", ownerId: selfId };
}

// Captures the Google OAuth token bridged via sessionStorage (see the manual
// OAuth token exchange effect below) and persists it for an EMPLOYEE session —
// keyed to their own user ID in localStorage, plus a best-effort write to their
// Supabase employees row so owner-side calendar/email features can reach it too.
function persistEmployeeGoogleToken(session: any): void {
  if (!session?.user) return;
  const googleId = (session.user.identities || []).find((i: any) => i.provider === "google");
  if (!googleId) return;
  const bridgedToken = sessionStorage.getItem("smocks.gpt") || "";
  const bridgedRefreshToken = sessionStorage.getItem("smocks.grt") || "";
  const providerToken = bridgedToken || session.provider_token || "";
  if (!providerToken) return;
  if (bridgedToken) sessionStorage.removeItem("smocks.gpt");
  if (bridgedRefreshToken) sessionStorage.removeItem("smocks.grt");
  const googleEmail = googleId.identity_data?.email || session.user.email || "";
  const expiresAt = Date.now() + 55 * 60 * 1000; // Google access tokens last ~1hr
  // Supabase is the source of truth for cross-device sync — write there
  // first and check the result explicitly (it resolves with {error} rather
  // than throwing on failure, so a bare .catch() alone would miss a real
  // failure and still log success). localStorage is only updated after a
  // confirmed Supabase success, purely as an instant-read cache for this
  // device — never the other way around, or a token saved here would show
  // as "connected" on THIS device while never reaching the other one.
  withTimeout(
    (supabase as any).from("employees")
      .update({ google_token: providerToken, google_refresh_token: bridgedRefreshToken || null, google_email: googleEmail, google_token_expires_at: new Date(expiresAt).toISOString() })
      .eq("user_id", session.user.id),
    15000, "Employee Google token save"
  )
    .then((result: any) => {
      if (result?.error) {
        console.error("Could not persist employee Google token to Supabase:", result.error.message);
        return;
      }
      saveEmpGoogleToken(session.user.id, { token: providerToken, refreshToken: bridgedRefreshToken, email: googleEmail, expiresAt });
    })
    // BUG FIX — a hung/timed-out write here previously left saveEmpGoogleToken
    // (the localStorage cache the "Connected" badge reads) never called at
    // all, and nothing told the employee why — they'd just see "not
    // connected" with no explanation and no local cache to fall back on
    // even though the OAuth grant itself succeeded seconds earlier.
    .catch((e: any) => console.error("Could not persist employee Google token to Supabase (timed out or network error):", e?.message));
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  useGlobalStyles();

  // ── OAuth redirect debug ──────────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash;
  }, []);

  // ── Manual OAuth token exchange ───────────────────────────────────────────
  // detectSessionInUrl isn't reliably processing the implicit-flow hash, so we
  // extract the tokens ourselves and call setSession() directly on mount.
  // provider_token (Google OAuth token) is bridged via sessionStorage so
  // applyGoogleIdentity (which has setSettings) can persist it.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token")) {
      console.log("[GoogleConnect] mount — no access_token in hash (not an OAuth callback, or lib/supabase.ts's pre-init bridge already consumed it)");
      return;
    }
    const params = new URLSearchParams(hash.substring(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const provider_token = params.get("provider_token");
    const provider_refresh_token = params.get("provider_refresh_token");
    console.log("[GoogleConnect] OAuth callback hash detected — provider_token present:", !!provider_token, "· access_token present:", !!access_token);
    // Bridge Google tokens to applyGoogleIdentity via sessionStorage. This is
    // a defensive second write — lib/supabase.ts already does this same
    // bridge synchronously at module load (before Supabase's own
    // detectSessionInUrl can race it), so this is normally a harmless no-op
    // re-write of the same value; it only matters if this effect somehow
    // runs before that module-level code did (it shouldn't, given import
    // order, but costs nothing to keep both).
    if (provider_token) sessionStorage.setItem("smocks.gpt", provider_token);
    if (provider_refresh_token) sessionStorage.setItem("smocks.grt", provider_refresh_token);
    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
        if (error) {
          console.error("[GoogleConnect] setSession failed:", error.message);
        } else {
          console.log("[GoogleConnect] setSession succeeded — session established, clearing hash");
          window.location.hash = "";
        }
      });
    }
  }, []);

  // ── PIN lock ──────────────────────────────────────────────────────────────
  const [pinSet] = usePersistentRaw("smocks.pin", "");
  const [pinUnlocked, setPinUnlocked] = useState(!pinSet);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  // ── Employee portal session (email/password auth, separate from Google OAuth) ──
  const [empSession, setEmpSession] = useState<any>(null);
  // CRM owner profile
  const [crmUserEmail, setCrmUserEmail] = useState("");
  // Captured once at auth-resolution time (onAuthStateChange/getSession at
  // bootstrap) so action handlers (crew requests, schedule&notify) never need
  // to call supabase.auth.getSession() themselves — that call is known to hang
  // indefinitely under certain Supabase internal navigator-lock contention,
  // which is what caused "Request Crew" to stick on "Sending…" forever.
  // FIX 3 — seeded from the cached last-known owner id (same trick as
  // hasCrmSession/getLastOwnerSessionFlag below) so a RETURNING owner has
  // ownerId populated instantly, not just once the async session bootstrap's
  // network round trip resolves. Without this, hasCrmSession being seeded
  // true rendered a fully-interactive Jobs page (crew assign/request
  // buttons and all) during a real window where crmUserId was still "" —
  // any action gated on it failed with "still finishing sign-in" even
  // though, from the owner's screen, they were already looking at a
  // seemingly-ready CRM.
  const [crmUserId, setCrmUserId] = useState(() => getLastOwnerId());
  const [profileDropOpen, setProfileDropOpen] = useState(false);
  // True once we've checked Supabase for an existing session on first load.
  // Prevents the CRM flashing briefly before the employee session is restored.
  const [sessionChecked, setSessionChecked] = useState(false);
  // True once any owner session is confirmed — gates the CRM from unauthenticated access.
  // Seeded from a cached flag so a returning owner with a still-valid session
  // renders straight into the dashboard instead of flashing the login form —
  // the auth bootstrap (below) actively clears the flag and flips this back
  // to false the instant a real session check comes back negative.
  const [hasCrmSession, setHasCrmSession] = useState(() => getLastOwnerSessionFlag());
  // FEATURE — "any base account hits their plan limit... prompts them to
  // upgrade." Fetched once per session, not on every render — see
  // lib/planLimits.ts for how a raw status/plan/trial_ends_at row turns
  // into actual enforced limits (and why "no row" is deliberately treated
  // as unlimited, not free-tier-limited).
  const [platformSub, setPlatformSub] = useState<PlatformSubscription>(null);
  useEffect(() => {
    if (!crmUserId || !hasCrmSession) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const res = await fetch("/api/platform-billing", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "get_status" }),
        });
        const data = await res.json().catch(() => null);
        if (data?.subscription !== undefined) setPlatformSub(data.subscription);
      } catch (e: any) {
        console.warn("[PlatformBilling] get_status failed:", e?.message);
      }
    })();
  }, [crmUserId, hasCrmSession]);
  const planLimits = getPlanLimits(platformSub);
  // "owner" or "manager" — both get the CRM, but managers get a restricted Settings modal
  // (profile tab only) and can't touch billing/Stripe or delete company data.
  const [crmRole, setCrmRole] = useState<"owner" | "manager">("owner");
  // Last Supabase sync timestamp
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  // EGRESS — a client can't read its own Supabase project's usage-vs-quota
  // (that's a Management API metric behind a privileged token that must
  // never ship in browser code), but a project that's been paused/restricted
  // for being over quota makes every request fail the same way, repeatedly,
  // across totally unrelated tables. That IS something the client can see —
  // track consecutive full-cycle failures and warn once it looks systemic
  // rather than one flaky request.
  const syncFailureStreakRef = useRef(0);
  const [supabaseDegraded, setSupabaseDegraded] = useState(false);
  const [degradedWarningDismissed, setDegradedWarningDismissed] = useState(false);

  // ── OAuth processing guard ───────────────────────────────────────────────
  // Set to true when the page loads with an OAuth callback hash (#access_token=...).
  // Cleared only after onAuthStateChange fires SIGNED_IN, meaning Supabase has fully
  // processed the hash. While true, nothing renders so the hash-sync effect cannot
  // overwrite the token-laden hash before Supabase reads it.
  const [oauthProcessing, setOauthProcessing] = useState(false);
  useEffect(() => {
    if (window.location.hash.includes("access_token")) {
      setOauthProcessing(true);
    }
  }, []);

  // Mobile view override ("mobile" | "desktop" | null = auto-detect by screen
  // width). Auto-detection lives in useIsMobile (resize/orientation-aware);
  // this lets a user explicitly pin one layout regardless of screen size.
  const [mobileViewForced, setMobileViewForced] = useState<"mobile" | "desktop" | null>(null);
  const autoIsMobile = useIsMobile(768);
  const isMobile = mobileViewForced ? mobileViewForced === "mobile" : autoIsMobile;

  // Owner email/password login (mobile landing page)
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);
  const [ownerLoginError, setOwnerLoginError] = useState("");
  const [ownerLoginLoading, setOwnerLoginLoading] = useState(false);
  const [ownerLoginMode, setOwnerLoginMode] = useState<"login" | "register">("login");
  const [ownerCompanyName, setOwnerCompanyName] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");

  // FEATURE — "it should ask them to pay first, then create an account."
  // Populated only when the URL is Stripe's own redirect back from a real
  // Checkout payment (#/signup-complete?session_id=...). null = normal
  // login/register flow, unchanged. "verifying" briefly shows a spinner
  // while the session_id is confirmed against Stripe server-side (never
  // trust the query string alone — see verify_signup_session).
  const [pendingCheckoutSession, setPendingCheckoutSession] = useState<
    { status: "verifying" } | { status: "ready"; sessionId: string; plan: string; interval: string; email: string } | { status: "error"; message: string } | null
  >(null);
  useEffect(() => {
    const hash = window.location.hash.replace(/^#\/?/, "");
    if (!hash.startsWith("signup-complete")) return;
    const qs = new URLSearchParams(hash.split("?")[1] || "");
    const sessionId = qs.get("session_id");
    if (!sessionId) { setPendingCheckoutSession({ status: "error", message: "No payment session found — please start from the pricing page." }); return; }
    setPendingCheckoutSession({ status: "verifying" });
    setOwnerLoginMode("register");
    fetch("/api/platform-billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify_signup_session", sessionId }),
    })
      .then(r => r.json())
      .then((data: any) => {
        if (data.error) { setPendingCheckoutSession({ status: "error", message: data.error }); return; }
        setPendingCheckoutSession({ status: "ready", sessionId, plan: data.plan || "", interval: data.interval || "month", email: data.email || "" });
        if (data.email) setOwnerEmail(data.email);
      })
      .catch((e: any) => setPendingCheckoutSession({ status: "error", message: e?.message || "Couldn't verify payment — try refreshing." }));
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(() => {
    // Restore page from URL hash on first load. The employee portal owns sub-paths
    // under its own route (#/portal/calendar, #/portal/jobs, etc.) for its tabs —
    // any hash starting with "portal" still resolves to the "portal" page here;
    // EmployeePortal itself reads the sub-path to pick the initial tab.
    const hash = window.location.hash.replace(/^#\/?/, "").split("?")[0];
    if (hash === "portal" || hash.startsWith("portal/")) return "portal";
    if (hash === "referral" || hash.startsWith("r/")) return "referral";
    if (hash === "rate" || hash.startsWith("rate?")) return "rate";
    // FIX 18 — public, unauthenticated lead-intake form meant to be embedded
    // via iframe on the owner's own website (see LeadIntakePage.tsx's "Get
    // Embed Code"). No owner session/auth — see LeadFormPage.tsx for why it
    // deliberately never reads app_settings (secrets exposure).
    if (hash === "lead-form" || hash.startsWith("lead-form?")) return "lead-form";
    // FEATURE — public, unauthenticated job-application form (see
    // HiringPage.tsx's "Apply Link"). Same no-app_settings-read reasoning as
    // lead-form/trash-cans above.
    if (hash === "apply" || hash.startsWith("apply?")) return "apply";
    // FEATURE (round 13, items 16-18) — public, unauthenticated Trash Can
    // Cleaning signup form. Same reasoning as lead-form above (no app_settings
    // read — see TrashCanSignupPage.tsx).
    if (hash === "trash-cans" || hash.startsWith("trash-cans?")) return "trash-cans";
    // FEATURE — public, unauthenticated legal pages required as live HTTPS
    // links for Twilio A2P 10DLC campaign registration (see LeadFormPage.tsx's
    // SMS opt-in checkbox and LegalPages.tsx).
    if (hash === "terms" || hash.startsWith("terms?")) return "terms";
    if (hash === "privacy" || hash.startsWith("privacy?")) return "privacy";
    // FIX 17/20 — public, unauthenticated single-estimate view (sign/decline a
    // quote, or pay an invoice) reached via #/estimate/ID. This used to be
    // #/portal/ID, but "portal" is the EMPLOYEE portal's own route — it has no
    // idea an ID after it is an estimate, not a tab name, so every "Review &
    // Sign" / "View & Pay Invoice" link a customer received landed them on the
    // employee login screen instead. See the "estimate" page render below.
    if (hash.startsWith("estimate/")) return "estimate";
    // FIX 19 — Supabase's password-recovery redirect appends its own
    // access_token/refresh_token/type=recovery params onto whatever
    // redirectTo URL was given; since that URL is itself a hash route
    // (#/reset-password), there's no room for a second "#", so Supabase just
    // concatenates onto the existing fragment: #reset-password&access_token=
    // ...&type=recovery. An exact `valid.includes(hash)` check against the
    // bare word "reset-password" then fails (the actual hash has all that
    // extra text appended) and silently fell through to "dashboard" — which
    // is exactly why the reset page sometimes never even loaded. Prefix-match
    // it like "portal/" and "estimate/" above.
    if (hash === "reset-password" || hash.startsWith("reset-password&") || hash.startsWith("reset-password?")) return "reset-password";
    // FEATURE — "it should ask them to pay first, then create an account."
    // Stripe redirects back here (see startPaidSignup below) after a real
    // payment on the hosted Checkout page, carrying its own session_id —
    // the signup-complete screen (rendered from the "login" page render
    // path below, gated on pendingCheckoutSession) verifies that session
    // server-side before letting anyone create an account against it.
    if (hash === "signup-complete" || hash.startsWith("signup-complete?")) return "login";
    // FEATURE — public marketing/landing page for the product itself
    // (CrewBoss), shown at the bare root ("#" or "#/", i.e. no hash at all)
    // or "#/welcome"/"#/home". Previously an empty hash fell through to the
    // "dashboard" default below, which — for a visitor with no session —
    // just meant the login screen (see the "welcome" gate right before the
    // login-page render further down in this file). "#/login" is the new
    // explicit route to that same login screen, used by the landing page's
    // CTA buttons.
    if (hash === "" || hash === "welcome" || hash === "home") return "welcome";
    if (hash === "login") return "login";
    // FEATURE — dedicated marketing pages linked from the landing page's nav
    // (see MarketingShared.tsx's MarketingNav/MarketingFooter, shared across
    // #/welcome, #/features, #/pricing, #/about). Same public/no-session
    // rendering pattern as "welcome" below.
    if (hash === "features") return "features";
    if (hash === "pricing") return "pricing";
    if (hash === "about") return "about";
    const valid = ["dashboard","alfred","inbox","notifications","customers","estimates","invoices","pipeline","intake","jobs","calendar","crew","campaigns","reviews","automations","social","goals","referrals","promotions","trashcans","sops","expenses","reports","analytics","budget","personal","accountability","employees","hiring","fleet","chemicals","google","portal","reset-password","client","referral","rate","welcome","login","features","pricing","about","cockpit","feedback","roadmap"];
    return valid.includes(hash) ? hash : "dashboard";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // BUG FIX — the marketing pages (#/welcome, #/features, #/pricing,
  // #/about) were coded as PUBLIC-ONLY: their render condition itself
  // requires `!hasCrmSession`, not just the redirect guard further down.
  // So a logged-in owner could never see them AT ALL, in any tab — opening
  // one in a new tab didn't help either, since Supabase's session is
  // shared across tabs via localStorage, so hasCrmSession resolves true
  // there too and the same gate blocks it. This flag is an explicit,
  // intentional "let me preview the marketing site while still logged in"
  // override, set only by the logo/nav-preview click (never by a page
  // load or hash resolution) — so a plain reload or a fresh tab, which
  // both start this at false, still auto-redirects a logged-in owner
  // straight to the dashboard exactly as before. Reset the moment they
  // land on any real CRM page again (effect below), so it can't leak into
  // a later involuntary visit to "welcome" (e.g. browser back button).
  const [marketingPreview, setMarketingPreview] = useState(false);
  useEffect(() => {
    if (!["welcome", "features", "pricing", "about", "login"].includes(page)) setMarketingPreview(false);
  }, [page]);

  // FEATURE — "when Alfred does something, take me there and show me." Each
  // queued step is one CRM action Alfred just took: navigate to the page it
  // lives on, glow the specific row/card for a moment, then move to the next
  // step. When the queue drains, land back on the Alfred chat so its final
  // "I just did them" reply is the last thing the owner sees — replacing the
  // old behavior of navigating away after each action and just staying
  // wherever the last one happened to land, with the chat reply left unseen
  // behind it.
  interface AlfredSpotlightStep { page: string; type?: string; id?: string; label?: string }
  const [alfredSpotlightQueue, setAlfredSpotlightQueue] = useState<AlfredSpotlightStep[]>([]);
  const [alfredHighlight, setAlfredHighlight] = useState<{ type: string; id: string } | null>(null);
  const alfredSpotlightRunning = useRef(false);
  const queueAlfredSpotlight = useCallback((step: AlfredSpotlightStep) => {
    setAlfredSpotlightQueue(q => [...q, step]);
  }, []);
  useEffect(() => {
    if (alfredSpotlightRunning.current || alfredSpotlightQueue.length === 0) return;
    alfredSpotlightRunning.current = true;
    (async () => {
      const steps = alfredSpotlightQueue;
      setAlfredSpotlightQueue([]);
      for (const step of steps) {
        setPage(step.page);
        // Give the page a beat to mount before the glow kicks in, and to
        // let the previous step's glow visibly settle first.
        await new Promise(r => setTimeout(r, 500));
        if (step.type && step.id) setAlfredHighlight({ type: step.type, id: step.id });
        await new Promise(r => setTimeout(r, 1800));
        setAlfredHighlight(null);
      }
      await new Promise(r => setTimeout(r, 200));
      setPage("alfred");
      alfredSpotlightRunning.current = false;
    })();
  }, [alfredSpotlightQueue]);
  // "View" buttons in automated owner emails (invoice paid, new lead, etc.)
  // link to e.g. #/invoices?open=ID — reuses the exact same highlight/glow
  // mechanism Alfred's spotlight already drives, just seeded from the URL
  // instead of a chat action. Runs once on mount and again on every
  // hashchange so clicking a second email link while the CRM tab is already
  // open also jumps/glows, not just the very first load.
  useEffect(() => {
    const OPEN_TYPE_BY_PAGE: Record<string, string> = { invoices: "invoice", estimates: "estimate", jobs: "job", customers: "customer" };
    const applyOpenParam = () => {
      const raw = window.location.hash.replace(/^#\/?/, "");
      const [pagePart, queryPart] = raw.split("?");
      if (!queryPart) return;
      const openId = new URLSearchParams(queryPart).get("open");
      const type = OPEN_TYPE_BY_PAGE[pagePart];
      if (openId && type) setAlfredHighlight({ type, id: openId });
    };
    applyOpenParam();
    window.addEventListener("hashchange", applyOpenParam);
    return () => window.removeEventListener("hashchange", applyOpenParam);
  }, []);
  // Sidebar open/close is button-only now (Menu icon / X / nav item taps /
  // outside-click on the overlay) — edge-swipe open and swipe-to-close were
  // removed per explicit user feedback: the gesture felt unreliable on a
  // real phone and, worse, the swipe-to-close touch handlers lived on the
  // same <aside> element as the Sign Out button, so an ordinary tap on Sign
  // Out with the slightest finger drift was sometimes read as a close-drag
  // instead of a click, making sign-out feel flaky.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // FEATURE — an upgrade prompt's "View Plans" jumps straight to Settings →
  // Billing instead of the default Profile tab.
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(undefined);
  const openBillingUpgrade = () => { setSettingsInitialSection("billing"); setSettingsOpen(true); };
  // Stripe Connect OAuth redirect landing — functions/api/stripe-connect-oauth.ts
  // sends the browser back to `${origin}/#/settings?stripe_connected=1` (or
  // `?stripe_connect_error=...`) after the owner authorizes on Stripe's own
  // site. Since Settings is a modal (settingsOpen state), not a real route,
  // pick that query param up once on mount, pop the modal open, toast, and
  // strip the param so a refresh doesn't re-fire it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("stripe_connected");
    const err = params.get("stripe_connect_error");
    if (!connected && !err) return;
    setSettingsOpen(true);
    if (connected) toast("✓ Stripe connected", "green");
    else toast("Stripe Connect failed: " + err, "red");
    const url = new URL(window.location.href);
    url.searchParams.delete("stripe_connected");
    url.searchParams.delete("stripe_connect_error");
    window.history.replaceState({}, "", url.toString());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // FIX 8 — "Add Manager" in Settings jumps to Employees with the invite
  // modal pre-opened (role defaulted to Manager) instead of duplicating the
  // whole invite form inside Settings.
  const [autoOpenManagerInvite, setAutoOpenManagerInvite] = useState(false);
  // Clicking a clock-out/report-problem desktop notification jumps straight
  // to Employees → Hours instead of just opening the app on whatever page it
  // was last on.
  const [employeesInitialView, setEmployeesInitialView] = useState<"list" | "hours" | "payroll" | undefined>(undefined);
  const goToEmployeeHours = () => { setPage("employees"); setEmployeesInitialView("hours"); };
  const [notifOpen, setNotifOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  // ISSUE 21 — which page's "New" modal should auto-open on the next
  // render of that page, set by a FAB click and cleared by the page itself
  // once it has opened the modal (see CustomersPage/EstimatesPage/JobsPage's
  // own autoOpenNew effect + onAutoOpenNewConsumed callback).
  const [fabAutoOpenNew, setFabAutoOpenNew] = useState<string | null>(null);
  // LeadIntakePage's "Convert to Estimate" action — navigates to Estimates
  // and reuses the same one-shot autoOpenNew mechanism above, plus this
  // companion flag so EstimateBuilder opens pre-targeted at the lead's
  // customer record instead of defaulting to the first customer in the list.
  const [estimatePresetCustomerId, setEstimatePresetCustomerId] = useState<string | null>(null);
  // ITEM 18 — "New Customer" now opens as a true popup over whatever page
  // the owner is already on, instead of navigating to Customers first. Jobs
  // and Alfred still navigate (their "New"/chat UI isn't a standalone
  // component the way CustomerModal is — extracting one would be a much
  // larger, riskier refactor), but at least don't lose the owner's place for
  // the one FAB action that had an easy, safe path to a real popup.
  const [fabQuickCustomerOpen, setFabQuickCustomerOpen] = useState(false);
  const saveFabQuickCustomer = (d: any) => {
    const id = uid();
    const referralCode = (d.firstName?.slice(0, 3) || "REF").toUpperCase() + id.slice(-4).toUpperCase();
    const record = { ...d, id, totalSpent: 0, createdAt: today(), referralCode, owner_id: crmUserId };
    setCustomers((prev: any[]) => [...prev, record]);
    setFabQuickCustomerOpen(false);
    (supabase as any).from("customers").insert(record)
      .then((result: any) => { if (result?.error) toast("Saved locally, but failed to sync — " + result.error.message, "red"); else toast("Customer added ✓", "green"); })
      .catch((e: any) => toast("Saved locally, but failed to sync — " + (e?.message || "unknown error"), "red"));
  };
  // ISSUE (round 2) — the drag-to-dismiss zone used to flip
  // settings.fabEnabled to false, which is a PERSISTED setting (synced to
  // Supabase/localStorage) — so a drag-dismiss looked identical to the
  // owner going into Settings and turning the FAB off entirely, and it
  // stayed gone forever, including after a reload. A drag-dismiss should
  // only clear the FAB for the current session; plain (non-persisted)
  // React state resets on every reload by construction, which is exactly
  // "reappears on reload unless fully disabled in Settings".
  const [fabSessionHidden, setFabSessionHidden] = useState(false);
  // FEATURE 1 — mobile FAB drag-and-drop. Hold the button for 2s to enter drag
  // mode; pointermove repositions it (clamped to the viewport); releasing
  // saves the position via usePersistent (localStorage key smocks.fabPosition)
  // so it stays put across reloads. Pointer Events (not touch-only) so this
  // also works with a mouse on desktop.
  const [fabPosition, setFabPosition] = usePersistent<{ x: number; y: number } | null>("smocks.fabPosition", null);
  const [fabDragging, setFabDragging] = useState(false);
  const [fabHolding, setFabHolding] = useState(false);
  const fabHoldTimerRef = useRef<any>(null);
  const fabDragOffsetRef = useRef({ x: 0, y: 0 });
  const fabHoldStartRef = useRef({ x: 0, y: 0 });
  const fabWasDraggedRef = useRef(false);
  const FAB_HOLD_MS = 500;
  const FAB_SIZE = 56;
  // A real finger held "still" for 2s still drifts a few px — if we cancel the
  // hold on any pointerleave/boundary event (the original implementation),
  // that natural jitter fires pointerleave almost immediately on touch and the
  // timer never survives to 2s. Instead we only cancel on genuine release
  // (pointerup/pointercancel) or if the finger moves past a real tolerance.
  const FAB_MOVE_TOLERANCE = 12;
  // FIX 15 — window.innerHeight on mobile Safari/Chrome reflects the LAYOUT
  // viewport, which can be taller than what's actually visible/reachable by
  // a thumb once the address bar or bottom toolbar is showing (the visual
  // viewport). A touch drag's clientY is relative to the VISUAL viewport, so
  // comparing it against window.innerHeight's "bottom 20%" threshold could
  // require dragging past the bottom of the actually-visible screen — the
  // FAB would never reach the hide zone no matter how far down it's
  // dragged. window.visualViewport.height is the accurate reachable height.
  const getViewportHeight = () => window.visualViewport?.height ?? window.innerHeight;
  const fabOnPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    fabDragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    fabHoldStartRef.current = { x: e.clientX, y: e.clientY };
    fabWasDraggedRef.current = false;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported — safe to ignore */ }
    setFabHolding(true);
    clearTimeout(fabHoldTimerRef.current);
    fabHoldTimerRef.current = setTimeout(() => {
      fabWasDraggedRef.current = true;
      setFabDragging(true);
      setFabHolding(false);
    }, FAB_HOLD_MS);
  };
  const fabCancelHold = (reason: string) => {
    if (fabHoldTimerRef.current) {
      clearTimeout(fabHoldTimerRef.current);
      fabHoldTimerRef.current = null;
    }
    setFabHolding(false);
  };
  const fabReleasePointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  // While holding (before the 2s threshold), track movement so a genuine
  // drag/scroll attempt cancels the hold instead of silently doing nothing.
  useEffect(() => {
    if (!fabHolding) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - fabHoldStartRef.current.x;
      const dy = e.clientY - fabHoldStartRef.current.y;
      const dist = Math.hypot(dx, dy);
      if (dist > FAB_MOVE_TOLERANCE) {
        fabCancelHold("moved past tolerance");
      }
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [fabHolding]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!fabDragging) return;
    const lastPosRef = { current: { x: 0, y: 0 } };
    const onMove = (e: PointerEvent) => {
      const x = Math.max(4, Math.min(window.innerWidth - FAB_SIZE - 4, e.clientX - fabDragOffsetRef.current.x));
      const y = Math.max(4, Math.min(getViewportHeight() - FAB_SIZE - 4, e.clientY - fabDragOffsetRef.current.y));
      lastPosRef.current = { x, y };
      setFabPosition({ x, y });
    };
    const onUp = () => {
      setFabDragging(false);
      // ISSUE 20 — dropping in the bottom-middle "dismiss zone" (center
      // third of the screen width, bottom 15% of height) now actually
      // hides the FAB, instead of collapsing to a small restore dot —
      // reuses the existing settings.fabEnabled flag (same one Settings →
      // Quick Action FAB already toggles) so "bring it back" has one
      // obvious answer instead of a second hidden mechanism to remember.
      // Checked once on release (not every pointermove tick) so this fires
      // exactly once per drag instead of spamming the toast mid-drag.
      const { x, y } = lastPosRef.current;
      const centerX = x + FAB_SIZE / 2;
      const inDismissZoneX = centerX > window.innerWidth * 0.35 && centerX < window.innerWidth * 0.65;
      const inDismissZoneY = y + FAB_SIZE > getViewportHeight() * 0.85;
      if (inDismissZoneX && inDismissZoneY) {
        setFabPosition(null);
        setFabSessionHidden(true);
        toast?.("Quick actions hidden for this session — reload the page, or turn it off for good in Settings → Quick Action FAB", "yellow");
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [fabDragging]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync URL hash when page changes — skip if the hash carries tokens we still need
  useEffect(() => {
    if (window.location.hash.includes("access_token")) return;
    if (window.location.hash.includes("invite=")) return;
    if (window.location.hash.includes("type=recovery")) return;
    if (page === "estimate") return; // keep the #/estimate/ID the link carried — don't strip the id
    // BUG FIX — "lead intake form colors don't apply" (and, unreported but
    // same root cause, company name/phone also silently reverting to
    // defaults). This effect rewrote the hash to a bare "/lead-form" the
    // instant the page loaded, wiping every query param — oid/co/ph/bg/btn/
    // text — before the page's own hashParam() reads could matter on
    // re-render. Same bug applies to every other public link-based landing
    // page that carries its own query params: #/rate (c/n/g/rl/co),
    // #/trash-cans (co/ph/cost/min/freq/pk), #/apply (oid/co), #/referral
    // (ref). "estimate" above already got this exact fix; these were missed.
    if (["lead-form", "rate", "trash-cans", "apply", "referral"].includes(page)) return;
    window.location.hash = "/" + page;
  }, [page]);

  // Detect Supabase password-recovery hash and route to reset-password page
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    if (params.get("type") === "recovery") {
      setPage("reset-password");
    }
  }, []);

  // Direct social-platform OAuth callback (Facebook/TikTok "Connect"
  // in Settings → Integrations redirects here with ?code=...). Exchanges the
  // code for a token via the configured backend proxy, saves it to settings,
  // then sends the owner back to Social.
  useEffect(() => {
    if (!window.location.hash.startsWith("#/social-oauth-callback")) return;
    const hash = window.location.hash.split("?")[1] || "";
    const params = new URLSearchParams(hash);
    const code = params.get("code");
    const state = params.get("state");
    const expectedState = sessionStorage.getItem("smocks.socialOAuthState");
    const platform = sessionStorage.getItem("smocks.socialOAuthPlatform") as SocialPlatform | null;
    sessionStorage.removeItem("smocks.socialOAuthState");
    sessionStorage.removeItem("smocks.socialOAuthPlatform");
    if (!code || !platform || state !== expectedState) { setPage("social"); return; }
    (async () => {
      const tok = await exchangeSocialOAuthCode(settings.socialBackendUrl || "", platform, code);
      if (tok && "accessToken" in tok) {
        const tokenField = platform === "facebook" ? "metaAccessToken" : "tiktokAccessToken";
        setSettings(s => ({ ...s, [tokenField]: tok.accessToken }));
        toast(`${platform} connected ✓`, "green");
      } else {
        toast(`Could not connect ${platform} — ${(tok as any)?.error || "unknown error"}`, "red");
      }
      setPage("social");
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for browser back/forward
  useEffect(() => {
    const valid = ["dashboard","alfred","inbox","notifications","customers","estimates","invoices","pipeline","intake","jobs","calendar","crew","campaigns","reviews","automations","social","goals","referrals","promotions","trashcans","sops","expenses","reports","analytics","budget","personal","accountability","employees","hiring","fleet","chemicals","google","portal","reset-password","client","referral","rate","lead-form","trash-cans","apply","terms","privacy","welcome","login","features","pricing","about","cockpit","feedback","roadmap"];
    const handler = () => {
      const hash = window.location.hash.replace(/^#\/?/, "").split("?")[0];
      if (hash === "portal" || hash.startsWith("portal/")) { setPage("portal"); return; }
      if (hash === "referral" || hash.startsWith("r/")) { setPage("referral"); return; }
      if (hash === "rate" || hash.startsWith("rate?")) { setPage("rate"); return; }
      if (hash === "lead-form" || hash.startsWith("lead-form?")) { setPage("lead-form"); return; }
      if (hash === "apply" || hash.startsWith("apply?")) { setPage("apply"); return; }
      if (hash === "terms" || hash.startsWith("terms?")) { setPage("terms"); return; }
      if (hash === "privacy" || hash.startsWith("privacy?")) { setPage("privacy"); return; }
      if (hash.startsWith("estimate/")) { setPage("estimate"); return; }
      if (hash === "reset-password" || hash.startsWith("reset-password&") || hash.startsWith("reset-password?")) { setPage("reset-password"); return; }
      if (hash === "" || hash === "home") { setPage("welcome"); return; }
      if (valid.includes(hash)) setPage(hash);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  // ── Recently-deleted id tracking ──────────────────────────────────────────
  // BUG FIX — "I delete an invoice/job/customer and it comes back." Root
  // cause: refetchData()'s merge (below) is purely additive — it updates rows
  // it already knows about and adds any row present on the server that isn't
  // in local state yet, but it never removes a local row just because the
  // server no longer has it. That's deliberate for the common case (don't
  // wipe out an unsynced local row from a slow write), but it means any
  // refetchData() call whose SELECT was in flight BEFORE a delete lands and
  // resolves AFTER — very possible, since refetchData() fires on every
  // jobs/customers/estimates realtime event AND on a poll interval, so
  // multiple calls are routinely in flight at once — resurrects the row it
  // just fetched, because from that stale response's point of view the row
  // still exists. markRecentlyDeleted() lets every delete call site record
  // the id(s) it just removed so refetchData can filter them back out of any
  // stale in-flight response for a short window, instead of trusting
  // whichever fetch happens to resolve last.
  const recentlyDeletedRef = useRef<{ jobs: Map<string, number>; customers: Map<string, number>; estimates: Map<string, number>; chemicals: Map<string, number> }>({ jobs: new Map(), customers: new Map(), estimates: new Map(), chemicals: new Map() });
  const RECENTLY_DELETED_TTL_MS = 2 * 60 * 1000;
  // BUG FIX — invoices/customers STILL came back after delete despite the
  // guards above and the syncedEstimateIdsRef guard on the 30s autosave.
  // Root cause found: `estimates`/`customers` are `usePersistent` — seeded
  // straight from THIS BROWSER's localStorage on mount, before any server
  // fetch happens — and syncLocalToSupabase() (a separate, mount-only,
  // `[]`-deps effect below) immediately upserts that entire local snapshot
  // back to Supabase to give offline-created rows a head start. If this
  // browser/tab's localStorage still has a row that was deleted from ANOTHER
  // device (or an earlier session on this same device, closed before it
  // could re-sync), that one-time push resurrects it — and it does this on
  // EVERY reload, forever, since a stale localStorage copy never expires on
  // its own. None of the in-memory guards above survive a closed tab/reload.
  // Fix: persist deleted ids to localStorage too (a small tombstone list),
  // so a stale snapshot from days/weeks ago still gets filtered before that
  // very first push, not just within the current tab's session.
  const TOMBSTONE_MAX = 500;
  const persistTombstones = useCallback((table: "estimates" | "customers", ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const key = `smocks.deleted.${table}`;
      const existing: string[] = JSON.parse(localStorage.getItem(key) || "[]");
      const merged = Array.from(new Set([...existing, ...ids])).slice(-TOMBSTONE_MAX);
      localStorage.setItem(key, JSON.stringify(merged));
    } catch { /* localStorage unavailable — in-memory guards still apply */ }
  }, []);
  const readTombstones = (table: "estimates" | "customers"): Set<string> => {
    try { return new Set(JSON.parse(localStorage.getItem(`smocks.deleted.${table}`) || "[]")); }
    catch { return new Set(); }
  };
  const markRecentlyDeleted = useCallback((table: "jobs" | "customers" | "estimates" | "chemicals", ids: string[]) => {
    const m = recentlyDeletedRef.current[table];
    const now = Date.now();
    for (const [id, ts] of m) { if (now - ts > RECENTLY_DELETED_TTL_MS) m.delete(id); }
    ids.forEach(id => m.set(id, now));
    if (table === "estimates" || table === "customers") persistTombstones(table, ids);
  }, [persistTombstones]);
  // Undoing a delete restores the row — it must stop being treated as
  // "recently deleted" or the next refetch would just filter the restore
  // right back out for the rest of the TTL window.
  const unmarkRecentlyDeleted = useCallback((table: "jobs" | "customers" | "estimates" | "chemicals", ids: string[]) => {
    const m = recentlyDeletedRef.current[table];
    ids.forEach(id => m.delete(id));
  }, []);
  // BUG FIX — "delete an invoice, it comes back." Root cause: the 30s bulk
  // auto-save interval further below blindly re-upserts this ENTIRE
  // in-memory `estimates`/`customers` array to Supabase every cycle, with
  // zero awareness of deletes that happened on a DIFFERENT tab/device in
  // the meantime. A second open session (e.g. phone left open while also
  // using desktop) whose own copy hasn't caught up yet — background-tab
  // timer throttling routinely delays its regular poll — would still have
  // the "deleted" row in ITS `estimates` state, and its own 30s autosave
  // firing re-inserts that row right back into the database. The next
  // poll on the ORIGINAL tab then picks that resurrected row back up,
  // often well after the 2-minute recentlyDeleted TTL has already expired
  // (a real-world "check back later and it's back" gap). These refs track
  // which ids each tab has actually CONFIRMED exist server-side (populated
  // by refetchData below) so the autosave can tell "known to exist, safe
  // to re-save" apart from "never confirmed — could be a legit new local
  // row, or could be one this tab doesn't know was deleted elsewhere."
  const syncedEstimateIdsRef = useRef<Set<string>>(new Set());
  const syncedCustomerIdsRef = useRef<Set<string>>(new Set());

  const filterRecentlyDeleted = (table: "jobs" | "customers" | "estimates" | "chemicals", rows: any[]) => {
    const m = recentlyDeletedRef.current[table];
    if (m.size === 0) return rows;
    const now = Date.now();
    return rows.filter(r => {
      const ts = m.get(r.id);
      if (ts === undefined) return true;
      if (now - ts > RECENTLY_DELETED_TTL_MS) { m.delete(r.id); return true; }
      return false;
    });
  };

  // ── Undo / redo stacks ────────────────────────────────────────────────────
  // BUG FIX — pushUndo existed but nothing in the app ever called it (the
  // Undo button was permanently disabled), and Redo was a hardcoded-disabled
  // stub with no stack at all ("visual only — stack not yet wired"). Delete
  // actions across Jobs/Customers/Estimates/Invoices now call pushUndo with
  // both a restore function AND a redo function (re-running the original
  // delete), so undo/redo can round-trip in either direction.
  const undoStackRef = useRef<Array<{ desc: string; fn: () => void; redoFn?: () => void }>>([]);
  const redoStackRef = useRef<Array<{ desc: string; fn: () => void; redoFn?: () => void }>>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const pushUndo = (desc: string, fn: () => void, redoFn?: () => void) => {
    undoStackRef.current = [...undoStackRef.current.slice(-19), { desc, fn, redoFn }];
    setUndoCount(undoStackRef.current.length);
    // A fresh action invalidates whatever was previously redo-able.
    redoStackRef.current = [];
    setRedoCount(0);
  };
  const undo = () => {
    if (!undoStackRef.current.length) return;
    const last = undoStackRef.current.pop()!;
    setUndoCount(undoStackRef.current.length);
    last.fn();
    if (last.redoFn) {
      redoStackRef.current = [...redoStackRef.current, last];
      setRedoCount(redoStackRef.current.length);
    }
    toast("Undone: " + last.desc, "yellow");
  };
  const redo = () => {
    if (!redoStackRef.current.length) return;
    const last = redoStackRef.current.pop()!;
    setRedoCount(redoStackRef.current.length);
    last.redoFn!();
    undoStackRef.current = [...undoStackRef.current, last];
    setUndoCount(undoStackRef.current.length);
    toast("Redone: " + last.desc, "yellow");
  };

  // ── Toasts ────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = (msg: string, tone?: "green" | "red" | "yellow") => {
    const id = uid();
    setToasts(prev => [...prev.slice(-4), { id, msg, tone: tone ?? "green" }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  // ── Persistent state ─────────────────────────────────────────────────────
  const [customers,       setCustomers]       = usePersistent<Customer[]>("smocks.customers", seedCustomers);
  const [estimates,       setEstimates]       = usePersistent<Estimate[]>("smocks.estimates", seedEstimates);
  const [jobs,            setJobs]            = usePersistent<Job[]>("smocks.jobs", seedJobs);
  const [employees,       setEmployees]       = usePersistent<Employee[]>("smocks.employees", seedEmployees);
  // AUDIT ITEM 13 — lets the Dashboard show "updating…" instead of trusting
  // (or worse, blanking) the Live Team View when the most recent employees
  // fetch actually failed, rather than silently keeping stale cached data
  // with no visible signal that a refresh attempt just failed.
  const [crewFetchError, setCrewFetchError] = useState(false);
  const [vehicles,        setVehicles]        = usePersistent<Vehicle[]>("smocks.vehicles", seedVehicles);
  const [maintenance,     setMaintenance]     = usePersistent<MaintenanceRecord[]>("smocks.maintenance", seedMaintenance);
  const [expenses,        setExpenses]        = usePersistent<Expense[]>("smocks.expenses", seedExpenses);
  const [chemicals,       setChemicals]       = usePersistent<Chemical[]>("smocks.chemicals", seedChemicals);
  const [services,        setServices]        = usePersistent<Service[]>("smocks.services", seedServices);
  // FEATURE — "add more default services." seedServices only seeds a BRAND
  // NEW account (usePersistent's default only applies when localStorage is
  // still empty) — an existing owner's already-saved service list never
  // picks up newly added catalog entries on its own. One-time backfill:
  // append any seed service whose id isn't already present, so existing
  // owners see the expanded catalog too without duplicating anything they
  // already have (including ones they've since edited/renamed, since this
  // matches by id, not name).
  useEffect(() => {
    setServices((prev: Service[]) => {
      const existingIds = new Set((prev || []).map((s: any) => s.id));
      const missing = seedServices.filter(s => !existingIds.has(s.id));
      if (missing.length === 0) return prev;
      return [...(prev || []), ...missing];
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [campaigns,       setCampaigns]       = usePersistent<Campaign[]>("smocks.campaigns", []);
  const [automations,     setAutomations]     = usePersistent<Automation[]>("smocks.automations", seedAutomations);
  const [reviews,         setReviews]         = usePersistent<Review[]>("smocks.reviews", []);
  const [socialPosts,     setSocialPosts]     = usePersistent<SocialPost[]>("smocks.socialPosts", []);
  // BUG FIX — "the social section shows posts I never made, marked
  // published/scheduled with fake engagement numbers." This used to default
  // to seedSocialPosts (3 fake posts, ids sp1/sp2/sp3) instead of an empty
  // array — already fixed above, but any account that loaded this page
  // before that fix still has those exact fake rows sitting in its real,
  // persisted localStorage, indistinguishable from something the owner
  // actually posted. One-time strip by their known fixed ids, safe to run
  // on every load since a real post can never legitimately have one of
  // these exact ids.
  useEffect(() => {
    setSocialPosts((prev: SocialPost[]) => {
      const seedIds = new Set(["sp1", "sp2", "sp3"]);
      const filtered = (prev || []).filter((p: any) => !seedIds.has(p.id));
      return filtered.length === (prev || []).length ? prev : filtered;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [inboxThreads,    setInboxThreads]    = usePersistent<InboxThread[]>("smocks.inbox", []);
  const [accountability,  setAccountability]  = usePersistent<AccountabilityEntry[]>("smocks.accountability", []);
  const [goalsList,       setGoalsList]       = usePersistent<Goal[]>("smocks.goals", []);
  const [wins,            setWins]            = usePersistent<Win[]>("smocks.wins", []);
  const [negativeAlerts,  setNegativeAlerts]  = usePersistent<Review[]>("smocks.negativeAlerts", []);
  const [referrals,       setReferrals]       = usePersistent<typeof seedReferrals>("smocks.referrals", seedReferrals);
  const [promotions,      setPromotions]      = usePersistent<import("./types").Promotion[]>("smocks.promotions", []);
  const [emailTemplates,    setEmailTemplates]    = usePersistent("smocks.emailTpls", seedEmailTemplates);
  const [smsTemplates,      setSmsTemplates]      = usePersistent("smocks.smsTpls", seedSmsTemplates);
  const [estimateTemplates, setEstimateTemplates] = usePersistent<any[]>("smocks.estimateTpls", []);
  const [timeline,        setTimeline]        = usePersistent<Timeline>("smocks.timeline", seedTimeline as Timeline);
  const [settings,        setSettings]        = usePersistent<AppSettings>("smocks.settings", {
    companyName: "Crew Boss",
    companyPhone: "(717) 555-0100",
    ownerName: "Will Smock",
    monthlyRevenueGoal: 8000,
    monthlyJobsGoal: 20,
    taxRate: 6,
    defaultDepositPct: 25,
    brandColor: "#dc2626",
    brandAccent: "#991b1b",
    notifyReviews: true,
    notifyOverdue: true,
    notifyLowStock: true,
    notifyMaintenance: true,
    notifyWeather: true,
    reviewShowcaseMinRating: 5,
  });
  // FIX 14 — lets effects (e.g. the Alfred check-in interval below) read the
  // latest settings at fire-time without depending on `settings` directly,
  // which would otherwise reset their setInterval every time any setting
  // changes.
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  // AUDIT FIX ("I'm not seeing any [automations] for owners") — root cause:
  // the owner/employee/client report templates (seed.ts AUTOMATION_TEMPLATES
  // tpl_owner_*/tpl_employee_*/tpl_client_*) were only ever reachable through
  // Automations → Templates → pick one → Save in the workflow builder — a
  // manual 3-click path with zero indication anything new existed. Worse,
  // `smocks.automations` is a usePersistent/localStorage value (see the
  // `automations` init above) whose seed default (seedAutomations) only ever
  // applies the very first time that key has never been written — an
  // existing owner's browser already had an automations array saved from
  // before these templates were added, so they could never pick the new
  // seed entries up automatically, no matter how many templates got added to
  // the gallery. This one-time backfill (gated by
  // settings.automationsReportBackfillV2 so it never re-adds something the
  // owner deliberately deleted) adds any of the report/client templates an
  // existing owner doesn't already have as real, already-active Automation
  // rows — so "Owner: End-of-Day Summary" etc. show up in the Automations
  // list immediately instead of staying hidden in the template gallery.
  const reportBackfillRanRef = useRef(false);
  useEffect(() => {
    if (reportBackfillRanRef.current) return;
    reportBackfillRanRef.current = true;
    if ((settings as any).automationsReportBackfillV2) return;
    const REPORT_TEMPLATE_IDS = [
      "tpl_owner_eod_summary", "tpl_owner_periodic_summary", "tpl_owner_progress_report",
      "tpl_employee_shift_summary", "tpl_employee_performance_report",
      "tpl_client_post_service_followup", "tpl_client_referral_request",
      "tpl_client_appointment_reminder_2h", "tpl_client_reservice_45day", "tpl_client_early_winback_4mo",
      // Seasonal pre-booking nudges — real templates/engine categories
      // already existed (seasonal_spring/seasonal_fall in
      // useAutomationEngine.ts) but were never in this backfill list, so
      // they had the exact same "invisible unless manually clicked in the
      // template gallery" problem as the report templates above.
      "tpl_seasonal_spring", "tpl_seasonal_fall",
    ];
    setAutomations(prev => {
      const existingIds = new Set(prev.map((a: any) => a.id));
      const toAdd = (AUTOMATION_TEMPLATES as any[])
        .filter(t => REPORT_TEMPLATE_IDS.includes(t.id) && !existingIds.has(t.id))
        .map(automationFromTemplate);
      return toAdd.length ? [...prev, ...toAdd] : prev;
    });
    setSettings((s: any) => ({ ...s, automationsReportBackfillV2: true }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // FEATURE — text-Alfred's enable_review_request_automation tool has no
  // direct access to `automations` (usePersistent/localStorage, browser-only
  // — this server-side agent can't touch it), so it stages a flag on
  // app_settings instead. Applied here the next time the owner's browser is
  // open (polls settings, so within a few seconds even if already open) —
  // same bridge pattern as the report-template backfill above, just
  // triggered by a live flag instead of running once ever.
  useEffect(() => {
    if (!(settings as any).pendingEnableReviewRequestAutomation) return;
    setAutomations(prev => {
      if (prev.some((a: any) => a.id === "tpl_review_request" && a.active)) return prev;
      const existing = prev.find((a: any) => a.id === "tpl_review_request");
      if (existing) return prev.map((a: any) => a.id === "tpl_review_request" ? { ...a, active: true } : a);
      const tpl = (AUTOMATION_TEMPLATES as any[]).find(t => t.id === "tpl_review_request");
      return tpl ? [...prev, automationFromTemplate(tpl)] : prev;
    });
    setSettings((s: any) => ({ ...s, pendingEnableReviewRequestAutomation: false }));
    toast?.("📮 Turned on automatic review requests after job completion ✓", "green");
  }, [(settings as any).pendingEnableReviewRequestAutomation]); // eslint-disable-line react-hooks/exhaustive-deps
  // ISSUE 14 (round 11) — ROOT CAUSE of "all Alfred check-in messages look
  // the same": the check-in effect further down is deliberately keyed only
  // on [crmUserId] (see its own comment) so its hourly setInterval survives
  // unrelated re-renders — but its tryCheckin() closure read `jobs`,
  // `estimates`, `goalsList`, and `weatherData` directly from component
  // scope, not via a ref. A closure created once (when the effect first ran,
  // near login) keeps referencing whatever those variables equalled AT THAT
  // MOMENT for its entire lifetime — every hourly firing for the rest of the
  // session used that same frozen snapshot, so the job counts/weather/
  // revenue never changed between check-ins even though the real data did.
  // Mirrors the settingsRef pattern above for the same reason.
  const jobsRef = useRef(jobs);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);
  const estimatesRef = useRef(estimates);
  useEffect(() => { estimatesRef.current = estimates; }, [estimates]);
  const goalsListRef = useRef(goalsList);
  useEffect(() => { goalsListRef.current = goalsList; }, [goalsList]);

  // ISSUE 13 (round 2) — "owner Google token keeps disconnecting". The
  // employee side (EmployeePortal.tsx) has always had a proactive 5-minute
  // refresh interval calling the same-origin /api/google-refresh Cloudflare
  // Function; the owner side had NO equivalent — its only refresh path was
  // the TOKEN_REFRESHED branch above, which only fires when SUPABASE'S OWN
  // background session-refresh cycle happens to also come back with a fresh
  // Google provider_token attached, which is not guaranteed to happen (or
  // happen often enough) — so the owner's Google access token, which Google
  // only issues for ~1hr, was largely left to just expire. Mirrors the
  // employee interval exactly: proactively refresh a few minutes before
  // expiry using the stored googleRefreshToken, so a real usage attempt
  // essentially never lands on an expired token.
  useEffect(() => {
    if (!hasCrmSession) return;
    const tryRefresh = async () => {
      const s = settingsRef.current as any;
      if (!s?.googleRefreshToken) return;
      const expiresAt = Number(s.googleTokenExpiresAt) || 0;
      if (expiresAt - Date.now() > 5 * 60 * 1000) return; // not close to expiring yet
      const refreshed = await refreshEmpGoogleToken(s.googleBackendUrl, s.googleRefreshToken);
      if (!refreshed || !refreshed.token) {
        if (refreshed?.configMissing) console.warn("[GoogleConnect] owner token refresh not configured — set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET in the Cloudflare Pages dashboard");
        return;
      }
      console.log("[GoogleConnect] owner token proactively refreshed ✓");
      setSettings((prev: any) => ({ ...prev, googleProviderToken: refreshed.token, googleTokenExpiresAt: refreshed.expiresAt }));
    };
    tryRefresh();
    const interval = setInterval(tryRefresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [hasCrmSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cross-device settings sync (BUG 9) ──────────────────────────────────────
  // Settings (API keys, model prefs, integrations, branding) live in
  // localStorage via usePersistent, which is per-device — so keys saved on a
  // laptop never appeared on a phone. Mirror the whole settings blob into a
  // Supabase `app_settings` table keyed by the owner's user id: load it on
  // mount (server wins over this device's stale copy) and upsert on change
  // (debounced). Fails silently if the table doesn't exist yet.
  const settingsSyncLoadedRef = useRef(false);
  const settingsSaveTimerRef = useRef<any>(null);
  // FIX 6 (mobile round 5) — seeded by the load effect below so the very
  // next save-effect run (triggered by this same load's setSettings call)
  // sees content identical to what the server already has and skips the
  // network round-trip entirely, instead of immediately re-uploading the
  // exact blob it just downloaded.
  const lastSyncedJsonRef = useRef<string | null>(null);
  useEffect(() => {
    if (!crmUserId || settingsSyncLoadedRef.current) return;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("app_settings").select("data").eq("owner_id", crmUserId).maybeSingle();
        if (error) {
          // FIX 6 (mobile round 3) — this used to fail silently (no log at
          // all) if the table didn't exist or RLS blocked the read.
          console.warn("[Settings Sync] error:", error.message);
        } else if (data?.data && typeof data.data === "object") {
          // Merge server settings over local — server is the source of truth
          // for cross-device fields, but keep any local-only keys not present
          // on the server so nothing is lost.
          setSettings((prev: any) => {
            const merged = { ...prev, ...data.data };
            // GoogleConnect — this is the load that runs the instant crmUserId
            // is seeded (from a LOCALSTORAGE CACHE, so it can fire before any
            // async session/OAuth work resolves). If the owner just connected
            // Google, applyGoogleIdentity may have already written a fresh
            // provider_token into local state — but the row this SELECT just
            // fetched is whatever was last PUSHED to the server, which is
            // debounced and can easily still be the pre-connection blob. A
            // blind `{...prev, ...data.data}` would silently regress a brand
            // new connection back to disconnected. Never let a stale/absent
            // server value erase an existing local token — only the
            // Disconnect button should ever clear it.
            if (prev.googleProviderToken && !data.data.googleProviderToken) {
              console.log("[GoogleConnect] server settings sync (initial load) had no provider_token — preserving existing local Google connection instead of clearing it");
              merged.googleConnected = prev.googleConnected;
              merged.googleProviderToken = prev.googleProviderToken;
              merged.googleRefreshToken = prev.googleRefreshToken;
              merged.googleTokenExpiresAt = prev.googleTokenExpiresAt;
              merged.googleEmail = prev.googleEmail;
            }
            lastSyncedJsonRef.current = JSON.stringify(merged);
            console.log("[Verify] settings sync across devices — working — loaded", Object.keys(data.data).length, "field(s) from server");
            if (data.data.twilioSid || data.data.googleProviderToken || data.data.stripeSecretKey || data.data.anthropicKey) {
              console.log("[Verify] API keys sync across devices — working");
            }
            return merged;
          });
        }
      } catch (e: any) { console.warn("[Settings Sync] error:", e?.message); }
      settingsSyncLoadedRef.current = true;
    })();
  }, [crmUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX 17/20 — public customer pages (#/estimate/ID, #/client) have no
  // crmUserId (the visitor was never the owner), so the load above never
  // runs and the customer sees an unbranded portal with no Stripe key —
  // payment/company-name would be blank. This is a single-tenant app (one
  // business per deployment), so grab whichever single app_settings row
  // exists, no owner_id filter needed.
  // AUDIT — this same gap applies to the EMPLOYEE portal (#/portal), and it's
  // far more consequential there: crmUserId is only ever set when the OWNER
  // has authenticated on THIS device (see setCrmUserId call sites — the
  // employee-role branch of onAuthStateChange returns immediately without
  // ever setting it). A technician's own phone almost never has an owner
  // session on it, so `settings` was silently stuck on this device's empty
  // localStorage defaults for the entire life of that session — no Twilio
  // SID/token, no Google connection, no company name. That's not a "some
  // logging would help" bug, it's the actual reason OTW/Running Late/Send
  // Invoice-from-portal (all gated on settings.twilioSid /
  // settings.googleConnected) failed with "not configured" for every real
  // employee on their own device, no matter how correct the send logic
  // itself was. Portal now uses the exact same no-owner-id fallback as the
  // public estimate/client pages.
  useEffect(() => {
    if (crmUserId || (page !== "estimate" && page !== "client" && page !== "portal") || settingsSyncLoadedRef.current) return;
    (async () => {
      try {
        const { data, error } = await (supabase as any).from("app_settings").select("data").limit(1).maybeSingle();
        if (!error && data?.data && typeof data.data === "object") {
          setSettings((prev: any) => ({ ...prev, ...data.data }));
        }
      } catch { /* app_settings table may not exist yet */ }
      settingsSyncLoadedRef.current = true;
    })();
  }, [page, crmUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const settingsLastSavedAtRef = useRef<string | null>(null);
  // FIX 6 (mobile round 5) — "canceling statement due to statement timeout":
  // this always upserted the ENTIRE settings blob, every time ANY field
  // changed, even if the actual change was tiny and even if the blob hadn't
  // meaningfully changed since the last successful sync (e.g. the load-effect
  // merging server data back into local state re-triggers this effect too).
  // A large field (a base64 logoUrl is the obvious candidate — easily
  // hundreds of KB) sent on every debounce tick is a plausible cause of a
  // slow-enough write to hit Postgres's statement_timeout. lastSyncedJsonRef
  // (declared above, seeded by the load effect) lets a no-op change
  // (content-identical to what's already confirmed synced) skip the network
  // call entirely.
  // Drop any oversized top-level field for the retry attempt — a giant
  // logoUrl or similar shouldn't block the rest of the settings (API keys,
  // toggles, branding colors) from reaching the server.
  // ISSUE 14 — settings sync was timing out on real deployments. Root cause
  // was two-fold: the 8s timeout was too tight for the full settings blob
  // (templates, integration tokens, branding colors, etc. all live in one
  // JSONB object) on anything but a fast connection, and MAX_FIELD_CHARS
  // only dropped individual oversized fields (e.g. one giant base64 logoUrl)
  // — it did nothing for a blob that's merely large in aggregate across many
  // small-ish fields. Tightened the per-field threshold so the retry pass
  // actually sheds enough weight, and gave both attempts more time.
  const MAX_FIELD_CHARS = 8000;
  const shrinkSettingsPayload = (obj: any): { payload: any; dropped: string[] } => {
    const dropped: string[] = [];
    const payload: any = {};
    for (const k of Object.keys(obj || {})) {
      const v = (obj as any)[k];
      if (typeof v === "string" && v.length > MAX_FIELD_CHARS) { dropped.push(k); continue; }
      payload[k] = v;
    }
    return { payload, dropped };
  };
  const saveSettingsToSupabase = async (payload: any, updatedAt: string, timeoutMs: number) => {
    return withTimeout(
      (supabase as any).from("app_settings").upsert({ owner_id: crmUserId, data: payload, updated_at: updatedAt }, { onConflict: "owner_id" }),
      timeoutMs,
      "Settings sync save"
    );
  };
  useEffect(() => {
    // Only start saving after the initial load has run, so we never overwrite
    // the server copy with this device's pre-load defaults.
    if (!crmUserId || !settingsSyncLoadedRef.current) return;
    clearTimeout(settingsSaveTimerRef.current);
    settingsSaveTimerRef.current = setTimeout(() => {
      const json = JSON.stringify(settings);
      if (json === lastSyncedJsonRef.current) return; // nothing actually changed
      const updatedAt = new Date().toISOString();
      (async () => {
        try {
          const r: any = await saveSettingsToSupabase(settings, updatedAt, 20000);
          if (!r?.error) {
            settingsLastSavedAtRef.current = updatedAt;
            lastSyncedJsonRef.current = json;
            return;
          }
          throw new Error(r.error.message);
        } catch (firstErr: any) {
          // FIX 6 — retry once with a smaller payload before giving up.
          const { payload, dropped } = shrinkSettingsPayload(settings);
          if (dropped.length === 0) {
            // Nothing to shrink — a second identical attempt wouldn't help.
            // ITEM 6 (mobile audit) — a plain "timed out"/network-ish error
            // used to read like an app bug with no next step. A repeated
            // timeout on a simple upsert is the same signature the
            // supabaseDegraded banner above is built to detect (paused
            // project / usage quota) — point the owner at the same place.
            const isSchemaErr = /relation .* does not exist/i.test(firstErr?.message || "") || /on conflict/i.test(firstErr?.message || "");
            const isTimeout = /timed out/i.test(firstErr?.message || "");
            const sizeKb = Math.round(json.length / 1024);
            // BUG FIX — this used to always suggest "check your Supabase
            // project isn't paused or over its usage quota" even on a plain
            // timeout, which is misleading when usage is actually fine (the
            // far more common cause of a slow settings save is just the size
            // of the payload — this blob holds every template/logo/photo in
            // one JSONB object — or a slow connection, neither of which is a
            // quota problem). Only suggest the quota/paused explanation for
            // errors that actually look account-related; a timeout gets a
            // size-aware hint instead.
            // BUG FIX — a small payload (nothing to shrink) used to give up
            // after exactly ONE attempt and immediately notify, even though
            // a 20s timeout on a 3KB upsert is very plausibly just a
            // transient network blip that a plain retry would clear on its
            // own. Try once more, unmodified, with a longer timeout, before
            // actually telling the owner anything failed.
            if (isTimeout) {
              try {
                const retryUpdatedAt = new Date().toISOString();
                const rPlain: any = await saveSettingsToSupabase(settings, retryUpdatedAt, 30000);
                if (!rPlain?.error) {
                  settingsLastSavedAtRef.current = retryUpdatedAt;
                  lastSyncedJsonRef.current = json;
                  console.warn("[Settings Sync] plain retry succeeded after initial timeout — no notification needed");
                  return;
                }
              } catch { /* fall through to the notification below */ }
            }
            const hint = isSchemaErr
              ? " — run supabase/migrations/0011_owner_settings_and_alfred_schema_fixes.sql in the Supabase SQL editor"
              : isTimeout
              ? ` — settings payload is ${sizeKb}KB; a slow/unstable connection or a large embedded image (logo, template photo) is the most likely cause, not your Supabase account. Will retry automatically on the next change.`
              : " — if this keeps happening, check your Supabase project isn't paused or over its usage quota (Supabase dashboard → Usage)";
            console.warn("[Settings Sync] error:", firstErr?.message + hint, `(payload ${sizeKb}KB)`);
            toast("Settings saved to this device but not to the server — " + (firstErr?.message || "check connection") + hint, "red");
            pushSettingsSyncNotification("Settings didn't sync to the server" + hint);
            return;
          }
          try {
            const retryUpdatedAt = new Date().toISOString();
            const r2: any = await saveSettingsToSupabase(payload, retryUpdatedAt, 20000);
            if (!r2?.error) {
              settingsLastSavedAtRef.current = retryUpdatedAt;
              // Only the shrunk payload is confirmed synced — leave
              // lastSyncedJsonRef unset so the full object (with the
              // oversized field) is retried again on the next real change.
              console.warn("[Settings Sync] saved with", dropped.join(", "), "dropped (too large) — retry succeeded");
              return;
            }
            throw new Error(r2.error.message);
          } catch (secondErr: any) {
            const isTimeout2 = /timed out/i.test(secondErr?.message || "");
            console.warn("[Settings Sync] error (both attempts failed):", secondErr?.message);
            const hint2 = isTimeout2 ? " — likely a slow/unstable connection, not your Supabase account. Will retry on the next change." : " — if this keeps happening, check your Supabase project isn't paused or over its usage quota (Supabase dashboard → Usage)";
            toast("Settings saved to this device but not to the server — " + (secondErr?.message || "check connection") + hint2, "red");
            pushSettingsSyncNotification("Settings didn't sync to the server" + hint2);
          }
        }
      })();
    }, 1500);
    return () => clearTimeout(settingsSaveTimerRef.current);
  }, [settings, crmUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX 9 — settings (which Goals, dashboard widgets, and every integration
  // key read from) only ever loaded ONCE per session — a goal or API key
  // changed on the phone never appeared on the computer's already-open tab
  // until it was manually reloaded. Poll like jobs/employees/estimates do,
  // and skip applying the server copy if its updated_at matches the last
  // write THIS device made (avoids clobbering a not-yet-debounced local edit
  // with what is, from the server's point of view, stale-by-a-second data).
  // EGRESS FIX — shared with the jobs/customers/estimates/employees poll
  // below; declared here (its first use) so every poll interval in this
  // component agrees on one "should we even fetch right now" answer instead
  // of drifting. onVisible refreshes cross-device data the moment the tab
  // becomes visible again rather than waiting out a full interval.
  const shouldPollCrossDevice = usePollGate(() => { refetchData(); refetchEmployees(); });
  useEffect(() => {
    if (!crmUserId) return;
    const pollSettings = async () => {
      if (!shouldPollCrossDevice()) return;
      try {
        const { data, error } = await (supabase as any).from("app_settings").select("data, updated_at").eq("owner_id", crmUserId).maybeSingle();
        if (error || !data?.data) return;
        if (data.updated_at && data.updated_at === settingsLastSavedAtRef.current) return;
        setSettings((prev: any) => {
          const merged = { ...prev, ...data.data };
          // GoogleConnect — same rule as the initial load effect above: this
          // 10s poll must never regress an existing local Google connection
          // just because the debounced save to the server hasn't landed yet.
          if (prev.googleProviderToken && !data.data.googleProviderToken) {
            console.log("[GoogleConnect] server settings poll had no provider_token — preserving existing local Google connection instead of clearing it");
            merged.googleConnected = prev.googleConnected;
            merged.googleProviderToken = prev.googleProviderToken;
            merged.googleRefreshToken = prev.googleRefreshToken;
            merged.googleTokenExpiresAt = prev.googleTokenExpiresAt;
            merged.googleEmail = prev.googleEmail;
          }
          return merged;
        });
      } catch { /* app_settings table may not exist yet */ }
    };
    // EGRESS FIX — app_settings.data is a single JSONB blob that can carry a
    // multi-MB inline base64 company logo (SettingsModal.tsx's logo upload
    // has no compression step, unlike job photos). Re-fetching the WHOLE
    // blob every 10s per open tab, regardless of whether anything changed,
    // made this a bigger egress driver than the entire jobs table (622KB
    // vs. this table's several MB) — confirmed via SELECT * FROM
    // storage... table-size check during a live egress investigation.
    // Realtime isn't wired up for this table, so this poll IS the only
    // sync mechanism — can't remove it, but this now uses the same
    // owner-configurable interval (Settings → default 120s) as every other
    // fallback poll, instead of a hardcoded 60s.
    const interval = setInterval(pollSettings, getPollIntervalMs(settings));
    return () => clearInterval(interval);
  }, [crmUserId, (settings as any)?.pollIntervalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX 5 — ensure the owner has a real row in `employees` so they can be
  // assigned to jobs, clock in/out, and show up in Live Crew View exactly like
  // any technician. Keyed by the same synthetic id JobDetailModal's crew
  // toggle already uses (`owner_<email>`) so existing crew-assignment code
  // and this row refer to the same employee. Runs once per session, after
  // the owner's Supabase session is known.
  // FIX 5 (round 2) — this used to ALSO require settings.ownerName to
  // already be set before it would even attempt anything. That field is
  // only ever populated by the email/password registration form (see
  // handleOwnerLogin below) — Google OAuth sign-in never sets it. So any
  // owner who signed in with Google and never separately opened Settings →
  // Company to type their name in had this whole effect permanently no-op,
  // and their crew profile silently never existed — exactly "owner
  // disappeared from crew/Live Crew/Employees" with no error anywhere.
  // Fall back to deriving a name from the email instead of requiring one.
  const ownerEmpRowEnsuredRef = useRef(false);
  useEffect(() => {
    // BUG FIX — this preferred settings.googleEmail over crmUserEmail, but
    // googleEmail is "whichever Google account is currently connected for
    // Calendar/Gmail" (Settings → Integrations), which can be reconnected
    // to a DIFFERENT account independently of login identity at any time —
    // it is NOT a stable owner identity. Reconnecting Google under a
    // different email regenerated a brand-new owner_<email> id and created
    // a second "William Knight" row in Employees, verified live: two owner
    // rows under the same real owner_id, one from original login
    // (smockspressurewash@...), one from a later Google reconnect
    // (drummerforger@...). crmUserEmail (the actual Supabase Auth session
    // that logged into the CRM) is what's stable — check it first.
    const ownerEmail = crmUserEmail || settings.googleEmail;
    if (!crmUserId || !ownerEmail || ownerEmpRowEnsuredRef.current) return;
    ownerEmpRowEnsuredRef.current = true;
    // Belt-and-suspenders — even with a stable email preferred above, guard
    // on "does ANY owner row already exist for this tenant" (not just an
    // exact id match) so this can never create a second one for any other
    // reason either.
    if (employees.some(e => e.role === "owner" && (e as any).owner_id === crmUserId)) return;
    const ownerId = `owner_${ownerEmail}`;
    if (employees.some(e => e.id === ownerId)) return;
    const rawName = settings.ownerName?.trim() || ownerEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    const firstName = rawName.split(" ")[0] || "Owner";
    const lastName = rawName.split(" ").slice(1).join(" ") || "";
    const ownerEmpRow: any = {
      id: ownerId, firstName, lastName, role: "owner", status: "active", email: ownerEmail, hourlyRate: 0, owner_id: crmUserId,
    };
    setEmployees(prev => prev.some(e => e.id === ownerId) ? prev : [...prev, ownerEmpRow as Employee]);
    (supabase as any).from("employees").upsert(ownerEmpRow, { onConflict: "id" })
      .then((r: any) => {
        if (r?.error) {
          // FIX 1 (mobile round 3) — "Could not find the 'firstName' column"
          // means the base employees table only has snake_case columns
          // (first_name etc.) — run supabase/migrations/0011_owner_settings_
          // and_alfred_schema_fixes.sql, which adds the camelCase columns
          // this app's code (everywhere, not just here) actually reads/writes.
          // FIX 1 (mobile round 4) — a NOT NULL constraint on the legacy
          // first_name/last_name/hourly_rate columns can still reject this
          // camelCase-only upsert even after 0011 — run
          // supabase/migrations/0012_employees_legacy_not_null_fix.sql too.
          const hint = /column.*schema cache/i.test(r.error.message)
            ? " — run supabase/migrations/0011_owner_settings_and_alfred_schema_fixes.sql in the Supabase SQL editor"
            : /not-null constraint/i.test(r.error.message)
            ? " — run supabase/migrations/0012_employees_legacy_not_null_fix.sql in the Supabase SQL editor"
            : "";
          console.warn("[OwnerSelfServe] employees upsert failed:", r.error.message + hint);
          // FIX 5 — this row is what lets the owner appear in crew dropdowns,
          // Live Team View/Crew View, and clock in/out at all; a silent
          // failure here means all of that quietly never works.
          toast("Couldn't set up your crew profile — " + r.error.message + hint, "red");
        } else {
        }
      })
      .catch((e: any) => {
        console.warn("[OwnerSelfServe] employees upsert threw:", e?.message);
        toast("Couldn't set up your crew profile — " + (e?.message || "unknown error"), "red");
      });
  }, [crmUserId, crmUserEmail, settings.ownerName, settings.googleEmail, employees]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Owner notifications on client invoice activity (BUG 15 / FEATURE 5) ──────
  // The client portal writes `clientViewedAt` / `paidAt` / `paymentFailedAt`
  // onto the estimate row in Supabase; the owner's 3s poll pulls those in. Diff
  // each poll against the previous snapshot and surface a toast + bell entry the
  // moment a client opens, pays, or fails to pay an invoice.
  const invoiceActivityRef = useRef<Record<string, { viewed?: string; paid?: string; failed?: string; refunded?: string; disputed?: string; status?: string }>>({});
  const invoiceActivitySeededRef = useRef(false);
  // FEATURE — notification center (audit round). This used to be a plain
  // useState capped at 20 entries — anything older just silently fell off
  // the end, there was no dedicated page (only the bell dropdown), no way to
  // delete a single one, no read/unread tracking, and nothing persisted
  // across a reload. Now backed by usePersistent (localStorage) with a much
  // higher cap, a `read` flag, and enough routing info (`page`) for a click
  // to actually take the owner somewhere relevant. NotificationsPage.tsx is
  // the dedicated scrollable/filterable/sortable view; the bell dropdown
  // becomes a short "recent + unread" preview of the same store.
  const [notifications, setNotifications] = usePersistent<AppNotification[]>("smocks.notifications", []);
  const NOTIFICATIONS_CAP = 300;
  // Settings-sync failures previously only fired a toast, which disappears
  // and is easy to miss — the Notifications tab is where the owner would
  // expect to find it later. Throttled to once per 30 minutes (was 5 — a
  // genuinely flaky connection still hit that every few minutes and read as
  // "I keep getting this notification" even though the underlying save now
  // also gets a real second attempt before this fires at all, see the plain
  // retry added above) so a bad connection doesn't nag repeatedly in one
  // sitting.
  const lastSettingsSyncNotifAtRef = useRef(0);
  const pushSettingsSyncNotification = (text: string) => {
    const now = Date.now();
    if (now - lastSettingsSyncNotifAtRef.current < 30 * 60 * 1000) return;
    lastSettingsSyncNotifAtRef.current = now;
    setNotifications((prev: AppNotification[]) => [{ id: uid(), text, at: now, read: false, category: "system" as const, page: "dashboard" }, ...prev].slice(0, NOTIFICATIONS_CAP));
  };
  const deleteNotification = (id: string) => setNotifications((prev: AppNotification[]) => prev.filter(n => n.id !== id));
  const clearAllNotifications = () => setNotifications([]);
  const markAllNotificationsRead = () => setNotifications((prev: AppNotification[]) => prev.map(n => ({ ...n, read: true })));
  const markNotificationRead = (id: string) => setNotifications((prev: AppNotification[]) => prev.map(n => n.id === id ? { ...n, read: true } : n));
  useEffect(() => {
    if (!hasCrmSession) return;
    const snapshot: Record<string, { viewed?: string; paid?: string; failed?: string; refunded?: string; disputed?: string; status?: string }> = {};
    const newEvents: { id: string; text: string; at: number; customerId?: string }[] = [];
    for (const e of estimates as any[]) {
      const cur = { viewed: e.clientViewedAt, paid: e.paidAt, failed: e.paymentFailedAt, refunded: e.refundedAt, disputed: e.disputedAt, status: e.status };
      snapshot[e.id] = cur;
      if (!invoiceActivitySeededRef.current) continue; // don't fire on first load
      const prev = invoiceActivityRef.current[e.id] || {};
      const custName = (() => { const c = customers.find(x => x.id === e.customerId); return c ? `${c.firstName} ${c.lastName}` : "A customer"; })();
      // ISSUE 11 (round 11) — "opened invoice" was hardcoded regardless of
      // whether this estimate row is actually invoiced yet (invoiced: true)
      // — a fresh, un-invoiced quote being viewed said "invoice" too. Only
      // the paid/failed events are inherently invoice-only (you can't pay or
      // fail to pay something that was never invoiced); "viewed" needs the
      // same invoiced-aware wording ClientPortal.tsx now uses.
      //
      // AUDIT (round 12) — refunded/disputed are new: functions/api/
      // stripe-webhook.ts now writes refundedAt/disputedAt for charge.refunded
      // and charge.dispute.created events (previously unhandled entirely —
      // neither was visible to the owner at all before this).
      if (cur.disputed && cur.disputed !== prev.disputed) newEvents.push({ id: e.id + ":disputed", text: `🚨 DISPUTE opened by ${custName} on ${fmt(e.total)} — respond in your Stripe dashboard`, at: Date.now(), customerId: e.customerId });
      else if (cur.refunded && cur.refunded !== prev.refunded) newEvents.push({ id: e.id + ":refunded", text: `↩️ ${fmt(e.total)} refunded to ${custName}`, at: Date.now(), customerId: e.customerId });
      else if (cur.paid && !prev.paid) newEvents.push({ id: e.id + ":paid", text: `💰 ${custName} paid invoice ${fmt(e.total)}`, at: Date.now(), customerId: e.customerId });
      else if (cur.failed && cur.failed !== prev.failed) newEvents.push({ id: e.id + ":failed", text: `⚠️ ${custName}'s payment failed on ${fmt(e.total)}`, at: Date.now(), customerId: e.customerId });
      else if (cur.viewed && !prev.viewed) newEvents.push({ id: e.id + ":viewed", text: `👀 ${custName} opened ${(e as any).invoiced ? "invoice" : "estimate"} ${fmt(e.total)}`, at: Date.now(), customerId: e.customerId });
      else if (cur.status === "rejected" && prev.status !== "rejected") newEvents.push({ id: e.id + ":rejected", text: `❌ ${custName} declined estimate ${fmt(e.total)}`, at: Date.now(), customerId: e.customerId });
      // FIX 17 — accepting a quote previously only fired the toast the CLIENT's
      // own browser showed itself (worthless to the owner, a different
      // session entirely) — nothing told the owner a quote was accepted.
      else if (cur.status === "approved" && prev.status !== "approved" && !(e as any).invoiced) newEvents.push({ id: e.id + ":approved", text: `✅ ${custName} accepted the quote for ${fmt(e.total)}`, at: Date.now(), customerId: e.customerId });
    }
    invoiceActivityRef.current = snapshot;
    if (!invoiceActivitySeededRef.current) { invoiceActivitySeededRef.current = true; return; }
    if (newEvents.length) {
      newEvents.forEach(ev => toast(ev.text, (ev.text.startsWith("⚠️") || ev.text.startsWith("❌")) ? "red" : "green"));
      setNotifications((prev: AppNotification[]) => [...newEvents.map(ev => ({ ...ev, read: false, category: "invoice" as const, page: "invoices" })), ...prev].slice(0, NOTIFICATIONS_CAP));
      // FEATURE — "customer detail Timeline tab: ensure all events are
      // logged and viewable." Timeline was entirely manual (only the
      // owner's own typed notes) — every real invoice/estimate lifecycle
      // event detected above now also lands on that customer's Timeline,
      // reusing the exact same diff this effect already computes rather
      // than adding a second, possibly-inconsistent tracking mechanism.
      setTimeline((prev: Record<string, any[]>) => {
        const next = { ...prev };
        newEvents.forEach(ev => {
          if (!ev.customerId) return;
          next[ev.customerId] = [...(next[ev.customerId] || []), { id: uid(), type: "estimate", date: today(), note: ev.text, author: "System" }];
        });
        return next;
      });
      // Email the owner too — a bell/toast only reaches them if the CRM tab is
      // open; accepted-quote and declined-quote are important enough to also
      // land in their inbox.
      const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
      if (ownerEmail) {
        // Every owner-facing automated email gets a "View in CRM" button that
        // deep-links straight to the record (#/PAGE?open=ID — picked up by
        // the effect above, which glows the row via the same mechanism
        // Alfred's spotlight uses) instead of leaving the owner to go dig it
        // up themselves. Matches the CTA-button treatment employee emails
        // (job assignment, tomorrow's jobs, daily briefing) already get.
        const linkTo = (page: string, id: string) => `${window.location.origin}${window.location.pathname}#/${page}?open=${encodeURIComponent(id)}`;
        newEvents.filter(ev => ev.id.endsWith(":approved") || ev.id.endsWith(":rejected")).forEach(ev => {
          const estId = ev.id.split(":")[0];
          const html = emailShell(settings as any, "Quote Update", `<p>${ev.text}</p>` + emailButton("View Estimate", linkTo("estimates", estId)));
          sendEmail(settings as any, { to: ownerEmail, subject: "Quote update — " + ((settings as any)?.companyName || "Crew Boss"), body: html }).catch(() => {});
        });
        // ISSUE 11 (round 11) — getting paid was the one invoice event that
        // DIDN'T email the owner (only approved/rejected quotes did) despite
        // being the most important one to not miss if their CRM tab isn't
        // open. Branded (emailShell) + routed through the owner's own
        // connected Gmail, matching every other in-app automated send.
        newEvents.filter(ev => ev.id.endsWith(":paid")).forEach(ev => {
          const estId = ev.id.split(":")[0];
          const html = emailShell(settings as any, "Invoice Paid", `<p>${ev.text.replace("💰 ", "")}</p>` + emailButton("View Invoice", linkTo("invoices", estId)));
          sendOwnerGmailOnly(settings as any, ownerEmail, "💰 Invoice paid — " + ((settings as any)?.companyName || "Crew Boss"), html).catch(() => {});
        });
        // AUDIT (round 12) — refunds and disputes are the two highest-stakes
        // payment events (real money leaving the account, or a chargeback
        // clock running) and previously had no owner email at all — a bell/
        // toast only reaches someone with the CRM tab open.
        newEvents.filter(ev => ev.id.endsWith(":refunded")).forEach(ev => {
          const estId = ev.id.split(":")[0];
          const html = emailShell(settings as any, "Invoice Refunded", `<p>${ev.text.replace("↩️ ", "")}</p>` + emailButton("View Invoice", linkTo("invoices", estId)));
          sendOwnerGmailOnly(settings as any, ownerEmail, "↩️ Invoice refunded — " + ((settings as any)?.companyName || "Crew Boss"), html).catch(() => {});
        });
        newEvents.filter(ev => ev.id.endsWith(":disputed")).forEach(ev => {
          const estId = ev.id.split(":")[0];
          const html = emailShell(settings as any, "Payment Dispute", `<p>${ev.text.replace("🚨 ", "")}</p><p>Disputes have a short response window — check your Stripe dashboard for evidence submission.</p>` + emailButton("View Invoice", linkTo("invoices", estId)));
          sendOwnerGmailOnly(settings as any, ownerEmail, "🚨 Payment dispute opened — " + ((settings as any)?.companyName || "Crew Boss"), html).catch(() => {});
        });
      }
    }
  }, [estimates, hasCrmSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Growth goal tracking — near-goal reminders + hit celebration ─────────────
  // FEATURE — owner asked for Alfred to nudge them as they close in on a
  // Growth goal and congratulate them when they hit it, plus an email on
  // completion. Mirrors the invoice-activity diff effect above: recompute
  // progress from the same computeGoalProgress() GoalsPage.tsx uses (so the
  // two never disagree on whether a goal is actually hit), fire each event
  // at most once per goal via remindedAt/celebratedAt stamped onto the goal
  // itself, and only after the first pass (avoid replaying history / firing
  // for every already-completed goal the moment the app loads).
  const goalTrackingSeededRef = useRef(false);
  useEffect(() => {
    if (!hasCrmSession || !crmUserId) return;
    if (!goalTrackingSeededRef.current) { goalTrackingSeededRef.current = true; return; }
    const active = (goalsList || []).filter((g: any) => !g.done);
    if (active.length === 0) return;
    const toRemind: any[] = [];
    const toCelebrate: any[] = [];
    active.forEach((g: any) => {
      const { pct } = computeGoalProgress(g, { jobs, customers });
      if (pct >= 100) { toCelebrate.push(g); return; }
      if (pct >= 90 && !g.remindedAt) toRemind.push({ ...g, pct });
    });
    if (toRemind.length === 0 && toCelebrate.length === 0) return;
    setGoalsList((prev: any[]) => prev.map((g: any) => {
      const remind = toRemind.find(r => r.id === g.id);
      const celebrate = toCelebrate.find(c => c.id === g.id);
      if (celebrate) return { ...g, done: true, completedAt: today(), metByDeadline: g.deadline ? today() <= g.deadline : true, celebratedAt: g.celebratedAt || today() };
      if (remind) return { ...g, remindedAt: today() };
      return g;
    }));
    toRemind.forEach((g: any) => {
      const msg = `You're at ${g.pct}% of your goal "${g.text}" — almost there! 🔥`;
      toast?.(`🤖 ${msg}`, "yellow");
      fetch("/api/alfred-notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Alfred Notifications", message: msg, ownerId: crmUserId }),
      }).catch((e: any) => console.warn("[GoalTracking] near-goal alfred-notify threw:", e?.message));
    });
    toCelebrate.forEach((g: any) => {
      const msg = `🎉 Goal hit! You reached "${g.text}"${g.hasReward || g.rewardAmount || g.rewardDescription ? ` — reward unlocked: ${g.rewardDescription || (g.rewardAmount ? "$" + g.rewardAmount : "")}` : ""}. Nice work!`;
      toast?.(msg, "green");
      fetch("/api/alfred-notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Alfred Notifications", message: msg, ownerId: crmUserId }),
      }).catch((e: any) => console.warn("[GoalTracking] goal-hit alfred-notify threw:", e?.message));
      const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail || crmUserEmail;
      if (ownerEmail) {
        const html = emailShell(settings as any, "Goal Reached! 🎉", `<p>${msg}</p>` + emailButton("View Goals", `${window.location.origin}${window.location.pathname}#/goals`));
        sendEmail(settings as any, { to: ownerEmail, subject: "🎉 Goal reached — " + ((settings as any)?.companyName || "Crew Boss"), body: html }).catch((e: any) => console.warn("[GoalTracking] goal-hit email threw:", e?.message));
      }
    });
  }, [jobs, customers, goalsList, hasCrmSession, crmUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Owner notifications on crew activity (FEATURE 7) ─────────────────────────
  // Diff the 3s employees/jobs poll to detect clock in/out (dayClockInAt),
  // job completion (status), and arrival ("I'm Here" → arrivedAt). Fires a
  // toast + bell entry the moment it happens, mirroring the invoice-activity
  // diff above. Seeded on first pass so a fresh load doesn't replay history.
  const crewActivityEmpRef = useRef<Record<string, number | null>>({});
  const crewActivityJobRef = useRef<Record<string, { status?: string; arrivedAt?: number; photoCount?: number; signed?: boolean; issueCount?: number }>>({});
  const crewActivitySeededRef = useRef(false);
  useEffect(() => {
    if (!hasCrmSession) return;
    const empSnap: Record<string, number | null> = {};
    const jobSnap: Record<string, { status?: string; arrivedAt?: number }> = {};
    const events: { id: string; text: string; at: number; customerId?: string }[] = [];
    const empName = (e: any) => `${e.firstName || ""} ${e.lastName || ""}`.trim() || "An employee";
    for (const e of employees as any[]) {
      const cur = e.dayClockInAt ?? null;
      empSnap[e.id] = cur;
      if (!crewActivitySeededRef.current) continue;
      const prev = crewActivityEmpRef.current[e.id] ?? null;
      // BUG FIX — "native push notifications aren't showing or working."
      // notifyDesktop only ever fires the plain browser Notification API,
      // which needs a tab actually open — the real Web Push pipeline
      // (lib/push.ts/functions/api/send-push.ts) was fully built and
      // subscribing correctly (confirmed real rows in push_subscriptions)
      // but was never actually CALLED from any of these events — the one
      // real notification-worthy trigger in the whole app was job
      // assignment (JobDetailModal.tsx). Every one of these already-built
      // in-app/desktop notifications now also fires a real push, which
      // reaches an installed/closed app, not just an open tab.
      if (cur && !prev) { const text = `🟢 ${empName(e)} started their shift`; events.push({ id: e.id + ":in:" + cur, text, at: Date.now() }); notifyDesktop(text, undefined, goToEmployeeHours); if (crmUserId) sendPushNotification({ ownerId: crmUserId, title: "Shift started", body: text, tag: "crew-activity" }); }
      else if (!cur && prev) { const text = `⏹ ${empName(e)} ended their shift`; events.push({ id: e.id + ":out:" + Date.now(), text, at: Date.now() }); notifyDesktop(text, undefined, goToEmployeeHours); if (crmUserId) sendPushNotification({ ownerId: crmUserId, title: "Shift ended", body: text, tag: "crew-activity" }); }
    }
    for (const j of jobs as any[]) {
      // FEATURE 4 (mobile round 7) — photo uploads and customer sign-off were
      // never diffed here at all, so the owner never got a toast/bell entry
      // for either, despite CLAUDE.md documenting this as an existing
      // feature. totalJobPhotoCount aggregates top-level + checklist photos
      // (see BLOCKER 12) so a checklist-camera upload counts too.
      const photoCount = totalJobPhotoCount(j);
      const signed = !!j.signOff;
      // ITEM 10 — "Report Problem" (EmployeePortal.tsx's sendReportProblem)
      // already emails the owner directly, but had no in-app bell/toast or
      // desktop alert at all — an owner away from their inbox could miss it
      // entirely. It logs as a commLog note starting with "🚨 ISSUE
      // REPORTED", so count those the same way photoCount is counted above
      // and diff it below.
      const issueCount = (j.commLog || []).filter((c: any) => typeof c.note === "string" && c.note.startsWith("🚨 ISSUE REPORTED")).length;
      const cur = { status: j.status, arrivedAt: j.arrivedAt, photoCount, signed, issueCount };
      jobSnap[j.id] = cur;
      if (!crewActivitySeededRef.current) continue;
      const prev = crewActivityJobRef.current[j.id] || {};
      const cust = customers.find(x => x.id === j.customerId);
      const who = cust ? `${cust.firstName} ${cust.lastName}` : j.address;
      if (cur.status === "completed" && prev.status && prev.status !== "completed") events.push({ id: j.id + ":done", text: `✅ Job completed — ${who}`, at: Date.now(), customerId: j.customerId });
      if (cur.arrivedAt && !prev.arrivedAt) {
        // FEATURE — arrival is tracked once per JOB (not per crew member),
        // so when a crew of several is assigned, one person tapping "I'm
        // Here" correctly reflects the whole crew arriving together — but
        // the notification used to say only "Crew arrived," never who, and
        // never whether that was on-time or late against the scheduled time.
        const crewNames = (Array.isArray(j.crew) ? j.crew : [])
          .map((empId: string) => employees.find((e: any) => e.id === empId))
          .filter(Boolean)
          .map((e: any) => e.firstName || "Crew member");
        const crewLabel = crewNames.length > 0 ? crewNames.join(" and ") : "Crew";
        let timingLabel = "";
        if (j.scheduledDate && j.scheduledTime) {
          const scheduledMs = new Date(`${j.scheduledDate}T${j.scheduledTime}:00`).getTime();
          if (!Number.isNaN(scheduledMs)) {
            const diffMin = Math.round((cur.arrivedAt - scheduledMs) / 60000);
            // BUG FIX — "if I'm an hour and a minute late, it should show an
            // hour and a minute late," not a raw "61m late." Format past 60
            // minutes as hours + minutes instead of one long minute count.
            const fmtLateness = (mins: number) => {
              const h = Math.floor(mins / 60), m = mins % 60;
              if (h <= 0) return `${m}m`;
              return m > 0 ? `${h}h ${m}m` : `${h}h`;
            };
            timingLabel = diffMin > 10 ? ` (${fmtLateness(diffMin)} late)` : diffMin < -5 ? " (early)" : " (on time)";
          }
        }
        const text = `📍 ${crewLabel} arrived at ${who}${timingLabel}`;
        events.push({ id: j.id + ":arrived", text, at: Date.now(), customerId: j.customerId });
        notifyDesktop(text);
        if (crmUserId) sendPushNotification({ ownerId: crmUserId, title: "Crew arrived", body: text, tag: "crew-activity" });
      }
      if (photoCount > (prev.photoCount ?? 0)) events.push({ id: j.id + ":photos:" + photoCount, text: `📸 ${photoCount - (prev.photoCount ?? 0)} new photo${photoCount - (prev.photoCount ?? 0) !== 1 ? "s" : ""} — ${who}`, at: Date.now(), customerId: j.customerId });
      if (signed && !prev.signed) events.push({ id: j.id + ":signed", text: `✍️ Got customer sign-off — ${who}`, at: Date.now(), customerId: j.customerId });
      if (issueCount > (prev.issueCount ?? 0)) {
        const latestNote = [...(j.commLog || [])].reverse().find((c: any) => typeof c.note === "string" && c.note.startsWith("🚨 ISSUE REPORTED"));
        const text = `🚨 Problem reported — ${who}`;
        events.push({ id: j.id + ":issue:" + issueCount, text, at: Date.now(), customerId: j.customerId });
        // Desktop alert is the closest thing to "push" this single-page app can
        // do without a server (see notifyDesktop's own comment) — also fired
        // for shift start/end and arrival above, but this one gets the actual
        // issue text as the notification body since it's the highest-priority
        // event of the bunch.
        notifyDesktop(text, latestNote?.note?.replace("🚨 ISSUE REPORTED by ", "") || undefined, goToEmployeeHours);
        if (crmUserId) sendPushNotification({ ownerId: crmUserId, title: "🚨 Problem reported", body: latestNote?.note?.replace("🚨 ISSUE REPORTED by ", "") || text, tag: "crew-issue" });
      }
    }
    crewActivityEmpRef.current = empSnap;
    crewActivityJobRef.current = jobSnap;
    if (!crewActivitySeededRef.current) { crewActivitySeededRef.current = true; return; }
    if (events.length) {
      events.forEach(ev => toast(ev.text, ev.text.startsWith("🚨") ? "red" : undefined));
      setNotifications((prev: AppNotification[]) => [...events.map(ev => ({ ...ev, read: false, category: (ev.text.startsWith("🚨") ? "issue" : "crew") as "issue" | "crew", page: "employees" })), ...prev].slice(0, NOTIFICATIONS_CAP));
      // FEATURE — same Timeline auto-logging as the invoice-activity effect
      // above, for the job-side events (completed/arrived/photos/signed/
      // issue) this effect already detects.
      setTimeline((prev: Record<string, any[]>) => {
        const next = { ...prev };
        events.forEach(ev => {
          if (!ev.customerId) return;
          next[ev.customerId] = [...(next[ev.customerId] || []), { id: uid(), type: "job", date: today(), note: ev.text, author: "System" }];
        });
        return next;
      });
    }
  }, [employees, jobs, hasCrmSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Owner notifications — trash-can inconvenience fee needs collecting ───────
  // (round 15) EmployeePortal.tsx's cans-not-out action now auto-charges the
  // customer's saved card when one's on file, and flags
  // inconvenienceFeePendingConfirmation instead of silently doing nothing when
  // there's no card / the charge fails. Same diff-the-poll pattern as the
  // crew-activity effect above — fires once when the flag flips true, so the
  // owner sees a bell/toast pointing them at TrashCanPage.tsx's "Charge Now" /
  // "Add to Next Invoice" banner instead of that fee just getting lost.
  const trashFeePendingRef = useRef<Record<string, boolean>>({});
  const trashFeePendingSeededRef = useRef(false);
  useEffect(() => {
    if (!hasCrmSession) return;
    const snap: Record<string, boolean> = {};
    const events: { id: string; text: string; at: number }[] = [];
    for (const j of jobs as any[]) {
      if (j.serviceCategory !== "trash_can") continue;
      const cur = !!j.inconvenienceFeePendingConfirmation;
      snap[j.id] = cur;
      if (!trashFeePendingSeededRef.current) continue;
      const prev = trashFeePendingRef.current[j.id] ?? false;
      if (cur && !prev) {
        const cust = customers.find(x => x.id === j.customerId);
        const who = cust ? `${cust.firstName} ${cust.lastName}` : j.address;
        events.push({ id: j.id + ":trashfee:" + Date.now(), text: `🗑 Inconvenience fee needs collecting — ${who}`, at: Date.now() });
      }
    }
    trashFeePendingRef.current = snap;
    if (!trashFeePendingSeededRef.current) { trashFeePendingSeededRef.current = true; return; }
    if (events.length) {
      events.forEach(ev => toast(ev.text, "yellow"));
      setNotifications((prev: AppNotification[]) => [...events.map(ev => ({ ...ev, read: false, category: "trash_can" as const, page: "trashcans" })), ...prev].slice(0, NOTIFICATIONS_CAP));
    }
  }, [jobs, hasCrmSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // FEATURE — photo/video auto-deletion (owner opt-in, Settings → Data;
  // settings.mediaRetentionDays is 0/undefined by default, meaning this is a
  // no-op for everyone unless the owner explicitly turns it on). Runs once
  // per session once real jobs are loaded, same "harmless if nothing
  // qualifies" pattern as Alfred's 7-day conversation cleanup.
  const mediaRetentionSweepDoneRef = useRef(false);
  useEffect(() => {
    if (!hasCrmSession || mediaRetentionSweepDoneRef.current) return;
    const days = Number((settings as any)?.mediaRetentionDays) || 0;
    if (days <= 0 || jobs.length === 0) return;
    mediaRetentionSweepDoneRef.current = true;
    purgeOldJobMedia(jobs, days, setJobs)
      .then(({ jobsPurged, filesDeleted }) => {
        if (jobsPurged > 0) toast(`Deleted media from ${jobsPurged} job(s) older than ${days} days (${filesDeleted} file(s))`, "yellow");
      })
      .catch((e: any) => console.warn("[MediaRetention] sweep failed:", e?.message));
  }, [hasCrmSession, jobs, (settings as any)?.mediaRetentionDays]); // eslint-disable-line react-hooks/exhaustive-deps

  // Alfred
  const [alfredConversations, setAlfredConversations] = usePersistent<AlfredConversation[]>("smocks.alfredConvs", []);
  const [activeConvId, setActiveConvId]               = usePersistent<string>("smocks.alfredActiveConv", "");
  const [alfredMemory, setAlfredMemory]               = usePersistent("smocks.alfredMemory", []);
  const [personality, setPersonality]                 = usePersistent("smocks.alfredPersonality", "drillsergeant");
  // BUG FIX — this was only ever localStorage, never part of `settings`
  // (the one object that actually syncs to Supabase app_settings.data), so
  // text-Alfred (server-side — no access to this browser's localStorage at
  // all) could never know which personality the owner picked, and it never
  // carried across devices either. Mirror it into settings on change so the
  // synced blob always has the current value without touching every one of
  // AlfredPage.tsx's existing references to the standalone personality prop.
  useEffect(() => {
    if ((settings as any).alfredPersonality !== personality) {
      setSettings((s: any) => ({ ...s, alfredPersonality: personality }));
    }
  }, [personality]); // eslint-disable-line react-hooks/exhaustive-deps
  const [modelStatus, setModelStatus]                 = usePersistent<ModelStatus>("smocks.modelStatus", {});
  const [googleData, setGoogleData]                   = usePersistent("smocks.googleData", {});

  // FIX 10 / FIX 2 (mobile round) — Alfred conversations sync with Supabase.
  // This used to live here, keyed off crmUserId, and ran for the whole app
  // session regardless of whether Alfred was even open. Moved into
  // AlfredPage.tsx itself (keyed off its own mount + ownerId prop) so: (a)
  // the fetch is actually triggered by AlfredPage mounting, matching what the
  // user asked for and making it easy to verify via the console the moment
  // the page opens, and (b) the 5s poll only runs while Alfred is actually
  // open, instead of forever in the background (egress win, same spirit as
  // the polling fixes elsewhere). alfredConversations/setAlfredConversations
  // stay here since usePersistent needs to own the localStorage-backed state.

  // FIX 14 — the general proactive check-in system (originally FIX 7) lived
  // entirely inside AlfredPage.tsx, gated on `[ownerId]` — but AlfredPage
  // itself only ever mounts when `page === "alfred"` (see the routing switch
  // below). A "proactive" check-in that can only fire while the owner is
  // ALREADY looking at Alfred never actually initiates anything — it's
  // structurally impossible for it to have fired unprompted. Moved the
  // trigger here (App.tsx is mounted for the whole session regardless of
  // page) so it can genuinely check in on its own; AlfredPage.tsx still owns
  // the conversation list's Supabase sync (that stays gated on Alfred being
  // open, on purpose, for the egress reason above) — a conversation created
  // here while Alfred isn't open is picked up and pushed to Supabase the
  // next time AlfredPage mounts (its own sync effect preserves any local
  // conversation not yet known server-side). A toast fires alongside it so
  // the owner notices even without opening the Alfred tab.
  useEffect(() => {
    if (!crmUserId) return;
    // ROUND 5 REWRITE — two separate complaints, one root cause. (1) "creates
    // a new chat every time" — every fire pushed a brand-new conversation via
    // setAlfredConversations, so a session left open all day (up to 3 fires)
    // left 3 separate throwaway chats titled "Check-in — <time>", exactly
    // like the estimate-viewed notifications did before that got routed
    // through a single persistent thread (functions/api/alfred-notify.ts).
    // (2) "chat is empty" — hasSomethingToSay (removed below) required an
    // open goal, a 5+ day stale estimate, an overdue invoice, or an
    // incomplete job to even fire; on a day with none of those, tryCheckin
    // returned before building any message, and the ONLY thing distinguishing
    // "nothing fired" from "fired but rendered blank" from outside the
    // console was silence either way. Now always sends real content (job
    // counts, weather, today's revenue) so there's always something to say,
    // and posts to the same persistent "Alfred Notifications" thread the
    // estimate-viewed flow already uses — one thread, always non-empty.
    const tryCheckin = () => {
      const todayStr = today();
      const checkinDate = (settingsRef.current as any)?.alfredCheckinDate;
      const countToday = checkinDate === todayStr ? ((settingsRef.current as any)?.alfredCheckinsToday || 0) : 0;
      if (countToday >= 3) { console.log("[AlfredCheckin] skipped — already hit 3 check-ins today"); return; }
      const lastAt = (settingsRef.current as any)?.alfredLastCheckinAt || 0;
      const hoursSinceLast = lastAt ? (Date.now() - lastAt) / 3600000 : Infinity;
      if (hoursSinceLast < 3) { console.log("[AlfredCheckin] skipped —", hoursSinceLast.toFixed(1), "h since last, waiting for 3h gap"); return; }
      const hour = new Date().getHours();
      if (hour < 8 || hour > 20) { console.log("[AlfredCheckin] skipped — outside 8am-8pm window"); return; }

      // VACATION MODE — a check-in during an active vacation window should
      // respect the owner's own stated preference (set via Alfred's
      // set_vacation_mode tool) instead of firing at the normal cadence
      // regardless of "how often do you want me to message you."
      const vac = (settingsRef.current as any)?.vacationMode;
      if (vac?.active && todayStr >= vac.startDate && todayStr <= vac.endDate) {
        if (vac.checkInFrequency === "none" || vac.checkInFrequency === "urgent_only") {
          console.log("[AlfredCheckin] skipped — vacation mode, checkInFrequency:", vac.checkInFrequency);
          return;
        }
        if (vac.checkInFrequency === "every_few_days") {
          const daysSinceLast = lastAt ? (Date.now() - lastAt) / 86400000 : Infinity;
          if (daysSinceLast < 3) { console.log("[AlfredCheckin] skipped — vacation mode, every_few_days gap not met"); return; }
        }
        if (countToday >= 1) { console.log("[AlfredCheckin] skipped — vacation mode, already checked in today"); return; }
      }

      const todaysJobs = jobsRef.current.filter(j => j.scheduledDate === todayStr);
      const scheduledCount = todaysJobs.filter(j => j.status === "scheduled").length;
      const inProgressCount = todaysJobs.filter(j => j.status === "in_progress").length;
      const completedCount = todaysJobs.filter(j => j.status === "completed").length;
      const revenueToday = todaysJobs.filter(j => j.status === "completed").reduce((s, j) => s + (Number(j.amount) || 0), 0);
      const openGoals = (goalsListRef.current || []).filter((g: any) => !g.completed && !g.achieved);
      const staleEstimates = estimatesRef.current.filter(e => e.status === "pending" && daysSince(e.createdAt) >= 5);
      const pendingQuotes = estimatesRef.current.filter(e => e.status === "pending");
      const overdueInvoices = estimatesRef.current.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 7);
      const weatherLine = weatherDataRef.current?.current ? Math.round(weatherDataRef.current.current.temp) + "°F, " + weatherDataRef.current.current.description : null;

      const lines = [
        "👋 Checking in — " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ".",
        "",
        "📅 Today: " + scheduledCount + " scheduled, " + inProgressCount + " in progress, " + completedCount + " completed.",
        weatherLine ? "🌤️ Weather: " + weatherLine + "." : "",
        revenueToday > 0 ? "💰 " + fmt(revenueToday) + " collected today so far." : "",
        overdueInvoices.length > 0 ? "💸 " + overdueInvoices.length + " overdue invoice" + (overdueInvoices.length !== 1 ? "s" : "") + " to collect on." : "",
        pendingQuotes.length > 0 ? "📋 " + pendingQuotes.length + " pending quote" + (pendingQuotes.length !== 1 ? "s" : "") + (staleEstimates.length > 0 ? " (" + staleEstimates.length + " stale — follow up)" : "") + "." : "",
        openGoals.length > 0 ? "🎯 " + openGoals.length + " personal goal" + (openGoals.length !== 1 ? "s" : "") + " still open." : "",
      ].filter(Boolean);
      const msg = lines.join("\n");
      console.log("[AlfredCheckin] firing check-in", countToday + 1, "of 3 for", todayStr);
      fetch("/api/alfred-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Alfred Notifications", message: msg, ownerId: crmUserId }),
      })
        .then(r => { if (!r.ok) console.warn("[AlfredCheckin] alfred-notify failed:", r.status); })
        .catch((e: any) => console.warn("[AlfredCheckin] alfred-notify threw:", e?.message));
      setSettings?.((prev: any) => ({ ...prev, alfredCheckinDate: todayStr, alfredCheckinsToday: countToday + 1, alfredLastCheckinAt: Date.now() }));
      toast?.("🤖 Alfred checked in — see Alfred Notifications", "green");
    };
    const t = setTimeout(tryCheckin, 1500);
    const interval = setInterval(tryCheckin, 60 * 60 * 1000);
    return () => { clearTimeout(t); clearInterval(interval); };
    // Deliberately keyed only on crmUserId, not jobs/estimates/goalsList/
    // settings/weatherData — tryCheckin reads ALL of those from refs
    // (settingsRef/jobsRef/estimatesRef/goalsListRef/weatherDataRef) at
    // fire-time now, specifically so it never needs to re-subscribe this
    // effect (and therefore reset the hourly interval) on every unrelated
    // data change, while still seeing live data instead of a snapshot frozen
    // at whatever those variables equalled when the effect first ran.
  }, [crmUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // AUDIT FIX — same relocation as the general check-in effect above, for the
  // exact same reason: this used to live entirely inside AlfredPage.tsx,
  // gated on the page being open, which meant a "morning briefing between
  // 6-11am" only ever fired if the owner happened to have Alfred open during
  // that window — not actually proactive. Moved here so it fires regardless
  // of which page is open, matching the check-in effect's own already-fixed
  // pattern.
  useEffect(() => {
    if (!crmUserId) return;
    const tryBriefing = () => {
      const todayStr = today();
      const lastDate = (settingsRef.current as any)?.alfredBriefingDate;
      if (lastDate === todayStr) return;
      const hour = new Date().getHours();
      if (hour < 6 || hour > 11) return;
      const todayJobs = jobs.filter(j => j.scheduledDate === todayStr && j.status === "scheduled");
      const overdueInv = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 14);
      const pendingEst = estimates.filter(e => e.status === "pending");
      const stale = estimates.filter(e => e.status === "pending" && daysSince(e.createdAt) >= 7);
      const revMonth = jobs.filter(j => j.status === "completed" && j.scheduledDate?.slice(0, 7) === todayStr.slice(0, 7)).reduce((s, j) => s + j.amount, 0);
      const goalRev = (settingsRef.current as any)?.monthlyRevenueGoal || 0;
      const pct = goalRev > 0 ? Math.round(revMonth / goalRev * 100) : null;
      const lines = [
        "🌅 MORNING BRIEFING — " + new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
        "",
        "📅 TODAY: " + (todayJobs.length > 0
          ? todayJobs.length + " job" + (todayJobs.length !== 1 ? "s" : "") + " scheduled\n" + todayJobs.slice(0, 4).map(j => { const c = customers.find(x => x.id === j.customerId); return "  • " + (c ? c.firstName + " " + c.lastName : "?") + " — " + (j.address || "").split(",")[0] + (j.amount ? " · " + fmt(j.amount) : ""); }).join("\n")
          : "Nothing scheduled. Book something."),
        "",
        pct !== null ? "📈 MONTH: " + fmt(revMonth) + " / " + fmt(goalRev) + " goal (" + pct + "%) " + (pct >= 80 ? "🔥 Almost there!" : pct >= 50 ? "📊 On track" : "⚠️ Behind pace") : "📈 MONTH: " + fmt(revMonth) + " collected",
        pendingEst.length > 0 ? "📋 " + pendingEst.length + " pending quote" + (pendingEst.length !== 1 ? "s" : "") + (stale.length > 0 ? " (" + stale.length + " stale — follow up)" : "") : "📋 No pending quotes",
        overdueInv.length > 0 ? "💸 " + overdueInv.length + " overdue invoice" + (overdueInv.length !== 1 ? "s" : "") + " — collect ASAP" : "✅ No overdue invoices",
        "",
        "Type /route to optimize today · /status for quick stats · Alfred out."
      ];
      const briefing = lines.join("\n");
      console.log("[AlfredBriefing] firing morning briefing for", todayStr);
      // ITEM 22 — this used to create a brand-new "Morning Briefing — <date>"
      // conversation every single day, exactly the same throwaway-chat
      // problem the check-in effect above already got fixed for (see its own
      // comment) — route through the same persistent "Alfred Notifications"
      // thread (functions/api/alfred-notify.ts) instead of setAlfredConversations.
      fetch("/api/alfred-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Alfred Notifications", message: briefing, ownerId: crmUserId }),
      })
        .then(r => { if (!r.ok) console.warn("[AlfredBriefing] alfred-notify failed:", r.status); })
        .catch((e: any) => console.warn("[AlfredBriefing] alfred-notify threw:", e?.message));
      // FEATURE — "proactive daily check-ins, but only if the owner wants
      // them" (Settings → AI Models → "Text me a daily check-in" toggle,
      // off by default — a real opt-in, not always-on). Reuses the exact
      // same briefing content the in-app notification above already
      // builds — one source of truth, just a second delivery channel.
      const s = settingsRef.current as any;
      if (s?.alfredSmsCheckinEnabled && s?.myPhone && s?.twilioSid) {
        twilioSend(s, s.myPhone, briefing)
          .then(() => logOutboundSmsToInbox({ contactName: "Owner (Daily Check-in)", contactPhone: s.myPhone, body: briefing }).catch(() => {}))
          .catch((e: any) => console.warn("[AlfredBriefing] SMS check-in send failed:", e?.message));
      }
      setSettings?.((prev: any) => ({ ...prev, alfredBriefingDate: todayStr }));
      toast?.("🌅 Alfred's morning briefing is ready — see Alfred Notifications", "green");
    };
    const t = setTimeout(tryBriefing, 1800);
    const interval = setInterval(tryBriefing, 60 * 60 * 1000);
    return () => { clearTimeout(t); clearInterval(interval); };
    // Deliberately keyed only on crmUserId — same staleness tradeoff as the
    // check-in effect above (reads live jobs/estimates/customers closures
    // from whenever this effect last actually re-subscribed).
  }, [crmUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // AUDIT FIX — "Morning briefings & day summaries do not work... Email
  // summaries do not work": sendDailyBriefingNow (below) always existed but
  // was ONLY reachable via a manual Dashboard button — there was never an
  // automatic trigger, despite the comment right above it calling this "the
  // (currently unimplemented) automatic end-of-day send." Mirrors the
  // "Tomorrow's Jobs" email effect's own once-per-day-after-6pm/localStorage-
  // dedup pattern. Opt-out, not opt-in (settings.dailyBriefingAutoSend ===
  // false disables it) — a once-daily performance summary is much lower spam
  // risk than the automation-SMS incident this app's kill-switches exist for,
  // and the owner explicitly asked for this to "just work."
  useEffect(() => {
    const checkAndSendDailySummary = async () => {
      if ((settings as any).dailyBriefingAutoSend === false) return;
      if (new Date().getHours() < 18) return;
      const dedupeKey = "smocks.dailySummarySent." + today();
      if (localStorage.getItem(dedupeKey)) return;
      const toEmail = (settings as any).companyEmail || (settings as any).myEmail;
      if (!toEmail) { localStorage.setItem(dedupeKey, "1"); return; } // nothing to send to — don't retry hourly
      localStorage.setItem(dedupeKey, "1");
      try {
        const tKey = today();
        const todaysJobs = jobs.filter(j => j.scheduledDate === tKey);
        const completed = todaysJobs.filter(j => j.status === "completed");
        const revenue = completed.reduce((s, j) => s + (Number(j.amount) || 0), 0);
        // BUG FIX — "give the owner total revenue AND profit" — same
        // labor+material+chemicals cost formula JobsPage.tsx already uses
        // for its own per-job margin display, just summed across today.
        const profit = completed.reduce((s, j: any) => {
          const cost = (Number(j.laborCost) || 0) + (Number(j.materialCost) || 0) + ((j.chemicalsUsed || []).reduce((s2: number, ch: any) => s2 + (Number(ch.cost) || 0), 0));
          return s + ((Number(j.amount) || 0) - cost);
        }, 0);
        const late = todaysJobs.filter(j => {
          if (!j.clockInAt || !j.scheduledTime) return false;
          const scheduled = new Date(`${j.scheduledDate}T${j.scheduledTime}:00`).getTime();
          return (j.clockInAt - scheduled) / 60000 > 15;
        }).length;
        const issues = todaysJobs.flatMap(j => (j.commLog || []).filter((e: any) => e.type === "note" && (e.date || "").startsWith(tKey))).length;
        const jobRows = todaysJobs.map(j => {
          const c = customers.find((x: any) => x.id === j.customerId);
          return { customerName: c ? `${c.firstName || ""} ${c.lastName || ""}`.trim() : (j.address || "Job"), address: j.address, amount: Number(j.amount) || 0, status: j.status || "scheduled" };
        });
        const origin = `${window.location.origin}${window.location.pathname}`;
        const actionButtons = [
          { label: "View Today's Jobs", href: `${origin}#/jobs` },
          { label: "Open Dashboard", href: `${origin}#/` },
        ];
        const html = buildDailyBriefingEmailHtml(settings as any, { completed: completed.length, total: todaysJobs.length, revenue, profit, late, issues }, jobRows, actionButtons);
        await sendEmail(settings as any, toEmail, "Daily Summary", html);
        console.log("[DailySummary] auto-sent for", tKey);
      } catch (e: any) {
        console.warn("[DailySummary] auto-send failed:", e?.message);
      }
    };
    checkAndSendDailySummary();
    const interval = setInterval(checkAndSendDailySummary, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [jobs, settings]);

  // FEATURE — guaranteed weekly owner digest (goal progress + overdue
  // invoices + upcoming jobs). Deliberately NOT built as an entry in the
  // user-editable `automations` list — the owner asked for this as a
  // first-class "just happens" feature, not something that could be
  // accidentally deleted/disabled along with everything else in Automations.
  // Same opt-out-not-opt-in + once-per-week/localStorage-dedup pattern as
  // the daily summary effect above; fires every Monday once the app has
  // been open past 8am that day (mirrors the daily summary's "after 6pm"
  // gate) so it reads as "start of week," not an arbitrary weekday.
  useEffect(() => {
    const checkAndSendWeeklyDigest = async () => {
      if ((settings as any).weeklyDigestAutoSend === false) return;
      const now = new Date();
      if (now.getDay() !== 1 || now.getHours() < 8) return; // Monday, after 8am
      // Gated to Monday-only above, so that day's own date string is already
      // a unique-per-week dedup key — no need for real ISO week-number math.
      const dedupeKey = "smocks.weeklyDigestSent." + now.toISOString().slice(0, 10);
      if (localStorage.getItem(dedupeKey)) return;
      const toEmail = (settings as any).companyEmail || (settings as any).myEmail;
      if (!toEmail) { localStorage.setItem(dedupeKey, "1"); return; }
      localStorage.setItem(dedupeKey, "1");
      try {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const tKey = today();
        const completedThisWeek = jobs.filter(j => j.status === "completed" && (j.completedAt || "").slice(0, 10) >= weekAgo);
        const revenueThisWeek = completedThisWeek.reduce((s, j) => s + (Number(j.amount) || 0), 0);
        const overdueInvoices = estimates
          .filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 7)
          .map(e => ({ customerName: (e as any).customerName || customers.find(c => c.id === e.customerId)?.firstName, total: e.total || 0, daysOverdue: daysSince(e.invoicedAt!) }));
        const upcomingJobs = jobs
          .filter(j => j.status !== "completed" && j.status !== "cancelled" && (j.scheduledDate || "") >= tKey)
          .sort((a, b) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""))
          .slice(0, 8)
          .map(j => ({ customerName: (j as any).customerName || customers.find(c => c.id === j.customerId)?.firstName, scheduledDate: j.scheduledDate, address: j.address }));
        const goals = (goalsList || []).filter((g: any) => !g.completed && !g.achieved).map((g: any) => ({ label: g.label, progress: g.current || 0, target: g.target || 1 }));
        const html = buildWeeklyOwnerDigestEmailHtml(settings as any, { goals, overdueInvoices, upcomingJobs, revenueThisWeek, jobsCompletedThisWeek: completedThisWeek.length });
        await sendEmail(settings as any, toEmail, "Your Weekly Rundown", html);
        console.log("[WeeklyDigest] auto-sent for", dedupeKey);
      } catch (e: any) {
        console.warn("[WeeklyDigest] auto-send failed:", e?.message);
      }
    };
    checkAndSendWeeklyDigest();
    const interval2 = setInterval(checkAndSendWeeklyDigest, 60 * 60 * 1000);
    return () => clearInterval(interval2);
  }, [jobs, estimates, customers, goalsList, settings]);

  // Portal
  const [portalEstId, setPortalEstId] = useState<string | null>(null);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  // FEATURE — "Client Demo": generic test buttons that fire immediately
  // (no picking a customer first), auto-picking real data behind the
  // scenes where a flow needs some record to render against. Review and
  // client-login flows render in-app via these flags instead of
  // window.open()-ing a new tab.
  const [clientDemoOpen, setClientDemoOpen] = useState(false);
  const [demoQuoteTypeMenuOpen, setDemoQuoteTypeMenuOpen] = useState(false);
  // FEATURE — "Test Viewing a Quote should allow clicking the package quote
  // option." Package/Options quote types are opt-in per estimate — a real
  // deployment often has zero examples of one or both, which used to just
  // disable that button forever ("none yet"). A synthetic, NEVER-persisted
  // preview (id prefixed "demo-", filtered out of every write path below) is
  // built on the fly instead, so all three quote types are always previewable
  // regardless of what real data exists.
  const [demoSyntheticEstimate, setDemoSyntheticEstimate] = useState<{ estimate: any; customer: any } | null>(null);
  const [clientDemoReviewOpen, setClientDemoReviewOpen] = useState(false);
  const [clientDemoLoginOpen, setClientDemoLoginOpen] = useState(false);

  // MULTI-TENANT (Phase D) — public #/estimate/:id data. Once RLS is
  // owner_id-scoped, an anonymous visitor (or a customer with no `employees`
  // row) can't resolve current_owner_id(), so the global `estimates`/
  // `customers` arrays are empty for this route. Fetched via the
  // service-role-backed /api/public-data endpoint (functions/api/public-data.ts,
  // action "get_estimate"), scoped narrowly by the unguessable estimate id.
  const [publicEstimate, setPublicEstimate] = useState<{ estimate: any; customer: any; settings: any } | null>(null);
  const [publicEstimateLoading, setPublicEstimateLoading] = useState(true);
  useEffect(() => {
    if (page !== "estimate") return;
    const estId = window.location.hash.replace(/^#\/?/, "").split("?")[0].replace(/^estimate\/?/, "");
    if (!estId) { setPublicEstimateLoading(false); return; }
    let cancelled = false;
    setPublicEstimateLoading(true);
    fetch("/api/public-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_estimate", id: estId }),
    })
      .then(res => res.json().then((data: any) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok || data?.error) { setPublicEstimate(null); return; }
        setPublicEstimate({ estimate: data.estimate, customer: data.customer, settings: data.settings });
      })
      .catch(() => { if (!cancelled) setPublicEstimate(null); })
      .finally(() => { if (!cancelled) setPublicEstimateLoading(false); });
    return () => { cancelled = true; };
  }, [page]);

  // Company first-run setup
  const [setupDone, setSetupDone] = usePersistentRaw("smocks.setupDone", "");
  const [companySetupOpen, setCompanySetupOpen] = useState(false);
  const [companySetupName, setCompanySetupName] = useState("");

  useEffect(() => {
    if (!settings.googleConnected || setupDone || oauthProcessing) return;
    (async () => {
      // Defensive guard: never show owner first-run setup to a user who was
      // previously known to be an employee or manager (cached by resolveUserRole
      // / portal login), even if settings.googleConnected was set incorrectly.
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (userId) {
        const cached = getCachedRole(userId);
        if (cached) {
          return;
        }
      }
      setCompanySetupName((settings as any).companyName || "");
      setCompanySetupOpen(true);
    })();
  }, [settings.googleConnected, setupDone, oauthProcessing]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCompanySetup = async () => {
    const name = companySetupName.trim() || "My Company";
    setSettings((prev: any) => ({ ...prev, companyName: name }));
    setSetupDone("1");
    setCompanySetupOpen(false);
    // Try Supabase org creation — graceful failure if tables don't exist
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (userId) {
        const { data: org } = await (supabase as any).from("organizations").insert({ name }).select("id").single();
        if (org?.id) {
          await (supabase as any).from("profiles").upsert({ id: userId, org_id: org.id });
        }
      }
    } catch { /* organizations/profiles tables may not exist yet */ }
  };

  // Weather
  // FIX 10 — weatherData used to initialize to (and, on any fetch failure,
  // stay stuck at) seedWeather's hardcoded 72°F with zero visible sign
  // anything was wrong — the Dashboard widget only ever gated on "is a key
  // configured," not "did the fetch actually succeed," so an invalid key, a
  // location OWM can't geocode, or a rate limit all silently displayed fake
  // seed data as if it were real. weatherData now starts null (no real data
  // yet) and weatherFetchError tracks the last failure so the UI can show an
  // explicit error instead of ever falling back to seedWeather silently.
  const [weatherData, setWeatherData] = useState<typeof seedWeather | null>(null);
  const [weatherFetchError, setWeatherFetchError] = useState<string | null>(null);
  // ISSUE 14 (round 11) — see jobsRef/estimatesRef/goalsListRef comment near
  // settingsRef; weatherData has to be ref'd separately down here since it
  // isn't declared until this point in the component body (referencing it
  // any earlier would be a TDZ error).
  const weatherDataRef = useRef(weatherData);
  useEffect(() => { weatherDataRef.current = weatherData; }, [weatherData]);

  // Computed stats
  const thisMonth = today().slice(0, 7);
  const totalRev  = jobs.filter(j => j.status === "completed").reduce((s, j) => s + j.amount, 0);
  const activeJobs = jobs.filter(j => j.status === "scheduled" || j.status === "in_progress").length;
  const pendingEst = estimates.filter(e => e.status === "pending").length;
  const doneMonth  = jobs.filter(j => j.status === "completed" && (j.scheduledDate ?? "").startsWith(thisMonth)).length;
  const sentEsts   = estimates.filter(e => e.sentAt).length;
  // BLOCKER 4 (mobile round 7) — was approved-count / sentAt-count. Several
  // flows (Dashboard's own "Send Invoice", EmployeePortal, InvoicesPage) set
  // status:"approved" directly on an estimate row without ever setting
  // sentAt, so the numerator counted every direct invoice while the
  // denominator excluded them — trivially producing rates over 1000%. Using
  // the full estimate count as the denominator (per spec: approved/total ×
  // 100) and clamping to [0,100] makes this a real percentage no matter how
  // an estimate reached "approved".
  const closeRate  = estimates.length > 0
    ? Math.min(100, Math.max(0, Math.round((estimates.filter(e => e.status === "approved").length / estimates.length) * 100)))
    : 0;
  const overdueCount = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 14).length;
  const lowStock   = chemicals.filter(c => c.stock <= c.reorderLevel).length;

  // Apply brand colors + font as CSS variables in real time
  useEffect(() => {
    const s = settings as any;
    const root = document.documentElement;
    root.style.setProperty("--brand",         s.brandPrimary  || s.brandColor || "#dc2626");
    root.style.setProperty("--brand-accent",  s.brandAccent   || "#991b1b");
    root.style.setProperty("--brand-bg",      s.brandBg       || "#000000");
    root.style.setProperty("--brand-surface", s.brandSurface  || "#0a0a0a");
    root.style.setProperty("--brand-text",    s.brandText     || "#ffffff");
    const fontMap: Record<string, string> = {
      serif:   "Georgia, 'Times New Roman', serif",
      mono:    "'Courier New', Courier, monospace",
      rounded: "'Trebuchet MS', Tahoma, sans-serif",
      modern:  "Outfit, 'Nunito', sans-serif",
      default: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    };
    root.style.setProperty("--brand-font", fontMap[s.brandFont] || fontMap.default);
    document.body.style.fontFamily = fontMap[s.brandFont] || "";
  }, [
    (settings as any).brandPrimary, settings.brandColor,
    (settings as any).brandAccent, (settings as any).brandBg,
    (settings as any).brandSurface, (settings as any).brandText,
    (settings as any).brandFont,
  ]);

  // ── Supabase employees sync ───────────────────────────────────────────────
  // Normalizes snake_case Supabase columns to the camelCase Employee type the app expects.
  const normalizeEmployee = (e: any): Employee => ({
    ...e,
    id: e.id || e.user_id || "",
    firstName: e.firstName || e.first_name || "",
    lastName: e.lastName || e.last_name || "",
    role: e.role || "Technician",
    status: e.status || "active",
    hourlyRate: e.hourlyRate ?? e.hourly_rate ?? 0,
    email: e.email || "",
    // Shift-timer + location fields are read by the owner's Live Team View.
    // Postgres folds unquoted column names to lowercase, so a column created
    // as dayClockInAt (unquoted) actually lands as `dayclockinat` — read every
    // plausible casing so the owner sees the shift no matter how the column
    // was declared. (FIX 1 / FIX 7 / FIX 12.)
    dayClockInAt: e.dayClockInAt ?? e.dayclockinat ?? e.day_clock_in_at ?? null,
    dayLunchStartAt: e.dayLunchStartAt ?? e.daylunchstartat ?? e.day_lunch_start_at ?? null,
    dayPausedMinutes: e.dayPausedMinutes ?? e.daypausedminutes ?? e.day_paused_minutes ?? 0,
    locationSharing: e.locationSharing ?? e.locationsharing ?? e.location_sharing ?? false,
    lastLocation: e.lastLocation ?? e.lastlocation ?? e.last_location ?? null,
    // BLOCKER — same unquoted-DDL casing risk as the shift fields above, but
    // these (migration 0019) never got the same defensive fallback. If any
    // of these columns landed lowercase, EVERY read of e.paidPeriods/
    // paidDays/paymentLog/lastShiftHours/lastShiftDate on the owner's side
    // comes back undefined even though the write actually succeeded and the
    // data is sitting right there under the lowercase key — which reads
    // exactly like "Mark as Paid doesn't stick" (it stuck; the owner's own
    // next read just couldn't see it).
    paidPeriods: e.paidPeriods ?? e.paidperiods ?? e.paid_periods ?? {},
    paidDays: e.paidDays ?? e.paiddays ?? e.paid_days ?? {},
    paidJobs: e.paidJobs ?? e.paidjobs ?? e.paid_jobs ?? {},
    paymentLog: e.paymentLog ?? e.paymentlog ?? e.payment_log ?? [],
    lastShiftHours: e.lastShiftHours ?? e.lastshifthours ?? e.last_shift_hours ?? 0,
    lastShiftDate: e.lastShiftDate ?? e.lastshiftdate ?? e.last_shift_date ?? "",
  });

  const refetchEmployees = async () => {
    try {
      const { data, error } = await (supabase as any).from("employees").select("*").eq("owner_id", crmUserId);
      if (error) {
        console.warn("[LiveCrew] employees fetch error:", error.message, "— (RLS may be blocking reads; run the employees RLS SQL) — keeping cached data");
        setCrewFetchError(true);
        return;
      }
      if (Array.isArray(data) && data.length > 0) {
        const normed = data.map(normalizeEmployee) as Employee[];
        const onShift = normed.filter((x: any) => !!x.dayClockInAt);
        setEmployees(normed);
        setCrewFetchError(false);
      } else {
        // Empty result usually means RLS is hiding the crew rows from the owner.
        console.warn("[LiveCrew] employees query returned 0 rows — keeping current state (likely RLS; owner can't read crew rows)");
        setCrewFetchError(true);
      }
    } catch (e: any) {
      console.warn("[LiveCrew] employees fetch threw:", e?.message, "— keeping cached data");
      setCrewFetchError(true);
    }
  };

  // Fetch jobs + customers from Supabase and merge into local state
  const refetchData = async () => {
    setIsSyncing(true);
    try {
      const [{ data: sbJobs, error: jobsErr }, { data: sbCustomers, error: customersErr }, { data: sbEstimates, error: estimatesErr }, { data: sbPromotions }, { data: sbReviews, error: reviewsErr }, { data: sbChemicals }] = await Promise.all([
        (supabase as any).from("jobs").select("*").eq("owner_id", crmUserId),
        (supabase as any).from("customers").select("*").eq("owner_id", crmUserId),
        (supabase as any).from("estimates").select("*").eq("owner_id", crmUserId),
        (supabase as any).from("promotions").select("*").eq("owner_id", crmUserId).then((r: any) => r).catch(() => ({ data: null })),
        (supabase as any).from("reviews").select("*").eq("owner_id", crmUserId).then((r: any) => r).catch((e: any) => ({ data: null, error: e })),
        // FEATURE — Chemicals & Equipment used to be localStorage-only, so
        // it never synced cross-device and text-Alfred (server-side) had no
        // way to read it at all — a hard blocker for its own supplier tools.
        (supabase as any).from("chemicals").select("*").eq("owner_id", crmUserId).then((r: any) => r).catch(() => ({ data: null })),
      ]);
      // ITEM 5 (mobile audit) — reviews previously failed silently here (no
      // logging at all on this fetch), which made "reviews aren't showing"
      // undiagnosable from the console. The actual root cause turned out to
      // be a column-name bug in functions/api/public-data.ts's submit_review
      // insert (fixed separately) so nothing ever reached this table — but
      // keep this log so a *future* reviews regression (RLS, missing table,
      // etc.) shows up immediately instead of silently returning 0 rows.
      if (reviewsErr) console.error("[Reviews] fetch failed:", reviewsErr.message || reviewsErr);
      // EGRESS/QUOTA — supabase-js resolves with {data: null, error} rather
      // than throwing, so this Promise.all never hits the catch block below
      // on a real per-table failure (RLS, paused project, quota
      // restriction) — it just silently skipped the state update. Three
      // core tables failing in the SAME cycle, repeated across several
      // cycles in a row, is the actual observable signature of a
      // paused/restricted project from the client's point of view.
      if (jobsErr || customersErr || estimatesErr) {
        syncFailureStreakRef.current += 1;
        if (syncFailureStreakRef.current >= 3) setSupabaseDegraded(true);
      } else {
        syncFailureStreakRef.current = 0;
        setSupabaseDegraded(false);
      }
      if (Array.isArray(sbJobs) && sbJobs.length > 0) {
        const normedJobs = filterRecentlyDeleted("jobs", sbJobs.map(normalizeJobRow));
        // AUDIT — this [Hours] log was a one-time diagnostic for FIX 7
        // (Hours/Payroll tabs pulling real data), but refetchData runs every
        // 10s PLUS on every realtime jobs/customers/estimates change, so it
        // was printing continuously all day long. That's confirmed working
        // now — removed rather than left flooding the console.
        setJobs(prev => {
          const sbMap = new Map(normedJobs.map((j: any) => [j.id, j]));
          const merged = prev.map(j => sbMap.has(j.id) ? { ...j, ...sbMap.get(j.id) } : j);
          const existingIds = new Set(prev.map(j => j.id));
          const added = normedJobs.filter((j: any) => !existingIds.has(j.id));
          return [...merged, ...added];
        });
      }
      if (Array.isArray(sbCustomers) && sbCustomers.length > 0) {
        // See syncedCustomerIdsRef's comment above — every id the server
        // actually returns is confirmed to exist there right now.
        sbCustomers.forEach((c: any) => syncedCustomerIdsRef.current.add(c.id));
        setCustomers(prev => {
          const filteredCustomers = filterRecentlyDeleted("customers", sbCustomers);
          const sbMap = new Map(filteredCustomers.map((c: any) => [c.id, c]));
          const merged = prev.map(c => sbMap.has(c.id) ? { ...c, ...sbMap.get(c.id) } : c);
          const existingIds = new Set(prev.map(c => c.id));
          const added = filteredCustomers.filter((c: any) => !existingIds.has(c.id));
          return [...merged, ...added];
        });
      }
      if (Array.isArray(sbEstimates) && sbEstimates.length > 0) {
        // See syncedEstimateIdsRef's comment above.
        sbEstimates.forEach((e: any) => syncedEstimateIdsRef.current.add(e.id));
        setEstimates(prev => {
          const filteredEstimates = filterRecentlyDeleted("estimates", sbEstimates);
          const sbMap = new Map(filteredEstimates.map((e: any) => [e.id, e]));
          const merged = prev.map(e => sbMap.has(e.id) ? { ...e, ...sbMap.get(e.id) } : e);
          const existingIds = new Set(prev.map(e => e.id));
          const added = filteredEstimates.filter((e: any) => !existingIds.has(e.id));
          return [...merged, ...added];
        });
      }
      // FIX 14 — promotions must reach anonymous #/estimate visitors too, so a
      // promo code entered at checkout can actually be validated against the
      // owner's real promotions, not just this device's localStorage copy.
      if (Array.isArray(sbPromotions) && sbPromotions.length > 0) {
        setPromotions(prev => {
          const sbMap = new Map(sbPromotions.map((p: any) => [p.id, p]));
          const merged = prev.map(p => sbMap.has(p.id) ? { ...p, ...sbMap.get(p.id) } : p);
          const existingIds = new Set(prev.map(p => p.id));
          const added = sbPromotions.filter((p: any) => !existingIds.has(p.id));
          return [...merged, ...added];
        });
      }
      // AUDIT FIX (mobile round 10) — real customer-submitted reviews (public
      // #/rate page -> Supabase "reviews" table, see CustomerReviewPage.tsx)
      // need to reach the owner's Review Wall/Showcase/Analytics, which all
      // read from the local `reviews` array (ReviewsPage.tsx). The DB row
      // shape (customerId/text/status: "pending"|"private") differs from the
      // legacy local review-request shape (jobId/token/feedback/status:
      // "completed") — normalized here into the local shape so ReviewsPage
      // doesn't need to know about two formats. Any DB row with a rating
      // represents a review that already happened, so it's always mapped to
      // "completed" (the DB's own "pending"/"private" status tracks whether
      // it's public-worthy or private feedback, tracked separately as
      // source/negative-alert material, not whether it was submitted).
      if (Array.isArray(sbReviews) && sbReviews.length > 0) {
        let newlyAddedLowRated: any[] = [];
        setReviews(prev => {
          const normalized = sbReviews.map((r: any) => ({
            id: r.id, customerId: r.customerId, rating: Number(r.rating) || 0,
            feedback: r.text || undefined, createdAt: r.createdAt || today(),
            source: r.source || "customer-submitted", status: "completed" as const,
          }));
          const sbMap = new Map(normalized.map((r: any) => [r.id, r]));
          const merged = prev.map(r => sbMap.has(r.id) ? { ...r, ...sbMap.get(r.id) } : r);
          const existingIds = new Set(prev.map(r => r.id));
          const added = normalized.filter((r: any) => !existingIds.has(r.id));
          newlyAddedLowRated = added.filter((r: any) => r.rating > 0 && r.rating <= 3);
          return [...merged, ...added];
        });
        if (newlyAddedLowRated.length > 0) {
          (setNegativeAlerts as any)((prev: any[]) => {
            const existingReviewIds = new Set(prev.map((a: any) => a.reviewId));
            const toAdd = newlyAddedLowRated.filter((r: any) => !existingReviewIds.has(r.id)).map((r: any) => {
              const cust = customers.find(c => c.id === r.customerId);
              return { id: uid(), reviewId: r.id, customerName: cust ? `${cust.firstName} ${cust.lastName}` : "Customer", rating: r.rating, at: today() };
            });
            return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
          });
        }
      }
      if (Array.isArray(sbChemicals) && sbChemicals.length > 0) {
        setChemicals(prev => {
          const filteredChemicals = filterRecentlyDeleted("chemicals", sbChemicals);
          const sbMap = new Map(filteredChemicals.map((c: any) => [c.id, c]));
          const merged = prev.map(c => sbMap.has(c.id) ? { ...c, ...sbMap.get(c.id) } : c);
          const existingIds = new Set(prev.map(c => c.id));
          const added = filteredChemicals.filter((c: any) => !existingIds.has(c.id));
          return [...merged, ...added];
        });
      }
      setLastSynced(new Date());
    } catch {
      /* tables may not exist yet — but a THROWN failure (network down,
         project unreachable) is just as much a signal as an error response. */
      syncFailureStreakRef.current += 1;
      if (syncFailureStreakRef.current >= 3) setSupabaseDegraded(true);
    }
    setIsSyncing(false);
  };

  // FIX 2 — auto-complete stale "in_progress" jobs left over from PAST days
  // that were never actually clocked into (clockInAt null). A job that a crew
  // genuinely started (clockInAt set) is left alone. Runs once per session
  // after jobs are available; persists to Supabase so the owner + employee
  // both stop seeing yesterday's jobs stuck "in progress".
  const pastJobSweepRef = useRef(false);
  useEffect(() => {
    if (pastJobSweepRef.current || jobs.length === 0) return;
    const todayStr = today();
    const stale = jobs.filter(j => j.status === "in_progress" && !j.clockInAt && j.scheduledDate && j.scheduledDate < todayStr);
    if (stale.length === 0) { pastJobSweepRef.current = true; return; }
    pastJobSweepRef.current = true;
    const staleIds = new Set(stale.map(j => j.id));
    setJobs(prev => prev.map(j => staleIds.has(j.id) ? { ...j, status: "completed" as const } : j));
    stale.forEach(j => {
      (supabase as any).from("jobs").update({ status: "completed" }).eq("id", j.id)
        .then((r: any) => { if (r?.error) console.warn("[PastJobs] failed to persist for", j.id, r.error.message); })
        .catch(() => {});
    });
  }, [jobs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save jobs to Supabase every 30 seconds (upsert on id)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (jobs.length === 0) return;
      try {
        // FIX 7 — every field the employee portal (or the owner's own
        // immediate-write JobsPage/JobDetailModal updateJob calls) can write
        // directly must be excluded from this 30s bulk upsert, or a stale
        // owner-browser copy can silently revert a genuinely fresh write —
        // e.g. an employee's "Mark Complete" sets status:"completed" and
        // paymentStatus:"Paid" immediately, but if the owner's local `jobs`
        // state hadn't caught up yet (their 3s poll hasn't landed since), this
        // bulk save would upsert their stale status:"scheduled" right back
        // over it moments later — which is exactly why completed jobs and
        // dashboard revenue looked like they "didn't update": the completion
        // got silently undone in Supabase by this loop, not by anything on
        // the dashboard itself. This list matches EmployeePortal's own
        // CORE_JOB_COLUMNS (the fields it knows it writes) plus lunch fields.
        // Upsert only sends columns present on each row object, so omitting a
        // key leaves that column untouched.
        const EMPLOYEE_OWNED_FIELDS = [
          "status", "paymentStatus", "paymentType", "loggedHours", "amountCollected", "invoiceSentAt", "arrivedAt",
          // BLOCKER — "crew" was already excluded here but "crewAssignedAt"
          // wasn't. Both get written together by every assign/request-accept
          // flow (see reconcileCrewAfterAssign in lib/utils.ts), but this
          // bulk autosave re-upserts every job's FULL in-memory row every
          // 30s. If crew came from ANOTHER device/actor since this browser's
          // own jobs state last refreshed, "crew" being stripped means the
          // array itself survives — but crewAssignedAt didn't, so this
          // owner's stale local copy silently overwrote (not merged) the
          // JSONB timestamp map, erasing another employee's assignment
          // timestamp (and their "New Assignment" banner) even though they
          // stayed visibly on the crew. Matches this feature's own "comes
          // and goes" symptom.
          "crew", "crewAssignedAt", "clockInAt", "lunchStartAt", "lunchMinutes", "lunchExceeded", "pipelineStage", "photos", "videos",
          "preChecklist", "duringChecklist", "postChecklist", "checklist", "signOff", "scheduledTime", "commLog",
          "equipmentChecked", "notes",
          // BUG FIX — "Auto-save skipped — jobs table is missing column(s)"
          // every 30s, every job, whole batch: crewGoogleEventIds is
          // `NOT NULL DEFAULT '{}'::jsonb` — fine when a row's INSERT/UPDATE
          // simply omits the key (the default applies), but PostgREST's
          // bulk upsert builds ONE statement from the UNION of every key
          // present across the whole array. The instant ANY single job in
          // local state had this key (e.g. freshly fetched from Supabase,
          // which always returns it), every OTHER job in the same batch —
          // which never had this key locally — got it sent as an explicit
          // JSON `null` to fill the column, violating NOT NULL and 400ing
          // the entire batch, not just that one job. No code here writes
          // this field directly (it's calendar-sync-derived), so it's safe
          // to strip like crew/crewAssignedAt above rather than normalize.
          "crewGoogleEventIds",
        ] as const;
        const safeJobs = jobs.map(j => {
          const copy: any = stripLegacyJobFields(j);
          EMPLOYEE_OWNED_FIELDS.forEach(f => delete copy[f]);
          copy.owner_id = crmUserId;
          return copy;
        });
        // FIX 1b (mobile round 6) — newer optional fields (recurring
        // schedule from migration 0007, deposits/discounts from 0010) are
        // in this bulk payload but may not exist as columns on every
        // deployment yet. A single unrecognized column 400s the WHOLE
        // batch — this retry drops just those optional fields (the same
        // "safe subset" idiom EmployeePortal.tsx/JobsPage.tsx's updateJob
        // already use for per-job writes) so the core job fields still
        // save instead of silently failing every 30s forever.
        const OPTIONAL_NEWER_FIELDS = [
          "isRecurring", "recurringMode", "recurringFreq", "recurringInterval", "recurringWeekdays",
          "depositRequired", "depositType", "discount", "discounts", "customFields",
          // "tip" is a real field (types/index.ts Job.tip, shown in
          // Dashboard/Reports/Budget/Alfred tip totals) — unlike
          // organizationId/org_id it should NOT be stripped from the app,
          // just from this retry until supabase/migrations/0020_job_tip_column.sql
          // is run. A seed job (lib/seed.ts) ships with tip:40, so any
          // deployment that ever loaded demo data has a job carrying this
          // field in its "smocks.jobs" localStorage cache, which — same as
          // the org_id incident — poisons this ENTIRE bulk upsert (all jobs,
          // not just that one) every 30s until either the column exists or
          // it's excluded here.
          "tip",
        ] as const;
        // Supabase-js resolves (rather than rejects) on a PostgREST error, so check
        // the returned `error` explicitly — a bare try/catch alone won't see a 400.
        const { error } = await (supabase as any).from("jobs").upsert(safeJobs, { onConflict: "id" });
        if (error) {
          const isColumnError = String(error.code) === "400" || error.message?.includes("400") || /column/i.test(error.message || "");
          if (isColumnError) {
            // Surface exactly which column PostgREST rejected, instead of a
            // generic "columns missing" with no actionable detail.
            const colMatch = /column ['"]?([\w.]+)['"]?/i.exec(error.message || "") || /['"]([\w]+)['"] column/i.exec(error.message || "");
            console.warn("Auto-save — column error:", error.message, colMatch ? "(column: " + colMatch[1] + ")" : "");
            const coreJobs = safeJobs.map(j => {
              const copy: any = { ...j };
              OPTIONAL_NEWER_FIELDS.forEach(f => delete copy[f]);
              return copy;
            });
            const retry = await (supabase as any).from("jobs").upsert(coreJobs, { onConflict: "id" });
            if (retry?.error) {
              console.warn("Auto-save skipped — jobs table is missing column(s) beyond the optional set retried. Run supabase/migrations/0007_custom_recurring_schedule_columns.sql and 0010_deposits_and_discounts.sql in the Supabase SQL editor. Error:", retry.error.message);
              return;
            }
            setLastSynced(new Date());
            return;
          }
          throw error;
        }
        setLastSynced(new Date());
      } catch (err: any) {
        if (err?.code === "400" || err?.message?.includes("400")) {
          console.warn("Auto-save skipped — jobs table columns missing:", err?.message);
          return; // Don't crash, just skip
        }
        console.warn("Auto-save failed:", err?.message);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [jobs]);

  // Auto-save customers + estimates to Supabase every 30 seconds (upsert on id).
  // The manual CustomerModal/EstimatesPage forms only ever called setCustomers/
  // setEstimates (local React state + localStorage via usePersistent) — there
  // was NO write path to Supabase at all for either table outside of Alfred's
  // direct insert calls and the one-time seed. That's why "the manual form
  // works" only looked true on the single device that created the record: it
  // never reached Supabase, so it could never reach a second device, and
  // Alfred-created rows were the only ones the cross-device poll ever saw.
  // BUG FIX — this bulk upsert had no safe-column retry at all, unlike the
  // matching jobs bulk autosave below (OPTIONAL_NEWER_FIELDS). folder
  // (0024) and smsOptIn/smsOptInAt/documents (0025) are all new fields a
  // customer object can now carry — on any deployment where those
  // migrations haven't run yet, the very first customer to get one of them
  // set (e.g. any new lead through the public form, which sets smsOptIn
  // unconditionally) would 400 this ENTIRE batch, every 30 seconds, for
  // every customer, silently, until the migration runs. Same "one bad
  // column poisons the whole write" failure mode this project has hit
  // repeatedly (tip, org_id, crewAssignedAt) — strip just these on retry so
  // the rest of the batch still saves.
  const CUSTOMER_OPTIONAL_NEWER_FIELDS = ["folder", "smsOptIn", "smsOptInAt", "documents", "smsOptOut", "optOutDate", "smsOptInPending", "smsOptInPendingAt"] as const;
  const upsertCustomersSafely = async (list: any[], label: string) => {
    if (list.length === 0) return;
    try {
      const withOwner = list.map((c: any) => ({ ...c, owner_id: crmUserId }));
      const { error } = await (supabase as any).from("customers").upsert(withOwner, { onConflict: "id" });
      if (!error) { list.forEach((c: any) => syncedCustomerIdsRef.current.add(c.id)); return; }
      console.warn(`${label} failed:`, error.message, "— retrying without", CUSTOMER_OPTIONAL_NEWER_FIELDS.join("/"));
      const coreList = withOwner.map((c: any) => {
        const copy = { ...c };
        CUSTOMER_OPTIONAL_NEWER_FIELDS.forEach(f => delete copy[f]);
        return copy;
      });
      const retry = await (supabase as any).from("customers").upsert(coreList, { onConflict: "id" });
      if (retry?.error) console.warn(`${label} — core retry also failed:`, retry.error.message);
    } catch (err: any) {
      console.warn(`${label} failed:`, err?.message);
    }
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      // BUG FIX — "delete an invoice/customer, it comes back." See
      // syncedEstimateIdsRef/syncedCustomerIdsRef's comment above — never
      // blindly re-push a row this tab previously confirmed existed on the
      // server but no longer does (deleted, here or on another device).
      // Only rows the server still actually has, or rows this tab has
      // NEVER confirmed synced before (a genuinely new local row), go out.
      let estimateSafeIds: Set<string> | null = null;
      let customerSafeIds: Set<string> | null = null;
      try {
        const [{ data: liveEstIds }, { data: liveCustIds }] = await Promise.all([
          (supabase as any).from("estimates").select("id").eq("owner_id", crmUserId),
          (supabase as any).from("customers").select("id").eq("owner_id", crmUserId),
        ]);
        if (Array.isArray(liveEstIds)) estimateSafeIds = new Set(liveEstIds.map((r: any) => r.id));
        if (Array.isArray(liveCustIds)) customerSafeIds = new Set(liveCustIds.map((r: any) => r.id));
      } catch (err: any) { console.warn("Auto-save id check failed — skipping this cycle entirely (see BUG FIX comment above safeCustomers/safeEstimates):", err?.message); }
      // BUG FIX — "invoices keep coming back." The old fallback here, when
      // the live id check itself failed (a flaky mobile connection is far
      // more likely to hit this than desktop — confirmed a second device,
      // an Android phone, hitting errors on this exact endpoint in the logs
      // while diagnosing this), was to push the ENTIRE unfiltered local
      // array with NO protection at all — completely bypassing the
      // resurrection guard this whole mechanism exists for. A phone that's
      // been open for a while, whose local `estimates` still has a row
      // deleted on another device minutes ago, would resurrect it the
      // moment its OWN live check had a network hiccup — which on mobile
      // data is routine, not rare. Skipping the cycle entirely when the
      // safety check fails is strictly safer than guessing: a legitimately
      // new local-only row just waits for the next successful cycle
      // instead of risking a deleted row coming back from the dead.
      const safeCustomers = !customerSafeIds ? [] : customers.filter((c: any) => customerSafeIds!.has(c.id) || !syncedCustomerIdsRef.current.has(c.id));
      await upsertCustomersSafely(safeCustomers, "Customer auto-save");
      const safeEstimates = !estimateSafeIds ? [] : estimates.filter((e: any) => estimateSafeIds!.has(e.id) || !syncedEstimateIdsRef.current.has(e.id));
      if (safeEstimates.length > 0) {
        try {
          const { error } = await (supabase as any).from("estimates").upsert(safeEstimates.map((e: any) => ({ ...e, owner_id: crmUserId })), { onConflict: "id" });
          if (error) console.warn("Estimate auto-save failed:", error.message);
          else safeEstimates.forEach((e: any) => syncedEstimateIdsRef.current.add(e.id));
        } catch (err: any) { console.warn("Estimate auto-save failed:", err?.message); }
      }
      // FEATURE — Chemicals & Equipment used to never reach Supabase at all
      // (localStorage-only) — see migration 0056's comment.
      if (chemicals.length > 0) {
        try {
          const { error } = await (supabase as any).from("chemicals").upsert(chemicals.map((c: any) => ({ ...c, owner_id: crmUserId })), { onConflict: "id" });
          if (error) console.warn("Chemicals auto-save failed:", error.message);
        } catch (err: any) { console.warn("Chemicals auto-save failed:", err?.message); }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [customers, estimates, chemicals]);

  // FEATURE — "make sure the owner can also access the auto mileage
  // tracking." EmployeePortal.tsx's GPS-based auto mileage tracker only
  // ever ran for a real employee session — the owner's own clock-in
  // (JobDetailModal's Time Tracking control) writes to the exact same
  // employees.dayClockInAt field employees use, but nothing watched it to
  // start/stop GPS tracking or log the trip. This mirrors that same
  // watchPosition/haversine logic, self-contained here rather than
  // routing the owner through EmployeePortal's employee-session-shaped
  // internals (which assume a real employee auth session throughout).
  const ownerMileageWatchIdRef = useRef<number | null>(null);
  const ownerLastGpsPosRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const ownerDayTrackedMilesRef = useRef(0);
  const ownerWasClockedInRef = useRef(false);
  const myOwnerEmpRow = employees.find((e: any) => e.role === "owner" && ((e.user_id && e.user_id === crmUserId) || (e.email && crmUserEmail && e.email.toLowerCase() === crmUserEmail.toLowerCase())));
  useEffect(() => {
    if (!hasCrmSession || !myOwnerEmpRow) return;
    const autoMileageEnabled = (settings as any)?.autoMileageTrackingEnabled !== false;
    const clockedIn = !!(myOwnerEmpRow as any).dayClockInAt;
    if (clockedIn && autoMileageEnabled && ownerMileageWatchIdRef.current == null && navigator.geolocation) {
      ownerLastGpsPosRef.current = null;
      ownerDayTrackedMilesRef.current = 0;
      const haversineMi = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
        const R = 3958.8;
        const dLat = (b.lat - a.lat) * Math.PI / 180;
        const dLng = (b.lng - a.lng) * Math.PI / 180;
        const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
      };
      ownerMileageWatchIdRef.current = navigator.geolocation.watchPosition(
        pos => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          const now = Date.now();
          if (accuracy != null && accuracy > 100) return;
          const prev = ownerLastGpsPosRef.current;
          if (prev) {
            const miles = haversineMi(prev, { lat, lng });
            const hours = Math.max((now - prev.t) / 3600000, 1 / 3600);
            if (miles / hours <= 100 && miles > 0.005) ownerDayTrackedMilesRef.current = Math.round((ownerDayTrackedMilesRef.current + miles) * 100) / 100;
          }
          ownerLastGpsPosRef.current = { lat, lng, t: now };
        },
        (err) => console.warn("[Owner Mileage] GPS watch error:", err.message),
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
      );
      console.log("[Owner Mileage] auto-tracking started");
    }
    // Transition from clocked-in -> clocked-out: stop the watch and log the trip.
    if (!clockedIn && ownerWasClockedInRef.current && ownerMileageWatchIdRef.current != null) {
      navigator.geolocation.clearWatch(ownerMileageWatchIdRef.current);
      ownerMileageWatchIdRef.current = null;
      const miles = ownerDayTrackedMilesRef.current;
      if (miles > 0.1) {
        const row = { id: uid(), employee_id: (myOwnerEmpRow as any).id, date: today(), from: "", to: "", miles, purpose: "Auto-tracked shift mileage", status: "approved", owner_id: crmUserId };
        (supabase as any).from("mileage_logs").insert(row)
          .then((r: any) => { if (r?.error) console.warn("[Owner Mileage] auto-submit failed:", r.error.message); })
          .catch((e: any) => console.warn("[Owner Mileage] auto-submit threw:", e?.message));
      }
      console.log("[Owner Mileage] auto-tracking stopped —", miles, "mi logged");
    }
    ownerWasClockedInRef.current = clockedIn;
  }, [hasCrmSession, (myOwnerEmpRow as any)?.dayClockInAt, (settings as any)?.autoMileageTrackingEnabled]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (ownerMileageWatchIdRef.current != null) navigator.geolocation.clearWatch(ownerMileageWatchIdRef.current); }, []);

  // SMS compliance — keep messaging.ts's in-memory opted-out-phone registry
  // (see setOptedOutPhones/isPhoneOptedOut in lib/messaging.ts) in sync with
  // the live customers array, so twilioSend() blocks anyone who's replied
  // STOP no matter which of the ~45 call sites across the app triggers it.
  useEffect(() => {
    setOptedOutPhones(customers);
  }, [customers]);

  // FEATURE (round 13, item 12) — Testing Mode, same registry pattern as
  // opt-out above. Recomputed whenever customers change OR the owner flips
  // the master switch in Settings.
  useEffect(() => {
    setTestModeContacts(customers, !!(settings as any)?.testModeEnabled);
  }, [customers, (settings as any)?.testModeEnabled]);

  // On first load, immediately push any localStorage customers + estimates to
  // Supabase so employees (and any other device) can read them right away,
  // without waiting up to 30s for the auto-save interval to fire.
  useEffect(() => {
    const syncLocalToSupabase = async () => {
      // See persistTombstones' comment above — this is a one-time push of
      // whatever localStorage has, straight on mount, before any server
      // fetch. Without filtering out ids this browser has tombstoned, a
      // stale local copy of a since-deleted row gets pushed right back.
      //
      // BUG FIX — "invoices keep coming back, this has been a persisting
      // problem." Tombstones (above) only protect the DEVICE that actually
      // performed the delete — a SECOND device/browser (phone left signed
      // in, a different tab that hasn't reloaded since) has no tombstone
      // for that id in its own localStorage at all. On its next reload,
      // this mount-time push ran unconditionally, immediately resurrecting
      // the row before any live check ever ran — the exact cross-device
      // "delete it, and it's back" loop that survived every earlier guard
      // here, since all of those only ever activated on later cycles, not
      // this very first push. Now mirrors the 30s interval's real fix:
      // fetch the live id set first, and only push a local-only row (one
      // NOT confirmed to still exist server-side) if it's genuinely recent
      // (created in the last 30 minutes) — a real offline-created row is
      // always this fresh; a stale cached copy of a since-deleted row from
      // another device essentially never is.
      const RECENT_MS = 30 * 60 * 1000;
      const isRecent = (row: any) => { const t = Date.parse(row?.createdAt || ""); return !Number.isNaN(t) && Date.now() - t < RECENT_MS; };
      let liveEstIds: Set<string> | null = null;
      let liveCustIds: Set<string> | null = null;
      try {
        const [{ data: estRows }, { data: custRows }] = await Promise.all([
          (supabase as any).from("estimates").select("id").eq("owner_id", crmUserId),
          (supabase as any).from("customers").select("id").eq("owner_id", crmUserId),
        ]);
        if (Array.isArray(estRows)) liveEstIds = new Set(estRows.map((r: any) => r.id));
        if (Array.isArray(custRows)) liveCustIds = new Set(custRows.map((r: any) => r.id));
      } catch (err: any) { console.warn("Initial sync — live id check failed, skipping local push entirely this load:", err?.message); }
      // Live check itself failing is the same "can't tell new from deleted"
      // situation as a missing id set — skip the push rather than guess.
      if (!liveEstIds || !liveCustIds) return;
      const deletedCustIds = readTombstones("customers");
      const deletedEstIds = readTombstones("estimates");
      const safeLocalCustomers = customers.filter((c: any) => !deletedCustIds.has(c.id) && (liveCustIds!.has(c.id) || isRecent(c)));
      await upsertCustomersSafely(safeLocalCustomers, "Initial customer sync");
      const storedEst = estimates.filter((e: any) => !deletedEstIds.has(e.id) && (liveEstIds!.has(e.id) || isRecent(e)));
      if (storedEst.length > 0) {
        try {
          const { error } = await (supabase as any).from("estimates").upsert(storedEst.map((e: any) => ({ ...e, owner_id: crmUserId })), { onConflict: "id" });
          if (error) console.warn("Initial estimate sync failed:", error.message);
        } catch (err: any) { console.warn("Initial estimate sync failed:", err?.message); }
      }
      if (chemicals.length > 0) {
        try {
          const { error } = await (supabase as any).from("chemicals").upsert(chemicals.map((c: any) => ({ ...c, owner_id: crmUserId })), { onConflict: "id" });
          if (error) console.warn("Initial chemicals sync failed:", error.message);
        } catch (err: any) { console.warn("Initial chemicals sync failed:", err?.message); }
      }
    };
    syncLocalToSupabase();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cross-device sync ────────────────────────────────────────────────────
  // refetchData() previously only ran once at session bootstrap, so a change
  // an employee made on their phone never reached an owner's already-open
  // dashboard until they refreshed the page. Two complementary mechanisms:
  // a Supabase realtime subscription for instant updates when the table has
  // realtime enabled (the actual "no polling needed" path — realtime pushes
  // over one shared websocket instead of a fresh REST read every tick), plus
  // a poll as a fallback for projects without realtime enabled or a dropped
  // connection.
  // EGRESS FIX — this poll used to run unconditionally, every 3s, for
  // jobs+customers+estimates+employees together, all day, whether or not the
  // tab was even visible — a full `select("*")` on 4 tables every 3 seconds
  // is the actual source of the high Supabase egress. Now: jobs/customers/
  // estimates (non-critical — realtime + a slower fallback is plenty) poll at
  // 10s, only Live Crew View (employees, drives the "who's on shift right
  // now" dashboard widget) keeps the faster 3s cadence, and BOTH skip
  // entirely while the tab is hidden or the user has been idle 5+ minutes.
  // shouldPollCrossDevice is declared earlier (near the settings poll) so
  // that poll can share the same gate — see the comment there.
  useEffect(() => {
    // Was gated on hasCrmSession (owner) only — an employee staying logged in
    // for a full shift never got customers refreshed after the one-time
    // bootstrap fetch, so any customer added/edited after they clocked in
    // silently showed no name/phone on their job cards. Both session types
    // need this. FIX 17/20 — an anonymous customer on the public #/estimate/ID
    // or #/client page ALSO needs real jobs/customers/estimates data (RLS
    // already allows anon reads); without this, ClientPortal/ClientAuthPortal
    // rendered with nothing but this browser's empty localStorage.
    if (!hasCrmSession && !empSession && page !== "estimate" && page !== "client") return;
    let channel: any = null;
    try {
      channel = (supabase as any)
        .channel("jobs-sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `owner_id=eq.${crmUserId}` }, () => { refetchData(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "customers", filter: `owner_id=eq.${crmUserId}` }, () => { refetchData(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "estimates", filter: `owner_id=eq.${crmUserId}` }, () => { refetchData(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "employees", filter: `owner_id=eq.${crmUserId}` }, () => { refetchEmployees(); })
        .subscribe();
    } catch { /* realtime may not be enabled on this project */ }
    // EGRESS FIX — jobs/customers/estimates carry inline base64 photos/videos
    // (see types/index.ts Photo.dataUrl etc.), so a select("*") poll re-
    // downloads every job's full media on every tick. Realtime above already
    // covers instant updates; this interval is only the cross-device/missed-
    // event fallback. Both now share the owner-configurable interval
    // (Settings → default 120s) instead of two different hardcoded values —
    // crewInterval was still at its ORIGINAL 3000ms here, never widened when
    // dataInterval was bumped to 60s in an earlier pass, making it by far
    // the single biggest poll-driven egress source in the app (a full
    // employees select("*") every 3 seconds, indefinitely, on every open
    // owner tab).
    const pollMs = getPollIntervalMs(settings);
    const dataInterval = setInterval(() => { if (shouldPollCrossDevice()) refetchData(); }, pollMs);
    const crewInterval = setInterval(() => { if (shouldPollCrossDevice()) refetchEmployees(); }, pollMs);
    return () => {
      clearInterval(dataInterval);
      clearInterval(crewInterval);
      try { channel?.unsubscribe(); } catch { /* ignore */ }
    };
  }, [hasCrmSession, !!empSession, crmUserId, (settings as any)?.pollIntervalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Supabase Google OAuth / identity-link capture ────────────────────────
  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;

    // Hard ceiling on the loading screen — independent of the async chain below.
    // supabase.auth.getSession()/onAuthStateChange can both hang (not throw) if
    // an earlier auth.initialize() call left an internal navigator-lock engaged,
    // a network request never settles, etc. A hang skips both try/catch AND
    // finally, since nothing ever rejects — so the only thing that can rescue
    // the UI from a permanently-stuck loading screen is a timer that doesn't
    // depend on any of this resolving at all.
    let bootstrapDone = false;
    const forceRenderTimer = setTimeout(() => {
      if (!bootstrapDone) {
        // BLOCKER 9 (mobile round 10) — this timer already rescues the
        // loading SCREEN from a hung getSession()/onAuthStateChange (see the
        // comment above), but until now it didn't rescue the DATA: everything
        // that populates `employees`/`jobs`/`customers` — including Live Crew
        // View's data — lives inside the same async bootstrap chain, AFTER
        // the hung await. A permanent hang there (the exact navigator-lock/
        // IndexedDB issue this comment already describes, which mobile
        // Safari/Chrome hit far more often than desktop) meant the CRM
        // rendered but silently NEVER fetched employees/jobs for the rest of
        // the session — "works on PC, shows nothing on phone, same account"
        // is exactly what that looks like, since the PC session's bootstrap
        // just happened not to hang. These calls don't depend on session
        // role-resolution (RLS is permissive per CLAUDE.md), so they can run
        // independently the moment this ceiling fires.
        //
        // CRITICAL FIX (employee-logout regression) — this used to also call
        // setHasCrmSession(true) here, on the assumption that a slow
        // bootstrap must belong to an owner. That assumption is wrong: at the
        // 5s mark we genuinely don't know yet whether the pending session (if
        // any) is an owner's or an employee's. An employee opening #/portal
        // has page==="portal" from the URL hash immediately, while empSession
        // is still null during resolution — forcing hasCrmSession true made
        // isOwnerView (below) — `!empSession && page==="portal" &&
        // hasCrmSession` — flip true, swapping their real portal for the
        // read-only OwnerTeamPortal preview stub the instant this timer
        // fired. That is what "employee signs in, sees the portal, then gets
        // kicked out ~5s later" actually was: not a real sign-out, but this
        // timer misclassifying an unresolved employee session as an owner.
        // Only fetch data here — never guess session type from a timeout.
        console.warn("Session bootstrap exceeded 5s — releasing loading screen and fetching data directly");
        setSessionChecked(true);
        refetchEmployees();
        refetchData();
      }
    }, 5000);

    // GoogleConnect — detectSessionInUrl (still enabled, for password-reset
    // hashes) and this file's own manual setSession() call both end up
    // processing the SAME OAuth-callback hash, which fires onAuthStateChange
    // TWICE for one real connect: once from whichever one actually parsed the
    // original hash (session carries provider_token), and again from the
    // other's redundant re-establish of the same tokens (session does NOT
    // carry provider_token — Supabase's setSession() never attaches it, that
    // field only exists on the session object produced by parsing the
    // original hash).
    //
    // A closure-scoped "already captured this load" flag was tried here
    // first and did not hold up — a flag read OUTSIDE the setState updater
    // is checked against whatever the closure captured at subscribe time,
    // not the actual current React state, so it's vulnerable to exactly the
    // kind of re-subscribe/re-render timing this bug already lives in.
    // Checking `prev` INSIDE the setSettings updater below is the fix: prev
    // is always the true, current state at the moment this update actually
    // applies, no matter how many times or in what order events fire — so
    // "already have a real token, incoming call has none" is judged against
    // reality, not a snapshot.
    // BUG FIX ("Google keeps disconnecting, especially after a redeploy") —
    // the refresh_token Google hands back is a ONE-TIME value: it only
    // appears in the OAuth redirect hash on the authorization that actually
    // grants offline access, never again after. Previously it only ever
    // reached Supabase by riding along in the next tick of the general,
    // debounced, whole-object `settings` sync (the same effect whose
    // "Settings sync save timed out" failures were found and logged
    // earlier this session) — a payload that also carries every template/
    // logo/photo the owner has ever saved, and can legitimately time out.
    // If that happened to fail (or simply hadn't fired yet) right as the
    // owner closed the tab or the page redeployed underneath them, the
    // refresh_token was gone for good — the access token it would have
    // renewed dies silently ~55 minutes later with no way back except a
    // full manual reconnect. Firing a small, dedicated, immediately-retried
    // write for just the Google token fields — decoupled from the bulk
    // settings payload — closes that window.
    const persistGoogleTokensNow = async (ownerId: string, patch: Record<string, any>) => {
      if (!ownerId) { console.warn("[GoogleConnect] persistGoogleTokensNow — no ownerId yet, skipping immediate persist (will still ride the next settings sync)"); return; }
      try {
        const { data: row } = await (supabase as any).from("app_settings").select("data").eq("owner_id", ownerId).maybeSingle();
        const merged = { ...(row?.data || {}), ...patch };
        const r: any = await withTimeout((supabase as any).from("app_settings").upsert({ owner_id: ownerId, data: merged, updated_at: new Date().toISOString() }, { onConflict: "owner_id" }), 15000, "Google token save");
        if (r?.error) throw new Error(r.error.message);
        console.log("[GoogleConnect] refresh_token persisted immediately to app_settings (not waiting on the general settings-sync debounce)");
      } catch (e: any) {
        console.error("[GoogleConnect] immediate refresh_token persist FAILED — connection may not survive a reload:", e?.message);
        toast?.("Google connected, but saving the connection to the server failed (" + (e?.message || "unknown error") + ") — it may not survive a reload. Try reconnecting if Google keeps disconnecting.", "red");
      }
    };
    const applyGoogleIdentity = (session: any, ownerId?: string) => {
      if (!session?.user) { console.log("[GoogleConnect] applyGoogleIdentity — no session, skipping"); return; }
      const googleId = (session.user.identities || []).find((i: any) => i.provider === "google");
      if (!googleId) { console.log("[GoogleConnect] applyGoogleIdentity — session has no google identity, skipping"); return; }
      const googleEmail = googleId.identity_data?.email || session.user.email || "";
      // Pick up the Google OAuth tokens bridged from the hash via sessionStorage.
      // session.provider_token is only populated immediately after setSession with the
      // original hash; on subsequent loads it is null, so the persisted value is kept.
      const bridgedToken = sessionStorage.getItem("smocks.gpt") || "";
      if (bridgedToken) sessionStorage.removeItem("smocks.gpt");
      const bridgedRefreshToken = sessionStorage.getItem("smocks.grt") || "";
      if (bridgedRefreshToken) sessionStorage.removeItem("smocks.grt");
      const providerToken = bridgedToken || session.provider_token || "";
      console.log("[GoogleConnect] applyGoogleIdentity — email:", googleEmail, "· providerToken this call:", !!providerToken, "· has refresh token this call:", !!bridgedRefreshToken);
      setSettings((prev: any) => {
        if (!providerToken && prev.googleProviderToken) {
          // Nothing new to contribute, and a real token already exists —
          // per the fix requirement, DO NOTHING. Return prev unchanged (same
          // reference) so React doesn't even re-render for this no-op.
          console.log("[GoogleConnect] no provider_token on this event, but settings.googleProviderToken already exists — doing nothing, existing connection untouched");
          return prev;
        }
        console.log("[GoogleConnect] saving google identity — provider token:", providerToken ? "NEW value from this event" : prev.googleProviderToken ? "keeping existing value" : "none yet on file");
        const tokenPatch = {
          googleConnected: true,
          googleEmail,
          googleScopes: prev.googleScopes && Object.keys(prev.googleScopes).length ? prev.googleScopes : { gmail: true, calendar: true, drive: true, contacts: true, tasks: true },
          // ITEM 10 — Google access tokens last ~1hr; recording when we
          // captured this one lets sendViaGmail check expiry proactively
          // (see lib/messaging.ts) instead of only discovering it's stale
          // after a 401.
          ...(providerToken ? { googleProviderToken: providerToken, googleTokenExpiresAt: Date.now() + 55 * 60 * 1000 } : {}),
          ...(bridgedRefreshToken ? { googleRefreshToken: bridgedRefreshToken } : {}),
        };
        // Only the refresh_token is truly irreplaceable (a one-time value) —
        // that's the one worth an immediate out-of-band write.
        if (bridgedRefreshToken && ownerId) persistGoogleTokensNow(ownerId, tokenPatch);
        return { ...prev, ...tokenPatch };
      });
    };

    (async () => {
      // Everything below must never leave setSessionChecked(false) permanently —
      // a thrown error here (a flaky network request, a Supabase query failing)
      // with no catch would mean the app is stuck on the full-screen loading
      // state forever, since nothing else can render until sessionChecked is true.
      try {
        // Capture now — Supabase may clear the hash before getSession() resolves
        const isOAuthCallback = window.location.hash.includes("access_token");

        // Subscribe first so we catch SIGNED_IN from detectSessionInUrl processing the hash.
        // The hash-sync effect is guarded to return early while access_token is in the hash,
        // so Supabase can read and process the token before the router overwrites it.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          try {
            // The client portal (#/client) signs in with the same shared Supabase auth
            // client but manages its own session locally — it must never let this
            // top-level listener reclassify a customer as an owner/employee and bounce
            // them into the CRM or employee portal.
            if (window.location.hash.replace(/^#\/?/, "").startsWith("client")) return;

            if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
              console.log("[GoogleConnect] onAuthStateChange —", event, "· has provider_token on session:", !!(session as any)?.provider_token);
            }

            if (event === "SIGNED_OUT") {
              setEmpSession(null);
              setHasCrmSession(false);
              setLastOwnerSessionFlag(false);
              setCrmUserId("");
              setLastOwnerId("");
              setCrmRole("owner");
              setOauthProcessing(false);
              return;
            }

            // Supabase rotates the access token in the background roughly every
            // hour; when it includes a fresh Google provider_token, capture it so
            // sendEmail()'s Gmail path uses the current token on the very next
            // send instead of only discovering it's stale after a 401.
            //
            // BUG FIX (Google accounts mixed up, round 2) — this used to write
            // straight to settings.googleProviderToken (the OWNER's shared
            // slot) with NO check on whose session was actually being
            // refreshed. onAuthStateChange fires for whatever session is
            // CURRENTLY ACTIVE in this browser tab — there is exactly one
            // Supabase Auth session per tab, shared by the whole app — so if
            // an EMPLOYEE happened to be the signed-in session when Supabase's
            // background refresh cycle fired (e.g. the same device/browser
            // was also used to sign into the employee portal), this
            // unconditionally overwrote the owner's Gmail/Calendar/Workspace
            // connection with the employee's token. This was the actual root
            // cause surviving the earlier OAuth-callback bridge fix (that fix
            // only gated the ONE-TIME connect flow, not this recurring
            // ~hourly background refresh). Now routed by the session's real
            // role, same as every other branch below.
            if (event === "TOKEN_REFRESHED") {
              const freshProviderToken = (session as any)?.provider_token;
              if (freshProviderToken) {
                const { role: refreshRole } = await resolveUserRole(session);
                if (refreshRole === "employee") {
                  console.log("[GoogleConnect] TOKEN_REFRESHED — active session is an EMPLOYEE — updating employees.google_token only, owner's settings.googleProviderToken left untouched");
                  persistEmployeeGoogleToken(session);
                } else {
                  console.log("[GoogleConnect] TOKEN_REFRESHED — active session is the OWNER/manager — updating settings.googleProviderToken");
                  setSettings((prev: any) => ({ ...prev, googleProviderToken: freshProviderToken, googleTokenExpiresAt: Date.now() + 55 * 60 * 1000 }));
                }
              }
              return;
            }

            // FIX 12 (mobile round 6) — INITIAL_SESSION used to fall through to
            // the exact same resolveUserRole() + state-setting logic the manual
            // getSession()/resolveUserRole(initial) block below also runs for
            // the very same session on every load — doubling the role-lookup
            // network cost (up to 2 sequential Postgrest queries each) and a
            // real contributor to "Session bootstrap exceeded 5s" firing on
            // every load rather than only during genuine hangs. The block
            // below already handles routing/state for the initial session;
            // this listener only needs to unblock the OAuth-processing flag.
            if (event === "INITIAL_SESSION") {
              setOauthProcessing(false);
              return;
            }

            const { role: userRole, ownerId: resolvedOwnerId } = await resolveUserRole(session);

            if (userRole === "employee") {
              // Force the hash to #/portal immediately too — belt-and-suspenders so the
              // URL itself never points at a CRM route while this resolves.
              if (!window.location.hash.startsWith("#/portal")) window.location.hash = "/portal";
              setEmpSession(session);
              setPage("portal");
              setOauthProcessing(false);
              persistEmployeeGoogleToken(session);
              // BUG FIX — "employees receive notifications like 'Fred checked
              // in,' which they shouldn't get." hasCrmSession's initial state
              // is OPTIMISTICALLY seeded from a stale "was an owner logged in
              // on this device before" localStorage flag (see
              // getLastOwnerSessionFlag above) — this employee branch never
              // explicitly cleared it, so on any device that had ever also
              // had the owner logged in (or the flag was simply stale from a
              // prior session), every hasCrmSession-gated effect (crew
              // activity toasts/desktop notifications, invoice-activity
              // diffing, etc.) kept running in the background on the
              // EMPLOYEE'S OWN session, firing owner-only notifications at
              // them. An employee session must always force this false.
              setHasCrmSession(false);
              setLastOwnerSessionFlag(false);
              // BUG FIX — this branch returned without ever setting crmUserId,
              // the tenant id refetchEmployees()/refetchData() and the
              // realtime subscription (both further down, both filtered by
              // `owner_id=eq.${crmUserId}`) actually query by. It was only
              // ever set on the owner/manager branch below, so an employee
              // session ran with whatever crmUserId happened to be cached
              // from getLastOwnerId() at mount — empty on a device that's
              // never had an owner log in, or stale/wrong otherwise. Either
              // way, the employees-table realtime subscription silently
              // matched zero rows and refetchEmployees() queried the wrong
              // owner, which is exactly what "clocked in on one device,
              // other device still shows not clocked in" looks like — no
              // error, just permanently stale employee data.
              if (resolvedOwnerId) { setCrmUserId(resolvedOwnerId); setLastOwnerId(resolvedOwnerId); }
              return;
            }

            // Owner / manager path — both get the CRM, crmRole drives Settings restrictions.
            // The explicit false branch matters: hasCrmSession's initial state is
            // optimistically seeded from a cached "was logged in last time" flag (see
            // below) so a returning owner skips straight to the dashboard instead of
            // flashing the login form — but that means a confirmed-absent session
            // must actively clear it, or a stale/expired cached flag would leave the
            // CRM shell rendered with no real session backing it.
            if (session) { setHasCrmSession(true); setLastOwnerSessionFlag(true); }
            else { setHasCrmSession(false); setLastOwnerSessionFlag(false); }
            setCrmRole(userRole === "manager" ? "manager" : "owner");
            if (session?.user?.email) setCrmUserEmail(session.user.email);
            if (session?.user?.id) { setCrmUserId(resolvedOwnerId || session.user.id); setLastOwnerId(resolvedOwnerId || session.user.id); }
            applyGoogleIdentity(session, resolvedOwnerId || session?.user?.id);

            if (event === "SIGNED_IN" || (event as string) === "IDENTITY_LINKED") {
              const isGoogle = (session?.user?.identities || []).some((i: any) => i.provider === "google");
              if (isGoogle) {
                setPage("google");
              } else {
                // Email/password owner sign-in → go to CRM dashboard. Layout
                // (mobile bottom-nav vs. desktop sidebar) is decided by actual
                // screen width, not forced here — a phone should still get
                // the mobile layout after signing in.
                setPage("dashboard");
              }
              setOauthProcessing(false);
            }
          } catch (err) {
            console.error("onAuthStateChange handler failed:", err);
            setOauthProcessing(false);
          }
        });
        sub = subscription;

        // Resolve current session and determine owner vs employee — skipped entirely
        // on the client portal route for the same reason as the listener guard above.
        if (window.location.hash.replace(/^#\/?/, "").startsWith("client")) {
          setSessionChecked(true);
          bootstrapDone = true;
          clearTimeout(forceRenderTimer);
          return;
        }
        const { data: { session: initial } } = await supabase.auth.getSession();
        const initIsGoogle = (initial?.user?.identities || []).some((i: any) => i.provider === "google");
        const { role: initRole, ownerId: initOwnerId } = await resolveUserRole(initial);
        if (initial && initRole === "employee") {
          if (!window.location.hash.startsWith("#/portal")) window.location.hash = "/portal";
          setEmpSession(initial);
          setPage("portal");
          setOauthProcessing(false);
          persistEmployeeGoogleToken(initial);
          // Same fix as the onAuthStateChange employee branch above — this
          // is the initial-page-load path (runs once on first mount) and
          // had the identical gap.
          if (initOwnerId) { setCrmUserId(initOwnerId); setLastOwnerId(initOwnerId); }
          // BUG FIX — same stale-flag issue as the onAuthStateChange employee
          // branch: hasCrmSession's optimistic initial state must be forced
          // false for a real employee session, or a stale "owner was
          // logged in on this device before" flag lets every CRM-only
          // effect (crew-activity notifications, etc.) keep running here.
          setHasCrmSession(false);
          setLastOwnerSessionFlag(false);
        } else {
          if (initial) { setHasCrmSession(true); setLastOwnerSessionFlag(true); }
          else { setHasCrmSession(false); setLastOwnerSessionFlag(false); }
          setCrmRole(initRole === "manager" ? "manager" : "owner");
          if (initial?.user?.id) { setCrmUserId(initOwnerId || initial.user.id); setLastOwnerId(initOwnerId || initial.user.id); }
          applyGoogleIdentity(initial, initOwnerId || initial?.user?.id);
          if (isOAuthCallback && initIsGoogle) {
            setPage("google");
            setOauthProcessing(false);
          }
          // Existing email/password owner session — ensure not stuck on portal
          // (layout itself still follows real screen width, see isMobile above)
          if (initial && !initIsGoogle) {
            setPage(prev => prev === "portal" ? "dashboard" : prev);
          }
        }

        // Load employees + jobs + customers from Supabase on initial load
        refetchEmployees();
        refetchData();
      } catch (err) {
        console.error("Session bootstrap failed — falling back to login screen:", err);
      } finally {
        // Session check complete — safe to render main app or employee portal.
        // Always runs, even if something above threw, so the app never gets
        // stuck on the loading screen.
        bootstrapDone = true;
        clearTimeout(forceRenderTimer);
        setSessionChecked(true);
      }
    })();

    return () => {
      clearTimeout(forceRenderTimer);
      sub?.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch real weather when OWM key is set — FIX 12: location comes from
  // Settings → Company (zip or "City, ST"), defaulting to York, PA only if
  // the owner hasn't set one.
  // BLOCKER 12 (mobile round 9) — two real bugs: (1) this only ever fetched
  // once, whenever the key/location setting itself changed, so a session
  // left open across the day kept showing whatever the temperature was at
  // load time (e.g. a cool morning fetch still showing "72°" at a 94° mid-
  // afternoon); (2) `.catch(() => {})` swallowed every failure completely
  // silently — an invalid key, a rate limit, or a location string OWM can't
  // geocode all fell back to seedWeather with zero visible sign anything
  // was wrong, making "weather shows fake data" indistinguishable from "no
  // key configured yet" when debugging a live deployment.
  useEffect(() => {
    if (!settings.owmKey) { setWeatherData(null); setWeatherFetchError(null); return; }
    const run = () => {
      // BUG FIX — an owner who never filled in the dedicated "Weather
      // Location" field (most owners, since it's easy to miss) silently got
      // York, PA's weather regardless of where their business actually is —
      // deriveWeatherLocation falls back to parsing the owner's own company
      // address before ever reaching that hardcoded default.
      fetchRealWeather(settings.owmKey, deriveWeatherLocation((settings as any).weatherLocation, (settings as any).companyAddress))
        .then(w => { console.log("[Weather] refreshed —", w.current.temp + "°,", w.current.description); setWeatherData(w); setWeatherFetchError(null); })
        .catch((e: any) => {
          const msg = e?.message || String(e);
          console.error("[Weather] fetch failed:", msg);
          setWeatherFetchError(msg);
          // Deliberately NOT falling back to seedWeather here — showing last
          // known REAL data (if any) is fine, but fake seed data disguised as
          // real is exactly what this fix is required to eliminate.
        });
    };
    run();
    const interval = setInterval(run, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [settings.owmKey, (settings as any).weatherLocation]);

  // "Tomorrow's Jobs" crew email — there's no server cron in a client-only app,
  // so this checks once on load and hourly thereafter: if it's 6pm or later and
  // today's batch hasn't gone out yet (deduped via localStorage by date), send
  // each employee with a job tomorrow their schedule. Only fires while someone
  // has the app open on or after 6pm — a real limitation of having no backend.
  useEffect(() => {
    const checkAndSendTomorrowJobs = async () => {
      if (new Date().getHours() < 18) return;
      const dedupeKey = "smocks.tomorrowJobsSent." + today();
      if (localStorage.getItem(dedupeKey)) return;
      const tomorrow = daysFromNow(1);
      const tomorrowJobs = jobs.filter(j => j.scheduledDate === tomorrow && j.status !== "cancelled");
      if (tomorrowJobs.length === 0) { localStorage.setItem(dedupeKey, "1"); return; }
      const byEmployee = new Map<string, typeof tomorrowJobs>();
      tomorrowJobs.forEach(j => {
        (j.crew || []).forEach((empId: any) => {
          const list = byEmployee.get(empId) || [];
          list.push(j);
          byEmployee.set(empId, list);
        });
      });
      for (const [empId, empJobs] of byEmployee) {
        const emp = employees.find(e => e.id === empId);
        if (!emp?.email) continue;
        const jobsList = empJobs.map(j => ({
          job: j,
          custName: (() => { const c = customers.find(x => x.id === j.customerId); return c ? `${c.firstName} ${c.lastName}` : ""; })(),
        }));
        const html = buildTomorrowJobsEmailHtml(settings as any, emp.firstName, jobsList);
        try { await sendEmail(settings as any, emp.email, "Tomorrow's Jobs", html); } catch { /* best-effort */ }
      }
      localStorage.setItem(dedupeKey, "1");
    };
    checkAndSendTomorrowJobs();
    const interval = setInterval(checkAndSendTomorrowJobs, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [jobs, employees, customers, settings]);

  // FEATURE — "employees should see who else is working with them on each
  // job. Weekly email with schedule, crew, and 'View your schedule' button."
  // Same no-backend-cron pattern as the tomorrow's-jobs email above: checks
  // once on load and hourly, fires once Sunday afternoon (so it's ready
  // before the work week), deduped per calendar week via localStorage.
  useEffect(() => {
    const checkAndSendWeeklySchedule = async () => {
      const now = new Date();
      if (now.getDay() !== 0 || now.getHours() < 15) return; // Sunday, 3pm+
      const weekKey = "smocks.weeklyScheduleSent." + localDateKey(now);
      if (localStorage.getItem(weekKey)) return;
      const weekDates = new Set(Array.from({ length: 7 }, (_, i) => daysFromNow(i + 1)));
      const weekJobs = jobs.filter(j => weekDates.has(j.scheduledDate) && j.status !== "cancelled");
      if (weekJobs.length === 0) { localStorage.setItem(weekKey, "1"); return; }
      const byEmployee = new Map<string, typeof weekJobs>();
      weekJobs.forEach(j => {
        (j.crew || []).forEach((empId: any) => {
          const id = typeof empId === "string" ? empId : empId?.id;
          if (!id) return;
          const list = byEmployee.get(id) || [];
          list.push(j);
          byEmployee.set(id, list);
        });
      });
      const portalUrl = `${window.location.origin}${window.location.pathname}#/portal`;
      for (const [empId, empJobs] of byEmployee) {
        const emp = employees.find(e => e.id === empId);
        if (!emp?.email) continue;
        const jobsList = empJobs
          .sort((a, b) => (a.scheduledDate + (a.scheduledTime || "")).localeCompare(b.scheduledDate + (b.scheduledTime || "")))
          .map(j => {
            const cust = customers.find(x => x.id === j.customerId);
            const crewNames = (j.crew || [])
              .map((c: any) => (typeof c === "string" ? c : c?.id))
              .filter((id: string) => id && id !== empId)
              .map((id: string) => { const e2 = employees.find(x => x.id === id); return e2 ? `${e2.firstName} ${e2.lastName}`.trim() : null; })
              .filter(Boolean) as string[];
            return { job: j, custName: cust ? `${cust.firstName} ${cust.lastName}` : "", crewNames };
          });
        const html = buildWeeklyScheduleEmailHtml(settings as any, emp.firstName, jobsList, portalUrl);
        try { await sendEmail(settings as any, emp.email, "Your Week Ahead", html); } catch { /* best-effort */ }
      }
      localStorage.setItem(weekKey, "1");
    };
    checkAndSendWeeklySchedule();
    const interval = setInterval(checkAndSendWeeklySchedule, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [jobs, employees, customers, settings]);

  // Manually triggered by the owner from the Dashboard — emails the owner a
  // same-day performance summary on demand, using the same template the
  // (currently unimplemented) automatic end-of-day send would use.
  const sendDailyBriefingNow = async () => {
    const tKey = today();
    const todaysJobs = jobs.filter(j => j.scheduledDate === tKey);
    const completed = todaysJobs.filter(j => j.status === "completed");
    const revenue = completed.reduce((s, j) => s + (Number(j.amount) || 0), 0);
    const profit = completed.reduce((s, j: any) => {
      const cost = (Number(j.laborCost) || 0) + (Number(j.materialCost) || 0) + ((j.chemicalsUsed || []).reduce((s2: number, ch: any) => s2 + (Number(ch.cost) || 0), 0));
      return s + ((Number(j.amount) || 0) - cost);
    }, 0);
    const late = todaysJobs.filter(j => {
      if (!j.clockInAt || !j.scheduledTime) return false;
      const scheduled = new Date(`${j.scheduledDate}T${j.scheduledTime}:00`).getTime();
      return (j.clockInAt - scheduled) / 60000 > 15;
    }).length;
    const issues = todaysJobs.flatMap(j => (j.commLog || []).filter((e: any) => e.type === "note" && (e.date || "").startsWith(tKey))).length;
    const jobRows = todaysJobs.map(j => {
      const c = customers.find((x: any) => x.id === j.customerId);
      return { customerName: c ? `${c.firstName || ""} ${c.lastName || ""}`.trim() : (j.address || "Job"), address: j.address, amount: Number(j.amount) || 0, status: j.status || "scheduled" };
    });
    const origin = `${window.location.origin}${window.location.pathname}`;
    const actionButtons = [{ label: "View Today's Jobs", href: `${origin}#/jobs` }, { label: "Open Dashboard", href: `${origin}#/` }];
    const html = buildDailyBriefingEmailHtml(settings as any, { completed: completed.length, total: todaysJobs.length, revenue, profit, late, issues }, jobRows, actionButtons);
    const toEmail = settings.companyEmail || settings.myEmail;
    if (!toEmail) { toast("Add a business email in Settings → My Profile first", "yellow"); return; }
    try {
      await sendEmail(settings as any, toEmail, "Daily Briefing", html);
      toast("Daily briefing sent ✓");
    } catch (e: any) {
      toast(e.message || "Failed to send daily briefing", "red");
    }
  };

  // Automation engine — batch-approval gate (automation spam guardrail):
  // every tick gathers candidates but never sends; the owner explicitly
  // approves each batch via AutomationBatchModal, rendered below.
  const { pendingBatch: pendingAutomationBatch, approveBatch: approveAutomationBatch, skipBatch: skipAutomationBatch } =
    useAutomationEngine({ automations, setAutomations, jobs, customers, estimates, referrals, employees, goals: goalsList, settings, setSettings, toast });

  // Scheduled-campaign executor — see useScheduledCampaigns.ts. Fires
  // regardless of which page is open, same reasoning as the automation
  // engine above.
  useScheduledCampaigns({ campaigns, setCampaigns, customers, settings, toast });

  // Sign out — clears Supabase session and forces login page.
  // signOut() defaults to scope: "global", which revokes the refresh token
  // server-side and signs the account out of EVERY device, not just this
  // one — that's what made signing out on one device log out the other.
  // scope: "local" only clears this browser's session.
  // BUG FIX — this had NO timeout and no try/catch. If Supabase's own
  // signOut() call hung (network blip, degraded project — see
  // supabaseDegraded elsewhere in this file, a real recurring condition for
  // this deployment) or threw, none of the state clears below ever ran —
  // the button just did nothing forever with zero feedback, exactly
  // matching "I press sign out and nothing happens." Clearing local state
  // is what actually gets the user back to the login screen; it no longer
  // waits on (or gets blocked by) the network call succeeding.
  // BUG FIX — "sign out is unresponsive on mobile." Two real gaps: (1) the
  // button gave zero visible feedback while the 5s signOut timeout ran, so
  // a tap that actually worked still LOOKED like nothing happened for up to
  // 5 seconds on a slow mobile connection; (2) the hash was never reset, so
  // if the owner signed out while on e.g. #/employees, the hashchange
  // listener could re-navigate `page` back to that same authenticated route
  // a beat later. try/finally guarantees local state always clears even if
  // signOut itself throws synchronously for some reason.
  const [signingOut, setSigningOut] = useState(false);
  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    toast?.("Signing out…");
    try {
      await withTimeout(supabase.auth.signOut({ scope: "local" }), 5000, "Sign out");
    } catch (e: any) {
      console.warn("[SignOut] server sign-out failed/timed out — clearing local session anyway:", e?.message);
    } finally {
      setSettings((prev: any) => ({
        ...prev,
        googleConnected: false,
        googleEmail: "",
        googleProviderToken: "",
        googleRefreshToken: "",
      }));
      setCrmUserEmail("");
      setHasCrmSession(false);
      setLastOwnerSessionFlag(false);
      setProfileDropOpen(false);
      setSidebarOpen(false);
      window.location.hash = "";
      setSigningOut(false);
    }
  };

  // No OAuth loading gate either — oauthProcessing still flips false once the
  // callback resolves and routes to the right page, but until then we just
  // render whatever the normal gates below decide (typically the login
  // screen) instead of blocking on a spinner.

  // ── Client portal — fully public route, its own Supabase auth, no PIN/owner gate ──
  if (page === "client") {
    return <ClientAuthPortal customers={customers} setCustomers={setCustomers} estimates={estimates} setEstimates={setEstimates} jobs={jobs} settings={settings} estimateTemplates={estimateTemplates} toast={toast} />;
  }

  // ── Single-estimate portal — fully public, no login. Reached via
  // #/estimate/ID from a "Review & Sign" / "View & Pay Invoice" link. Replaces
  // the old #/portal/ID links, which pointed at the EMPLOYEE portal's own
  // route and left a real customer stranded on an employee login screen
  // (see FIX 17 / FIX 20). Renders the same ClientPortal used for the owner's
  // internal preview button, wired to write approve/decline straight to
  // Supabase — this visitor has no CRM session for the App-level state
  // setters to mean anything beyond this one render.
  // Reads AND writes for this anonymous route both go through
  // /api/public-data (service role, bypasses RLS) — see approve_estimate/
  // decline_estimate there. A direct anon-client write here would be
  // rejected by the new owner_id-scoped WITH CHECK policies, since an
  // anonymous visitor has no owner_id-satisfying session.
  if (page === "estimate") {
    const est = publicEstimate?.estimate;
    const estCust = publicEstimate?.customer;
    // publicEstimateLoading distinguishes "still fetching" from "fetched and
    // truly not found" (expired/bad link) — both render the same message
    // today, but keeping the flag around in case that copy needs to diverge.
    if (!est) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center text-white/50 text-sm p-4 text-center">
          {publicEstimateLoading
            ? "Loading your estimate…"
            : <>Loading your estimate… if this doesn't load in a few seconds, the link may have expired — contact {publicEstimate?.settings?.companyName || settings.companyName || "the business"} for a new one.</>}
        </div>
      );
    }
    return (
      <ClientPortal
        estimate={est}
        customer={estCust}
        jobs={jobs}
        invoices={estimates.filter(e => e.invoiced)}
        settings={{ ...settings, ...(publicEstimate?.settings || {}) } as any}
        estimateTemplates={estimateTemplates}
        promotions={promotions}
        customers={customers}
        setCustomers={setCustomers}
        onClose={() => { window.location.hash = "/client"; }}
        onView={id => {
          setEstimates(prev => prev.map(e => e.id === id && !(e as any).clientViewedAt ? { ...e, clientViewedAt: new Date().toISOString() } as any : e));
          fetch("/api/public-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark_estimate_viewed", id }) }).catch(() => {});
        }}
        onApprove={(id, data) => {
          const paid = data.payChoice !== "later";
          setEstimates(prev => prev.map(e => e.id === id ? {
            ...e, status: "approved", signedAt: data.signedAt || e.signedAt, sigData: data.sigData || e.sigData, payChoice: data.payChoice,
            ...(paid ? { paidAt: today() } : {}),
            paidDeposit: data.payType === "deposit" ? data.totalPaid : (e.paidDeposit || 0),
            paidFull: data.payType === "full" ? data.totalPaid : data.payType === "remaining" ? (e.paidDeposit || 0) + data.totalPaid : (e.paidFull || 0),
          } : e));
          const cust = customers.find(c => c.id === est.customerId);
          // FEATURE 4 — combine every linked service's checklist template
          // (instead of always starting the job with an empty checklist).
          // Seeds BOTH job.checklist (legacy, CrewView/JobsPage progress %)
          // AND job.preChecklist (what EmployeePortal's field-portal flow
          // actually renders to the crew — it only falls back to hardcoded
          // defaults when empty).
          const combinedChecklist = buildChecklistFromServices(est.lineItems, services);
          const newJob = {
            id: uid(), customerId: est.customerId, address: cust?.address || "",
            amount: est.total, status: "scheduled", scheduledDate: "", duration: 2,
            priority: "normal", crew: [], checklist: combinedChecklist, preChecklist: combinedChecklist, photos: [], chemicalsUsed: [],
            equipment: [], tags: ["Needs Scheduling"], commLog: [],
            notes: "From approved estimate #" + id.slice(-4).toUpperCase(),
            createdAt: today(), estimateId: id,
          } as any;
          setJobs(prev => prev.some(j => (j as any).estimateId === id) ? prev : [...prev, { ...newJob, owner_id: (est as any).owner_id }]);
          // Anonymous visitor — no owner_id-satisfying session, so this
          // write goes through the service-role approve_estimate action
          // (see functions/api/public-data.ts) rather than the anon client.
          fetch("/api/public-data", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "approve_estimate", id, signedAt: data.signedAt, sigData: data.sigData, payChoice: data.payChoice,
              paid, totalPaid: data.totalPaid, payType: data.payType,
              job: newJob,
            }),
          }).catch(() => {});
          toast(paid ? "✓ Paid — " + fmt(data.totalPaid) : "✓ Signed — you'll pay later");
        }}
        onDecline={async (id: string, data: { reason?: string; category?: string }) => {
          const declinedAt = new Date().toISOString();
          setEstimates(prev => prev.map(e => e.id === id ? { ...e, status: "rejected", declinedAt, declineReason: data.reason || "", declineReasonCategory: data.category || "" } as any : e));
          try {
            await fetch("/api/public-data", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "decline_estimate", id, reason: data.reason || "", category: data.category || "" }),
            });
          } catch { /* ignore */ }
        }}
      />
    );
  }

  // ── Referral landing — fully public, no auth/PIN gate. Handles both
  // #/referral?ref=CODE and the shorthand #/r/CODE.
  if (page === "referral") {
    return <ReferralLanding customers={customers} setCustomers={setCustomers} settings={settings} toast={toast} />;
  }

  // ── Customer review landing — public route, no auth.
  // URL: #/rate?c=CUSTOMER_ID&n=FIRST_NAME&g=GOOGLE_PLACE_ID&co=COMPANY_NAME
  if (page === "rate") {
    return <CustomerReviewPage />;
  }

  // ── Public lead intake form — no auth, embeddable via iframe. See
  // LeadFormPage.tsx and LeadIntakePage.tsx's "Get Embed Code".
  // URL: #/lead-form?co=COMPANY_NAME&ph=COMPANY_PHONE
  if (page === "lead-form") {
    return <LeadFormPage />;
  }

  // ── Public Trash Can Cleaning signup — no auth. See TrashCanSignupPage.tsx.
  // URL: #/trash-cans?co=...&ph=...&cost=...&min=...&freq=...&pk=...
  if (page === "trash-cans") {
    return <TrashCanSignupPage />;
  }

  // ── Public job application form — no auth. See ApplyPage.tsx and
  // HiringPage.tsx's "Apply Link". URL: #/apply?oid=OWNER_ID&co=COMPANY_NAME
  if (page === "apply") {
    return <ApplyPage />;
  }

  // ── Public legal pages — no auth, required as live HTTPS links for Twilio
  // A2P 10DLC campaign registration. See LegalPages.tsx.
  if (page === "terms") {
    return <TermsPage />;
  }
  if (page === "privacy") {
    return <PrivacyPolicyPage />;
  }

  // ── Public marketing/landing page — fully public, no auth/PIN gate ────────
  // Shown at the bare root ("#/", "#/welcome", "#/home") to any visitor with
  // no active session. A returning visitor who still has a session (owner or
  // employee) but somehow lands back on "welcome" (e.g. a stale bookmark,
  // or the hash-sync effect writing "#/welcome" back after login) falls
  // through here and gets redirected to the dashboard/portal by the
  // fallback redirect further down instead of seeing marketing copy.
  // Shared hand-off for every marketing page's nav/footer/CTA — moves between
  // #/welcome, #/features, #/pricing, #/about (and #/login) by setting both
  // the URL hash and this component's `page` state together, same pattern as
  // the pre-existing onGetStarted below.
  const navigateMarketing = (p: "welcome" | "features" | "pricing" | "about" | "login") => {
    window.location.hash = "/" + p;
    setPage(p);
  };
  // FEATURE — "it should ask them to pay first, then create an account."
  // Real Stripe Checkout, started with NO session/account yet — Stripe's
  // own hosted page collects the card, then redirects back to
  // #/signup-complete?session_id=... (see the effect near ownerCompanyName
  // above), which is where an account actually gets created. The
  // hero/footer "Start Free Trial" buttons deliberately keep going through
  // navigateMarketing("login") unchanged — that's the real free-tier
  // signup path, no payment involved at all.
  const [choosingPlan, setChoosingPlan] = useState(false);
  const startPaidSignup = async (plan: string, interval: "month" | "year") => {
    setChoosingPlan(true);
    try {
      const res = await fetch("/api/platform-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_signup_checkout_session",
          plan, interval,
          successUrl: `${window.location.origin}${window.location.pathname}#/signup-complete?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}${window.location.pathname}#/pricing`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) { toast(data.error || "Couldn't start checkout — try again", "red"); setChoosingPlan(false); return; }
      window.location.href = data.url;
    } catch (e: any) {
      toast("Couldn't start checkout — " + (e?.message || "unknown error"), "red");
      setChoosingPlan(false);
    }
  };

  // BUG FIX — "not showing I'm logged in when I go to the landing page" —
  // passed into every marketing page's MarketingNav (isLoggedIn prop) so
  // its CTA reflects reality instead of always saying "Log In."
  const goToDashboardFromMarketing = () => { setMarketingPreview(false); window.location.hash = "/dashboard"; setPage("dashboard"); };

  // `marketingPreview` lets an already-logged-in owner explicitly view
  // these pages (see the flag's own comment above) — everyone else still
  // needs the normal !empSession && !hasCrmSession public-page gate.
  // The little "Back to Dashboard" bar is rendered here, wrapping the page,
  // rather than threaded as a prop into all four marketing page files.
  const previewBar = marketingPreview && hasCrmSession && (
    <div className="fixed top-0 inset-x-0 z-[400] bg-red-700 text-white text-xs font-medium py-2 px-4 flex items-center justify-center gap-3">
      Previewing the marketing site while logged in
      <button onClick={() => { setMarketingPreview(false); window.location.hash = "/dashboard"; setPage("dashboard"); }} className="underline hover:no-underline font-semibold">Back to Dashboard</button>
    </div>
  );
  if (page === "welcome" && (marketingPreview || (!empSession && !hasCrmSession))) {
    return <>{previewBar}<LandingPage onGetStarted={() => navigateMarketing("login")} onNavigate={navigateMarketing} onChoosePlan={startPaidSignup} choosingPlan={choosingPlan} isLoggedIn={hasCrmSession} onGoToDashboard={goToDashboardFromMarketing} /></>;
  }
  // ── Dedicated marketing pages — same public, no-session-required pattern
  // as "welcome" above. See MarketingShared.tsx for the shared nav/footer.
  if (page === "features" && (marketingPreview || (!empSession && !hasCrmSession))) {
    return <>{previewBar}<FeaturesPage onGetStarted={() => navigateMarketing("login")} onNavigate={navigateMarketing} isLoggedIn={hasCrmSession} onGoToDashboard={goToDashboardFromMarketing} /></>;
  }
  if (page === "pricing" && (marketingPreview || (!empSession && !hasCrmSession))) {
    return <>{previewBar}<PricingPage onGetStarted={() => navigateMarketing("login")} onNavigate={navigateMarketing} onChoosePlan={startPaidSignup} choosingPlan={choosingPlan} isLoggedIn={hasCrmSession} onGoToDashboard={goToDashboardFromMarketing} /></>;
  }
  if (page === "about" && (marketingPreview || (!empSession && !hasCrmSession))) {
    return <>{previewBar}<AboutPage onGetStarted={() => navigateMarketing("login")} onNavigate={navigateMarketing} isLoggedIn={hasCrmSession} onGoToDashboard={goToDashboardFromMarketing} /></>;
  }
  // FEATURE — public roadmap (logged-out visitors) — read-only, only shows
  // items the admin has actually scheduled/shipped, no submit/vote (that
  // needs a real CrewBoss account — see the in-app "Feedback" nav item).
  if (page === "roadmap" && (marketingPreview || (!empSession && !hasCrmSession))) {
    return (
      <>
        {previewBar}
        <div className="min-h-screen bg-black text-white">
          <div className="sticky top-0 z-40 backdrop-blur-md bg-black/60 border-b border-white/10 px-4 py-3 flex items-center justify-between">
            <button onClick={() => navigateMarketing("welcome")} className="font-bold text-lg tracking-tight">Crew<span className="text-red-500">Boss</span></button>
            <button onClick={() => navigateMarketing("login")} className="px-4 py-2 rounded-lg bg-gradient-to-br from-red-600 to-red-800 text-sm font-semibold">Start Free Trial</button>
          </div>
          <FeedbackPage publicMode />
        </div>
      </>
    );
  }

  // No top-level loading gate — render immediately with whatever's already
  // in localStorage (jobs/customers/settings load synchronously via
  // usePersistent) rather than blocking on session resolution. The login
  // gate just below already handles the "not authenticated yet" case, and
  // it isn't a spinner — it's the real login form, so there's no flash of
  // a fake loading state, just a (usually sub-second) render of the login
  // screen for an already-authenticated visitor until the session bootstrap
  // confirms their role and flips hasCrmSession/empSession.

  // ── PIN screen ────────────────────────────────────────────────────────────
  if (pinSet && !pinUnlocked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-xs space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center mx-auto shadow-lg">
            <Lock size={28} className="text-white" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">Crew Boss OS</div>
            <div className="text-sm text-white/50 mt-1">Enter your PIN to continue</div>
          </div>
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={"w-4 h-4 rounded-full border-2 transition " + (pinInput.length > i ? "bg-red-500 border-red-500" : "border-white/30")} />
            ))}
          </div>
          {pinError && <div className="text-red-400 text-sm">Incorrect PIN</div>}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k, i) => (
              <button key={i} disabled={k === ""} onClick={() => {
                if (k === "⌫") { setPinInput(p => p.slice(0, -1)); setPinError(false); return; }
                const next = pinInput + k;
                setPinInput(next);
                if (next.length === 4) {
                  if (next === pinSet) { setPinUnlocked(true); setPinInput(""); }
                  else { setPinError(true); setTimeout(() => { setPinInput(""); setPinError(false); }, 800); }
                }
              }} className={"h-14 rounded-xl text-xl font-bold border transition " + (k === "" ? "opacity-0 pointer-events-none" : "bg-white/5 border-white/10 text-white hover:bg-white/10 active:scale-95")}>
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Password reset — full-screen, no auth required ───────────────────────
  if (page === "reset-password") {
    return <ResetPassword />;
  }

  // ── Redirect employees away from CRM pages to their portal ─────────────
  if (empSession && page !== "portal" && page !== "reset-password") {
    // Use a side-effect-free guard: set page on next tick so React doesn't warn
    // about state updates during render
    setTimeout(() => setPage("portal"), 0);
  }

  // ── Redirect an already-signed-in owner off the marketing/login pages ────
  // Reaching this point with page "welcome"/"features"/"pricing"/"about" or
  // "login" means hasCrmSession is already true (each marketing-page return
  // above and the login-gate return below all require !hasCrmSession) — send
  // them on to the real dashboard instead of rendering nothing (none of
  // these are a case in the page switch further down).
  if (hasCrmSession && page === "login") {
    // "login" is never previewable — there's no legitimate reason for an
    // already-authenticated owner to see the login form itself, even in
    // marketingPreview mode (e.g. if they tap the nav's "Log In" button
    // while previewing the marketing site).
    // BUG FIX — setMarketingPreview(false) used to fire synchronously
    // right here, during render, the one place in this whole redirect
    // block that didn't match the setTimeout(...,0) deferral every other
    // "set state in response to a render condition, not a real event"
    // guard in this file already uses (see the identical pattern two
    // blocks up for the employee-portal redirect). Matching that
    // convention here too, deferred together with the page change so
    // they land in the same tick.
    setTimeout(() => { setMarketingPreview(false); setPage("dashboard"); }, 0);
  } else if (hasCrmSession && !marketingPreview && (page === "welcome" || page === "features" || page === "pricing" || page === "about")) {
    setTimeout(() => setPage("dashboard"), 0);
  }

  // BUG FIX — "briefly see the login page for a few seconds even though
  // I'm logged in." #/portal lands on this branch immediately from the URL
  // hash, before the async session bootstrap (supabase.auth.getSession())
  // has actually resolved — empSession is still its initial `null` at that
  // point regardless of whether a real session exists, so EmployeePortal
  // mounted and rendered its logged-out login screen for however long that
  // resolution took, then swapped to the real portal once setEmpSession
  // fired. sessionChecked already exists and flips true the moment that
  // resolution completes either way — it just was never actually read
  // anywhere. Hold on a lightweight loading state instead of mounting the
  // portal at all until we genuinely know one way or the other.
  if (page === "portal" && !empSession && !sessionChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white/50 text-sm p-4 text-center">
        Loading…
      </div>
    );
  }

  // ── Employee portal — takes over when an employee is authenticated ────────
  if (empSession || page === "portal") {
    // CRITICAL FIX (Running Late / OTW — and every other action in the
    // portal — showing NO toast at all) — this is an early return from
    // App's render, entirely separate from the main JSX return further down
    // that owns the `{toasts.map(...)}` overlay (see near the bottom of this
    // component). EmployeePortal only ever received the `toast` FUNCTION as a
    // prop (which correctly appends to this component's `toasts` state) but
    // never had anywhere to actually render that state — every toast call
    // anywhere in the ~5300-line EmployeePortal (Running Late, OTW, Complete
    // Job, checklist toggles, clock in/out failures, all of it) was updating
    // state that nothing ever displayed. Render the identical toast overlay
    // here too so employees on their own devices actually see feedback.
    return (
      <>
        <EmployeePortal
          empSession={empSession}
          setEmpSession={setEmpSession}
          jobs={jobs}
          setJobs={setJobs}
          employees={employees}
          customers={customers}
          setCustomers={setCustomers}
          settings={settings}
          estimates={estimates}
          setEstimates={setEstimates}
          chemicals={chemicals}
          toast={toast}
          // hasCrmSession (a verified, currently-active owner session) is the correct signal
          // here — settings.googleConnected is a sticky per-browser localStorage flag that
          // stays true forever after the owner's first Google sign-in on that machine. Using
          // it meant any employee opening #/portal on a shared/non-incognito browser the
          // owner had used before got shown the owner's stripped-down team-preview stub
          // (OwnerTeamPortal) instead of their own login screen and full portal.
          isOwnerView={!empSession && page === "portal" && !window.location.hash.includes("invite=") && hasCrmSession}
          onClose={() => setPage("dashboard")}
          refetchEmployees={refetchEmployees}
          weatherData={weatherData}
        />
        <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:right-auto z-50 space-y-2 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className={"pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium backdrop-blur animate-fade-in border " + (t.tone === "red" ? "bg-red-950/90 border-red-700/50 text-red-200" : t.tone === "yellow" ? "bg-yellow-950/90 border-yellow-700/50 text-yellow-200" : "bg-black/90 border-green-700/50 text-green-200")}>
              <div className={"w-1.5 h-1.5 rounded-full flex-shrink-0 " + (t.tone === "red" ? "bg-red-400" : t.tone === "yellow" ? "bg-yellow-400" : "bg-green-400")} />
              {t.msg}
            </div>
          ))}
        </div>
      </>
    );
  }

  // ── Login page — shown to any visitor without an active session ──────────
  if (!empSession && !hasCrmSession) {
    const handleGoogleLogin = () => {
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + window.location.pathname,
          // ISSUE 1 (Inbox audit) — this scope list was missing gmail.modify
          // (which implies read access, so it replaces gmail.readonly rather
          // than sitting alongside it). InboxPage.tsx's markGmailRead() calls
          // Gmail's .../modify endpoint to clear the UNREAD label, and
          // fetchGmailMessages() lists/reads inbox messages — neither
          // permission was ever actually granted by this consent screen, so
          // EVERY such call came back 403 "insufficient permission" no
          // matter how fresh the token was — not an expiry problem, a scope
          // problem. Matches GoogleWorkspacePage.tsx/SettingsModal.tsx's own
          // "Connect Google" scope lists (see the same fix there).
          scopes: "email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/drive.readonly",
          // BLOCKER 3 (mobile round 7) — without access_type:"offline", Google
          // only ever hands back an access token (good for ~1h) and no
          // refresh_token, so once it expires the ONLY way to fix "Gmail 401"
          // was a full manual reconnect. prompt:"consent" forces the consent
          // screen even on a returning user, which is required for Google to
          // actually issue a refresh_token on anything but the very first
          // authorization ever — without it, a token that already lost its
          // refresh_token (e.g. from before this fix) would never regain one.
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
    };
    const handleOwnerLogin = async () => {
      if (!ownerEmail.trim() || !ownerPassword.trim()) {
        setOwnerLoginError("Enter email and password"); return;
      }
      setOwnerLoginLoading(true); setOwnerLoginError("");
      let isRegistering = false;
      if (ownerLoginMode === "register") {
        if (ownerPassword.length < 6) { setOwnerLoginError("Password must be at least 6 characters"); setOwnerLoginLoading(false); return; }
        const { error: signUpErr } = await supabase.auth.signUp({
          email: ownerEmail.trim(),
          password: ownerPassword,
          options: { data: { role: "owner", fullName: ownerFullName.trim(), companyName: ownerCompanyName.trim() || "My Company" } },
        });
        if (signUpErr) { setOwnerLoginError(signUpErr.message); setOwnerLoginLoading(false); return; }
        if (ownerCompanyName.trim()) {
          setSettings((prev: any) => ({ ...prev, companyName: ownerCompanyName.trim() }));
        }
        if (ownerFullName.trim()) {
          setSettings((prev: any) => ({ ...prev, ownerName: ownerFullName.trim() }));
        }
        setSettings((prev: any) => ({ ...prev, onboardingComplete: false }));
        isRegistering = true;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email: ownerEmail.trim(), password: ownerPassword });
      setOwnerLoginLoading(false);
      if (error) { setOwnerLoginError(error.message); return; }
      // FEATURE — "let people sign up and pay for CrewBoss" / "it should
      // ask them to pay first, then create an account." Two mutually
      // exclusive paths for a brand-new registration: if this account was
      // just created off a verified Stripe payment (pendingCheckoutSession,
      // see the effect above), record that REAL paid subscription — never
      // the free trial. Otherwise (the ordinary free signup, still fully
      // supported — this is the actual "free but limited" tier entry
      // point), start the free trial exactly as before.
      if (isRegistering && data?.session?.access_token) {
        if (pendingCheckoutSession?.status === "ready") {
          fetch("/api/platform-billing", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
            body: JSON.stringify({ action: "complete_signup", sessionId: pendingCheckoutSession.sessionId }),
          }).catch((e: any) => console.warn("[PlatformBilling] complete_signup failed:", e?.message));
        } else {
          fetch("/api/platform-billing", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
            body: JSON.stringify({ action: "start_trial" }),
          }).catch((e: any) => console.warn("[PlatformBilling] start_trial failed:", e?.message));
        }
      }
      // FIX 5 (round 2) — this used to also insert an employee row for the
      // owner right here, using snake_case columns (user_id/first_name/
      // last_name/hourly_rate) and a random default id, instead of the
      // camelCase columns + owner_<email> id convention every other place in
      // the app (crew dropdowns, Live Crew View, JobDetailModal) expects.
      // That insert almost certainly failed against the real schema and was
      // swallowed by a bare .catch(() => {}) with no logging — silently
      // doing nothing. The "FIX 5" effect above (keyed on crmUserId) already
      // creates the correctly-shaped row once the session resolves post
      // sign-in, so this divergent duplicate is just removed rather than
      // fixed in place.
      // onAuthStateChange handles the rest of the routing from here.
    };
    const handleForgotPassword = async () => {
      if (!ownerEmail.trim()) { setOwnerLoginError("Enter your email first, then tap \"Forgot password?\""); toast("Enter your email first", "yellow"); return; }
      setOwnerLoginLoading(true); setOwnerLoginError("");
      const { error } = await supabase.auth.resetPasswordForEmail(ownerEmail.trim(), {
        redirectTo: window.location.origin + window.location.pathname + "#/reset-password",
      });
      setOwnerLoginLoading(false);
      if (error) console.error("[Forgot Password] — error:", error.message);
      toast(error ? "Couldn't send reset email — " + error.message : "Check your email for the reset link ✓", error ? "red" : "green");
    };
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-sm flex flex-col items-center gap-6 py-8">
          <div className="text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-red-900/50">
              <CrewBossMark className="w-11 h-11" />
            </div>
            <div className="text-2xl font-bold tracking-tight">CrewBoss</div>
            <div className="text-sm text-white/40 mt-1">{settings.companyName || "Business Management"}</div>
          </div>

          <div className="w-full flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
            <button className="flex-1 py-2 rounded-lg text-xs font-medium bg-red-600/30 border border-red-500/40 text-white transition">
              Owner / Manager
            </button>
            <button onClick={() => setPage("portal")} className="flex-1 py-2 rounded-lg text-xs font-medium text-white/40 hover:text-white/70 transition">
              Employee Portal
            </button>
          </div>

          {pendingCheckoutSession?.status === "verifying" && (
            <div className="w-full p-4 rounded-2xl bg-green-950/20 border border-green-700/40 text-center text-sm text-green-300 flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-green-400/40 border-t-green-400 rounded-full animate-spin" />
              Confirming your payment…
            </div>
          )}
          {pendingCheckoutSession?.status === "error" && (
            <div className="w-full p-4 rounded-2xl bg-red-950/30 border border-red-700/40 text-center text-sm text-red-300">{pendingCheckoutSession.message}</div>
          )}
          {pendingCheckoutSession?.status === "ready" && (
            <div className="w-full p-4 rounded-2xl bg-green-950/20 border border-green-700/40 text-center">
              <div className="text-sm font-semibold text-green-300">✓ Payment received — {pendingCheckoutSession.plan ? pendingCheckoutSession.plan[0].toUpperCase() + pendingCheckoutSession.plan.slice(1) : "your"} plan, billed {pendingCheckoutSession.interval === "year" ? "annually" : "monthly"}</div>
              <div className="text-xs text-green-400/70 mt-1">Create your account below to finish setting up.</div>
            </div>
          )}

          <div className="w-full space-y-3">
            {/* Email/password owner login */}
            <div className="space-y-2.5">
              {ownerLoginMode === "register" && (
                <>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Full Name</label>
                    <input
                      type="text" value={ownerFullName} onChange={e => setOwnerFullName(e.target.value)}
                      placeholder="Will Smock"
                      className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3.5 text-base text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Company Name</label>
                    <input
                      type="text" value={ownerCompanyName} onChange={e => setOwnerCompanyName(e.target.value)}
                      placeholder="Crew Boss"
                      className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3.5 text-base text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs text-white/50 mb-1 block">Email</label>
                <input
                  type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleOwnerLogin()}
                  placeholder="owner@example.com"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3.5 text-base text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Password</label>
                <div className="relative">
                  <input
                    type={showOwnerPassword ? "text" : "password"} value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleOwnerLogin()}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3.5 pr-12 text-base text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOwnerPassword(s => !s)}
                    aria-label={showOwnerPassword ? "Hide password" : "Show password"}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-white/40 hover:text-white/80"
                  >
                    {showOwnerPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {ownerLoginMode === "login" && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-right w-full text-sm text-white/40 hover:text-white/70 transition py-1 -mt-1"
                >
                  Forgot password?
                </button>
              )}
              {ownerLoginError && (
                <div className="p-3 bg-red-950/40 border border-red-700/40 rounded-xl text-sm text-red-300">{ownerLoginError}</div>
              )}
              <button
                onClick={handleOwnerLogin}
                disabled={ownerLoginLoading}
                className="w-full min-h-[52px] py-4 rounded-2xl bg-gradient-to-r from-red-600 to-red-800 text-white font-semibold text-base hover:from-red-500 hover:to-red-700 active:scale-95 transition-all disabled:opacity-50"
              >
                {ownerLoginLoading ? "Please wait…" : ownerLoginMode === "login" ? "Sign In" : "Create Owner Account"}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-white/30">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Google Sign-In */}
            <button
              onClick={handleGoogleLogin}
              className="w-full min-h-[52px] flex items-center justify-center gap-3 py-4 rounded-2xl bg-white text-gray-900 font-semibold text-base shadow-lg hover:bg-gray-50 active:scale-95 transition-all"
            >
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign in with Google
            </button>

            <button
              onClick={() => { setOwnerLoginMode(m => m === "login" ? "register" : "login"); setOwnerLoginError(""); }}
              className="w-full min-h-[44px] text-center text-sm text-white/40 hover:text-white/70 transition py-2"
            >
              {ownerLoginMode === "login" ? "Create account" : "← Back to sign in"}
            </button>

          </div>

          <button
            onClick={() => setMobileViewForced(isMobile ? "desktop" : "mobile")}
            className="text-xs text-white/20 hover:text-white/50 transition py-2"
          >
            Switch to {isMobile ? "desktop" : "mobile"} view
          </button>
        </div>
      </div>
    );
  }

  // ── Owner onboarding — only for brand-new registrations (onboardingComplete
  // is explicitly false, set at signup); pre-existing accounts have it
  // undefined and skip straight to the main app. Re-openable from
  // Settings → Onboarding, which also flips it back to false.
  if (settings.onboardingComplete === false) {
    return (
      <OnboardingFlow
        settings={settings}
        setSettings={setSettings}
        setCustomers={setCustomers}
        services={services}
        setServices={setServices}
        toast={toast}
        onFinish={() => setPage("dashboard")}
      />
    );
  }

  // ── Manager CRM permission gating (FIX 8) ──────────────────────────────────
  // Managers get full CRM access by default EXCEPT Alfred/Inbox/Accountability/
  // Google Workspace, which stay hidden unless the owner explicitly grants them
  // via Employees → Edit → Manager CRM Access. Owners are never restricted.
  const MANAGER_RESTRICTED_PAGE_IDS = ["alfred", "inbox", "accountability", "google"];
  const currentManagerEmp = crmRole === "manager"
    ? employees.find((e: any) => (e.user_id && e.user_id === crmUserId) || (e.email && crmUserEmail && e.email.toLowerCase() === crmUserEmail.toLowerCase()))
    : null;
  const managerCrmPerms: Record<string, boolean> = (currentManagerEmp as any)?.managerPermissions || {};
  const managerBlocked = (id: string) => crmRole === "manager" && MANAGER_RESTRICTED_PAGE_IDS.includes(id) && !managerCrmPerms[id];
  // FEATURE — Alfred Cockpit: an in-app place to report bugs/ideas and
  // track them kanban-style, gated to the owner's own personal email only
  // (not managers, not any other owner account this deployment might ever
  // have) since it's a direct line to the developer, not a CRM feature.
  const isCockpitOwner = crmUserEmail?.toLowerCase() === "smockspressurewash@gmail.com";
  // FEATURE — public feedback/roadmap board, visible to every signed-in
  // CrewBoss owner (any business, not just this one) — a real "Feedback"
  // nav item, not gated like Alfred Cockpit above (that one's a private
  // line to the developer; this is the product's own public board).
  const navGroupsWithFeedback = navGroups.map(g => g.label === "Main" ? { ...g, items: [...g.items, { id: "feedback", label: "Feedback", icon: MessageSquare }] } : g);
  const visibleNavGroups = (isCockpitOwner
    ? [...navGroupsWithFeedback, { label: "Developer", items: [{ id: "cockpit", label: "Alfred Cockpit", icon: LayoutGrid }] }]
    : navGroupsWithFeedback
  )
    .map(g => ({ ...g, items: g.items.filter(item => !managerBlocked(item.id)) }))
    .filter(g => g.items.length > 0);
  const RestrictedNotice = ({ label }: { label: string }) => (
    <div className="flex flex-col items-center justify-center text-center py-24 text-white/40">
      <Lock size={32} className="mb-3 opacity-40" />
      <div className="font-semibold text-white/60 mb-1">Access Restricted</div>
      <div className="text-sm max-w-xs">Your manager account doesn't have access to {label}. Ask the owner to grant it in Employees → Manager CRM Access.</div>
    </div>
  );

  // ── Main app ──────────────────────────────────────────────────────────────
  // MOBILE HEADER FIX — h-screen (100vh) can be TALLER than the actual
  // visible viewport on mobile Safari/Chrome (100vh is measured against the
  // viewport with the browser's address/toolbar chrome hidden, not the
  // shorter one it starts you on), which let this whole app div grow past
  // what's actually on screen and made the OS page (not this div) scrollable
  // by the difference — dragging the header/profile/notifications bar in it
  // off the top of the screen along with everything else, with nothing
  // pinning it in place. h-dvh tracks the real, currently-visible viewport
  // instead, so this root's height always matches what's actually on screen
  // and nothing needs to page-scroll. h-screen stays first as a fallback for
  // browsers without dvh support; h-dvh (declared after) overrides it where
  // supported.
  return (
    <div className="flex h-screen h-dvh overflow-hidden bg-black text-white">
      {/* Sidebar overlay for mobile */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar — open/close is button-only (see comment above); no touch
          handlers on this element at all, so a tap on Sign Out (or anything
          else in here) is a plain, unintercepted click every time. */}
      <aside
        className={"fixed inset-y-0 left-0 z-30 w-64 bg-black/95 border-r border-red-900/30 flex flex-col transition-transform duration-300 ease-out md:relative md:translate-x-0 " + (sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")}
      >
        {/* Logo — navigates in-place to the marketing landing page via
            marketingPreview (see that flag's own comment above), which
            explicitly suppresses the "already-signed-in owner off the
            marketing pages" redirect guard just for this intentional visit.
            A plain reload or a fresh tab both start marketingPreview at
            false, so those still redirect a logged-in owner straight to
            the dashboard as expected — only this explicit click bypasses it. */}
        {/* BUG FIX — "the box with the logo still isn't aligned with the top
            bar, it sits slightly lower." Matching `py-3` on both this box and
            <header> (previous fix, see below) wasn't actually enough: this
            box's content is a text-4xl heading (its own font line-height
            drives the row's total height), while <header>'s content is a mix
            of icons/buttons of various sizes — those two rows resolve to
            DIFFERENT auto-heights even with identical padding, so their
            content ends up centered within boxes of different total height
            and visibly doesn't line up. Pinning BOTH this box and <header> to
            the exact same explicit height (h-[60px], not just matching
            padding) makes the row heights byte-identical regardless of what
            font/icon metrics either one's content happens to have — items-
            center then centers each side's content within truly equal boxes. */}
        <div className="relative h-[60px] px-4 border-b border-red-900/30 flex items-center justify-center">
          <button
            onClick={() => { setMarketingPreview(true); window.location.hash = "/welcome"; setPage("welcome"); }}
            className="flex items-center text-left hover:opacity-80 transition"
            title="View landing page"
          >
            <div className="font-extrabold text-4xl leading-tight tracking-tight">Crew<span className="text-red-500">Boss</span></div>
          </button>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1"><X size={16} /></button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-4 px-2">
          {visibleNavGroups.map(group => (
            <div key={group.label}>
              <div className="text-[9px] uppercase tracking-widest text-white/30 font-semibold px-3 mb-1">{group.label}</div>
              {group.items.map(item => {
                const Icon = item.icon;
                const active = page === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setPage(item.id); setSidebarOpen(false); }}
                    className={"w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition mb-0.5 " + (active ? "bg-gradient-to-r from-red-600/30 to-red-900/20 text-white border border-red-600/30" : "text-white/60 hover:text-white hover:bg-white/5")}
                  >
                    <Icon size={15} className={active ? "text-red-400" : ""} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-red-900/30 space-y-1">
          <div className="flex gap-2">
            <button onClick={() => { setSettingsOpen(true); setSidebarOpen(false); }} className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/5 transition">
              <Settings size={14} />Settings
            </button>
            <button onClick={() => setMobileViewForced("mobile")} className="flex items-center justify-center gap-1 p-2 rounded-xl text-xs text-white/20 hover:text-white/50 hover:bg-white/5 transition" title="Switch to mobile view">
              <Monitor size={12} />
            </button>
          </div>
          <button
            onClick={() => { handleSignOut(); setSidebarOpen(false); }}
            className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs text-red-500/60 hover:text-red-400 hover:bg-red-950/20 transition"
          >
            <Lock size={13} />Sign Out
          </button>
        </div>
      </aside>

      {/* Main content — no edge-swipe handlers; open the sidebar via the
          Menu button in the header only (see comment above). */}
      <div
        className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden"
      >
        {/* Header — sticky top-0 is belt-and-suspenders on top of the flex
            layout above (which already pins it, since it's a flex-shrink-0
            sibling before the scrollable <main>, not an ancestor of it): if
            anything below it ever escapes its intended height (see the
            min-h-0 fixes on this column and on <main>), sticky still keeps
            the header/profile avatar/notifications bell pinned to the top
            of whatever DOES end up scrolling instead of disappearing off
            screen with it. */}
        <header className="sticky top-0 h-[60px] flex items-center gap-2 px-4 border-b border-red-900/30 bg-black/80 backdrop-blur flex-shrink-0 relative z-40">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2.5 -ml-1 text-white/50 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center">
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          <GlobalSearch customers={customers} jobs={jobs} estimates={estimates} onNav={setPage} />
          {/* Undo */}
          <button onClick={undo} disabled={undoCount === 0} title="Undo last action" className={"p-2 rounded-lg transition " + (undoCount > 0 ? "text-white/60 hover:text-white hover:bg-white/5" : "text-white/20 cursor-not-allowed")}>
            <Undo2 size={16} />
          </button>
          {/* Redo */}
          <button onClick={redo} disabled={redoCount === 0} title="Redo last undone action" className={"p-2 rounded-lg transition hidden md:flex " + (redoCount > 0 ? "text-white/60 hover:text-white hover:bg-white/5" : "text-white/20 cursor-not-allowed")}>
            <Redo2 size={16} />
          </button>
          {/* Auto-save indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs select-none">
            {isSyncing ? (
              <>
                <div className="w-3 h-3 border border-white/30 border-t-white/70 rounded-full animate-spin" />
                <span className="text-white/40">Saving…</span>
              </>
            ) : (
              <>
                <CheckCircle size={12} className="text-green-400/60" />
                <span className="text-green-400/50">
                  {lastSynced ? `Synced ${lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Saved"}
                </span>
              </>
            )}
          </div>
          {/* Client Demo — lets the owner test every customer-facing flow
              (view/sign a quote, pay an invoice, leave a review, view the
              full client portal, reschedule a job) against a real customer's
              real data, picked from a modal instead of always jumping to
              whatever estimate happens to be newest. */}
          {/* BUG FIX — "I don't see the button for testing the client demo"
              on mobile. This was `hidden md:flex`, deliberately removed on
              any screen narrower than md — icon-only on small screens
              (matching InstallAppButton's own responsive pattern right
              below) instead of fully gone. */}
          <button
            onClick={() => setClientDemoOpen(true)}
            title="Client Demo"
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-black/40 border border-red-900/30 rounded-xl text-xs text-white/50 hover:text-white hover:border-red-600/50 transition flex-shrink-0"
          >
            <Globe size={13} /><span className="hidden sm:inline">Client Demo</span>
          </button>
          {/* PWA — always-visible install button (see InstallAppButton.tsx —
              it explains itself instead of disappearing when there's
              nothing to install). Icon-only below sm so it can never push
              the notifications bell/profile avatar off-screen on a narrow
              phone — this header has no wrap/scroll fallback, so an item
              that's too wide here doesn't just look cramped, it can shove
              later items past the visible edge entirely. */}
          <InstallAppButton className="!flex flex-shrink-0 !px-2 sm:!px-3" label="Install App" labelClassName="hidden sm:inline" />
          {/* Notifications */}
          <div className="relative">
          <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2 text-white/60 hover:text-white">
            <Bell size={18} />
            {(notifications.filter(n => !n.read).length + negativeAlerts.length + overdueCount + lowStock) > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-[150]" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-80 bg-black/95 border border-red-900/40 rounded-xl shadow-2xl z-[160] overflow-hidden max-h-[480px] flex flex-col">
                <div className="p-3 border-b border-red-900/30 flex items-center justify-between">
                  <div className="font-semibold text-sm">Notifications</div>
                  <button onClick={() => setNotifOpen(false)} className="p-1 text-white/40 hover:text-white"><X size={14} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {notifications.slice(0, 8).map(n => (
                    <button key={n.id + n.at} onClick={() => { markNotificationRead(n.id); setPage(n.page || "notifications"); setNotifOpen(false); }} className={"w-full flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl text-left " + (n.read ? "opacity-50" : "")}>
                      <div className={"p-1.5 rounded-lg " + (n.category === "issue" ? "bg-red-950/30 text-red-400" : n.category === "crew" ? "bg-blue-950/30 text-blue-400" : "bg-green-950/30 text-green-400")}>
                        {n.category === "issue" ? <AlertTriangle size={12} /> : n.category === "crew" ? <Users2 size={12} /> : <Receipt size={12} />}
                      </div>
                      <div className="min-w-0"><div className="text-xs font-semibold truncate">{n.text}</div><div className="text-[10px] text-white/40">{new Date(n.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div></div>
                    </button>
                  ))}
                  {overdueCount > 0 && (
                    <button onClick={() => { setPage("invoices"); setNotifOpen(false); }} className="w-full flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl text-left">
                      <div className="p-1.5 rounded-lg bg-yellow-950/30 text-yellow-400"><Receipt size={12} /></div>
                      <div><div className="text-xs font-semibold">{overdueCount} overdue invoice{overdueCount !== 1 ? "s" : ""}</div><div className="text-[10px] text-white/40">Past due 14+ days</div></div>
                    </button>
                  )}
                  {lowStock > 0 && (
                    <button onClick={() => { setPage("chemicals"); setNotifOpen(false); }} className="w-full flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl text-left">
                      <div className="p-1.5 rounded-lg bg-red-950/30 text-red-400"><FlaskConical size={12} /></div>
                      <div><div className="text-xs font-semibold">{lowStock} chemical{lowStock !== 1 ? "s" : ""} low</div><div className="text-[10px] text-white/40">Below reorder level</div></div>
                    </button>
                  )}
                  {estimates.filter(e => e.status === "pending" && daysSince(e.createdAt) >= 7).slice(0, 3).map(e => {
                    const c = customers.find(x => x.id === e.customerId);
                    return (
                      <button key={e.id} onClick={() => { setPage("estimates"); setNotifOpen(false); }} className="w-full flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl text-left">
                        <div className="p-1.5 rounded-lg bg-yellow-950/30 text-yellow-400"><FileText size={12} /></div>
                        <div><div className="text-xs font-semibold">Stale quote — {c?.firstName ?? "?"}</div><div className="text-[10px] text-white/40">{daysSince(e.createdAt)}d old · ${e.total}</div></div>
                      </button>
                    );
                  })}
                  {negativeAlerts.length === 0 && overdueCount === 0 && lowStock === 0 && notifications.length === 0 && estimates.filter(e => e.status === "pending" && daysSince(e.createdAt) >= 7).length === 0 && (
                    <div className="p-6 text-center text-sm text-white/40">All clear ✓</div>
                  )}
                </div>
                <button onClick={() => { setPage("notifications"); setNotifOpen(false); }} className="p-2.5 text-center text-xs text-red-400 hover:text-red-300 border-t border-red-900/30 font-semibold">
                  See all notifications →
                </button>
              </div>
            </>
          )}
          </div>{/* end notifications relative wrapper */}
          {/* Profile avatar + dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileDropOpen(o => !o)}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-xs font-bold hover:ring-2 hover:ring-red-500/50 transition"
              title="Account"
            >
              {((settings.ownerName || settings.userName || crmUserEmail || "S")[0] || "S").toUpperCase()}
            </button>
            {profileDropOpen && (
              <>
                <div className="fixed inset-0 z-[150]" onClick={() => setProfileDropOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-black/95 border border-red-900/40 rounded-xl shadow-2xl z-[160] overflow-hidden">
                  <div className="px-4 py-3 border-b border-red-900/30">
                    {/* BUG FIX — "it doesn't show the owner's name or phone
                        number, just a dash." The email line only ever
                        checked crmUserEmail/settings.googleEmail — both can
                        genuinely be empty (a fresh session before either
                        resolves, or an owner who's never connected Google)
                        even though the owner's real email/phone are sitting
                        right there in settings under different keys. Now
                        falls through every place this app actually stores
                        an owner identity, and shows the phone number too
                        when one's on file, instead of silently dropping it. */}
                    <div className="font-semibold text-sm truncate">{settings.ownerName || (settings as any).userName || (crmUserEmail || "").split("@")[0] || "Owner"}</div>
                    <div className="text-xs text-white/40 truncate mt-0.5">{crmUserEmail || settings.googleEmail || (settings as any).myEmail || (settings as any).companyEmail || "No email on file"}</div>
                    {(settings as any).myPhone && <div className="text-xs text-white/40 truncate mt-0.5">{(settings as any).myPhone}</div>}
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <button
                      onClick={() => { setSettingsOpen(true); setProfileDropOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition text-left"
                    >
                      <Settings size={14} />Settings
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 transition text-left"
                    >
                      <Lock size={14} />Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* EGRESS/QUOTA — see supabaseDegraded above. Not a live usage-vs-cap
            readout (impossible to get safely from client code) — this is a
            best-effort inference from repeated request failures, so the
            wording says "may be" rather than asserting the cause. */}
        {supabaseDegraded && !degradedWarningDismissed && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-red-950/40 border-b border-red-700/40 text-red-200 text-xs flex-shrink-0">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <div className="flex-1">
              Supabase requests have been failing repeatedly — this can happen when a project is paused or over its usage quota. Check Usage in your Supabase dashboard. If you're near a quota limit, raising the Background Sync Interval in Settings → Data can help.
            </div>
            <button onClick={() => setSettingsOpen(true)} className="underline hover:text-white flex-shrink-0">Open Settings</button>
            <button onClick={() => setDegradedWarningDismissed(true)} className="text-red-200/60 hover:text-white flex-shrink-0"><X size={14} /></button>
          </div>
        )}

        {/* Page content */}
        {/* FIX 19 — AlfredPage used to size itself with a hardcoded
            h-[calc(100dvh-150px)] guess at "everything else on screen" —
            wrong on any layout where the header/padding/mobile bottom nav
            don't add up to exactly 150px (they don't, especially with this
            wrapper's own py-4/p-6 padding stacked on top), so Alfred was
            sometimes shorter than the actual remaining space (extra empty
            page scroll below it) and sometimes taller (forcing the outer
            page to ALSO scroll to see the rest of the chat — a scroll-
            inside-a-scroll that read as "doesn't fill the screen"). For the
            alfred page specifically, main becomes a flex column with no
            padding/max-width constraint so AlfredPage's own flex-1 container
            (see AlfredPage.tsx) fills exactly the remaining space next to
            the (still fully visible, unaffected — it's a sibling <aside>,
            not replaced) main sidebar, with no double scroll. */}
        {/* BUG (mobile) — InboxPage used to size its own root with a raw
            `height: calc(100vh - 57px)` guess, the exact anti-pattern FIX 19
            below already documents for Alfred: on mobile that guess can run
            taller than the space actually left inside `main` (real header
            height, the degraded-Supabase banner, etc. don't reliably add up
            to 57px), forcing `main` itself to scroll to show the rest —
            which reads as "the top bar disappeared" even though it never
            actually moved, because the visible viewport had already
            scrolled past it. Giving Inbox the same flex-column/no-padding
            treatment as Alfred (own flex-1 fills exactly what's left, no
            vh guess) fixes it the same way. */}
        {/* BUG FIX — "sections are cut off partially on mobile scroll." The
            mobile bottom nav is `env(safe-area-inset-bottom)` TALLER than
            its base height on notched/gesture-bar phones — this fixed
            `pb-16` never accounted for that extra inset, so the last chunk
            of scrollable content (the tail of Upcoming/Recent Activity, on
            Dashboard) sat partly behind the nav bar on exactly those
            devices. Matches the nav bar's own safe-area padding. */}
        <main className={"flex-1 min-h-0 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 " + (page === "alfred" || page === "inbox" ? "flex flex-col overflow-hidden" : "overflow-y-auto")}>
          <div className={page === "alfred" || page === "inbox" ? "flex-1 flex flex-col min-h-0 p-2 md:p-3" : "px-3 py-4 md:p-6 max-w-[1600px] mx-auto"}>
            <PageFade key={page} className={page === "alfred" || page === "inbox" ? "flex-1 min-h-0 flex flex-col" : ""}>
              <SafePage>
                {page === "cockpit" && isCockpitOwner && <CockpitPage ownerId={crmUserId} toast={toast} />}
                {page === "feedback" && <FeedbackPage userEmail={crmUserEmail} userName={(settings as any)?.ownerName || (settings as any)?.companyName} isAdmin={isCockpitOwner} toast={toast} />}
                {page === "dashboard"      && <Dashboard jobs={jobs} setJobs={setJobs} customers={customers} estimates={estimates} setEstimates={setEstimates} automations={automations} stats={{ totalRev, activeJobs, pendingEst, closeRate, doneMonth }} goals={{ revenue: settings.monthlyRevenueGoal ?? 8000, jobCount: settings.monthlyJobsGoal ?? 20 }} vehicles={vehicles} maintenance={maintenance} chemicals={chemicals} settings={settings} setSettings={setSettings} onNav={setPage} toast={toast} weatherData={weatherData} weatherFetchError={weatherFetchError} inboxThreads={inboxThreads} employees={employees} crewFetchError={crewFetchError} reviews={reviews} onSendDailyBriefing={sendDailyBriefingNow} onViewJob={id => { setOpenJobId(id); setPage("jobs"); }} ownerId={crmUserId} />}
                {page === "customers"      && <CustomersPage customers={customers} setCustomers={setCustomers} estimates={estimates} jobs={jobs} employees={employees} toast={toast} timeline={timeline} setTimeline={setTimeline} settings={settings} setSettings={setSettings} autoOpenNew={fabAutoOpenNew === "customers"} onAutoOpenNewConsumed={() => setFabAutoOpenNew(null)} highlightId={alfredHighlight?.type === "customer" ? alfredHighlight.id : null} pushUndo={pushUndo} markRecentlyDeleted={markRecentlyDeleted} unmarkRecentlyDeleted={unmarkRecentlyDeleted} onSpotlight={queueAlfredSpotlight} planLimits={planLimits} onUpgrade={openBillingUpgrade} />}
                {page === "estimates"      && <EstimatesPage estimates={estimates} setEstimates={setEstimates} customers={customers} services={services} settings={settings} toast={toast} onPortal={id => setPortalEstId(id)} estimateTemplates={estimateTemplates} setEstimateTemplates={setEstimateTemplates} setJobs={setJobs} onNav={setPage} autoOpenNew={fabAutoOpenNew === "estimates"} onAutoOpenNewConsumed={() => { setFabAutoOpenNew(null); setEstimatePresetCustomerId(null); }} presetCustomerId={estimatePresetCustomerId || ""} ownerId={crmUserId} highlightId={alfredHighlight?.type === "estimate" ? alfredHighlight.id : null} pushUndo={pushUndo} markRecentlyDeleted={markRecentlyDeleted} unmarkRecentlyDeleted={unmarkRecentlyDeleted} />}
                {page === "invoices"       && <InvoicesPage estimates={estimates} setEstimates={setEstimates} customers={customers} settings={settings} toast={toast} jobs={jobs} setJobs={setJobs} ownerId={crmUserId} highlightId={alfredHighlight?.type === "invoice" ? alfredHighlight.id : null} pushUndo={pushUndo} markRecentlyDeleted={markRecentlyDeleted} unmarkRecentlyDeleted={unmarkRecentlyDeleted} />}
                {page === "jobs"           && <JobsPage jobs={jobs} setJobs={setJobs} customers={customers} setCustomers={setCustomers} employees={employees} estimates={estimates} setEstimates={setEstimates} settings={settings} setSettings={setSettings} toast={toast} posts={socialPosts} setPosts={setSocialPosts} setTimeline={setTimeline} initialDetailId={openJobId} onInitialDetailIdConsumed={() => setOpenJobId(null)} onPortal={id => setPortalEstId(id)} ownerId={crmUserId} autoOpenNew={fabAutoOpenNew === "jobs"} onAutoOpenNewConsumed={() => setFabAutoOpenNew(null)} highlightId={alfredHighlight?.type === "job" ? alfredHighlight.id : null} pushUndo={pushUndo} markRecentlyDeleted={markRecentlyDeleted} unmarkRecentlyDeleted={unmarkRecentlyDeleted} services={services} />}
                {page === "pipeline"       && <PipelinePage jobs={jobs} setJobs={setJobs} customers={customers} toast={toast} />}
                {page === "calendar"       && <CalendarPage jobs={jobs} setJobs={setJobs} customers={customers} employees={employees} toast={toast} settings={settings} setSettings={setSettings} ownerId={crmUserId} />}
                {page === "inbox"          && (managerBlocked("inbox") ? <RestrictedNotice label="the Inbox" /> : <InboxPage threads={inboxThreads} setThreads={setInboxThreads} customers={customers} setCustomers={setCustomers} settings={settings} toast={toast} ownerId={crmUserId} />)}
                {page === "campaigns"      && <CampaignsPage campaigns={campaigns} setCampaigns={setCampaigns} customers={customers} estimates={estimates} jobs={jobs} settings={settings} setSettings={setSettings} inboxThreads={inboxThreads} setInboxThreads={setInboxThreads} automations={automations} setAutomations={setAutomations} toast={toast} />}
                {page === "reviews"        && <ReviewsPage reviews={reviews} setReviews={setReviews} jobs={jobs} customers={customers} toast={toast} negativeAlerts={negativeAlerts} setNegativeAlerts={setNegativeAlerts} settings={settings} setSettings={setSettings} />}
                {page === "automations"    && <AutomationsPage automations={automations} setAutomations={setAutomations} jobs={jobs} customers={customers} estimates={estimates} settings={settings} setSettings={setSettings} toast={toast} />}
                {page === "social"         && <SocialPage posts={socialPosts} setPosts={setSocialPosts} toast={toast} settings={settings} jobs={jobs} ownerId={crmUserId} onNav={setPage} />}
                {page === "intake"         && <LeadIntakePage customers={customers} setCustomers={setCustomers} estimates={estimates} setEstimates={setEstimates} services={services} jobs={jobs} settings={settings} setSettings={setSettings} toast={toast} onNav={setPage} onConvertToEstimate={(customerId: string) => { setEstimatePresetCustomerId(customerId); setFabAutoOpenNew("estimates"); setPage("estimates"); }} ownerId={crmUserId} markRecentlyDeleted={markRecentlyDeleted} />}
                {page === "alfred"         && (managerBlocked("alfred") ? <RestrictedNotice label="Alfred AI" /> : <AlfredPage conversations={alfredConversations} setConversations={setAlfredConversations} activeConvId={activeConvId} setActiveConvId={setActiveConvId} memory={alfredMemory} setMemory={setAlfredMemory} personality={personality} setPersonality={setPersonality} apiKey={settings.anthropicKey ?? settings.geminiKey ?? ""} openSettings={() => setSettingsOpen(true)} toast={toast} jobs={jobs} setJobs={setJobs} estimates={estimates} setEstimates={setEstimates} customers={customers} setCustomers={setCustomers} employees={employees} automations={automations} setAutomations={setAutomations} stats={{ totalRev, activeJobs, pendingEst, closeRate, doneMonth }} setWins={setWins} goals={goalsList} setGoals={setGoalsList} setSettings={setSettings} settings={settings} modelStatus={modelStatus} setModelStatus={setModelStatus} onNav={setPage} onSpotlight={queueAlfredSpotlight} expenses={expenses} setExpenses={setExpenses} chemicals={chemicals} ownerId={crmUserId} />)}
                {page === "google"         && (managerBlocked("google") ? <RestrictedNotice label="Google Workspace" /> : <GoogleWorkspacePage settings={settings} setSettings={setSettings} googleData={googleData as any} setGoogleData={setGoogleData} customers={customers} setCustomers={setCustomers} jobs={jobs} toast={toast} onNav={setPage} />)}
                {page === "employees"      && <EmployeesPage employees={employees} setEmployees={setEmployees} jobs={jobs} setJobs={setJobs} customers={customers} settings={settings} toast={toast} autoOpenManagerInvite={autoOpenManagerInvite} onAutoOpenManagerInviteConsumed={() => setAutoOpenManagerInvite(false)} initialView={employeesInitialView} onInitialViewConsumed={() => setEmployeesInitialView(undefined)} ownerId={crmUserId} planLimits={planLimits} onUpgrade={openBillingUpgrade} />}
                {page === "hiring"         && <HiringPage settings={settings} setSettings={setSettings} toast={toast} ownerId={crmUserId} onNav={setPage} />}
                {page === "fleet"          && <FleetPage vehicles={vehicles} setVehicles={setVehicles} maintenance={maintenance} setMaintenance={setMaintenance} toast={toast} />}
                {page === "expenses"       && <ExpensesPage expenses={expenses} setExpenses={setExpenses} toast={toast} />}
                {page === "chemicals"      && <ChemicalsPage chemicals={chemicals} setChemicals={setChemicals} toast={toast} settings={settings} ownerId={crmUserId} markRecentlyDeleted={markRecentlyDeleted} />}
                {page === "notifications"  && <NotificationsPage notifications={notifications} onDelete={deleteNotification} onMarkRead={markNotificationRead} onMarkAllRead={markAllNotificationsRead} onClearAll={clearAllNotifications} onNav={setPage} />}
                {page === "reports"        && <ReportsPage jobs={jobs} customers={customers} estimates={estimates} expenses={expenses} employees={employees} chemicals={chemicals} />}
                {page === "analytics"      && <AnalyticsPage jobs={jobs} customers={customers} estimates={estimates} expenses={expenses} />}
                {page === "budget"         && <BudgetPage jobs={jobs} estimates={estimates} expenses={expenses} settings={settings} toast={toast} />}
                {page === "personal"       && <PersonalBudgetPage toast={toast} />}
                {page === "accountability" && (managerBlocked("accountability") ? <RestrictedNotice label="Accountability Tools" /> : <AccountabilityPage entries={accountability} setEntries={setAccountability} goals={goalsList} setGoals={setGoalsList} wins={wins} setWins={setWins} toast={toast} settings={settings} ownerId={crmUserId} onNav={setPage} />)}
                {page === "goals" && <GoalsPage goals={goalsList} setGoals={setGoalsList} jobs={jobs} customers={customers} toast={toast} />}
                {page === "referrals"      && <ReferralsPage customers={customers} setCustomers={setCustomers} jobs={jobs} toast={toast} settings={settings} setSettings={setSettings} />}
                {page === "promotions"     && <PromotionsPage promotions={promotions} setPromotions={setPromotions} customers={customers} services={services} settings={settings} toast={toast} />}
                {page === "trashcans"      && <TrashCanPage jobs={jobs} setJobs={setJobs} customers={customers} settings={settings} setSettings={setSettings} toast={toast} ownerId={crmUserId} />}
                {page === "crew"           && <CrewView jobs={jobs} setJobs={setJobs} customers={customers} employees={employees} toast={toast} settings={settings} setSettings={setSettings} estimates={estimates} setEstimates={setEstimates} refetchEmployees={refetchEmployees} ownerId={crmUserId} />}
              </SafePage>
            </PageFade>
          </div>
        </main>

        {/* Mobile bottom nav — quick access to the 4 most-used sections,
            plus Feedback (5th slot) so "report a bug / request a feature"
            has a guaranteed-visible entry point on mobile, not just buried
            behind the hamburger sidebar (which technically already had it,
            but wasn't obviously "where you'd go for that" without a label
            pointing at it). */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-black/95 border-t border-red-900/30 backdrop-blur flex items-stretch" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {[
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "jobs", label: "Jobs", icon: Briefcase },
            { id: "customers", label: "Customers", icon: Users },
            { id: "estimates", label: "Estimates", icon: FileText },
            { id: "feedback", label: "Feedback", icon: MessageSquare },
          ].map(item => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  // Jobs/Customers/Estimates should pop their "New" modal
                  // right away on tap, not just land on the list page —
                  // same autoOpenNew mechanism the FAB already uses above.
                  setPage(item.id);
                  if (item.id === "jobs" || item.id === "customers" || item.id === "estimates") setFabAutoOpenNew(item.id);
                }}
                className={"flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition " + (active ? "text-red-400" : "text-white/40 hover:text-white/70")}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Settings modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialSection={settingsInitialSection}
        settings={settings}
        setSettings={setSettings}
        jobs={jobs}
        setJobs={setJobs}
        markRecentlyDeleted={markRecentlyDeleted}
        customers={customers}
        estimates={estimates}
        campaigns={campaigns}
        services={services}
        setServices={setServices}
        emailTemplates={emailTemplates}
        setEmailTemplates={setEmailTemplates}
        smsTemplates={smsTemplates}
        setSmsTemplates={setSmsTemplates}
        estimateTemplates={estimateTemplates}
        setEstimateTemplates={setEstimateTemplates}
        modelStatus={modelStatus}
        setModelStatus={setModelStatus}
        employees={employees}
        toast={toast}
        onSignOut={handleSignOut}
        restrictToProfile={crmRole === "manager"}
        onAddManager={() => { setSettingsOpen(false); setAutoOpenManagerInvite(true); setPage("employees"); }}
      />

      {clientDemoOpen && (() => {
        // Auto-pick real records behind the scenes instead of making the
        // owner choose a customer first — most recent open quote / unpaid
        // invoice / any invoice, across ALL customers, sorted newest first.
        const sortedEstimates = [...estimates].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        // BUG FIX — picking any non-invoiced estimate regardless of status
        // could grab one already signed/approved, and ClientPortal only
        // shows the Review/Sign action when status is still "pending" — so
        // an already-approved quote rendered a dead-end view with nothing
        // to click, which read as "jumps straight to the end." Prefer a
        // genuinely still-pending quote so the walkthrough has steps to
        // actually walk through; falls back to any quote if none are pending.
        const latestQuote = sortedEstimates.find(e => !(e as any).invoiced && (!e.status || e.status === "pending")) || sortedEstimates.find(e => !(e as any).invoiced);
        // FEATURE — "different options: a package quote, an options quote,
        // or a normal quote." Same "prefer pending, else any" logic as
        // latestQuote above, just narrowed to a specific estimateType so
        // the owner can actually preview each layout instead of only ever
        // landing on whichever type the most recent real quote happens to be.
        const quoteByType = (t: "standard" | "package" | "options") => {
          const matchesType = (e: any) => t === "standard" ? (!e.estimateType || e.estimateType === "standard") : e.estimateType === t;
          return sortedEstimates.find(e => !(e as any).invoiced && matchesType(e) && (!e.status || e.status === "pending"))
            || sortedEstimates.find(e => !(e as any).invoiced && matchesType(e));
        };
        const quoteTypeOptions: { key: "standard" | "package" | "options"; label: string }[] = [
          { key: "standard", label: "Normal Quote" },
          { key: "package", label: "Package Quote" },
          { key: "options", label: "Options Quote" },
        ];
        const buildSyntheticQuote = (t: "standard" | "package" | "options") => {
          const realCust = customers[0];
          const customer = realCust || { id: "demo-cust", firstName: "Jamie", lastName: "Rivera", address: "412 Oak Ridge Ln, York PA", phone: "", email: "" };
          const svc = services.slice(0, 3);
          const li = (n: number) => svc[n] ? { id: "demo-li" + n, description: svc[n].name, quantity: 1, unitPrice: svc[n].basePrice || 199 } : { id: "demo-li" + n, description: ["House Soft Wash", "Driveway Wash", "Gutter Cleaning"][n], quantity: 1, unitPrice: [349, 175, 149][n] };
          const base: any = { id: "demo-" + t + "-" + Date.now(), customerId: customer.id, createdAt: today(), status: "pending", invoiced: false, subtotal: 0, tax: 0, total: 0, notes: "" };
          if (t === "package") {
            const packages = [0, 1].map(i => ({ id: "demo-pkg" + i, name: i === 0 ? "Standard Package" : "Premium Package", description: i === 0 ? "Our most popular combo" : "Everything, top to bottom", lineItems: i === 0 ? [li(0)] : [li(0), li(1), li(2)], subtotal: i === 0 ? li(0).unitPrice : li(0).unitPrice + li(1).unitPrice + li(2).unitPrice }));
            Object.assign(base, { estimateType: "package", packages, total: packages[0].subtotal });
          } else if (t === "options") {
            // BUG FIX — "if it's an options package, ensure everything is
            // optional." Every item here is toggleable now (was leaving the
            // first item locked-on, which read as "I can't check gutter
            // cleaning / commercial exterior" in the demo).
            const lineItems = [{ ...li(0), optional: true }, { ...li(1), optional: true }, { ...li(2), optional: true }];
            Object.assign(base, { estimateType: "options", lineItems, subtotal: lineItems.reduce((s, x) => s + x.unitPrice, 0), total: lineItems.reduce((s, x) => s + x.unitPrice, 0) });
          } else {
            const lineItems = [li(0), li(1)];
            const subtotal = lineItems.reduce((s, x) => s + x.unitPrice, 0);
            Object.assign(base, { estimateType: "standard", lineItems, subtotal, tax: Math.round(subtotal * (settings?.taxRate || 0)) / 100, total: subtotal + Math.round(subtotal * (settings?.taxRate || 0)) / 100 });
          }
          setDemoSyntheticEstimate({ estimate: base, customer });
        };
        // Same reasoning as latestQuote above — prefer an invoice that
        // genuinely still has something to pay (not already paid in full,
        // not declined) so the payment walkthrough has a real balance due
        // to show instead of a $0-due dead end.
        const latestUnpaidInvoice = sortedEstimates.find(e => (e as any).invoiced && !e.paidAt && !(e as any).paidFull && e.status !== "rejected")
          || sortedEstimates.find(e => (e as any).invoiced && !e.paidAt);
        const latestInvoice = sortedEstimates.find(e => (e as any).invoiced && e.status !== "rejected") || sortedEstimates.find(e => (e as any).invoiced);
        const demoBtnClass = "w-full text-left px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm text-white/80 flex items-center justify-between transition";
        return (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur flex items-center justify-center p-4" onClick={() => setClientDemoOpen(false)}>
            <div className="w-full max-w-md bg-neutral-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-red-600 to-red-800">
                <div className="font-bold text-white flex items-center gap-2"><Globe size={16} />Client Demo</div>
                <button onClick={() => setClientDemoOpen(false)} className="p-1.5 rounded-lg hover:bg-white/15 text-white"><X size={16} /></button>
              </div>
              <div className="p-4 space-y-2">
                <div className="text-[11px] text-white/40 mb-1">Preview any customer-facing flow instantly — real records are picked automatically.</div>
                <button onClick={() => setDemoQuoteTypeMenuOpen(o => !o)} className={demoBtnClass}>
                  Test Viewing a Quote
                  <ChevronRight size={13} className={"text-white/30 transition-transform " + (demoQuoteTypeMenuOpen ? "rotate-90" : "")} />
                </button>
                {demoQuoteTypeMenuOpen && (
                  <div className="pl-2 space-y-1.5 border-l-2 border-red-700/30 ml-1.5">
                    {quoteTypeOptions.map(opt => {
                      const match = quoteByType(opt.key);
                      return (
                        <button key={opt.key} onClick={() => {
                          setClientDemoOpen(false); setDemoQuoteTypeMenuOpen(false);
                          if (match) setPortalEstId(match.id); else buildSyntheticQuote(opt.key);
                        }} className={demoBtnClass + " !text-xs"}>
                          {opt.label} {!match && <span className="text-[10px] text-white/30">preview (no real example yet)</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                <button disabled={!latestUnpaidInvoice} onClick={() => { setClientDemoOpen(false); setPortalEstId(latestUnpaidInvoice!.id); }} className={demoBtnClass}>
                  Test Paying an Invoice {!latestUnpaidInvoice && <span className="text-[10px] text-white/30">no unpaid invoice to preview</span>}
                </button>
                <button disabled={!latestInvoice} onClick={() => { setClientDemoOpen(false); setPortalEstId(latestInvoice!.id); }} className={demoBtnClass}>
                  Test Viewing an Invoice {!latestInvoice && <span className="text-[10px] text-white/30">no invoice to preview</span>}
                </button>
                <button onClick={() => { setClientDemoOpen(false); setClientDemoReviewOpen(true); }} className={demoBtnClass}>
                  Test Leaving a Review
                </button>
                <button onClick={() => { setClientDemoOpen(false); setClientDemoLoginOpen(true); }} className={demoBtnClass}>
                  Test the Full Client Portal
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Client Demo — Leave a Review, rendered in-app rather than a new
          tab. CustomerReviewPage normally reads its params off #/rate's
          hash; `overrides` feeds it generic demo values directly so we
          don't have to touch window.location.hash (which would blow away
          the CRM page underneath this overlay). */}
      {clientDemoReviewOpen && (
        // BUG FIX — "the review demo should be blurred, not solid black."
        // This used to be an opaque bg-black overlay, unlike every other
        // demo popup here (the picker modal, the review-in-picker preview)
        // which all use the blurred-CRM-showing-through look. Matches that
        // same treatment so it visibly reads as "a preview floating over
        // your CRM," not a totally separate blank page.
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur overflow-y-auto">
          <button onClick={() => setClientDemoReviewOpen(false)} className="fixed top-4 right-4 z-[210] p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/15"><X size={18} /></button>
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-neutral-950 border border-white/10 rounded-2xl shadow-2xl">
              <CustomerReviewPage embedded overrides={{ n: "there", co: (settings as any)?.companyName || "Crew Boss", rl: (settings as any)?.googleReviewLink || "", g: (settings as any)?.googlePlaceId || "" }} />
            </div>
          </div>
        </div>
      )}

      {/* Client Demo — full client portal login, rendered in-app rather
          than a new tab. ClientAuthPortal manages its own real Supabase
          auth session (no mock-session bypass exists), so this genuinely
          tests the customer login flow against real data. */}
      {clientDemoLoginOpen && (
        // BUG FIX — "the full client portal should be a pop-up, not cover
        // the whole screen." ClientAuthPortal is the real customer-facing
        // page (min-h-screen, full layout by design for its actual #/client
        // route) — rather than rewriting its internals for a second
        // "embedded" mode, this contains it in a bounded, blurred-backdrop
        // card like every other demo popup. ClientAuthPortal's own
        // min-h-screen still measures against the viewport, so it can be
        // taller than the card — the card scrolls internally to show all of
        // it, same as scrolling a phone screen, instead of taking over the
        // whole browser window.
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur flex items-center justify-center p-2 sm:p-6" onClick={() => setClientDemoLoginOpen(false)}>
          <div className="relative w-full max-w-md h-full sm:h-[88vh] bg-black border border-white/10 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setClientDemoLoginOpen(false)} className="absolute top-3 right-3 z-[210] p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/15"><X size={16} /></button>
            <div className="h-full overflow-y-auto">
              <ClientAuthPortal customers={customers} setCustomers={setCustomers} estimates={estimates} setEstimates={setEstimates} jobs={jobs} settings={settings} estimateTemplates={estimateTemplates} toast={toast} demoMode onExitDemo={() => setClientDemoLoginOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Automation batch-approval gate — nothing an automation wants to send
          goes out until the owner explicitly approves it here. */}
      {pendingAutomationBatch && (
        <AutomationBatchModal
          batch={pendingAutomationBatch}
          onSendAll={approveAutomationBatch}
          onSkip={skipAutomationBatch}
          onPause={() => {
            setSettings((s: any) => ({ ...s, automationsPaused: true }));
            skipAutomationBatch();
            toast("Automations paused");
          }}
        />
      )}

      {/* Client portal */}
      {(portalEstId || demoSyntheticEstimate) && (
        <ClientPortal
          estimate={demoSyntheticEstimate ? demoSyntheticEstimate.estimate : estimates.find(e => e.id === portalEstId)}
          customer={demoSyntheticEstimate ? demoSyntheticEstimate.customer : customers.find(c => c.id === estimates.find(e => e.id === portalEstId)?.customerId)}
          jobs={jobs}
          invoices={estimates.filter(e => e.invoiced)}
          settings={settings}
          estimateTemplates={estimateTemplates}
          promotions={promotions}
          customers={customers}
          setCustomers={setCustomers}
          onClose={() => { setPortalEstId(null); setDemoSyntheticEstimate(null); }}
          onView={id => {
          // A synthetic demo quote (id starts "demo-") was never written to
          // Supabase — nothing real to mark viewed.
          if (String(id).startsWith("demo-")) return;
          setEstimates(prev => prev.map(e => e.id === id && !(e as any).clientViewedAt ? { ...e, clientViewedAt: new Date().toISOString() } as any : e));
          fetch("/api/public-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark_estimate_viewed", id }) }).catch(() => {});
        }}
          onApprove={(id, data) => {
            // FEATURE — package/options quote preview has nothing real to
            // sign or pay against (no row exists to update) — tell the
            // owner plainly this is a preview instead of silently doing
            // nothing or throwing trying to update a non-existent row.
            if (String(id).startsWith("demo-")) { toast?.("This is a preview — nothing was actually signed or charged."); return; }
            const paid = data.payChoice !== "later";
            setEstimates(prev => prev.map(e => e.id === id ? {
              ...e, status: "approved", signedAt: data.signedAt || e.signedAt, sigData: data.sigData || e.sigData, payChoice: data.payChoice,
              ...(paid ? { paidAt: today() } : {}),
              paidDeposit: data.payType === "deposit" ? data.totalPaid : (e.paidDeposit || 0),
              paidFull: data.payType === "full" ? data.totalPaid : data.payType === "remaining" ? (e.paidDeposit || 0) + data.totalPaid : (e.paidFull || 0),
            } : e));
            // Customer-side approval also needs to surface as a job needing
            // scheduling — same convention (scheduledDate: "") as the owner's
            // own "Approve Estimate" button in EstimatesPage.
            // ISSUE 12 (round 2) — this was local-state-only (setJobs with no
            // matching Supabase insert), unlike the identical block in the
            // OTHER ClientPortal usage above (the public #/estimate/:id
            // route), which does insert. A job created here (e.g. via the
            // owner's own "Preview as Customer" approve button) looked like
            // it worked, but never reached the jobs table — the very next
            // 3s cross-device poll (or a reload) wholesale-replaces local
            // state from Supabase and it silently vanished, which is exactly
            // "no Unscheduled — Needs a Date section" after testing this
            // path.
            setJobs(prev => {
              if (prev.some(j => (j as any).estimateId === id)) return prev;
              const est = estimates.find(e => e.id === id);
              if (!est) return prev;
              const cust = customers.find(c => c.id === est.customerId);
              const combinedChecklist = buildChecklistFromServices(est.lineItems, services);
              const newJob = {
                id: uid(), customerId: est.customerId, address: cust?.address || "",
                amount: est.total, status: "scheduled", scheduledDate: "", duration: 2,
                priority: "normal", crew: [], checklist: combinedChecklist, preChecklist: combinedChecklist, photos: [], chemicalsUsed: [],
                equipment: [], tags: ["Needs Scheduling"], commLog: [],
                notes: "From approved estimate #" + id.slice(-4).toUpperCase(),
                createdAt: today(), estimateId: id, owner_id: crmUserId,
              } as any;
              (supabase as any).from("jobs").insert(newJob)
                .then((r: any) => { if (r?.error) toast?.("Job created locally, but failed to save to the server — " + r.error.message, "red"); })
                .catch((e: any) => toast?.("Job created locally, but failed to save to the server — " + (e?.message || "unknown error"), "red"));
              return [...prev, newJob];
            });
            toast(paid ? "✓ Paid — " + fmt(data.totalPaid) : "✓ Signed — customer will pay later");
            setPortalEstId(null);
          }}
          onDecline={async (id: string, data: { reason?: string; category?: string }) => {
            if (String(id).startsWith("demo-")) { setDemoSyntheticEstimate(prev => prev ? { ...prev, estimate: { ...prev.estimate, status: "rejected" } } : prev); return; }
            const declinedAt = new Date().toISOString();
            setEstimates(prev => prev.map(est => est.id === id ? { ...est, status: "rejected", declinedAt, declineReason: data.reason || "", declineReasonCategory: data.category || "" } as any : est));
            // Write immediately rather than waiting on the 30s bulk autosave —
            // the owner's invoiceActivity diff (above) only fires once this
            // lands in Supabase and the owner's own poll picks it up.
            try {
              const { error } = await (supabase as any).from("estimates").update({ status: "rejected", declinedAt, declineReason: data.reason || "", declineReasonCategory: data.category || "" }).eq("id", id);
              if (error) console.warn("Decline failed to save server-side:", error.message);
            } catch (e: any) {
              console.warn("Decline failed to save server-side:", e?.message);
            }
          }}
        />
      )}

      {/* FAB — floating quick-action button */}
      {settings.fabEnabled !== false && !fabSessionHidden && (
        <>
          {fabOpen && <div className="fixed inset-0 z-40" onClick={() => setFabOpen(false)} />}
          {/* Raised above the mobile bottom nav (bottom-20) so it never overlaps
              it; drops back to bottom-6 on md+ where there's no bottom nav.
              FEATURE 1 — once dragged, fabPosition overrides these default
              corner classes with an explicit left/bottom so it stays wherever
              it was dropped.
              FEATURE 8 (mobile round 7) — this used to anchor the dragged
              position with `top`, while the default (undragged) case anchors
              with `bottom`. Since the button is the LAST flex child (quick
              actions render above it), a `top`-anchored container grows
              DOWNWARD as the menu opens — the button itself visibly jumped
              down every time the menu opened after a drag, and the whole
              menu could open in the wrong direction. Anchoring by `bottom`
              in both cases keeps the button's position stable and the menu
              always expanding upward, matching the non-dragged behavior. */}
          <div
            className={"z-50 flex flex-col items-end gap-2.5 " + (fabPosition ? "fixed" : "fixed bottom-20 right-5 md:bottom-6 md:right-6")}
            style={fabPosition ? { left: fabPosition.x, bottom: Math.max(4, getViewportHeight() - fabPosition.y - FAB_SIZE) } : { marginBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* BLOCKER 15 (mobile round 9) — dragged into the bottom 20% of
                the screen (e.g. behind the mobile bottom nav / thumb-
                unreachable area): hide the FAB completely rather than
                collapsing to a visible arrow tab (the previous FEATURE 8
                behavior, which the owner found confusing — expected it to
                just disappear). A small pulsing dot marks where it went;
                tapping the dot restores the FAB to its default position. */}
            {fabPosition && fabPosition.y + FAB_SIZE > getViewportHeight() * 0.8 ? (
              <button
                onClick={() => setFabPosition(null)}
                aria-label="Restore quick actions"
                className="w-4 h-4 rounded-full bg-red-500/70 hover:bg-red-500 flex items-center justify-center transition"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
              </button>
            ) : <>
            {fabOpen && (
              <>
                {(() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const fabIconMap: Record<string, React.ComponentType<any>> = {
                    customers: Users, estimates: FileText, jobs: Briefcase,
                    alfred: Bot, expenses: Receipt, intake: UserPlus,
                  };
                  const enabledFabIds = ((settings as any).fabActions as string[] | undefined) ?? ["customers","estimates","jobs","alfred"];
                  const fabActions = ALL_FAB_ACTIONS.filter(a => enabledFabIds.includes(a.id) && !managerBlocked(a.dest));
                  return fabActions.map(item => {
                    const Icon = fabIconMap[item.id] ?? Plus;
                    return (
                      <button
                        key={item.dest}
                        onClick={() => {
                          // ITEM 18 — New Customer pops up right here, no
                          // navigation. See fabQuickCustomerOpen above.
                          if (item.dest === "customers") {
                            setFabQuickCustomerOpen(true);
                            setFabOpen(false);
                            setSidebarOpen(false);
                            return;
                          }
                          setPage(item.dest);
                          // ISSUE 21 — estimates/jobs support auto-opening
                          // their "New" modal; other FAB destinations
                          // (Alfred, Expenses, New Lead) just navigate as
                          // before, since they have no separate creation
                          // modal to pop.
                          if (item.dest === "estimates" || item.dest === "jobs") setFabAutoOpenNew(item.dest);
                          setFabOpen(false);
                          setSidebarOpen(false);
                        }}
                        className={"flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r text-white text-sm font-semibold shadow-xl border border-white/10 hover:scale-105 active:scale-95 transition-transform " + item.colorClass}
                      >
                        <Icon size={15} />
                        {item.label}
                      </button>
                    );
                  });
                })()}
              </>
            )}
            <button
              onClick={() => {
                // FEATURE 1 — a hold-to-drag interaction ends with a pointerup
                // that the browser also fires a click for; suppress that one
                // click so dragging the FAB doesn't also toggle the menu open.
                if (fabWasDraggedRef.current) { fabWasDraggedRef.current = false; return; }
                setFabOpen(o => !o);
              }}
              onPointerDown={fabOnPointerDown}
              onPointerUp={(e) => { fabReleasePointer(e); fabCancelHold("released"); }}
              onPointerCancel={(e) => { fabReleasePointer(e); fabCancelHold("pointer canceled by browser"); }}
              onContextMenu={(e) => e.preventDefault()}
              className={"w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-red-800 shadow-2xl shadow-red-900/60 flex items-center justify-center border border-red-400/30 touch-none select-none " +
                (fabDragging ? "scale-110 ring-4 ring-red-400/50 cursor-grabbing" : fabHolding ? "scale-110 ring-4 ring-red-300/70" : "hover:scale-110 active:scale-95")}
              style={{
                transition: fabDragging ? "none" : "transform 0.15s ease-out, box-shadow 0.15s ease-out",
                boxShadow: fabHolding ? "0 0 0 8px rgba(248,113,113,0.35), 0 0 24px 4px rgba(248,113,113,0.55)" : undefined,
                WebkitUserSelect: "none",
                userSelect: "none",
                WebkitTouchCallout: "none",
              }}
              aria-label="Quick actions"
            >
              <Plus size={24} className={"text-white transition-transform duration-200 " + (fabOpen && !fabDragging ? "rotate-45" : "")} />
            </button>
            </>}
          </div>
        </>
      )}

      {/* ITEM 18 — FAB "New Customer" popup, rendered at the top level so it
          overlays whatever page the owner is currently on. */}
      <CustomerModal open={fabQuickCustomerOpen} onClose={() => setFabQuickCustomerOpen(false)} data={null} onSave={saveFabQuickCustomer} mapsKey={(settings as any).googleMapsKey || (settings as any).mapsKey || ""} customers={customers} />

      {/* AUDIT FIX (mobile) — SopModal is `fixed inset-0`, meant to cover the
          real viewport, but rendering it inside the "sops" page slot puts it
          inside <PageFade>, whose wrapper div sets `transform: translateY(...)`
          — even at rest that's a non-"none" transform, which per spec makes
          that div a containing block for `position: fixed` descendants. So the
          "full screen" modal was actually being boxed into <main>'s small
          content area instead of the viewport, leaving nothing usable visible
          on mobile. Rendered here, as a sibling at the top level like every
          other modal, it escapes that trap and truly covers the viewport. */}
      <SopModal open={page === "sops"} onClose={() => setPage("dashboard")} editable ownerId={crmUserId} employees={employees} toast={toast} />

      {/* Company first-run setup modal */}
      {companySetupOpen && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-black/95 border border-red-900/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center mx-auto mb-3">
                <Globe size={24} className="text-white" />
              </div>
              <div className="text-lg font-bold">Welcome! Set up your account</div>
              <div className="text-sm text-white/50 mt-1">What's your company name?</div>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Company Name</label>
              <input
                autoFocus
                type="text"
                value={companySetupName}
                onChange={e => setCompanySetupName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveCompanySetup()}
                placeholder="e.g. Crew Boss"
                className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <button
              onClick={saveCompanySetup}
              disabled={!companySetupName.trim()}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-800 text-white text-sm font-semibold hover:from-red-500 hover:to-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Get Started
            </button>
            <button onClick={() => { setSetupDone("1"); setCompanySetupOpen(false); }} className="w-full text-center text-xs text-white/30 hover:text-white/50 transition">
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* Toasts — raised above the mobile bottom nav so they're not hidden behind it */}
      <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:right-auto z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={"pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium backdrop-blur animate-fade-in border " + (t.tone === "red" ? "bg-red-950/90 border-red-700/50 text-red-200" : t.tone === "yellow" ? "bg-yellow-950/90 border-yellow-700/50 text-yellow-200" : "bg-black/90 border-green-700/50 text-green-200")}>
            <div className={"w-1.5 h-1.5 rounded-full flex-shrink-0 " + (t.tone === "red" ? "bg-red-400" : t.tone === "yellow" ? "bg-yellow-400" : "bg-green-400")} />
            {t.msg}
          </div>
        ))}
      </div>
      {/* BUG FIX — replaces the old always-visible header "Notify Me" toggle
          with a one-time opt-in pop-up (see PushOptInPrompt.tsx). */}
      {hasCrmSession && crmUserId && <PushOptInPrompt ownerId={crmUserId} />}
    </div>
  );
}
