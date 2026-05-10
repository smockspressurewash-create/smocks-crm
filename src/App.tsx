import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, FileText, Receipt, Briefcase, Activity, Calendar, MessageSquare, Send, Award, Star, Workflow, Share2, FileImage, Bot, Globe, Users2, UserCheck, Truck, FlaskConical, BarChart3, TrendingUp, PieChart, Heart, Settings, Bell, Search, X, ChevronLeft, ChevronRight, Lock, CheckCircle, AlertTriangle, AlertCircle, Cloud, LogOut, Navigation, Loader2 } from 'lucide-react';
import { usePersistent } from './hooks/usePersistent';
import { usePersistentRaw } from './hooks/usePersistentRaw';
import { useGlobalStyles } from './hooks/useGlobalStyles';
import { PageFade } from './components/ui/PageFade';
import { SafePage } from './components/ui/SafePage';
import { GlobalSearch } from './components/ui/GlobalSearch';
import { Badge } from './components/ui/Badge';
import { supabase } from './lib/supabase';
import { useSupabaseQuery } from './hooks/useSupabaseQuery';
import { useSupabaseMutation } from './hooks/useSupabaseMutation';

// Seed data
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedWeather, seedCampaigns, seedSocialPosts, seedReferrals, seedMaintenance, seedTimeline } from './lib/seed';
import { uid, today, daysSince, fmt, daysFromNow, normalizeAutomation } from './lib/utils';

// Pages
import { Dashboard } from './components/pages/Dashboard';
import { CustomersPage } from './components/pages/Customers';
import { EstimatesPage } from './components/pages/Estimates';
import { InvoicesPage } from './components/pages/Invoices';
import { JobsPage } from './components/pages/Jobs';
import { PipelinePage } from './components/pages/Pipeline';
import { CalendarPage } from './components/pages/Calendar';
import { InboxPage } from './components/pages/Inbox';
import { CampaignsPage } from './components/pages/Campaigns';
import { AutomationsPage } from './components/pages/Automations';
import { AccountabilityPage } from './components/pages/Accountability';
import { SettingsModal } from './components/pages/Settings';
import { ExpensesPage } from './components/pages/Expenses';
import { FleetPage } from './components/pages/Fleet';
import { ChemicalsPage } from './components/pages/Chemicals';
import { EmployeesPage } from './components/pages/Employees';
import { ReportsPage } from './components/pages/Reports';
import { AnalyticsPage } from './components/pages/Analytics';
import { BudgetPage } from './components/pages/Budget';
import { SocialPage } from './components/pages/Social';
import { LeadIntakePage } from './components/pages/LeadIntake';
import { PersonalBudgetPage } from './components/pages/PersonalBudget';
import { CrewView } from './components/pages/CrewView';
import { LoginPage } from './components/pages/LoginPage';
import { SignupPage } from './components/pages/SignupPage';
import { ForgotPasswordPage } from './components/pages/ForgotPassword';
import { ResetPassword } from './components/pages/ResetPassword';

// Stubs for remaining pages
const ReferralsPage = () => <div className="p-8 text-white/40">Referrals Page (Coming Soon)</div>;
const ReviewsPage = () => <div className="p-8 text-white/40">Reviews Page (Coming Soon)</div>;
const AlfredPage = () => <div className="p-8 text-white/40">Alfred AI Page (Coming Soon)</div>;
const GoogleWorkspacePage = () => <div className="p-8 text-white/40">Google Workspace Page (Coming Soon)</div>;
const ClientPortal = () => null;
const CustomerPortalLogin = () => null;

export default function App() {
  useGlobalStyles();
  const [page, setPage] = useState("dashboard");
  const [authView, setAuthView] = useState<"login" | "signup" | "forgot" | "resetPassword">("login");
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // PIN protection
  const [pinSet] = usePersistentRaw("smocks.pin", "");
  const [pinUnlocked, setPinUnlocked] = useState(!pinSet);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  // States
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistent("smocks.sidebarCollapsed", false);
  
  // Migrated to Supabase with Hybrid Fallback
  const { data: customers, setData: setCustomers, loading: loadingCustomers } = useSupabaseQuery<any>('customers', 'smocks.customers');
  const { data: estimates, setData: setEstimates, loading: loadingEstimates } = useSupabaseQuery<any>('estimates', 'smocks.estimates');
  const { data: jobs, setData: setJobs, loading: loadingJobs } = useSupabaseQuery<any>('jobs', 'smocks.jobs');
  const { data: expenses, setData: setExpenses, loading: loadingExpenses } = useSupabaseQuery<any>('expenses', 'smocks.expenses');

  // Mutation hooks
  const customerMut = useSupabaseMutation('customers', 'smocks.customers', customers, setCustomers, userProfile?.org_id);
  const estimateMut = useSupabaseMutation('estimates', 'smocks.estimates', estimates, setEstimates, userProfile?.org_id);
  const jobMut = useSupabaseMutation('jobs', 'smocks.jobs', jobs, setJobs, userProfile?.org_id);
  const expenseMut = useSupabaseMutation('expenses', 'smocks.expenses', expenses, setExpenses, userProfile?.org_id);

  const [employees, setEmployees] = usePersistent("smocks.employees", seedEmployees);
  const [vehicles, setVehicles] = usePersistent("smocks.vehicles", seedVehicles);
  const [chemicals, setChemicals] = usePersistent("smocks.chemicals", seedChemicals);
  const [services, setServices] = usePersistent("smocks.services", seedServices);
  const [automations, setAutomations] = usePersistent("smocks.automations", seedAutomations);
  const [emailTemplates, setEmailTemplates] = usePersistent("smocks.emailTemplates", seedEmailTemplates);
  const [estimateTemplates, setEstimateTemplates] = usePersistent("smocks.estimateTemplates", []);
  const [smsTemplates, setSmsTemplates] = usePersistent("smocks.smsTemplates", seedSmsTemplates);
  const [reviews, setReviews] = usePersistent("smocks.reviews", []);
  const [negativeAlerts, setNegativeAlerts] = usePersistent("smocks.negativeAlerts", []);
  const [accountability, setAccountability] = usePersistent("smocks.accountability", []);
  const [goalsList, setGoalsList] = usePersistent("smocks.goals", []);
  const [wins, setWins] = usePersistent("smocks.wins", []);
  const [personality, setPersonality] = usePersistent("smocks.personality", "drill");
  const [weatherData, setWeatherData] = useState(seedWeather);
  const [inboxThreads, setInboxThreads] = usePersistent("smocks.inbox", []);
  const [campaigns, setCampaigns] = useState(seedCampaigns);
  const [socialPosts, setSocialPosts] = useState(seedSocialPosts);
  const [referrals, setReferrals] = useState(seedReferrals);
  const [maintenance, setMaintenance] = usePersistent("smocks.maintenance", seedMaintenance);
  const [timeline, setTimeline] = usePersistent("smocks.timeline", seedTimeline);
  const [settings, setSettings] = usePersistent("smocks.settings", {
    companyName: "Smock's Pressure Washing",
    companyPhone: "(717) 555-0100",
    companyEmail: "info@smocks.com",
    monthlyRevenueGoal: 15000,
    monthlyJobsGoal: 25,
    brandColor: "#dc2626",
    accentColor: "#991b1b",
    activeModel: "claude",
    modelPriority: ["claude", "openai", "gemini"],
    modelKeys: { claude: "", openai: "", gemini: "" }
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);

  useEffect(() => {
    // Check for recovery flow
    if (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery')) {
      setAuthView('resetPassword');
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setUserProfile(null);
      setLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Seeding logic for new users
  useEffect(() => {
    if (!loadingCustomers && session && customers.length === 0) {
      const seedDatabase = async () => {
        console.log("New organization detected. Seeding data...");
        // Seed customers
        for (const c of seedCustomers) {
          await customerMut.insert({ ...c, id: undefined }); 
        }
        // Seed estimates
        for (const e of seedEstimates) {
          await estimateMut.insert({ ...e, id: undefined });
        }
        // Seed jobs
        for (const j of seedJobs) {
          await jobMut.insert({ ...j, id: undefined });
        }
        // Seed expenses
        for (const ex of seedExpenses) {
          await expenseMut.insert({ ...ex, id: undefined });
        }
        toast("Welcome! We've added some demo data to get you started.");
      };
      seedDatabase();
    }
  }, [loadingCustomers, session, customers.length]);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (!error && data) {
      setUserProfile(data);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const toast = (msg: string, type = "success") => {
    const id = uid();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2500);
  };

  if (loadingAuth) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black">
        <Loader2 className="text-red-500 animate-spin" size={32} />
      </div>
    );
  }

  if (!session) {
    if (authView === "signup") return <SignupPage onSwitchToLogin={() => setAuthView("login")} />;
    if (authView === "forgot") return <ForgotPasswordPage onBackToLogin={() => setAuthView("login")} />;
    if (authView === "resetPassword") return <ResetPassword onSuccess={() => {
      window.history.replaceState({}, document.title, window.location.pathname);
      setAuthView("login");
    }} />;
    return <LoginPage onSwitchToSignup={() => setAuthView("signup")} onSwitchToForgot={() => setAuthView("forgot")} />;
  }

  if (pinSet && !pinUnlocked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-xs space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center mx-auto shadow-lg shadow-red-900/40">
            <Lock size={28} className="text-white" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">Smock's OS</div>
            <div className="text-sm text-white/50 mt-1">Enter PIN</div>
          </div>
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={"w-4 h-4 rounded-full border-2 transition " + (pinInput.length > i ? "bg-red-500 border-red-500" : "border-white/30")} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k, i) => (
              <button key={i} disabled={k === ""} onClick={() => {
                if (k === "⌫") { setPinInput(p => p.slice(0, -1)); return; }
                const next = pinInput + k;
                setPinInput(next);
                if (next.length === 4) {
                  if (next === pinSet) setPinUnlocked(true);
                  else { setPinError(true); setTimeout(() => setPinInput(""), 500); }
                }
              }} className={"h-14 rounded-xl text-xl font-bold border transition " + (k === "" ? "opacity-0" : "bg-white/5 border-white/10 text-white hover:bg-white/10")}>
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalRev = jobs.filter((j: any) => j.status === "completed").reduce((s: any, j: any) => s + (j.amount || 0), 0);
  const activeJobs = jobs.filter((j: any) => j.status !== "completed" && j.status !== "cancelled").length;
  const pendingEst = estimates.filter((e: any) => e.status === "pending").length;
  const closeRate = estimates.length ? Math.round((estimates.filter((e: any) => e.status === "approved").length / estimates.length) * 100) : 0;
  const doneMonth = jobs.filter((j: any) => j.status === "completed").length;

  const navGroups = [
    { items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "Business",
      items: [
        { id: "customers", label: "Customers", icon: Users },
        { id: "estimates", label: "Estimates", icon: FileText },
        { id: "invoices", label: "Invoices", icon: Receipt },
        { id: "jobs", label: "Jobs", icon: Briefcase },
        { id: "pipeline", label: "Pipeline", icon: Activity },
        { id: "calendar", label: "Calendar", icon: Calendar },
        { id: "inbox", label: "Inbox", icon: MessageSquare }
      ]
    },
    {
      label: "Operations",
      items: [
        { id: "fleet", label: "Fleet", icon: Truck },
        { id: "chemicals", label: "Chemicals", icon: FlaskConical },
        { id: "expenses", label: "Expenses", icon: Receipt }
      ]
    },
    {
      label: "Insights",
      items: [
        { id: "reports", label: "Reports", icon: BarChart3 },
        { id: "accountability", label: "Accountability", icon: Activity }
      ]
    }
  ];

  const titles: any = { dashboard: "Dashboard", customers: "Customers", estimates: "Estimates", invoices: "Invoices", jobs: "Jobs", pipeline: "Pipeline", calendar: "Calendar", inbox: "Inbox", fleet: "Fleet", expenses: "Expenses", chemicals: "Chemicals", reports: "Reports", accountability: "Accountability", automations: "Automations", campaigns: "Campaigns" };

  return (
    <div className="h-screen w-full text-white bg-black relative flex overflow-hidden font-sans">
      <aside className={"sticky top-0 h-screen flex-shrink-0 z-40 transition-all duration-300 " + (sidebarCollapsed ? "w-[68px]" : "w-64")}>
        <div className="h-full bg-black border-r border-red-900/30 flex flex-col">
          <div className="p-4 flex items-center justify-between border-b border-red-900/30">
            {!sidebarCollapsed && <span className="font-bold text-red-500">Smock's OS</span>}
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}><ChevronLeft size={16} /></button>
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-4">
            {navGroups.map((g, gi) => (
              <div key={gi}>
                {g.label && !sidebarCollapsed && <div className="text-[10px] uppercase text-white/30 font-bold mb-2 ml-2">{g.label}</div>}
                <div className="space-y-1">
                  {g.items.map(it => (
                    <button key={it.id} onClick={() => setPage(it.id)} className={"w-full flex items-center gap-3 px-3 py-2 rounded-xl transition " + (page === it.id ? "bg-red-600/20 text-red-400 border border-red-600/40" : "text-white/50 hover:text-white hover:bg-white/5 border border-transparent")}>
                      <it.icon size={18} />
                      {!sidebarCollapsed && <span className="text-sm">{it.label}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          
          <div className="p-4 border-t border-red-900/30 space-y-2">
            <div className="flex items-center gap-3 px-3 py-2">
               <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-bold text-xs shrink-0">
                 {userProfile?.full_name?.split(' ').map((n: any) => n[0]).join('') || '??'}
               </div>
               {!sidebarCollapsed && (
                 <div className="overflow-hidden">
                   <div className="text-sm font-medium truncate">{userProfile?.full_name || session.user.email}</div>
                   <div className="text-[10px] text-white/40 truncate capitalize">{userProfile?.role || 'User'}</div>
                 </div>
               )}
            </div>
            
            <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-3 text-white/50 hover:text-white transition w-full px-3 py-2">
              <Settings size={18} />
              {!sidebarCollapsed && <span className="text-sm">Settings</span>}
            </button>
            
            <button onClick={handleSignOut} className="flex items-center gap-3 text-red-400/70 hover:text-red-400 transition w-full px-3 py-2">
              <LogOut size={18} />
              {!sidebarCollapsed && <span className="text-sm">Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 bg-black/50 backdrop-blur-xl border-b border-red-900/30 px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">{titles[page]}</h1>
          <div className="flex items-center gap-4">
            <GlobalSearch customers={customers} jobs={jobs} estimates={estimates} onNav={setPage} />
            <button className="relative p-2 text-white/60 hover:text-white"><Bell size={20} /></button>
            <div className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center font-bold">SM</div>
          </div>
        </header>

        <div className="p-6">
          <PageFade key={page}>
            <SafePage>
              {page === "dashboard" && <Dashboard jobs={jobs} customers={customers} estimates={estimates} automations={automations} stats={{ totalRev, activeJobs, pendingEst, closeRate, doneMonth }} goals={{ revenue: settings.monthlyRevenueGoal, jobCount: settings.monthlyJobsGoal }} vehicles={vehicles} maintenance={maintenance} chemicals={chemicals} settings={settings} setSettings={setSettings} onNav={setPage} toast={toast} weatherData={weatherData} inboxThreads={inboxThreads} />}
              {page === "customers" && <CustomersPage customers={customers} setCustomers={setCustomers} estimates={estimates} jobs={jobs} toast={toast} timeline={timeline} setTimeline={setTimeline} settings={settings} addCustomer={customerMut.insert} updateCustomer={customerMut.update} removeCustomer={customerMut.remove} />}
              {page === "estimates" && <EstimatesPage estimates={estimates} setEstimates={setEstimates} customers={customers} services={services} settings={settings} toast={toast} estimateTemplates={estimateTemplates} setEstimateTemplates={setEstimateTemplates} setJobs={setJobs} onNav={setPage} addEstimate={estimateMut.insert} updateEstimate={estimateMut.update} removeEstimate={estimateMut.remove} />}
              {page === "invoices" && <InvoicesPage estimates={estimates} setEstimates={setEstimates} customers={customers} settings={settings} toast={toast} updateEstimate={estimateMut.update} />}
              {page === "jobs" && <JobsPage jobs={jobs} setJobs={setJobs} customers={customers} employees={employees} estimates={estimates} setEstimates={setEstimates} settings={settings} toast={toast} setTimeline={setTimeline} addJob={jobMut.insert} updateJob={jobMut.update} removeJob={jobMut.remove} />}
              {page === "pipeline" && <PipelinePage jobs={jobs} setJobs={setJobs} customers={customers} toast={toast} updateJob={jobMut.update} />}
              {page === "calendar" && <CalendarPage jobs={jobs} setJobs={setJobs} customers={customers} toast={toast} settings={settings} updateJob={jobMut.update} />}
              {page === "inbox" && <InboxPage threads={inboxThreads} setThreads={setInboxThreads} customers={customers} settings={settings} toast={toast} />}
              {page === "campaigns" && <CampaignsPage campaigns={campaigns} setCampaigns={setCampaigns} customers={customers} estimates={estimates} jobs={jobs} settings={settings} inboxThreads={inboxThreads} setInboxThreads={setInboxThreads} toast={toast} />}
              {page === "referrals" && <ReferralsPage />}
              {page === "reviews" && <ReviewsPage />}
              {page === "automations" && <AutomationsPage automations={automations} setAutomations={setAutomations} jobs={jobs} customers={customers} estimates={estimates} settings={settings} toast={toast} />}
              {page === "social" && <SocialPage posts={socialPosts} setPosts={setSocialPosts} toast={toast} />}
              {page === "intake" && <LeadIntakePage setCustomers={setCustomers} toast={toast} onNav={setPage} />}
              {page === "accountability" && <AccountabilityPage entries={accountability} setEntries={setAccountability} goals={goalsList} setGoals={setGoalsList} wins={wins} setWins={setWins} toast={toast} />}
              {page === "alfred" && <AlfredPage />}
              {page === "google" && <GoogleWorkspacePage />}
              {page === "employees" && <EmployeesPage employees={employees} setEmployees={setEmployees} jobs={jobs} />}
              {page === "fleet" && <FleetPage vehicles={vehicles} setVehicles={setVehicles} maintenance={maintenance} setMaintenance={setMaintenance} toast={toast} />}
              {page === "expenses" && <ExpensesPage expenses={expenses} setExpenses={setExpenses} addExpense={expenseMut.insert} updateExpense={expenseMut.update} removeExpense={expenseMut.remove} />}
              {page === "chemicals" && <ChemicalsPage chemicals={chemicals} setChemicals={setChemicals} toast={toast} settings={settings} />}
              {page === "reports" && <ReportsPage jobs={jobs} customers={customers} estimates={estimates} expenses={expenses} employees={employees} chemicals={chemicals} />}
              {page === "analytics" && <AnalyticsPage jobs={jobs} customers={customers} estimates={estimates} expenses={expenses} />}
              {page === "budget" && <BudgetPage jobs={jobs} estimates={estimates} expenses={expenses} settings={settings} />}
              {page === "personal" && <PersonalBudgetPage jobs={jobs} settings={settings} />}
              {page === "crew" && <CrewView jobs={jobs} setJobs={setJobs} customers={customers} employees={employees} toast={toast} />}
            </SafePage>
          </PageFade>
        </div>
      </main>

      {settingsOpen && <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} setSettings={setSettings} services={services} setServices={setServices} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} smsTemplates={smsTemplates} setSmsTemplates={setSmsTemplates} toast={toast} />}

      <div className="fixed bottom-6 right-6 z-[60] space-y-2 pointer-events-none max-w-sm w-full">
        {toasts.map(t => (
          <div key={t.id} className="anim-toast flex items-center gap-3 px-4 py-3 bg-black/90 backdrop-blur-xl border border-red-500/40 rounded-2xl shadow-2xl text-sm font-medium text-white pointer-events-auto">
            <CheckCircle size={15} className="text-green-400" />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
