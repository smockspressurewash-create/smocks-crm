import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Users, FileText, Receipt, Briefcase, GitBranch,
  Calendar, MessageSquare, Megaphone, Star, Zap, Share2, UserPlus,
  Bot, Database, Users2, Truck, DollarSign, FlaskConical, BarChart3,
  TrendingUp, PiggyBank, Wallet, Heart, Gift, Monitor,
  Bell, Settings, X, Lock, Globe, ChevronLeft, ChevronRight, Plus, Undo2, Redo2, CheckCircle
} from "lucide-react";

import { useGlobalStyles } from "./hooks/useGlobalStyles";
import { usePersistent } from "./hooks/usePersistent";
import { usePersistentRaw } from "./hooks/usePersistentRaw";
import { useAutomationEngine } from "./hooks/useAutomationEngine";
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
import { CrewView } from "./components/pages/CrewView";
import { SettingsModal } from "./components/pages/SettingsModal";
import { ClientPortal } from "./components/pages/ClientPortal";
import { EmployeePortal } from "./components/pages/EmployeePortal";

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
import { fmt, uid, today, daysSince, daysFromNow } from "./lib/utils";
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
      { id: "referrals",   label: "Referrals",   icon: Gift      },
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

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  useGlobalStyles();

  // ── OAuth redirect debug ──────────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash;
    console.log("HASH ON LOAD:", hash.substring(0, 100));
    console.log("FULL URL:", window.location.href.substring(0, 200));
  }, []);

  // ── Manual OAuth token exchange ───────────────────────────────────────────
  // detectSessionInUrl isn't reliably processing the implicit-flow hash, so we
  // extract the tokens ourselves and call setSession() directly on mount.
  // provider_token (Google OAuth token) is bridged via sessionStorage so
  // applyGoogleIdentity (which has setSettings) can persist it.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;
    const params = new URLSearchParams(hash.substring(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const provider_token = params.get("provider_token");
    const provider_refresh_token = params.get("provider_refresh_token");
    // Bridge Google tokens to applyGoogleIdentity via sessionStorage
    if (provider_token) sessionStorage.setItem("smocks.gpt", provider_token);
    if (provider_refresh_token) sessionStorage.setItem("smocks.grt", provider_refresh_token);
    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
        if (error) {
          console.error("setSession failed:", error);
        } else {
          console.log("setSession succeeded — user:", data.session?.user?.email,
            "provider_token in hash:", !!provider_token);
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
  // True once we've checked Supabase for an existing session on first load.
  // Prevents the CRM flashing briefly before the employee session is restored.
  const [sessionChecked, setSessionChecked] = useState(false);

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

  // ── Navigation ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(() => {
    // Restore page from URL hash on first load
    const hash = window.location.hash.replace(/^#\/?/, "").split("?")[0];
    const valid = ["dashboard","alfred","inbox","customers","estimates","invoices","pipeline","intake","jobs","calendar","crew","campaigns","reviews","automations","social","referrals","expenses","reports","analytics","budget","personal","accountability","employees","fleet","chemicals","google","portal"];
    return valid.includes(hash) ? hash : "dashboard";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  // Sync URL hash when page changes — skip if the hash is an OAuth callback or invite link
  useEffect(() => {
    if (window.location.hash.includes("access_token")) return;
    if (window.location.hash.includes("invite=")) return;
    window.location.hash = "/" + page;
  }, [page]);

  // Listen for browser back/forward
  useEffect(() => {
    const valid = ["dashboard","alfred","inbox","customers","estimates","invoices","pipeline","intake","jobs","calendar","crew","campaigns","reviews","automations","social","referrals","expenses","reports","analytics","budget","personal","accountability","employees","fleet","chemicals","google","portal"];
    const handler = () => {
      const hash = window.location.hash.replace(/^#\/?/, "").split("?")[0];
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
  const [vehicles,        setVehicles]        = usePersistent<Vehicle[]>("smocks.vehicles", seedVehicles);
  const [maintenance,     setMaintenance]     = usePersistent<MaintenanceRecord[]>("smocks.maintenance", seedMaintenance);
  const [expenses,        setExpenses]        = usePersistent<Expense[]>("smocks.expenses", seedExpenses);
  const [chemicals,       setChemicals]       = usePersistent<Chemical[]>("smocks.chemicals", seedChemicals);
  const [services,        setServices]        = usePersistent<Service[]>("smocks.services", seedServices);
  const [campaigns,       setCampaigns]       = usePersistent<Campaign[]>("smocks.campaigns", []);
  const [automations,     setAutomations]     = usePersistent<Automation[]>("smocks.automations", seedAutomations);
  const [reviews,         setReviews]         = usePersistent<Review[]>("smocks.reviews", []);
  const [socialPosts,     setSocialPosts]     = usePersistent<SocialPost[]>("smocks.socialPosts", seedSocialPosts);
  const [inboxThreads,    setInboxThreads]    = usePersistent<InboxThread[]>("smocks.inbox", []);
  const [accountability,  setAccountability]  = usePersistent<AccountabilityEntry[]>("smocks.accountability", seedAccountabilityEntries);
  const [goalsList,       setGoalsList]       = usePersistent<Goal[]>("smocks.goals", seedGoals);
  const [wins,            setWins]            = usePersistent<Win[]>("smocks.wins", []);
  const [negativeAlerts,  setNegativeAlerts]  = usePersistent<Review[]>("smocks.negativeAlerts", []);
  const [referrals,       setReferrals]       = usePersistent<typeof seedReferrals>("smocks.referrals", seedReferrals);
  const [emailTemplates,    setEmailTemplates]    = usePersistent("smocks.emailTpls", seedEmailTemplates);
  const [smsTemplates,      setSmsTemplates]      = usePersistent("smocks.smsTpls", seedSmsTemplates);
  const [estimateTemplates, setEstimateTemplates] = usePersistent<any[]>("smocks.estimateTpls", []);
  const [timeline,        setTimeline]        = usePersistent<Timeline>("smocks.timeline", seedTimeline as Timeline);
  const [settings,        setSettings]        = usePersistent<AppSettings>("smocks.settings", {
    companyName: "Smock's Pressure Washing",
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

  // Alfred
  const [alfredConversations, setAlfredConversations] = usePersistent<AlfredConversation[]>("smocks.alfredConvs", []);
  const [activeConvId, setActiveConvId]               = usePersistent<string>("smocks.alfredActiveConv", "");
  const [alfredMemory, setAlfredMemory]               = usePersistent("smocks.alfredMemory", []);
  const [personality, setPersonality]                 = usePersistent("smocks.alfredPersonality", "drillsergeant");
  const [modelStatus, setModelStatus]                 = usePersistent<ModelStatus>("smocks.modelStatus", {});
  const [googleData, setGoogleData]                   = usePersistent("smocks.googleData", {});

  // Portal
  const [portalEstId, setPortalEstId] = useState<string | null>(null);

  // Company first-run setup
  const [setupDone, setSetupDone] = usePersistentRaw("smocks.setupDone", "");
  const [companySetupOpen, setCompanySetupOpen] = useState(false);
  const [companySetupName, setCompanySetupName] = useState("");

  useEffect(() => {
    if (settings.googleConnected && !setupDone && !oauthProcessing) {
      setCompanySetupName((settings as any).companyName || "");
      setCompanySetupOpen(true);
    }
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
  const [weatherData, setWeatherData] = useState(seedWeather);

  // Computed stats
  const thisMonth = today().slice(0, 7);
  const totalRev  = jobs.filter(j => j.status === "completed").reduce((s, j) => s + j.amount, 0);
  const activeJobs = jobs.filter(j => j.status === "scheduled" || j.status === "in_progress").length;
  const pendingEst = estimates.filter(e => e.status === "pending").length;
  const doneMonth  = jobs.filter(j => j.status === "completed" && (j.scheduledDate ?? "").startsWith(thisMonth)).length;
  const sentEsts   = estimates.filter(e => e.sentAt).length;
  const closeRate  = sentEsts > 0 ? Math.round((estimates.filter(e => e.status === "approved").length / sentEsts) * 100) : 0;
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

  // ── Supabase Google OAuth / identity-link capture ────────────────────────
  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;

    const applyGoogleIdentity = (session: any) => {
      if (!session?.user) return;
      const googleId = (session.user.identities || []).find((i: any) => i.provider === "google");
      if (!googleId) return;
      const googleEmail = googleId.identity_data?.email || session.user.email || "";
      // Pick up the Google OAuth tokens bridged from the hash via sessionStorage.
      // session.provider_token is only populated immediately after setSession with the
      // original hash; on subsequent loads it is null, so the persisted value is kept.
      const bridgedToken = sessionStorage.getItem("smocks.gpt") || "";
      if (bridgedToken) sessionStorage.removeItem("smocks.gpt");
      const bridgedRefreshToken = sessionStorage.getItem("smocks.grt") || "";
      if (bridgedRefreshToken) sessionStorage.removeItem("smocks.grt");
      const providerToken = bridgedToken || session.provider_token || "";
      setSettings((prev: any) => ({
        ...prev,
        googleConnected: true,
        googleEmail,
        googleScopes: { gmail: true, calendar: true, drive: true, contacts: true, tasks: true },
        ...(providerToken ? { googleProviderToken: providerToken } : {}),
        ...(bridgedRefreshToken ? { googleRefreshToken: bridgedRefreshToken } : {}),
      }));
    };

    (async () => {
      // Capture now — Supabase may clear the hash before getSession() resolves
      const isOAuthCallback = window.location.hash.includes("access_token");

      // Subscribe first so we catch SIGNED_IN from detectSessionInUrl processing the hash.
      // The hash-sync effect is guarded to return early while access_token is in the hash,
      // so Supabase can read and process the token before the router overwrites it.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("AUTH STATE CHANGE:", event, "session email:", session?.user?.email,
          "provider_token present:", !!session?.provider_token,
          "user identities:", JSON.stringify(session?.user?.identities),
          "app_metadata:", JSON.stringify(session?.user?.app_metadata));

        if (event === "SIGNED_OUT") {
          setEmpSession(null);
          setOauthProcessing(false);
          return;
        }

        // Detect employee (email/password) sessions vs owner (Google OAuth) sessions
        const isGoogle = (session?.user?.identities || []).some((i: any) => i.provider === "google");
        const empRole = session?.user?.user_metadata?.role;
        const isEmployee = session && !isGoogle && (empRole === "technician" || empRole === "manager");

        if (isEmployee) {
          setEmpSession(session);
          setOauthProcessing(false);
          return;
        }

        applyGoogleIdentity(session);
        if (event === "SIGNED_IN" || (event as string) === "IDENTITY_LINKED") {
          if ((session?.user?.identities || []).some((i: any) => i.provider === "google")) {
            setPage("google");
          }
          // SIGNED_IN means Supabase finished processing the OAuth hash
          setOauthProcessing(false);
        }
        // Safety net: initialize() may process the token before subscription and fire
        // INITIAL_SESSION instead of SIGNED_IN — clear the spinner in that case too
        if (event === "INITIAL_SESSION") {
          setOauthProcessing(false);
        }
      });
      sub = subscription;

      // Resolve current session to apply any already-linked Google identity
      const { data: { session: initial } } = await supabase.auth.getSession();
      console.log("INITIAL SESSION resolved — email:", initial?.user?.email,
        "provider_token present:", !!initial?.provider_token,
        "identities:", JSON.stringify(initial?.user?.identities),
        "app_metadata:", JSON.stringify(initial?.user?.app_metadata));
      // Check if existing session is an employee session
      const initIsGoogle = (initial?.user?.identities || []).some((i: any) => i.provider === "google");
      const initEmpRole = initial?.user?.user_metadata?.role;
      if (initial && !initIsGoogle && (initEmpRole === "technician" || initEmpRole === "manager")) {
        setEmpSession(initial);
        setOauthProcessing(false);
      } else {
        applyGoogleIdentity(initial);
        // If initialize() already exchanged the token (SIGNED_IN missed), handle navigation here
        if (isOAuthCallback && initIsGoogle) {
          setPage("google");
          setOauthProcessing(false);
        }
      }
      // Session check complete — safe to render main app or employee portal
      setSessionChecked(true);
    })();

    return () => sub?.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch real weather when OWM key is set
  useEffect(() => {
    if (!settings.owmKey) return;
    fetchRealWeather(settings.owmKey).then(setWeatherData).catch(() => {});
  }, [settings.owmKey]);

  // Automation engine
  useAutomationEngine({ automations, setAutomations, jobs, customers, estimates, settings, toast });

  // ── OAuth loading screen ──────────────────────────────────────────────────
  if (oauthProcessing) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm text-white/50">Completing Google sign-in…</div>
        </div>
      </div>
    );
  }

  // ── Session loading guard — prevents CRM flashing before employee session restores ──
  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-600/50 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── PIN screen ────────────────────────────────────────────────────────────
  if (pinSet && !pinUnlocked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-xs space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center mx-auto shadow-lg">
            <Lock size={28} className="text-white" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">Smock's OS</div>
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

  // ── Employee portal — takes over when an employee is authenticated ────────
  if (empSession || page === "portal") {
    return (
      <EmployeePortal
        empSession={empSession}
        setEmpSession={setEmpSession}
        jobs={jobs}
        setJobs={setJobs}
        employees={employees}
        customers={customers}
        settings={settings}
        toast={toast}
        isOwnerView={!empSession && page === "portal" && !window.location.hash.includes("invite=") && !!settings.googleConnected}
        onClose={() => setPage("dashboard")}
      />
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-black text-white">
      {/* Sidebar overlay for mobile */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={"fixed inset-y-0 left-0 z-30 w-64 bg-black/95 border-r border-red-900/30 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 " + (sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        {/* Logo */}
        <div className="p-4 border-b border-red-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center font-black text-sm shadow-lg shadow-red-900/40">
              {(settings.companyName || "S")[0].toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">{settings.companyName || "Smock's OS"}</div>
              <div className="text-[10px] text-white/40">Business CRM</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/40 hover:text-white p-1"><X size={16} /></button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-4 px-2">
          {navGroups.map(group => (
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
        <div className="p-3 border-t border-red-900/30 flex gap-2">
          <button onClick={() => { setSettingsOpen(true); setSidebarOpen(false); }} className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/5 transition">
            <Settings size={14} />Settings
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-2 px-4 py-3 border-b border-red-900/30 bg-black/80 backdrop-blur flex-shrink-0 relative z-40">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-1 text-white/50 hover:text-white">
            <ChevronRight size={20} />
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
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-green-400/50 select-none">
            <CheckCircle size={12} />
            <span>Saved</span>
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
                  {negativeAlerts.length === 0 && overdueCount === 0 && lowStock === 0 && estimates.filter(e => e.status === "pending" && daysSince(e.createdAt) >= 7).length === 0 && (
                    <div className="p-6 text-center text-sm text-white/40">All clear ✓</div>
                  )}
                </div>
              </div>
            </>
          )}
          </div>{/* end notifications relative wrapper */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-xs font-bold">SM</div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            <PageFade key={page}>
              <SafePage>
                {page === "dashboard"      && <Dashboard jobs={jobs} customers={customers} estimates={estimates} automations={automations} stats={{ totalRev, activeJobs, pendingEst, closeRate, doneMonth }} goals={{ revenue: settings.monthlyRevenueGoal ?? 8000, jobCount: settings.monthlyJobsGoal ?? 20 }} vehicles={vehicles} maintenance={maintenance} chemicals={chemicals} settings={settings} setSettings={setSettings} onNav={setPage} toast={toast} weatherData={weatherData} inboxThreads={inboxThreads} />}
                {page === "customers"      && <CustomersPage customers={customers} setCustomers={setCustomers} estimates={estimates} jobs={jobs} toast={toast} timeline={timeline} setTimeline={setTimeline} settings={settings} />}
                {page === "estimates"      && <EstimatesPage estimates={estimates} setEstimates={setEstimates} customers={customers} services={services} settings={settings} toast={toast} onPortal={id => setPortalEstId(id)} estimateTemplates={estimateTemplates} setEstimateTemplates={setEstimateTemplates} setJobs={setJobs} onNav={setPage} />}
                {page === "invoices"       && <InvoicesPage estimates={estimates} setEstimates={setEstimates} customers={customers} settings={settings} toast={toast} />}
                {page === "jobs"           && <JobsPage jobs={jobs} setJobs={setJobs} customers={customers} employees={employees} estimates={estimates} setEstimates={setEstimates} settings={settings} toast={toast} posts={socialPosts} setPosts={setSocialPosts} setTimeline={setTimeline} />}
                {page === "pipeline"       && <PipelinePage jobs={jobs} setJobs={setJobs} customers={customers} toast={toast} />}
                {page === "calendar"       && <CalendarPage jobs={jobs} setJobs={setJobs} customers={customers} employees={employees} toast={toast} settings={settings} />}
                {page === "inbox"          && <InboxPage threads={inboxThreads} setThreads={setInboxThreads} customers={customers} settings={settings} toast={toast} />}
                {page === "campaigns"      && <CampaignsPage campaigns={campaigns} setCampaigns={setCampaigns} customers={customers} estimates={estimates} jobs={jobs} settings={settings} inboxThreads={inboxThreads} setInboxThreads={setInboxThreads} toast={toast} />}
                {page === "reviews"        && <ReviewsPage reviews={reviews} setReviews={setReviews} jobs={jobs} customers={customers} toast={toast} negativeAlerts={negativeAlerts} setNegativeAlerts={setNegativeAlerts} settings={settings} setSettings={setSettings} />}
                {page === "automations"    && <AutomationsPage automations={automations} setAutomations={setAutomations} jobs={jobs} customers={customers} estimates={estimates} settings={settings} toast={toast} />}
                {page === "social"         && <SocialPage posts={socialPosts} setPosts={setSocialPosts} toast={toast} settings={settings} />}
                {page === "intake"         && <LeadIntakePage customers={customers} setCustomers={setCustomers} estimates={estimates} setEstimates={setEstimates} services={services} settings={settings} toast={toast} onNav={setPage} />}
                {page === "alfred"         && <AlfredPage conversations={alfredConversations} setConversations={setAlfredConversations} activeConvId={activeConvId} setActiveConvId={setActiveConvId} memory={alfredMemory} setMemory={setAlfredMemory} personality={personality} setPersonality={setPersonality} apiKey={settings.anthropicKey ?? settings.geminiKey ?? ""} openSettings={() => setSettingsOpen(true)} toast={toast} jobs={jobs} setJobs={setJobs} estimates={estimates} setEstimates={setEstimates} customers={customers} setCustomers={setCustomers} employees={employees} automations={automations} setAutomations={setAutomations} stats={{ totalRev, activeJobs, pendingEst, closeRate, doneMonth }} setWins={setWins} goals={goalsList} setGoals={setGoalsList} setSettings={setSettings} settings={settings} modelStatus={modelStatus} setModelStatus={setModelStatus} onNav={setPage} />}
                {page === "google"         && <GoogleWorkspacePage settings={settings} setSettings={setSettings} googleData={googleData as any} setGoogleData={setGoogleData} customers={customers} setCustomers={setCustomers} jobs={jobs} toast={toast} onNav={setPage} />}
                {page === "employees"      && <EmployeesPage employees={employees} setEmployees={setEmployees} jobs={jobs} settings={settings} toast={toast} />}
                {page === "fleet"          && <FleetPage vehicles={vehicles} setVehicles={setVehicles} maintenance={maintenance} setMaintenance={setMaintenance} toast={toast} />}
                {page === "expenses"       && <ExpensesPage expenses={expenses} setExpenses={setExpenses} />}
                {page === "chemicals"      && <ChemicalsPage chemicals={chemicals} setChemicals={setChemicals} toast={toast} settings={settings} />}
                {page === "reports"        && <ReportsPage jobs={jobs} customers={customers} estimates={estimates} expenses={expenses} employees={employees} chemicals={chemicals} />}
                {page === "analytics"      && <AnalyticsPage jobs={jobs} customers={customers} estimates={estimates} expenses={expenses} />}
                {page === "budget"         && <BudgetPage jobs={jobs} estimates={estimates} expenses={expenses} settings={settings} toast={toast} />}
                {page === "personal"       && <PersonalBudgetPage toast={toast} />}
                {page === "accountability" && <AccountabilityPage entries={accountability} setEntries={setAccountability} goals={goalsList} setGoals={setGoalsList} wins={wins} setWins={setWins} toast={toast} />}
                {page === "referrals"      && <ReferralsPage customers={customers} referrals={referrals as any} toast={toast} settings={settings} />}
                {page === "crew"           && <CrewView jobs={jobs} setJobs={setJobs} customers={customers} employees={employees} toast={toast} />}
              </SafePage>
            </PageFade>
          </div>
        </main>
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
      />

      {/* Client portal */}
      {portalEstId && (
        <ClientPortal
          estimate={estimates.find(e => e.id === portalEstId)}
          customer={customers.find(c => c.id === estimates.find(e => e.id === portalEstId)?.customerId)}
          settings={settings}
          onClose={() => setPortalEstId(null)}
          onApprove={(id, data) => {
            setEstimates(prev => prev.map(e => e.id === id ? { ...e, status: "approved", signedAt: data.signedAt, sigData: data.sigData, paidAt: today(), paidDeposit: data.payType === "deposit" ? data.totalPaid : 0, paidFull: data.payType === "full" ? data.totalPaid : 0 } : e));
            toast("✓ Signed & paid — " + fmt(data.totalPaid));
            setPortalEstId(null);
          }}
        />
      )}

      {/* FAB — floating quick-action button */}
      {settings.fabEnabled !== false && (
        <>
          {fabOpen && <div className="fixed inset-0 z-40" onClick={() => setFabOpen(false)} />}
          <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5">
            {fabOpen && (
              <>
                {(() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const fabIconMap: Record<string, React.ComponentType<any>> = {
                    customers: Users, estimates: FileText, jobs: Briefcase,
                    alfred: Bot, expenses: Receipt, intake: UserPlus,
                  };
                  const enabledFabIds = ((settings as any).fabActions as string[] | undefined) ?? ["customers","estimates","jobs","alfred"];
                  const fabActions = ALL_FAB_ACTIONS.filter(a => enabledFabIds.includes(a.id));
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
              onClick={() => setFabOpen(o => !o)}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-red-800 shadow-2xl shadow-red-900/60 flex items-center justify-center border border-red-400/30 hover:scale-110 active:scale-95"
              style={{ transition: "transform 0.2s cubic-bezier(0.34,1.2,0.64,1)" }}
              aria-label="Quick actions"
            >
              <Plus size={24} className={"text-white transition-transform duration-200 " + (fabOpen ? "rotate-45" : "")} />
            </button>
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
                placeholder="e.g. Smock's Pressure Washing"
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

      {/* Toasts */}
      <div className="fixed bottom-4 left-4 z-50 space-y-2 pointer-events-none">
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
