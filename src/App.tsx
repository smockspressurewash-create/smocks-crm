import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Users, FileText, Receipt, Briefcase, GitBranch,
  Calendar, MessageSquare, Megaphone, Star, Zap, Share2, UserPlus,
  Bot, Database, Users2, Truck, DollarSign, FlaskConical, BarChart3,
  TrendingUp, PiggyBank, Wallet, Heart, Gift, Monitor, Tag,
  Bell, Settings, X, Lock, Globe, ChevronLeft, ChevronRight, Plus, Undo2, Redo2, CheckCircle, Eye, EyeOff, Menu
} from "lucide-react";

import { useGlobalStyles } from "./hooks/useGlobalStyles";
import { usePersistent } from "./hooks/usePersistent";
import { usePersistentRaw } from "./hooks/usePersistentRaw";
import { usePollGate } from "./hooks/usePollGate";
import { useAutomationEngine } from "./hooks/useAutomationEngine";
import { useIsMobile } from "./hooks/useIsMobile";
import { supabase } from "./lib/supabase";
import { SafePage } from "./components/ui/ErrorBoundary";
import { PageFade } from "./components/ui/PageFade";
import { GlobalSearch } from "./components/ui/GlobalSearch";

// ─── Pages ────────────────────────────────────────────────────────────────────
import { Dashboard } from "./components/pages/Dashboard";
import { CustomersPage } from "./components/pages/CustomersPage";
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
import { AlfredPage } from "./components/pages/AlfredPage";
import { GoogleWorkspacePage } from "./components/pages/GoogleWorkspacePage";
import { EmployeesPage } from "./components/pages/EmployeesPage";
import { FleetPage } from "./components/pages/FleetPage";
import { ExpensesPage } from "./components/pages/ExpensesPage";
import { ChemicalsPage } from "./components/pages/ChemicalsPage";
import { ReportsPage } from "./components/pages/ReportsPage";
import { AnalyticsPage } from "./components/pages/AnalyticsPage";
import { BudgetPage } from "./components/pages/BudgetPage";
import { PersonalBudgetPage } from "./components/pages/PersonalBudgetPage";
import { AccountabilityPage } from "./components/pages/AccountabilityPage";
import { ReferralsPage } from "./components/pages/ReferralsPage";
import { PromotionsPage } from "./components/pages/PromotionsPage";
import { CrewView } from "./components/pages/CrewView";
import { SettingsModal } from "./components/pages/SettingsModal";
import { ClientPortal } from "./components/pages/ClientPortal";
import { ClientAuthPortal } from "./components/pages/ClientAuthPortal";
import { ReferralLanding } from "./components/pages/ReferralLanding";
import { CustomerReviewPage } from "./components/pages/CustomerReviewPage";
import { LeadFormPage } from "./components/pages/LeadFormPage";
import { EmployeePortal } from "./components/pages/EmployeePortal";
import { saveEmpGoogleToken } from "./lib/googleApi";
import { ResetPassword } from "./components/pages/ResetPassword";
import { OnboardingFlow } from "./components/ui/OnboardingFlow";

// ─── Seed data ────────────────────────────────────────────────────────────────
import {
  seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles,
  seedExpenses, seedChemicals, seedServices, seedAutomations,
  seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals,
  seedMaintenance, seedSocialPosts, seedTimeline, seedGoals, seedReminders,
  seedAccountabilityEntries, seedMileage, campaignTemplates,
} from "./lib/seed";
import { seedWeather } from "./lib/weather";
import { fetchRealWeather } from "./lib/weather";
import { fmt, uid, today, daysSince, daysFromNow, consumeOAuthIntent, getLastOwnerSessionFlag, setLastOwnerSessionFlag, getLastOwnerId, setLastOwnerId, buildChecklistFromServices, withTimeout, normalizeJobRow, totalJobPhotoCount, notifyDesktop } from "./lib/utils";
import { sendEmail, buildTomorrowJobsEmailHtml, buildDailyBriefingEmailHtml } from "./lib/messaging";
import { exchangeSocialOAuthCode, type SocialPlatform } from "./lib/socialOAuth";
import type {
  Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense,
  Chemical, Service, Campaign, Automation, Review, SocialPost,
  AccountabilityEntry, Goal, Win, Reminder, AppSettings,
  InboxThread, AlfredConversation, AlfredMessage, Timeline, ModelStatus,
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
      { id: "dashboard",  label: "Dashboard",  icon: LayoutDashboard },
      { id: "alfred",     label: "Alfred AI",  icon: Bot             },
      { id: "inbox",      label: "Inbox",      icon: MessageSquare   },
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
    label: "Operations",
    items: [
      { id: "jobs",       label: "Jobs",       icon: Briefcase  },
      { id: "calendar",   label: "Calendar",   icon: Calendar   },
      { id: "crew",       label: "Crew View",  icon: Monitor    },
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
      { id: "fleet",     label: "Fleet",     icon: Truck       },
      { id: "chemicals", label: "Chemicals", icon: FlaskConical},
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
async function resolveUserRole(session: any): Promise<"owner" | "manager" | "employee"> {
  if (!session?.user) return "owner";

  const cached = getCachedRole(session.user.id);
  if (cached) {
    return cached;
  }

  try {
    const { data } = await (supabase as any)
      .from("employees")
      .select("id, role")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (data) {
      const role = (data.role || "").toLowerCase();
      if (role === "owner") {
        return "owner";
      }
      if (role === "manager") {
        setCachedRole(session.user.id, "manager");
        return "manager";
      }
      setCachedRole(session.user.id, "employee");
      return "employee";
    }
  } catch { /* employees table may not exist */ }

  // No row matched by user_id — for a Google sign-in this is normal the
  // FIRST time an employee uses Google (their employees row was created by
  // the owner with just an email, never linked to an auth user_id yet). Try
  // matching by email and link it so every future lookup hits the fast
  // user_id path above.
  const email = session.user.email;
  if (email) {
    try {
      const { data: byEmail } = await (supabase as any)
        .from("employees")
        .select("id, role, user_id")
        .ilike("email", email)
        .maybeSingle();
      if (byEmail) {
        if (!byEmail.user_id) {
          (supabase as any).from("employees").update({ user_id: session.user.id }).eq("id", byEmail.id).catch(() => {});
        }
        const role = (byEmail.role || "").toLowerCase();
        if (role === "owner") return "owner";
        if (role === "manager") { setCachedRole(session.user.id, "manager"); return "manager"; }
        setCachedRole(session.user.id, "employee");
        return "employee";
      }
    } catch { /* employees table may not exist or have no email column */ }
  }

  const oauthIntent = consumeOAuthIntent();
  if (oauthIntent === "employee") {
    return "employee";
  }

  const identities = session.user.identities || [];
  const hasGoogle = identities.some((i: any) => i.provider === "google");
  if (hasGoogle) {
    return "owner";
  }

  return "employee";
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
  (supabase as any).from("employees")
    .update({ google_token: providerToken, google_refresh_token: bridgedRefreshToken || null, google_email: googleEmail, google_token_expires_at: new Date(expiresAt).toISOString() })
    .eq("user_id", session.user.id)
    .then((result: any) => {
      if (result?.error) {
        console.error("Could not persist employee Google token to Supabase:", result.error.message);
        return;
      }
      saveEmpGoogleToken(session.user.id, { token: providerToken, refreshToken: bridgedRefreshToken, email: googleEmail, expiresAt });
    })
    .catch((e: any) => console.error("Could not persist employee Google token to Supabase:", e?.message));
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
  // "owner" or "manager" — both get the CRM, but managers get a restricted Settings modal
  // (profile tab only) and can't touch billing/Stripe or delete company data.
  const [crmRole, setCrmRole] = useState<"owner" | "manager">("owner");
  // Last Supabase sync timestamp
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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
    const valid = ["dashboard","alfred","inbox","customers","estimates","invoices","pipeline","intake","jobs","calendar","crew","campaigns","reviews","automations","social","referrals","promotions","expenses","reports","analytics","budget","personal","accountability","employees","fleet","chemicals","google","portal","reset-password","client","referral","rate"];
    return valid.includes(hash) ? hash : "dashboard";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // FIX 3 (mobile round 4) — round 3's 50px edge zone / 50px threshold still
  // felt too hard to trigger reliably on a real phone. Widened the edge zone
  // further (a thumb rarely starts a swipe from the literal first 50px) and
  // lowered the distance needed, kept the flat vertical-drift allowance from
  // round 3. edgeSwipeProgress now also drives a live "peek" of the sidebar
  // itself (see the <aside> style below) proportional to how far the swipe
  // has gone, instead of only revealing it once the threshold is crossed.
  // BLOCKER 16 (mobile round 9) — user report: "detection area too small" —
  // widened from 120px to the requested 150px so a thumb swipe starting
  // further from the literal screen edge still registers as an open-gesture.
  const EDGE_ZONE_PX = 150;
  const SWIPE_THRESHOLD_PX = 30;
  const MAX_VERTICAL_DRIFT_PX = 100;
  const SIDEBAR_WIDTH_PX = 256; // matches the aside's w-64
  const mainTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [edgeSwipeProgress, setEdgeSwipeProgress] = useState(0); // 0..1
  const handleMainTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t.clientX < EDGE_ZONE_PX && !sidebarOpen) {
      mainTouchStartRef.current = { x: t.clientX, y: t.clientY };
      // FIX 3 (mobile round 4) — visible immediately on touch-down within the
      // zone, not just once the finger has moved (round 3's 0.05 was almost
      // imperceptible).
      setEdgeSwipeProgress(0.12);
    } else {
      mainTouchStartRef.current = null;
    }
  };
  const handleMainTouchMove = (e: React.TouchEvent) => {
    const start = mainTouchStartRef.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dy) > MAX_VERTICAL_DRIFT_PX) {
      mainTouchStartRef.current = null;
      setEdgeSwipeProgress(0);
      return;
    }
    setEdgeSwipeProgress(Math.max(0.12, Math.min(1, dx / SWIPE_THRESHOLD_PX)));
  };
  const handleMainTouchEnd = (e: React.TouchEvent) => {
    const start = mainTouchStartRef.current;
    mainTouchStartRef.current = null;
    setEdgeSwipeProgress(0);
    if (!start || sidebarOpen) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const distance = Math.round(Math.hypot(dx, dy));
    if (dx > SWIPE_THRESHOLD_PX && Math.abs(dy) <= MAX_VERTICAL_DRIFT_PX) {
      setSidebarOpen(true);
    }
  };
  const sidebarTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  // FIX 3 (mobile round 5) — swipe-to-close only ever checked the delta on
  // touchend, with no touchmove handler at all, so there was no live
  // animation and (per user report) the close gesture wasn't registering
  // reliably. sidebarCloseProgress mirrors edgeSwipeProgress's open-gesture
  // pattern: drives a live drag-out transform (see the <aside> style below)
  // so the sidebar visibly slides left as the finger moves, and commits the
  // close once the drag crosses SWIPE_THRESHOLD_PX.
  const [sidebarCloseProgress, setSidebarCloseProgress] = useState(0); // 0..1
  const handleSidebarTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    sidebarTouchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleSidebarTouchMove = (e: React.TouchEvent) => {
    const start = sidebarTouchStartRef.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = start.x - t.clientX; // positive = dragging left (closing)
    const dy = t.clientY - start.y;
    if (Math.abs(dy) > MAX_VERTICAL_DRIFT_PX) {
      sidebarTouchStartRef.current = null;
      setSidebarCloseProgress(0);
      return;
    }
    setSidebarCloseProgress(Math.max(0, Math.min(1, dx / SWIPE_THRESHOLD_PX)));
  };
  const handleSidebarTouchEnd = (e: React.TouchEvent) => {
    const start = sidebarTouchStartRef.current;
    sidebarTouchStartRef.current = null;
    setSidebarCloseProgress(0);
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = start.x - t.clientX;
    const dy = t.clientY - start.y;
    if (dx > SWIPE_THRESHOLD_PX && Math.abs(dy) <= MAX_VERTICAL_DRIFT_PX) {
      setSidebarOpen(false);
    }
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  // FIX 8 — "Add Manager" in Settings jumps to Employees with the invite
  // modal pre-opened (role defaulted to Manager) instead of duplicating the
  // whole invite form inside Settings.
  const [autoOpenManagerInvite, setAutoOpenManagerInvite] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
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
    const onMove = (e: PointerEvent) => {
      const x = Math.max(4, Math.min(window.innerWidth - FAB_SIZE - 4, e.clientX - fabDragOffsetRef.current.x));
      const y = Math.max(4, Math.min(getViewportHeight() - FAB_SIZE - 4, e.clientY - fabDragOffsetRef.current.y));
      setFabPosition({ x, y });
    };
    const onUp = () => {
      setFabDragging(false);
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

  // Direct social-platform OAuth callback (Facebook/LinkedIn/TikTok "Connect"
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
      if (tok) {
        const tokenField = platform === "facebook" ? "metaAccessToken" : platform === "linkedin" ? "linkedinAccessToken" : "tiktokAccessToken";
        setSettings(s => ({ ...s, [tokenField]: tok.accessToken }));
        toast(`${platform} connected ✓`, "green");
      } else {
        toast(`Could not connect ${platform} — check the backend URL in Settings`, "red");
      }
      setPage("social");
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for browser back/forward
  useEffect(() => {
    const valid = ["dashboard","alfred","inbox","customers","estimates","invoices","pipeline","intake","jobs","calendar","crew","campaigns","reviews","automations","social","referrals","promotions","expenses","reports","analytics","budget","personal","accountability","employees","fleet","chemicals","google","portal","reset-password","client","referral","rate","lead-form"];
    const handler = () => {
      const hash = window.location.hash.replace(/^#\/?/, "").split("?")[0];
      if (hash === "portal" || hash.startsWith("portal/")) { setPage("portal"); return; }
      if (hash === "referral" || hash.startsWith("r/")) { setPage("referral"); return; }
      if (hash === "rate" || hash.startsWith("rate?")) { setPage("rate"); return; }
      if (hash === "lead-form" || hash.startsWith("lead-form?")) { setPage("lead-form"); return; }
      if (hash.startsWith("estimate/")) { setPage("estimate"); return; }
      if (hash === "reset-password" || hash.startsWith("reset-password&") || hash.startsWith("reset-password?")) { setPage("reset-password"); return; }
      if (valid.includes(hash)) setPage(hash);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  // ── Undo stack ────────────────────────────────────────────────────────────
  const undoStackRef = useRef<Array<{ desc: string; fn: () => void }>>([]);
  const [undoCount, setUndoCount] = useState(0);
  const pushUndo = (desc: string, fn: () => void) => {
    undoStackRef.current = [...undoStackRef.current.slice(-19), { desc, fn }];
    setUndoCount(undoStackRef.current.length);
  };
  const undo = () => {
    if (!undoStackRef.current.length) return;
    const last = undoStackRef.current.pop()!;
    setUndoCount(undoStackRef.current.length);
    last.fn();
    toast("Undone: " + last.desc, "yellow");
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
  const [campaigns,       setCampaigns]       = usePersistent<Campaign[]>("smocks.campaigns", []);
  const [automations,     setAutomations]     = usePersistent<Automation[]>("smocks.automations", seedAutomations);
  const [reviews,         setReviews]         = usePersistent<Review[]>("smocks.reviews", []);
  const [socialPosts,     setSocialPosts]     = usePersistent<SocialPost[]>("smocks.socialPosts", []);
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
  const MAX_FIELD_CHARS = 20000;
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
          const r: any = await saveSettingsToSupabase(settings, updatedAt, 8000);
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
            const hint = /relation .* does not exist/i.test(firstErr?.message || "") || /on conflict/i.test(firstErr?.message || "")
              ? " — run supabase/migrations/0011_owner_settings_and_alfred_schema_fixes.sql in the Supabase SQL editor"
              : "";
            console.warn("[Settings Sync] error:", firstErr?.message + hint);
            toast("Settings saved to this device but not to the server — " + (firstErr?.message || "check connection") + hint, "red");
            return;
          }
          try {
            const retryUpdatedAt = new Date().toISOString();
            const r2: any = await saveSettingsToSupabase(payload, retryUpdatedAt, 8000);
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
            console.warn("[Settings Sync] error (both attempts failed):", secondErr?.message);
            toast("Settings saved to this device but not to the server — " + (secondErr?.message || "check connection"), "red");
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
    // sync mechanism — can't remove it, but 60s cuts its cost 6x same as
    // the jobs/customers/estimates poll above.
    const interval = setInterval(pollSettings, 60000);
    return () => clearInterval(interval);
  }, [crmUserId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const ownerEmail = settings.googleEmail || crmUserEmail;
    if (!crmUserId || !ownerEmail || ownerEmpRowEnsuredRef.current) return;
    ownerEmpRowEnsuredRef.current = true;
    const ownerId = `owner_${ownerEmail}`;
    if (employees.some(e => e.id === ownerId)) return;
    const rawName = settings.ownerName?.trim() || ownerEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    const firstName = rawName.split(" ")[0] || "Owner";
    const lastName = rawName.split(" ").slice(1).join(" ") || "";
    const ownerEmpRow: any = {
      id: ownerId, firstName, lastName, role: "owner", status: "active", email: ownerEmail, hourlyRate: 0,
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
  const invoiceActivityRef = useRef<Record<string, { viewed?: string; paid?: string; failed?: string; status?: string }>>({});
  const invoiceActivitySeededRef = useRef(false);
  const [invoiceNotifs, setInvoiceNotifs] = useState<{ id: string; text: string; at: number }[]>([]);
  useEffect(() => {
    if (!hasCrmSession) return;
    const snapshot: Record<string, { viewed?: string; paid?: string; failed?: string; status?: string }> = {};
    const newEvents: { id: string; text: string; at: number }[] = [];
    for (const e of estimates as any[]) {
      const cur = { viewed: e.clientViewedAt, paid: e.paidAt, failed: e.paymentFailedAt, status: e.status };
      snapshot[e.id] = cur;
      if (!invoiceActivitySeededRef.current) continue; // don't fire on first load
      const prev = invoiceActivityRef.current[e.id] || {};
      const custName = (() => { const c = customers.find(x => x.id === e.customerId); return c ? `${c.firstName} ${c.lastName}` : "A customer"; })();
      if (cur.paid && !prev.paid) newEvents.push({ id: e.id + ":paid", text: `💰 ${custName} paid invoice ${fmt(e.total)}`, at: Date.now() });
      else if (cur.failed && cur.failed !== prev.failed) newEvents.push({ id: e.id + ":failed", text: `⚠️ ${custName}'s payment failed on ${fmt(e.total)}`, at: Date.now() });
      else if (cur.viewed && !prev.viewed) newEvents.push({ id: e.id + ":viewed", text: `👀 ${custName} opened invoice ${fmt(e.total)}`, at: Date.now() });
      else if (cur.status === "rejected" && prev.status !== "rejected") newEvents.push({ id: e.id + ":rejected", text: `❌ ${custName} declined estimate ${fmt(e.total)}`, at: Date.now() });
      // FIX 17 — accepting a quote previously only fired the toast the CLIENT's
      // own browser showed itself (worthless to the owner, a different
      // session entirely) — nothing told the owner a quote was accepted.
      else if (cur.status === "approved" && prev.status !== "approved" && !(e as any).invoiced) newEvents.push({ id: e.id + ":approved", text: `✅ ${custName} accepted the quote for ${fmt(e.total)}`, at: Date.now() });
    }
    invoiceActivityRef.current = snapshot;
    if (!invoiceActivitySeededRef.current) { invoiceActivitySeededRef.current = true; return; }
    if (newEvents.length) {
      newEvents.forEach(ev => toast(ev.text, (ev.text.startsWith("⚠️") || ev.text.startsWith("❌")) ? "red" : "green"));
      setInvoiceNotifs(prev => [...newEvents, ...prev].slice(0, 20));
      // Email the owner too — a bell/toast only reaches them if the CRM tab is
      // open; accepted-quote and declined-quote are important enough to also
      // land in their inbox.
      const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
      if (ownerEmail) {
        newEvents.filter(ev => ev.id.endsWith(":approved") || ev.id.endsWith(":rejected")).forEach(ev => {
          sendEmail(settings as any, { to: ownerEmail, subject: "Quote update — " + (settings as any)?.companyName || "Crew Boss", body: ev.text }).catch(() => {});
        });
      }
    }
  }, [estimates, hasCrmSession]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const events: { id: string; text: string; at: number }[] = [];
    const empName = (e: any) => `${e.firstName || ""} ${e.lastName || ""}`.trim() || "An employee";
    for (const e of employees as any[]) {
      const cur = e.dayClockInAt ?? null;
      empSnap[e.id] = cur;
      if (!crewActivitySeededRef.current) continue;
      const prev = crewActivityEmpRef.current[e.id] ?? null;
      if (cur && !prev) events.push({ id: e.id + ":in:" + cur, text: `🟢 ${empName(e)} started their shift`, at: Date.now() });
      else if (!cur && prev) events.push({ id: e.id + ":out:" + Date.now(), text: `⏹ ${empName(e)} ended their shift`, at: Date.now() });
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
      if (cur.status === "completed" && prev.status && prev.status !== "completed") events.push({ id: j.id + ":done", text: `✅ Job completed — ${who}`, at: Date.now() });
      if (cur.arrivedAt && !prev.arrivedAt) events.push({ id: j.id + ":arrived", text: `📍 Crew arrived at ${who}`, at: Date.now() });
      if (photoCount > (prev.photoCount ?? 0)) events.push({ id: j.id + ":photos:" + photoCount, text: `📸 ${photoCount - (prev.photoCount ?? 0)} new photo${photoCount - (prev.photoCount ?? 0) !== 1 ? "s" : ""} — ${who}`, at: Date.now() });
      if (signed && !prev.signed) events.push({ id: j.id + ":signed", text: `✍️ Got customer sign-off — ${who}`, at: Date.now() });
      if (issueCount > (prev.issueCount ?? 0)) {
        const latestNote = [...(j.commLog || [])].reverse().find((c: any) => typeof c.note === "string" && c.note.startsWith("🚨 ISSUE REPORTED"));
        const text = `🚨 Problem reported — ${who}`;
        events.push({ id: j.id + ":issue:" + issueCount, text, at: Date.now() });
        // Desktop alert is the closest thing to "push" this single-page app can
        // do without a server (see notifyDesktop's own comment) — fire it only
        // for this highest-priority event, not every crew-activity ping.
        notifyDesktop(text, latestNote?.note?.replace("🚨 ISSUE REPORTED by ", "") || undefined);
      }
    }
    crewActivityEmpRef.current = empSnap;
    crewActivityJobRef.current = jobSnap;
    if (!crewActivitySeededRef.current) { crewActivitySeededRef.current = true; return; }
    if (events.length) {
      events.forEach(ev => toast(ev.text, ev.text.startsWith("🚨") ? "red" : undefined));
      setInvoiceNotifs(prev => [...events, ...prev].slice(0, 20));
    }
  }, [employees, jobs, hasCrmSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // Alfred
  const [alfredConversations, setAlfredConversations] = usePersistent<AlfredConversation[]>("smocks.alfredConvs", []);
  const [activeConvId, setActiveConvId]               = usePersistent<string>("smocks.alfredActiveConv", "");
  const [alfredMemory, setAlfredMemory]               = usePersistent("smocks.alfredMemory", []);
  const [personality, setPersonality]                 = usePersistent("smocks.alfredPersonality", "drillsergeant");
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
    // Re-evaluated on mount AND hourly thereafter (no server cron in a
    // client-only app — same pattern the "Tomorrow's Jobs" email effect
    // uses below) so a session left open all day still gets its up-to-3
    // check-ins spread across the day, not just a single mount-time check.
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

      const openGoals = (goalsList || []).filter((g: any) => !g.completed && !g.achieved);
      const staleEstimates = estimates.filter(e => e.status === "pending" && daysSince(e.createdAt) >= 5);
      const overdueInvoices = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 7);
      const incompleteJobsToday = jobs.filter(j => j.scheduledDate === todayStr && j.status !== "completed" && j.status !== "cancelled");
      const hasSomethingToSay = openGoals.length > 0 || staleEstimates.length > 0 || overdueInvoices.length > 0 || incompleteJobsToday.length > 0;
      if (!hasSomethingToSay) { console.log("[AlfredCheckin] skipped — nothing worth checking in about right now"); return; }

      const lines = [
        "👋 Checking in on you.",
        "",
        openGoals.length > 0 ? "🎯 " + openGoals.length + " personal goal" + (openGoals.length !== 1 ? "s" : "") + " still open." : "",
        incompleteJobsToday.length > 0 ? "🧰 " + incompleteJobsToday.length + " job" + (incompleteJobsToday.length !== 1 ? "s" : "") + " today not marked complete yet." : "",
        staleEstimates.length > 0 ? "💬 Clients waiting on a follow-up: " + staleEstimates.slice(0, 3).map(e => { const c = customers.find(x => x.id === e.customerId); return c ? c.firstName + " " + c.lastName : "?"; }).join(", ") + (staleEstimates.length > 3 ? " +" + (staleEstimates.length - 3) + " more" : "") + "." : "",
        overdueInvoices.length > 0 ? "💸 " + overdueInvoices.length + " overdue invoice" + (overdueInvoices.length !== 1 ? "s" : "") + " to collect on." : "",
        "",
        "Anything you want help tackling right now?",
      ].filter(Boolean);
      const msg = lines.join("\n");
      const newConv = { id: uid(), title: "Check-in — " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), personality, messages: [{ id: uid(), role: "alfred", content: msg, timestamp: Date.now() }], createdAt: Date.now(), updatedAt: Date.now() };
      console.log("[AlfredCheckin] firing check-in", countToday + 1, "of 3 for", todayStr);
      setAlfredConversations((prev: any[]) => [newConv, ...(prev || [])]);
      setSettings?.((prev: any) => ({ ...prev, alfredCheckinDate: todayStr, alfredCheckinsToday: countToday + 1, alfredLastCheckinAt: Date.now() }));
      toast?.("🤖 Alfred checked in — see the Alfred tab", "green");
    };
    const t = setTimeout(tryCheckin, 1500);
    const interval = setInterval(tryCheckin, 60 * 60 * 1000);
    return () => { clearTimeout(t); clearInterval(interval); };
    // Deliberately keyed only on crmUserId, not jobs/estimates/goalsList/
    // settings — tryCheckin reads settingsRef.current for the latest gating
    // state at fire-time without needing to re-subscribe this effect (and
    // therefore reset the hourly interval) on every unrelated data change.
  }, [crmUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Portal
  const [portalEstId, setPortalEstId] = useState<string | null>(null);
  const [openJobId, setOpenJobId] = useState<string | null>(null);

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
  });

  const refetchEmployees = async () => {
    try {
      const { data, error } = await (supabase as any).from("employees").select("*");
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
      const [{ data: sbJobs }, { data: sbCustomers }, { data: sbEstimates }, { data: sbPromotions }] = await Promise.all([
        (supabase as any).from("jobs").select("*"),
        (supabase as any).from("customers").select("*"),
        (supabase as any).from("estimates").select("*"),
        (supabase as any).from("promotions").select("*").then((r: any) => r).catch(() => ({ data: null })),
      ]);
      if (Array.isArray(sbJobs) && sbJobs.length > 0) {
        const normedJobs = sbJobs.map(normalizeJobRow);
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
        setCustomers(prev => {
          const sbMap = new Map(sbCustomers.map((c: any) => [c.id, c]));
          const merged = prev.map(c => sbMap.has(c.id) ? { ...c, ...sbMap.get(c.id) } : c);
          const existingIds = new Set(prev.map(c => c.id));
          const added = sbCustomers.filter((c: any) => !existingIds.has(c.id));
          return [...merged, ...added];
        });
      }
      if (Array.isArray(sbEstimates) && sbEstimates.length > 0) {
        setEstimates(prev => {
          const sbMap = new Map(sbEstimates.map((e: any) => [e.id, e]));
          const merged = prev.map(e => sbMap.has(e.id) ? { ...e, ...sbMap.get(e.id) } : e);
          const existingIds = new Set(prev.map(e => e.id));
          const added = sbEstimates.filter((e: any) => !existingIds.has(e.id));
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
      setLastSynced(new Date());
    } catch { /* tables may not exist yet */ }
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
          "crew", "clockInAt", "lunchStartAt", "lunchMinutes", "lunchExceeded", "pipelineStage", "photos", "videos",
          "preChecklist", "duringChecklist", "postChecklist", "checklist", "signOff", "scheduledTime", "commLog",
          "equipmentChecked", "notes",
        ] as const;
        const safeJobs = jobs.map(j => {
          const copy: any = { ...j };
          EMPLOYEE_OWNED_FIELDS.forEach(f => delete copy[f]);
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
  useEffect(() => {
    const interval = setInterval(async () => {
      if (customers.length > 0) {
        try {
          const { error } = await (supabase as any).from("customers").upsert(customers, { onConflict: "id" });
          if (error) console.warn("Customer auto-save failed:", error.message);
        } catch (err: any) { console.warn("Customer auto-save failed:", err?.message); }
      }
      if (estimates.length > 0) {
        try {
          const { error } = await (supabase as any).from("estimates").upsert(estimates, { onConflict: "id" });
          if (error) console.warn("Estimate auto-save failed:", error.message);
        } catch (err: any) { console.warn("Estimate auto-save failed:", err?.message); }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [customers, estimates]);

  // On first load, immediately push any localStorage customers + estimates to
  // Supabase so employees (and any other device) can read them right away,
  // without waiting up to 30s for the auto-save interval to fire.
  useEffect(() => {
    const syncLocalToSupabase = async () => {
      const stored = customers;
      if (stored.length > 0) {
        try {
          const { error } = await (supabase as any).from("customers").upsert(stored, { onConflict: "id" });
          if (error) console.warn("Initial customer sync failed:", error.message);
        } catch (err: any) { console.warn("Initial customer sync failed:", err?.message); }
      }
      const storedEst = estimates;
      if (storedEst.length > 0) {
        try {
          const { error } = await (supabase as any).from("estimates").upsert(storedEst, { onConflict: "id" });
          if (error) console.warn("Initial estimate sync failed:", error.message);
        } catch (err: any) { console.warn("Initial estimate sync failed:", err?.message); }
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
        .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => { refetchData(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () => { refetchData(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "estimates" }, () => { refetchData(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, () => { refetchEmployees(); })
        .subscribe();
    } catch { /* realtime may not be enabled on this project */ }
    // EGRESS FIX — jobs/customers/estimates carry inline base64 photos/videos
    // (see types/index.ts Photo.dataUrl etc.), so a select("*") poll re-
    // downloads every job's full media on every tick. Realtime above already
    // covers instant updates; this interval is only the cross-device/missed-
    // event fallback, so widened from 10s to 60s (6x less egress) rather than
    // removed outright.
    const dataInterval = setInterval(() => { if (shouldPollCrossDevice()) refetchData(); }, 60000);
    const crewInterval = setInterval(() => { if (shouldPollCrossDevice()) refetchEmployees(); }, 3000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(crewInterval);
      try { channel?.unsubscribe(); } catch { /* ignore */ }
    };
  }, [hasCrmSession, !!empSession]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const applyGoogleIdentity = (session: any) => {
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
        return {
          ...prev,
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
            if (event === "TOKEN_REFRESHED") {
              const freshProviderToken = (session as any)?.provider_token;
              if (freshProviderToken) {
                console.log("[GoogleConnect] TOKEN_REFRESHED carried a fresh provider_token — updating settings");
                setSettings((prev: any) => ({ ...prev, googleProviderToken: freshProviderToken, googleTokenExpiresAt: Date.now() + 55 * 60 * 1000 }));
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

            const userRole = await resolveUserRole(session);

            if (userRole === "employee") {
              // Force the hash to #/portal immediately too — belt-and-suspenders so the
              // URL itself never points at a CRM route while this resolves.
              if (!window.location.hash.startsWith("#/portal")) window.location.hash = "/portal";
              setEmpSession(session);
              setPage("portal");
              setOauthProcessing(false);
              persistEmployeeGoogleToken(session);
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
            if (session?.user?.id) { setCrmUserId(session.user.id); setLastOwnerId(session.user.id); }
            applyGoogleIdentity(session);

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
        const initRole = await resolveUserRole(initial);
        if (initial && initRole === "employee") {
          if (!window.location.hash.startsWith("#/portal")) window.location.hash = "/portal";
          setEmpSession(initial);
          setPage("portal");
          setOauthProcessing(false);
          persistEmployeeGoogleToken(initial);
        } else {
          if (initial) { setHasCrmSession(true); setLastOwnerSessionFlag(true); }
          else { setHasCrmSession(false); setLastOwnerSessionFlag(false); }
          setCrmRole(initRole === "manager" ? "manager" : "owner");
          if (initial?.user?.id) { setCrmUserId(initial.user.id); setLastOwnerId(initial.user.id); }
          applyGoogleIdentity(initial);
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
      fetchRealWeather(settings.owmKey, (settings as any).weatherLocation)
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
        const html = buildTomorrowJobsEmailHtml(settings.companyName || "Crew Boss", emp.firstName, jobsList);
        try { await sendEmail(settings as any, emp.email, "Tomorrow's Jobs", html); } catch { /* best-effort */ }
      }
      localStorage.setItem(dedupeKey, "1");
    };
    checkAndSendTomorrowJobs();
    const interval = setInterval(checkAndSendTomorrowJobs, 60 * 60 * 1000);
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
    const late = todaysJobs.filter(j => {
      if (!j.clockInAt || !j.scheduledTime) return false;
      const scheduled = new Date(`${j.scheduledDate}T${j.scheduledTime}:00`).getTime();
      return (j.clockInAt - scheduled) / 60000 > 15;
    }).length;
    const issues = todaysJobs.flatMap(j => (j.commLog || []).filter((e: any) => e.type === "note" && (e.date || "").startsWith(tKey))).length;
    const html = buildDailyBriefingEmailHtml(settings.companyName || "Crew Boss", { completed: completed.length, total: todaysJobs.length, revenue, late, issues });
    const toEmail = settings.companyEmail || settings.myEmail;
    if (!toEmail) { toast("Add a business email in Settings → My Profile first", "yellow"); return; }
    try {
      await sendEmail(settings as any, toEmail, "Daily Briefing", html);
      toast("Daily briefing sent ✓");
    } catch (e: any) {
      toast(e.message || "Failed to send daily briefing", "red");
    }
  };

  // Automation engine
  useAutomationEngine({ automations, setAutomations, jobs, customers, estimates, referrals, settings, toast });

  // Sign out — clears Supabase session and forces login page.
  // signOut() defaults to scope: "global", which revokes the refresh token
  // server-side and signs the account out of EVERY device, not just this
  // one — that's what made signing out on one device log out the other.
  // scope: "local" only clears this browser's session.
  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
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
  if (page === "estimate") {
    const estId = window.location.hash.replace(/^#\/?/, "").split("?")[0].replace(/^estimate\/?/, "");
    const est = estimates.find(e => e.id === estId);
    const estCust = est ? customers.find(c => c.id === est.customerId) : undefined;
    if (!est) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center text-white/50 text-sm p-4 text-center">
          Loading your estimate… if this doesn't load in a few seconds, the link may have expired — contact {settings.companyName || "the business"} for a new one.
        </div>
      );
    }
    return (
      <ClientPortal
        estimate={est}
        customer={estCust}
        jobs={jobs}
        invoices={estimates.filter(e => e.invoiced)}
        settings={settings}
        estimateTemplates={estimateTemplates}
        promotions={promotions}
        customers={customers}
        setCustomers={setCustomers}
        onClose={() => { window.location.hash = "/client"; }}
        onView={id => setEstimates(prev => prev.map(e => e.id === id && !e.viewed ? { ...e, viewed: true, viewedAt: new Date().toISOString() } : e))}
        onApprove={(id, data) => {
          const paid = data.payChoice !== "later";
          setEstimates(prev => prev.map(e => e.id === id ? {
            ...e, status: "approved", signedAt: data.signedAt || e.signedAt, sigData: data.sigData || e.sigData, payChoice: data.payChoice,
            ...(paid ? { paidAt: today() } : {}),
            paidDeposit: data.payType === "deposit" ? data.totalPaid : (e.paidDeposit || 0),
            paidFull: data.payType === "full" ? data.totalPaid : data.payType === "remaining" ? (e.paidDeposit || 0) + data.totalPaid : (e.paidFull || 0),
          } : e));
          (supabase as any).from("estimates").update({
            status: "approved", signedAt: data.signedAt, sigData: data.sigData, payChoice: data.payChoice,
            ...(paid ? { paidAt: today() } : {}),
          }).eq("id", id).catch(() => {});
          setJobs(prev => {
            if (prev.some(j => (j as any).estimateId === id)) return prev;
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
            (supabase as any).from("jobs").insert(newJob).catch(() => {});
            return [...prev, newJob];
          });
          toast(paid ? "✓ Paid — " + fmt(data.totalPaid) : "✓ Signed — you'll pay later");
        }}
        onDecline={async (id: string, data: { reason?: string }) => {
          const declinedAt = new Date().toISOString();
          setEstimates(prev => prev.map(e => e.id === id ? { ...e, status: "rejected", declinedAt, declineReason: data.reason || "" } as any : e));
          try { await (supabase as any).from("estimates").update({ status: "rejected", declinedAt, declineReason: data.reason || "" }).eq("id", id); } catch { /* ignore */ }
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
          scopes: "email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/drive.readonly",
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
              <span className="text-3xl font-black">CB</span>
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
  const visibleNavGroups = navGroups
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
  return (
    <div className="flex h-screen overflow-hidden bg-black text-white">
      {/* Sidebar overlay for mobile */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar — its own touch handlers close it on a leftward swipe */}
      <aside
        onTouchStart={handleSidebarTouchStart}
        onTouchMove={handleSidebarTouchMove}
        onTouchEnd={handleSidebarTouchEnd}
        className={"fixed inset-y-0 left-0 z-30 w-64 bg-black/95 border-r border-red-900/30 flex flex-col transition-transform duration-300 ease-out md:relative md:translate-x-0 " + (sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")}
        // FIX 3 (mobile round 4/5) — while an edge-swipe-open is actively in
        // progress (not yet open), or a swipe-to-close drag is in progress
        // (already open), override the class-driven transform so the sidebar
        // visibly follows the finger instead of only snapping at the
        // threshold. transition: "none" here so it tracks 1:1 with no lag;
        // once the touch ends both progress values reset to 0, this inline
        // style drops away, and the normal duration-300 class transition
        // takes over for the final snap open/closed.
        // BLOCKER 8 (mobile round 7) — without an explicit touch-action, a
        // touchmove that starts anywhere inside the scrollable <nav> below
        // (overflow-y-auto) can get claimed by the browser's own native
        // scroll-vs-gesture disambiguation before our horizontal-delta JS
        // ever sees a clean drag, which is why swipe-to-close could feel
        // like it "didn't work" depending on exactly where the drag started.
        // pan-y tells the browser vertical scrolling is still native but
        // horizontal motion is ours to interpret.
        style={{
          touchAction: "pan-y",
          ...(edgeSwipeProgress > 0 && !sidebarOpen
            ? { transform: `translateX(calc(-100% + ${Math.round(edgeSwipeProgress * SIDEBAR_WIDTH_PX)}px))`, transition: "none" }
            : sidebarCloseProgress > 0 && sidebarOpen
            ? { transform: `translateX(-${Math.round(sidebarCloseProgress * SIDEBAR_WIDTH_PX)}px)`, transition: "none" }
            : {}),
        }}
      >
        {/* Logo */}
        <div className="p-4 border-b border-red-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center font-black text-sm shadow-lg shadow-red-900/40">
              {(settings.companyName || "S")[0].toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">{settings.companyName || "Crew Boss OS"}</div>
              <div className="text-[10px] text-white/40">Business CRM</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-white/40 hover:text-white p-1"><X size={16} /></button>
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

      {/* Edge-swipe visual feedback — a growing shadow/gradient on the left
          edge while an armed swipe is in progress, so there's an indication
          the sidebar is about to open before it actually crosses the
          threshold. Pointer-events-none so it never intercepts the touch. */}
      {edgeSwipeProgress > 0 && !sidebarOpen && (
        <div
          className="md:hidden fixed inset-y-0 left-0 z-40 pointer-events-none transition-opacity"
          style={{
            width: 80,
            opacity: edgeSwipeProgress,
            background: "linear-gradient(to right, rgba(220,38,38,0.35), transparent)",
            boxShadow: "4px 0 24px rgba(220,38,38,0.25)",
          }}
        />
      )}

      {/* Main content — its own touch handlers open the sidebar on an
          edge-swipe-right (only armed when the touch starts within 50px of
          the left edge, so normal scrolling/tapping elsewhere is untouched) */}
      <div
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        onTouchStart={handleMainTouchStart}
        onTouchMove={handleMainTouchMove}
        onTouchEnd={handleMainTouchEnd}
      >
        {/* Header */}
        <header className="flex items-center gap-2 px-4 py-3 border-b border-red-900/30 bg-black/80 backdrop-blur flex-shrink-0 relative z-40">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2.5 -ml-1 text-white/50 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center">
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          <GlobalSearch customers={customers} jobs={jobs} estimates={estimates} onNav={setPage} />
          {/* Undo */}
          <button onClick={undo} disabled={undoCount === 0} title="Undo last action" className={"p-2 rounded-lg transition " + (undoCount > 0 ? "text-white/60 hover:text-white hover:bg-white/5" : "text-white/20 cursor-not-allowed")}>
            <Undo2 size={16} />
          </button>
          {/* Redo (visual only — stack not yet wired) */}
          <button disabled title="Nothing to redo" className="p-2 rounded-lg text-white/20 cursor-not-allowed hidden md:flex">
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
          {/* Portal button — opens latest approved estimate in ClientPortal */}
          <button
            onClick={() => {
              const latest = estimates.find(e => e.status === "approved" || (e as any).invoiced);
              if (latest) { setPortalEstId(latest.id); }
              else { setPage("estimates"); toast("Approve an estimate first to access the client portal", "yellow"); }
            }}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-black/40 border border-red-900/30 rounded-xl text-xs text-white/50 hover:text-white hover:border-red-600/50 transition"
          >
            <Globe size={13} />Portal
          </button>
          {/* Notifications */}
          <div className="relative">
          <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2 text-white/60 hover:text-white">
            <Bell size={18} />
            {(negativeAlerts.length + overdueCount + lowStock) > 0 && (
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
                  {invoiceNotifs.map(n => (
                    <button key={n.id + n.at} onClick={() => { setPage("invoices"); setNotifOpen(false); }} className="w-full flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl text-left">
                      <div className="p-1.5 rounded-lg bg-green-950/30 text-green-400"><Receipt size={12} /></div>
                      <div><div className="text-xs font-semibold">{n.text}</div><div className="text-[10px] text-white/40">{new Date(n.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div></div>
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
                  {negativeAlerts.length === 0 && overdueCount === 0 && lowStock === 0 && invoiceNotifs.length === 0 && estimates.filter(e => e.status === "pending" && daysSince(e.createdAt) >= 7).length === 0 && (
                    <div className="p-6 text-center text-sm text-white/40">All clear ✓</div>
                  )}
                </div>
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
                    <div className="font-semibold text-sm truncate">{settings.ownerName || settings.userName || "Owner"}</div>
                    <div className="text-xs text-white/40 truncate mt-0.5">{crmUserEmail || settings.googleEmail || "—"}</div>
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
        <main className={"flex-1 pb-16 md:pb-0 " + (page === "alfred" ? "flex flex-col overflow-hidden" : "overflow-y-auto")}>
          <div className={page === "alfred" ? "flex-1 flex flex-col min-h-0 p-2 md:p-3" : "px-3 py-4 md:p-6 max-w-[1600px] mx-auto"}>
            <PageFade key={page} className={page === "alfred" ? "flex-1 min-h-0 flex flex-col" : ""}>
              <SafePage>
                {page === "dashboard"      && <Dashboard jobs={jobs} setJobs={setJobs} customers={customers} estimates={estimates} setEstimates={setEstimates} automations={automations} stats={{ totalRev, activeJobs, pendingEst, closeRate, doneMonth }} goals={{ revenue: settings.monthlyRevenueGoal ?? 8000, jobCount: settings.monthlyJobsGoal ?? 20 }} vehicles={vehicles} maintenance={maintenance} chemicals={chemicals} settings={settings} setSettings={setSettings} onNav={setPage} toast={toast} weatherData={weatherData} weatherFetchError={weatherFetchError} inboxThreads={inboxThreads} employees={employees} crewFetchError={crewFetchError} reviews={reviews} onSendDailyBriefing={sendDailyBriefingNow} onViewJob={id => { setOpenJobId(id); setPage("jobs"); }} ownerId={crmUserId} />}
                {page === "customers"      && <CustomersPage customers={customers} setCustomers={setCustomers} estimates={estimates} jobs={jobs} employees={employees} toast={toast} timeline={timeline} setTimeline={setTimeline} settings={settings} />}
                {page === "estimates"      && <EstimatesPage estimates={estimates} setEstimates={setEstimates} customers={customers} services={services} settings={settings} toast={toast} onPortal={id => setPortalEstId(id)} estimateTemplates={estimateTemplates} setEstimateTemplates={setEstimateTemplates} setJobs={setJobs} onNav={setPage} />}
                {page === "invoices"       && <InvoicesPage estimates={estimates} setEstimates={setEstimates} customers={customers} settings={settings} toast={toast} jobs={jobs} setJobs={setJobs} />}
                {page === "jobs"           && <JobsPage jobs={jobs} setJobs={setJobs} customers={customers} setCustomers={setCustomers} employees={employees} estimates={estimates} setEstimates={setEstimates} settings={settings} toast={toast} posts={socialPosts} setPosts={setSocialPosts} setTimeline={setTimeline} initialDetailId={openJobId} onInitialDetailIdConsumed={() => setOpenJobId(null)} onPortal={id => setPortalEstId(id)} ownerId={crmUserId} />}
                {page === "pipeline"       && <PipelinePage jobs={jobs} setJobs={setJobs} customers={customers} toast={toast} />}
                {page === "calendar"       && <CalendarPage jobs={jobs} setJobs={setJobs} customers={customers} employees={employees} toast={toast} settings={settings} ownerId={crmUserId} />}
                {page === "inbox"          && (managerBlocked("inbox") ? <RestrictedNotice label="the Inbox" /> : <InboxPage threads={inboxThreads} setThreads={setInboxThreads} customers={customers} settings={settings} toast={toast} />)}
                {page === "campaigns"      && <CampaignsPage campaigns={campaigns} setCampaigns={setCampaigns} customers={customers} estimates={estimates} jobs={jobs} settings={settings} inboxThreads={inboxThreads} setInboxThreads={setInboxThreads} toast={toast} />}
                {page === "reviews"        && <ReviewsPage reviews={reviews} setReviews={setReviews} jobs={jobs} customers={customers} toast={toast} negativeAlerts={negativeAlerts} setNegativeAlerts={setNegativeAlerts} settings={settings} setSettings={setSettings} />}
                {page === "automations"    && <AutomationsPage automations={automations} setAutomations={setAutomations} jobs={jobs} customers={customers} estimates={estimates} settings={settings} setSettings={setSettings} toast={toast} />}
                {page === "social"         && <SocialPage posts={socialPosts} setPosts={setSocialPosts} toast={toast} settings={settings} />}
                {page === "intake"         && <LeadIntakePage customers={customers} setCustomers={setCustomers} estimates={estimates} setEstimates={setEstimates} services={services} settings={settings} toast={toast} onNav={setPage} />}
                {page === "alfred"         && (managerBlocked("alfred") ? <RestrictedNotice label="Alfred AI" /> : <AlfredPage conversations={alfredConversations} setConversations={setAlfredConversations} activeConvId={activeConvId} setActiveConvId={setActiveConvId} memory={alfredMemory} setMemory={setAlfredMemory} personality={personality} setPersonality={setPersonality} apiKey={settings.anthropicKey ?? settings.geminiKey ?? ""} openSettings={() => setSettingsOpen(true)} toast={toast} jobs={jobs} setJobs={setJobs} estimates={estimates} setEstimates={setEstimates} customers={customers} setCustomers={setCustomers} employees={employees} automations={automations} setAutomations={setAutomations} stats={{ totalRev, activeJobs, pendingEst, closeRate, doneMonth }} setWins={setWins} goals={goalsList} setGoals={setGoalsList} setSettings={setSettings} settings={settings} modelStatus={modelStatus} setModelStatus={setModelStatus} onNav={setPage} ownerId={crmUserId} />)}
                {page === "google"         && (managerBlocked("google") ? <RestrictedNotice label="Google Workspace" /> : <GoogleWorkspacePage settings={settings} setSettings={setSettings} googleData={googleData as any} setGoogleData={setGoogleData} customers={customers} setCustomers={setCustomers} jobs={jobs} toast={toast} onNav={setPage} />)}
                {page === "employees"      && <EmployeesPage employees={employees} setEmployees={setEmployees} jobs={jobs} customers={customers} settings={settings} toast={toast} autoOpenManagerInvite={autoOpenManagerInvite} onAutoOpenManagerInviteConsumed={() => setAutoOpenManagerInvite(false)} />}
                {page === "fleet"          && <FleetPage vehicles={vehicles} setVehicles={setVehicles} maintenance={maintenance} setMaintenance={setMaintenance} toast={toast} />}
                {page === "expenses"       && <ExpensesPage expenses={expenses} setExpenses={setExpenses} />}
                {page === "chemicals"      && <ChemicalsPage chemicals={chemicals} setChemicals={setChemicals} toast={toast} settings={settings} />}
                {page === "reports"        && <ReportsPage jobs={jobs} customers={customers} estimates={estimates} expenses={expenses} employees={employees} chemicals={chemicals} />}
                {page === "analytics"      && <AnalyticsPage jobs={jobs} customers={customers} estimates={estimates} expenses={expenses} />}
                {page === "budget"         && <BudgetPage jobs={jobs} estimates={estimates} expenses={expenses} settings={settings} toast={toast} />}
                {page === "personal"       && <PersonalBudgetPage toast={toast} />}
                {page === "accountability" && (managerBlocked("accountability") ? <RestrictedNotice label="Accountability Tools" /> : <AccountabilityPage entries={accountability} setEntries={setAccountability} goals={goalsList} setGoals={setGoalsList} wins={wins} setWins={setWins} toast={toast} settings={settings} />)}
                {page === "referrals"      && <ReferralsPage customers={customers} setCustomers={setCustomers} jobs={jobs} toast={toast} settings={settings} setSettings={setSettings} />}
                {page === "promotions"     && <PromotionsPage promotions={promotions} setPromotions={setPromotions} customers={customers} services={services} settings={settings} toast={toast} />}
                {page === "crew"           && <CrewView jobs={jobs} setJobs={setJobs} customers={customers} employees={employees} toast={toast} settings={settings} estimates={estimates} setEstimates={setEstimates} refetchEmployees={refetchEmployees} ownerId={crmUserId} />}
              </SafePage>
            </PageFade>
          </div>
        </main>

        {/* Mobile bottom nav — quick access to the 4 most-used sections;
            everything else still lives behind the hamburger sidebar. */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-black/95 border-t border-red-900/30 backdrop-blur flex items-stretch" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {[
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "jobs", label: "Jobs", icon: Briefcase },
            { id: "customers", label: "Customers", icon: Users },
            { id: "estimates", label: "Estimates", icon: FileText },
          ].map(item => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
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
        settings={settings}
        setSettings={setSettings}
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
        toast={toast}
        onSignOut={handleSignOut}
        restrictToProfile={crmRole === "manager"}
        onAddManager={() => { setSettingsOpen(false); setAutoOpenManagerInvite(true); setPage("employees"); }}
      />

      {/* Client portal */}
      {portalEstId && (
        <ClientPortal
          estimate={estimates.find(e => e.id === portalEstId)}
          customer={customers.find(c => c.id === estimates.find(e => e.id === portalEstId)?.customerId)}
          jobs={jobs}
          invoices={estimates.filter(e => e.invoiced)}
          settings={settings}
          estimateTemplates={estimateTemplates}
          promotions={promotions}
          customers={customers}
          setCustomers={setCustomers}
          onClose={() => setPortalEstId(null)}
          onView={id => setEstimates(prev => prev.map(e => e.id === id && !e.viewed ? { ...e, viewed: true, viewedAt: new Date().toISOString() } : e))}
          onApprove={(id, data) => {
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
            setJobs(prev => {
              if (prev.some(j => (j as any).estimateId === id)) return prev;
              const est = estimates.find(e => e.id === id);
              if (!est) return prev;
              const cust = customers.find(c => c.id === est.customerId);
              const combinedChecklist = buildChecklistFromServices(est.lineItems, services);
              return [...prev, {
                id: uid(), customerId: est.customerId, address: cust?.address || "",
                amount: est.total, status: "scheduled", scheduledDate: "", duration: 2,
                priority: "normal", crew: [], checklist: combinedChecklist, preChecklist: combinedChecklist, photos: [], chemicalsUsed: [],
                equipment: [], tags: ["Needs Scheduling"], commLog: [],
                notes: "From approved estimate #" + id.slice(-4).toUpperCase(),
                createdAt: today(), estimateId: id,
              } as any];
            });
            toast(paid ? "✓ Paid — " + fmt(data.totalPaid) : "✓ Signed — customer will pay later");
            setPortalEstId(null);
          }}
          onDecline={async (id: string, data: { reason?: string }) => {
            const declinedAt = new Date().toISOString();
            setEstimates(prev => prev.map(est => est.id === id ? { ...est, status: "rejected", declinedAt, declineReason: data.reason || "" } as any : est));
            // Write immediately rather than waiting on the 30s bulk autosave —
            // the owner's invoiceActivity diff (above) only fires once this
            // lands in Supabase and the owner's own poll picks it up.
            try {
              const { error } = await (supabase as any).from("estimates").update({ status: "rejected", declinedAt, declineReason: data.reason || "" }).eq("id", id);
              if (error) console.warn("Decline failed to save server-side:", error.message);
            } catch (e: any) {
              console.warn("Decline failed to save server-side:", e?.message);
            }
          }}
        />
      )}

      {/* FAB — floating quick-action button */}
      {settings.fabEnabled !== false && (
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
                        onClick={() => { setPage(item.dest); setFabOpen(false); setSidebarOpen(false); }}
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
    </div>
  );
}
