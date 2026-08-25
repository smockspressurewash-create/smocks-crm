import React, { useEffect, useRef, useState } from "react";
import { Lock, Mail, User, Phone, LogOut, CreditCard, Receipt, CheckCircle, Clock, Gift, Copy, Repeat, ImageIcon, ChevronRight, FileText, Briefcase, CalendarClock, Eye, EyeOff, Search, Plus, Building2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { fmt, uid, today, mediaSrc } from "../../lib/utils";
import type { Customer, Estimate, Job, AppSettings } from "../../types";
import { Glass } from "../ui/Glass";
import { CrewBossMark } from "../ui/CrewBossMark";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { Badge } from "../ui/Badge";
import { Stat } from "../ui/Stat";
import { Modal } from "../ui/Modal";
import { StripePaymentModal } from "../ui/StripePaymentModal";
import { SaveCardModal } from "../ui/SaveCardModal";
import { getMySavedCard, getMySavedCards, detachMyPaymentMethod, sendPaymentReceipt, type StripeSavedCard } from "../../lib/stripe";
import { seedRewardTiers } from "../../lib/seed";

// Public, unauthenticated-by-default route (#/client) — a customer-facing
// portal with its own Supabase email/password auth, intentionally separate
// from the owner/employee auth handled in App.tsx (see the route guards
// added there). Customers are matched to their CRM record by email since
// there's no backend to mint a dedicated client_id at signup time.
export function ClientAuthPortal({
  customers = [], setCustomers = (() => {}) as any,
  estimates = [], setEstimates = (() => {}) as any,
  jobs = [], settings = {} as AppSettings, estimateTemplates = [], toast = (() => {}) as any,
  demoMode = false, onExitDemo = () => {},
}: {
  customers?: Customer[]; setCustomers?: any;
  estimates?: Estimate[]; setEstimates?: any;
  jobs?: Job[]; settings?: AppSettings; estimateTemplates?: any[]; toast?: any;
  // FEATURE — App.tsx's "Test the Full Client Portal" demo renders this
  // component INLINE inside the owner's own already-authenticated tab, which
  // shares the same Supabase client singleton as the owner's real session.
  // Without demoMode, this component's own real session check (below) finds
  // the OWNER'S session, and BUG 10's staff-bounce effect immediately
  // hash-redirects back to the dashboard — which is exactly why the demo
  // button looked like it "did nothing." demoMode skips the real auth/
  // session machinery entirely and renders the logged-in portal UI directly
  // from real jobs/estimates/customers already in memory, and reroutes Sign
  // Out to just closing the demo instead of actually signing the owner out.
  demoMode?: boolean; onExitDemo?: () => void;
}) {
  const [session, setSession] = useState<any>(null);
  const [checked, setChecked] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [tab, setTab] = useState<"invoices" | "quotes" | "jobs" | "referrals" | "payment">("invoices");
  const [rescheduleJobId, setRescheduleJobId] = useState<string | null>(null);
  const [rescheduleNote, setRescheduleNote] = useState("");
  const [reschedulingSend, setReschedulingSend] = useState(false);
  // FEATURE — self-serve cancel/reschedule, gated by settings.clientPortalCancelReschedule
  // (owner opt-in, off by default — see SettingsModal.tsx). Both require a
  // reason; the real permission check happens server-side in
  // public-data.ts's client_cancel_job/client_reschedule_job actions, this
  // client-side gate is only to decide which UI to show.
  const [directActionJobId, setDirectActionJobId] = useState<string | null>(null);
  const [directActionType, setDirectActionType] = useState<"cancel" | "reschedule" | null>(null);
  const [directReason, setDirectReason] = useState("");
  const [directNewDate, setDirectNewDate] = useState("");
  const [directNewTime, setDirectNewTime] = useState("");
  const [directSending, setDirectSending] = useState(false);

  const submitDirectAction = async () => {
    if (!directActionJobId || !directActionType) return;
    if (!directReason.trim()) { toast?.("Please enter a reason", "red"); return; }
    if (directActionType === "reschedule" && !directNewDate) { toast?.("Please pick a new date", "red"); return; }
    setDirectSending(true);
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const token = sessData.session?.access_token;
      const res = await fetch("/api/public-data", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: directActionType === "cancel" ? "client_cancel_job" : "client_reschedule_job",
          jobId: directActionJobId, reason: directReason.trim(), newDate: directNewDate, newTime: directNewTime,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data?.error) throw new Error(data?.error || `Request failed (${res.status})`);
      patchActiveJobs(jobs => jobs.map(x => x.id === directActionJobId ? { ...x, status: data.status, scheduledDate: data.scheduledDate } as any : x));
      toast?.(directActionType === "cancel" ? "Job cancelled ✓" : "Job rescheduled ✓", "green");
      setDirectActionJobId(null); setDirectActionType(null); setDirectReason(""); setDirectNewDate(""); setDirectNewTime("");
    } catch (e: any) {
      toast?.(e?.message || "Couldn't complete that — please call or text us directly", "red");
    } finally {
      setDirectSending(false);
    }
  };
  const [payingInv, setPayingInv] = useState<Estimate | null>(null);
  // FEATURE — legal disclaimer/T&Cs gate before the Stripe modal opens (this
  // portal jumps straight from "Pay Now" to the card form with no review
  // step, unlike ClientPortal.tsx's estimate-payment flow, so the checkbox
  // lives here as its own intermediate step instead).
  const [payDisclaimerInv, setPayDisclaimerInv] = useState<Estimate | null>(null);
  const [agreedInvoiceTerms, setAgreedInvoiceTerms] = useState(false);
  const [showSaveCard, setShowSaveCard] = useState(false);
  const [mySavedCard, setMySavedCard] = useState<{ brand?: string; last4?: string; expMonth?: number; expYear?: number } | null>(null);
  // FEATURE — multi-card support: every card the customer has saved, not
  // just the default one. Loaded from Stripe directly (source of truth for
  // brand/last4) whenever the default changes or after a save/remove.
  const [myCards, setMyCards] = useState<StripeSavedCard[]>([]);
  const [cardsBusyId, setCardsBusyId] = useState<string | null>(null);
  const refreshMyCards = () => {
    if (!session?.access_token) { setMyCards([]); return; }
    getMySavedCards(session.access_token).then(setMyCards).catch(() => setMyCards([]));
  };

  // MULTI-TENANT (Phase D) — was `customers.find(...)` against the App.tsx
  // global `customers`/`estimates`/`jobs` props (owner_id-scoped once RLS
  // 0033_multitenant_owner_scoping.sql is live, so empty for a customer
  // session — current_owner_id() only resolves for staff). Fetched instead
  // via /api/public-data's "get_customer_portal_data" action (service role,
  // resolves the caller's own customer record + their jobs/estimates
  // server-side from their VERIFIED session email, sent as a bearer token —
  // never a client-claimed id). Stored in local state; `customers`/
  // `estimates`/`jobs` props are still accepted (harmless, and referral-list
  // lookups below still use the `customers` prop) but no longer the source
  // of truth for the logged-in customer's own record/invoices/jobs.
  // BUG FIX — `settings` was carrying the resolved owning business's public
  // Stripe/branding info (never the global App.tsx `settings` prop, which
  // is empty on a real customer's own device — see the server-side comment
  // on get_customer_portal_data in public-data.ts).
  // MULTI-BUSINESS — a customer can be linked to more than one business
  // through the same login (e.g. one company pressure-washes their house, a
  // different one mows their lawn). `accounts` is one entry per business
  // they're a customer of; `activeIdx` picks which one this screen shows.
  type PortalAccount = { customer: Customer; jobs: Job[]; estimates: Estimate[]; settings: { stripePublishableKey?: string; stripeAccountId?: string; companyName?: string } | null };
  const [portalData, setPortalData] = useState<{ accounts: PortalAccount[] } | null>(null);
  const [portalDataLoading, setPortalDataLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const fetchPortalData = async () => {
    setPortalDataLoading(true);
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const token = sessData.session?.access_token;
      if (!token) { setPortalData({ accounts: [] }); return; }
      const res = await fetch("/api/public-data", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "get_customer_portal_data" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) { setPortalData({ accounts: [] }); return; }
      setPortalData({ accounts: data.accounts || [] });
      setActiveIdx(prev => Math.min(prev, Math.max(0, (data.accounts?.length || 1) - 1)));
    } catch {
      setPortalData({ accounts: [] });
    } finally {
      setPortalDataLoading(false);
    }
  };

  // ── "Find & Connect" — search businesses on the platform and request to
  // become their customer (lands as a pending "lead" in that owner's Lead
  // Intake list; see request_customer_link in public-data.ts).
  const [findQuery, setFindQuery] = useState("");
  const [findResults, setFindResults] = useState<Array<{ ownerId: string; companyName: string; companyPhone?: string; logoUrl?: string }>>([]);
  const [findBusy, setFindBusy] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [connectingOwnerId, setConnectingOwnerId] = useState<string | null>(null);
  const [connectedOwnerIds, setConnectedOwnerIds] = useState<string[]>([]);
  const searchBusinesses = async (q: string) => {
    setFindQuery(q);
    if (q.trim().length < 2) { setFindResults([]); return; }
    setFindBusy(true);
    try {
      const res = await fetch("/api/public-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "search_businesses", query: q.trim() }) });
      const data = await res.json().catch(() => null);
      setFindResults(data?.businesses || []);
    } catch { setFindResults([]); }
    finally { setFindBusy(false); }
  };
  const requestConnect = async (ownerId: string) => {
    setConnectingOwnerId(ownerId);
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const token = sessData.session?.access_token;
      const res = await fetch("/api/public-data", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "request_customer_link", ownerId, firstName, lastName, phone }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) throw new Error(data?.error || "Request failed");
      setConnectedOwnerIds(prev => [...prev, ownerId]);
      toast?.("Request sent ✓ — they'll confirm you as a customer soon", "green");
    } catch (e: any) {
      toast?.(e?.message || "Couldn't send that request", "red");
    } finally {
      setConnectingOwnerId(null);
    }
  };

  useEffect(() => {
    if (demoMode) { setChecked(true); return; }
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session || null);
      setChecked(true);
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, [demoMode]);

  // Fetch (or re-fetch, e.g. right after signup/login flips `session`) the
  // customer's own portal data whenever a session becomes available.
  useEffect(() => {
    if (demoMode) return;
    if (session?.user?.email) fetchPortalData();
    else setPortalData(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, demoMode]);

  // demoMode builds its "logged in" account straight from the real
  // jobs/estimates/customers already loaded in the owner's CRM session,
  // instead of the real get_customer_portal_data fetch (which resolves the
  // caller's OWN customer record — the owner isn't a customer, so that call
  // would just come back empty). Picks whichever customer actually has data
  // to show, so the walkthrough isn't just an empty shell.
  const demoAccount: PortalAccount | null = (() => {
    if (!demoMode) return null;
    const withData = [...customers].sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const pick = withData.find(c => estimates.some(e => e.customerId === c.id) || jobs.some(j => j.customerId === c.id)) || withData[0];
    if (!pick) return null;
    return {
      customer: pick,
      jobs: jobs.filter(j => j.customerId === pick.id),
      estimates: estimates.filter(e => e.customerId === pick.id),
      settings: { stripePublishableKey: (settings as any)?.stripePublishableKey, stripeAccountId: (settings as any)?.stripeAccountId, companyName: (settings as any)?.companyName },
    };
  })();

  const active = demoMode ? demoAccount : (portalData?.accounts?.[activeIdx] || null);
  const cust = active?.customer || null;

  // Real brand/last4 for the saved-card display below (closes the TODO left
  // where the display previously only had the generic literal "Card on
  // file" label to show) — see lib/stripe.ts's getMySavedCard.
  useEffect(() => {
    if (!cust?.savedPaymentMethodId || !session?.access_token) { setMySavedCard(null); return; }
    getMySavedCard(session.access_token).then(setMySavedCard).catch(() => setMySavedCard(null));
  }, [cust?.savedPaymentMethodId, session?.access_token]);

  useEffect(() => {
    refreshMyCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cust?.stripeCustomerId, session?.access_token]);

  // FIX 17 — "View & Pay Invoice" / "Review & Sign" links emailed/texted to
  // customers all point at #/client?invoice=ID (this portal), NOT the old
  // #/portal/ID pattern (which is the EMPLOYEE portal's route and had no idea
  // what to do with an estimate id — those links landed a customer on an
  // employee login screen). Once logged in and matched to a customer record,
  // auto-open that specific invoice's payment modal instead of making them
  // hunt for it in the list.
  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (!cust || deepLinkHandledRef.current) return;
    const hash = window.location.hash;
    const qIndex = hash.indexOf("?");
    if (qIndex === -1) return;
    const params = new URLSearchParams(hash.slice(qIndex + 1));
    const invoiceId = params.get("invoice");
    if (!invoiceId) return;
    const inv = (active?.estimates || []).find(e => e.id === invoiceId && e.customerId === cust.id);
    if (inv) { setTab("invoices"); setPayingInv(inv); deepLinkHandledRef.current = true; }
  }, [cust, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // BUG 10 — if an OWNER/employee is logged in and lands on #/client, they'll
  // have a session but no matching customer record, which used to strand them
  // on "Setting up your account…". Detect a staff session (matches the owner's
  // configured email, or a row in the employees table) and bounce them to the
  // main app instead of showing the customer setup screen.
  useEffect(() => {
    if (demoMode || !checked || !session?.user?.email || cust) return;
    const email = session.user.email.toLowerCase();
    const ownerEmail = ((settings as any)?.myEmail || (settings as any)?.companyEmail || "").toLowerCase();
    if (ownerEmail && email === ownerEmail) {
      window.location.hash = "/dashboard";
      return;
    }
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("employees").select("id, role").ilike("email", email).maybeSingle();
        if (data) { window.location.hash = "/dashboard"; }
      } catch { /* employees table may not exist */ }
    })();
  }, [checked, session?.user?.email, cust]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAuth = async () => {
    setAuthError("");
    if (!email.trim() || !password.trim()) { setAuthError("Email and password are required"); return; }
    setAuthBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        // BUG FIX — this used to fake a customer record into local React
        // state with no matching Supabase insert at all, so it silently
        // never persisted anywhere and vanished on reload/another device.
        // A brand-new signup with no existing customer row anywhere now
        // correctly lands on the "Find & Connect" screen (see the !cust
        // render branch below) instead of a record that was never real.
        setSession(data.session || null);
        toast?.("Account created — welcome!", "green");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setSession(data.session || null);
      }
    } catch (e: any) {
      setAuthError(e?.message || "Authentication failed");
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    // GUARD — this shares the same Supabase client as the owner's real CRM
    // session; in demoMode a real signOut would sign the OWNER out. Just
    // close the demo overlay instead.
    if (demoMode) { onExitDemo(); return; }
    await supabase.auth.signOut({ scope: "local" }); setSession(null);
  };

  const handleForgotPassword = async () => {
    setAuthError("");
    if (!email.trim()) { setAuthError("Enter your email above first, then tap \"Forgot password?\""); return; }
    setForgotBusy(true);
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}#/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      setForgotSent(true);
      toast?.("Password reset email sent ✓", "green");
    } catch (e: any) {
      setAuthError(e?.message || "Failed to send reset email");
    } finally {
      setForgotBusy(false);
    }
  };

  // BUG FIX — this used to always read the GLOBAL `settings` prop, which is
  // empty on a real customer's own device (they're not the owner, so it
  // never resolves current_owner_id()) — and, once a customer can belong to
  // more than one business, was wrong regardless since each account has its
  // own name. Prefer the active account's own resolved company name once
  // logged in; the prop/generic fallback only matters pre-login.
  const companyName = active?.settings?.companyName || settings?.companyName || "Crew Boss";

  if (!demoMode && (!checked || (session?.user?.email && portalData === null))) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white/40 text-sm">Loading…</div>;
  }

  if (demoMode && !demoAccount) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 text-center">
        <div className="max-w-sm space-y-3">
          <div className="text-white/60 font-semibold">No customer with jobs or quotes yet to preview</div>
          <div className="text-sm text-white/40">Create a customer with at least one quote or job, then try this demo again.</div>
          <GBtn onClick={onExitDemo}>Close</GBtn>
        </div>
      </div>
    );
  }

  // ── Logged out — login / signup form ──────────────────────────────────────
  if (!demoMode && !session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center mx-auto shadow-lg shadow-red-900/40">
              <CrewBossMark className="w-9 h-9" />
            </div>
            <div className="text-lg font-bold text-white">{companyName} — Client Portal</div>
            <div className="text-xs text-white/40">Pay invoices, track jobs, and view your referral rewards</div>
          </div>

          <Glass className="p-5 space-y-3">
            <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
              {(["login", "signup"] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setAuthError(""); }} className={"flex-1 py-1.5 rounded-lg text-xs font-medium transition capitalize " + (mode === m ? "bg-red-700/40 text-white border border-red-700/50" : "text-white/50")}>{m === "login" ? "Log In" : "Sign Up"}</button>
              ))}
            </div>

            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-2">
                <GInput placeholder="First name" value={firstName} onChange={(e: any) => setFirstName(e.target.value)} className="!text-sm" />
                <GInput placeholder="Last name" value={lastName} onChange={(e: any) => setLastName(e.target.value)} className="!text-sm" />
              </div>
            )}
            <GInput type="email" placeholder="Email" value={email} onChange={(e: any) => setEmail(e.target.value)} className="!text-sm" />
            {mode === "signup" && <GInput type="tel" placeholder="Phone" value={phone} onChange={(e: any) => setPhone(e.target.value)} className="!text-sm" />}
            <div className="relative">
              <GInput type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e: any) => setPassword(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && handleAuth()} className="!text-sm !pr-10" />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition" tabIndex={-1}>
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {authError && <div className="text-xs text-red-400">{authError}</div>}
            <GBtn onClick={handleAuth} disabled={authBusy} className="w-full !py-3">{authBusy ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}</GBtn>
            {mode === "login" && (
              forgotSent ? (
                <div className="text-xs text-green-400 text-center">Check your email for a password reset link.</div>
              ) : (
                <button type="button" onClick={handleForgotPassword} disabled={forgotBusy} className="w-full text-center text-xs text-white/40 hover:text-white/70 transition disabled:opacity-50">
                  {forgotBusy ? "Sending…" : "Forgot password?"}
                </button>
              )
            )}
          </Glass>
        </div>
      </div>
    );
  }

  // ── Logged in, no matching customer record yet — "Find & Connect" ─────────
  // BUG FIX — this used to be a dead end ("we couldn't find a customer
  // record... contact the business to link your account") with no way
  // forward from inside the app at all. Now lets the customer search
  // businesses on the platform and request to become their customer —
  // lands as a pending "lead" the owner approves from Lead Intake, same as
  // any other inbound lead.
  if (!cust) {
    return (
      <div className="min-h-screen bg-black p-4">
        <div className="max-w-sm mx-auto space-y-4 pt-8">
          <div className="text-center space-y-1.5">
            <Building2 size={32} className="mx-auto text-white/20" />
            <div className="text-white font-semibold">Find a business</div>
            <div className="text-xs text-white/40">Search for the company you work with — we'll let them know you'd like to connect.</div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <GInput placeholder="Search by business name..." value={findQuery} onChange={(e: any) => searchBusinesses(e.target.value)} className="!text-sm !pl-9" />
          </div>
          {findBusy && <div className="text-center text-xs text-white/30">Searching…</div>}
          <div className="space-y-2">
            {findResults.map(b => {
              const isConnecting = connectingOwnerId === b.ownerId;
              const isConnected = connectedOwnerIds.includes(b.ownerId);
              return (
                <Glass key={b.ownerId} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{b.companyName}</div>
                    {b.companyPhone && <div className="text-[11px] text-white/40">{b.companyPhone}</div>}
                  </div>
                  {isConnected ? (
                    <Badge tone="green">Requested</Badge>
                  ) : (
                    <GBtn disabled={isConnecting} onClick={() => requestConnect(b.ownerId)} className="!text-xs !py-1.5 flex-shrink-0">
                      {isConnecting ? "Sending…" : <><Plus size={12} className="inline mr-1" />Connect</>}
                    </GBtn>
                  )}
                </Glass>
              );
            })}
            {!findBusy && findQuery.trim().length >= 2 && findResults.length === 0 && (
              <div className="text-center text-xs text-white/30 py-4">No businesses found matching "{findQuery}" — double-check the spelling, or ask them for their direct signup link instead.</div>
            )}
          </div>
          <div className="text-center pt-2">
            <GBtn variant="ghost" onClick={signOut}><LogOut size={13} className="inline mr-1.5" />Sign Out</GBtn>
          </div>
        </div>
      </div>
    );
  }

  const myEstimates = active?.estimates || [];
  const myInvoices = myEstimates.filter(e => e.customerId === cust.id && e.invoiced);
  const outstanding = myInvoices.filter(e => !e.paidAt);

  // Mark outstanding invoices as viewed once per session so the owner gets a
  // "client opened invoice" notification (BUG 15 / FEATURE 5). Writes only to
  // Supabase (owner's source of truth); guarded so it fires at most once per
  // invoice per portal load.
  const viewedMarkedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    outstanding.forEach(inv => {
      if ((inv as any).clientViewedAt || viewedMarkedRef.current.has(inv.id)) return;
      viewedMarkedRef.current.add(inv.id);
      (supabase as any).from("estimates").update({ clientViewedAt: new Date().toISOString() }).eq("id", inv.id).then(() => {}).catch(() => {});
    });
  }, [outstanding.map(i => i.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const paid = myInvoices.filter(e => !!e.paidAt);
  const myJobsList = active?.jobs || [];
  const myJobs = myJobsList.filter(j => j.customerId === cust.id).sort((a, b) => (b.scheduledDate || "").localeCompare(a.scheduledDate || ""));
  const completedJobs = myJobs.filter(j => j.status === "completed");
  // AUDIT FIX (round 13, item 7) — upcoming vs past, instead of one
  // undifferentiated list newest-first (a customer's next job could be
  // buried below a year of completed history).
  const upcomingJobs = myJobs.filter(j => j.status !== "completed" && j.status !== "cancelled").sort((a, b) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
  const pastJobs = myJobs.filter(j => j.status === "completed" || j.status === "cancelled");
  const myQuotes = myEstimates.filter(e => e.customerId === cust.id && !e.invoiced).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const requestReschedule = async (jobId: string) => {
    setReschedulingSend(true);
    try {
      const j = myJobsList.find(x => x.id === jobId);
      await (supabase as any).from("jobs").update({
        rescheduleRequested: true, rescheduleRequestNote: rescheduleNote.trim() || null, rescheduleRequestedAt: new Date().toISOString(),
      }).eq("id", jobId);
      // Same anonymous-safe owner-notification proxy CustomerReviewPage.tsx/
      // ClientPortal.tsx use — see functions/api/alfred-notify.ts.
      fetch("/api/alfred-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Alfred Notifications",
          message: `📅 RESCHEDULE REQUESTED\n\n${cust.firstName} ${cust.lastName} asked to reschedule their ${j?.scheduledDate || "upcoming"} job at ${j?.address || "their property"}.${rescheduleNote.trim() ? `\n\nNote: "${rescheduleNote.trim()}"` : ""}`,
          jobId: jobId, customerId: cust.id,
        }),
      }).catch(() => {});
      // Optimistic local update — portalData is now this page's source of
      // truth for `jobs` (see MULTI-TENANT note above), so without this the
      // "Reschedule requested" badge wouldn't show until the next full
      // fetchPortalData() call.
      patchActiveJobs(jobs => jobs.map(x => x.id === jobId ? { ...x, rescheduleRequested: true } as any : x));
      toast?.("Reschedule request sent — we'll be in touch to confirm a new date ✓", "green");
      setRescheduleJobId(null);
      setRescheduleNote("");
    } catch (e: any) {
      toast?.("Couldn't send request — please call or text us directly", "red");
    } finally {
      setReschedulingSend(false);
    }
  };
  // TODO(multitenant): referredCustomers still reads the App.tsx global
  // `customers` prop, which is owner_id-scoped and will be empty for this
  // customer session once RLS is live — public-data.ts has no action for
  // "customers this customer referred" yet, so this list will just render
  // empty rather than crash. Flagging rather than guessing at a new
  // server-side action for it.
  const referredCustomers = customers.filter(c => c.referredBy === cust.id);
  const referralLink = `${window.location.origin}${window.location.pathname}#/referral?ref=${cust.referralCode || ""}`;
  const isCommercial = !!cust.isCommercial || (cust.tags || []).includes("Commercial");

  // `cust` now comes from portalData (see MULTI-TENANT note above), not from
  // the `customers` prop array — so a setCustomers() call updating that prop
  // array no longer touches what `cust` reads from. Mirror any patch into
  // portalData.customer too so recurring-payment/save-card UI still updates
  // immediately, same as it did when `cust` was sourced from `customers`.
  const patchCust = (patch: Partial<Customer> | ((c: Customer) => Partial<Customer>)) => {
    setPortalData(prev => {
      if (!prev?.accounts?.[activeIdx]?.customer) return prev;
      const c = prev.accounts[activeIdx].customer;
      const p = typeof patch === "function" ? patch(c) : patch;
      const accounts = prev.accounts.map((a, i) => i === activeIdx ? { ...a, customer: { ...a.customer, ...p } } : a);
      return { ...prev, accounts };
    });
  };
  // Patches jobs/estimates on the currently active account only.
  const patchActiveJobs = (fn: (jobs: Job[]) => Job[]) => {
    setPortalData(prev => {
      if (!prev?.accounts?.[activeIdx]) return prev;
      const accounts = prev.accounts.map((a, i) => i === activeIdx ? { ...a, jobs: fn(a.jobs) } : a);
      return { ...prev, accounts };
    });
  };
  const patchActiveEstimates = (fn: (estimates: Estimate[]) => Estimate[]) => {
    setPortalData(prev => {
      if (!prev?.accounts?.[activeIdx]) return prev;
      const accounts = prev.accounts.map((a, i) => i === activeIdx ? { ...a, estimates: fn(a.estimates) } : a);
      return { ...prev, accounts };
    });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="bg-gradient-to-r from-red-600 to-red-800 px-5 py-4 flex items-center justify-between">
        <div>
          <div className="font-bold">{companyName}</div>
          <div className="text-red-200 text-xs">Hi {cust.firstName} 👋</div>
        </div>
        <button onClick={signOut} className="text-white/80 hover:text-white flex items-center gap-1 text-xs"><LogOut size={14} />Sign Out</button>
      </div>

      {/* MULTI-BUSINESS — switcher, only shown once there's more than one
          business to switch between (a brand-new single-business customer
          sees nothing extra here). */}
      {(portalData?.accounts?.length || 0) > 1 && (
        <div className="bg-black/60 border-b border-white/10 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {portalData!.accounts.map((a, i) => (
            <button key={a.customer.id} onClick={() => setActiveIdx(i)} className={"flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap " + (i === activeIdx ? "bg-red-700/40 text-white border border-red-700/50" : "bg-white/5 text-white/50 border border-white/10 hover:text-white/80")}>
              {a.settings?.companyName || "Business " + (i + 1)}
            </button>
          ))}
          <button onClick={() => setFindOpen(true)} className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 border border-dashed border-white/15 flex items-center gap-1"><Plus size={11} />Add</button>
        </div>
      )}

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {(portalData?.accounts?.length || 0) <= 1 && (
          <button onClick={() => setFindOpen(true)} className="w-full text-center text-[11px] text-white/30 hover:text-white/60 transition flex items-center justify-center gap-1.5"><Plus size={11} />Connect to another business</button>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={Receipt} label="Outstanding" value={fmt(outstanding.reduce((s, e) => s + e.total, 0))} />
          <Stat icon={CheckCircle} label="Jobs Done" value={String(completedJobs.length)} />
          <Stat icon={Gift} label="Referral Credit" value={fmt(cust.referralCreditOwed || 0)} />
        </div>

        <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl overflow-x-auto">
          {/* AUDIT FIX (round 13, item 7) — added a Quotes tab (pending,
              not-yet-invoiced estimates were previously invisible here —
              only invoiced ones showed, under "Invoices"), and renamed
              "Past Jobs" -> "Jobs" since that tab now shows upcoming AND
              past jobs together (see below). */}
          {([["invoices", "Invoices", Receipt], ["quotes", "Quotes", FileText], ["jobs", "Jobs", Clock], ["referrals", "Referrals", Gift], ["payment", "Payment", CreditCard]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)} className={"flex-1 py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 whitespace-nowrap " + (tab === key ? "bg-red-700/40 text-white border border-red-700/50" : "text-white/50")}><Icon size={12} />{label}</button>
          ))}
        </div>

        {tab === "invoices" && (
          <div className="space-y-3">
            {outstanding.length > 0 && <div className="text-xs text-white/40 uppercase tracking-wider">Outstanding</div>}
            {outstanding.map(inv => (
              <Glass key={inv.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{fmt(inv.total)}</div>
                  <div className="text-xs text-white/40">{inv.invoicedAt || inv.createdAt}</div>
                </div>
                <GBtn onClick={() => { setAgreedInvoiceTerms(false); setPayDisclaimerInv(inv); }} className="!text-xs !py-2"><CreditCard size={13} className="inline mr-1" />Pay Now</GBtn>
              </Glass>
            ))}
            {outstanding.length === 0 && <div className="text-center py-6 text-white/30 text-sm">No outstanding invoices 🎉</div>}

            {payDisclaimerInv && (
              <Glass className="p-4 space-y-3 !border-red-700/40">
                <div className="text-sm font-semibold">Confirm payment of {fmt(payDisclaimerInv.total)}</div>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={agreedInvoiceTerms} onChange={ev => setAgreedInvoiceTerms(ev.target.checked)} className="mt-0.5 flex-shrink-0" />
                  <span className="text-[13px] text-white/70 leading-relaxed">
                    I authorize {companyName} to charge {fmt(payDisclaimerInv.total)} to my payment method. I understand this charge is non-refundable once service has been rendered, and that {companyName} may retain job photos/videos as service records for up to {(settings as any)?.mediaRetentionDays || 30} days. If I provided a phone number, I may receive text updates about this service (message/data rates may apply — reply STOP at any time to opt out, HELP for help; see {companyName}'s{" "}
                    <a href={"#/terms?co=" + encodeURIComponent(companyName)} target="_blank" rel="noopener noreferrer" className="underline text-red-300">Terms</a> and{" "}
                    <a href={"#/privacy?co=" + encodeURIComponent(companyName)} target="_blank" rel="noopener noreferrer" className="underline text-red-300">Privacy Policy</a>)
                    {payDisclaimerInv.terms ? <> — see full terms below.</> : "."}
                    {payDisclaimerInv.terms && <div className="mt-1.5 text-white/40 whitespace-pre-wrap">{payDisclaimerInv.terms}</div>}
                  </span>
                </label>
                <div className="flex gap-2">
                  <GBtn variant="ghost" onClick={() => setPayDisclaimerInv(null)} className="!text-xs">Cancel</GBtn>
                  <GBtn onClick={() => { setPayingInv(payDisclaimerInv); setPayDisclaimerInv(null); }} disabled={!agreedInvoiceTerms} className="!text-xs flex-1">Continue to Payment</GBtn>
                </div>
              </Glass>
            )}

            <div className="text-xs text-white/40 uppercase tracking-wider pt-2">Paid</div>
            {paid.length === 0 && <div className="text-center py-6 text-white/30 text-sm">No paid invoices yet</div>}
            {paid.map(inv => (
              <Glass key={inv.id} className="p-4 flex items-center justify-between gap-3 !bg-black/30">
                <div>
                  <div className="font-semibold">{fmt(inv.total)}</div>
                  <div className="text-xs text-white/40">Paid {inv.paidAt}</div>
                </div>
                <Badge tone="green">Paid</Badge>
              </Glass>
            ))}
          </div>
        )}

        {/* AUDIT FIX (round 13, item 7) — Quotes tab: pending (not yet
            invoiced) estimates, previously invisible in this portal — only
            invoiced ones ever showed, under Invoices. */}
        {tab === "quotes" && (
          <div className="space-y-3">
            {myQuotes.length === 0 && <div className="text-center py-6 text-white/30 text-sm">No quotes on file</div>}
            {myQuotes.map(q => (
              <Glass key={q.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{fmt(q.total)}</div>
                  <div className="text-xs text-white/40">{q.createdAt}</div>
                </div>
                <Badge tone={q.status === "approved" ? "green" : q.status === "rejected" ? "red" : "yellow"}>{q.status}</Badge>
              </Glass>
            ))}
          </div>
        )}

        {tab === "jobs" && (
          <div className="space-y-5">
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5"><CalendarClock size={12} />Upcoming</div>
              {upcomingJobs.length === 0 && <div className="text-center py-6 text-white/30 text-sm">No upcoming jobs</div>}
              {upcomingJobs.map(j => (
                <Glass key={j.id} className="p-4 mb-2">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="text-sm font-medium truncate">{j.address}</div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {j.jobType === "commercial" && <Badge tone="blue">Commercial</Badge>}
                      {j.isRecurring && <Badge tone="purple"><Repeat size={9} className="inline mr-0.5" />{j.recurringFreq || "Recurring"}</Badge>}
                      <Badge tone={j.status === "cancelled" ? "red" : "blue"}>{j.status}</Badge>
                    </div>
                  </div>
                  <div className="text-xs text-white/40">{j.scheduledDate}{j.scheduledTime ? ` · ${j.scheduledTime}` : ""}</div>
                  {/* FEATURE — "business name shows for each job, especially
                      with multiple businesses." myJobs is already scoped to
                      whichever business account is currently active, so this
                      is unambiguous — but it's easy to lose track of which
                      business you're viewing after switching or scrolling,
                      so label it on every job explicitly rather than relying
                      on the header alone. */}
                  {(portalData?.accounts?.length || 0) > 1 && <div className="text-[10px] text-red-400/70 mt-0.5">{companyName}</div>}

                  {/* FEATURE — self-serve cancel/reschedule (owner opt-in,
                      settings.clientPortalCancelReschedule). Falls back to
                      the request-only flow below when the owner hasn't
                      turned it on. */}
                  {settings?.clientPortalCancelReschedule && directActionJobId === j.id ? (
                    <div className="mt-2 space-y-2">
                      <div className="text-[11px] font-semibold text-white/70">{directActionType === "cancel" ? "Cancel this job" : "Reschedule this job"}</div>
                      {directActionType === "reschedule" && (
                        <div className="flex gap-2">
                          <input type="date" value={directNewDate} onChange={e => setDirectNewDate(e.target.value)} className="flex-1 bg-white/5 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/50" />
                          <input type="time" value={directNewTime} onChange={e => setDirectNewTime(e.target.value)} className="flex-1 bg-white/5 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/50" />
                        </div>
                      )}
                      <textarea value={directReason} onChange={e => setDirectReason(e.target.value)} rows={2} placeholder="Reason (required)" className="w-full bg-white/5 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/25 resize-none focus:outline-none focus:border-red-500/50" />
                      <div className="flex gap-2">
                        <button disabled={directSending} onClick={submitDirectAction} className="flex-1 py-1.5 rounded-lg bg-red-700/40 border border-red-600/50 text-white text-xs font-semibold disabled:opacity-50">{directSending ? "Sending…" : directActionType === "cancel" ? "Confirm Cancellation" : "Confirm New Date"}</button>
                        <button disabled={directSending} onClick={() => { setDirectActionJobId(null); setDirectActionType(null); setDirectReason(""); setDirectNewDate(""); setDirectNewTime(""); }} className="px-3 text-[11px] text-white/40 hover:text-white/60">Back</button>
                      </div>
                    </div>
                  ) : settings?.clientPortalCancelReschedule ? (
                    <div className="mt-2 flex items-center gap-3">
                      <button onClick={() => { setDirectActionJobId(j.id); setDirectActionType("reschedule"); }} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"><CalendarClock size={11} />Reschedule</button>
                      <button onClick={() => { setDirectActionJobId(j.id); setDirectActionType("cancel"); }} className="text-[11px] text-red-400 hover:text-red-300">Cancel Job</button>
                    </div>
                  ) : j.rescheduleRequested ? (
                    <div className="text-[11px] text-yellow-300/80 mt-2">📅 Reschedule requested — we'll confirm a new date soon.</div>
                  ) : rescheduleJobId === j.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea value={rescheduleNote} onChange={e => setRescheduleNote(e.target.value)} rows={2} placeholder="Preferred new date/time (optional)" className="w-full bg-white/5 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/25 resize-none focus:outline-none focus:border-red-500/50" />
                      <div className="flex gap-2">
                        <button disabled={reschedulingSend} onClick={() => requestReschedule(j.id)} className="flex-1 py-1.5 rounded-lg bg-red-700/40 border border-red-600/50 text-white text-xs font-semibold disabled:opacity-50">{reschedulingSend ? "Sending…" : "Send Request"}</button>
                        <button disabled={reschedulingSend} onClick={() => { setRescheduleJobId(null); setRescheduleNote(""); }} className="px-3 text-[11px] text-white/40 hover:text-white/60">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setRescheduleJobId(j.id)} className="mt-2 text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"><CalendarClock size={11} />Request Reschedule</button>
                  )}
                </Glass>
              ))}
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5"><Clock size={12} />Past Jobs</div>
              {pastJobs.length === 0 && <div className="text-center py-6 text-white/30 text-sm">No past jobs yet</div>}
              {pastJobs.map(j => (
                <Glass key={j.id} className="p-4 mb-2">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="text-sm font-medium truncate">{j.address}</div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {j.jobType === "commercial" && <Badge tone="blue">Commercial</Badge>}
                      {j.isRecurring && <Badge tone="purple"><Repeat size={9} className="inline mr-0.5" />{j.recurringFreq || "Recurring"}</Badge>}
                      <Badge tone={j.status === "completed" ? "green" : "red"}>{j.status}</Badge>
                    </div>
                  </div>
                  <div className="text-xs text-white/40">{j.scheduledDate}</div>
                  {(portalData?.accounts?.length || 0) > 1 && <div className="text-[10px] text-red-400/70 mt-0.5">{companyName}</div>}
                  {(j.photos || []).length > 0 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto">
                      {j.photos.map(p => <img key={p.id} src={mediaSrc(p.url, p.dataUrl)} alt="" className="w-16 h-16 rounded-lg object-cover border border-white/10 flex-shrink-0" />)}
                    </div>
                  )}
                </Glass>
              ))}
            </div>
          </div>
        )}

        {tab === "referrals" && (() => {
          // FEATURE — referral progress tracker. Reuses the SAME reward tier
          // ladder ReferralsPage.tsx already shows the owner (lib/seed.ts's
          // seedRewardTiers) so a client's "how close am I" view matches what
          // the owner actually offers, instead of a made-up parallel scale.
          const referredCount = referredCustomers.length;
          const sortedTiers = [...seedRewardTiers].sort((a, b) => a.minReferrals - b.minReferrals);
          const tiersReached = sortedTiers.filter(t => referredCount >= t.minReferrals);
          const currentTier = tiersReached[tiersReached.length - 1] || null;
          const nextTier = sortedTiers.find(t => t.minReferrals > referredCount) || null;
          const prevThreshold = currentTier?.minReferrals || 0;
          const progressPct = nextTier
            ? Math.min(100, Math.round(((referredCount - prevThreshold) / (nextTier.minReferrals - prevThreshold)) * 100))
            : 100;
          return (
            <div className="space-y-3">
              <Glass className="p-4">
                <div className="text-xs text-white/50 mb-1">Your referral code</div>
                <div className="text-2xl font-bold tracking-wider">{cust.referralCode || "—"}</div>
                <button onClick={() => { navigator.clipboard.writeText(referralLink); toast?.("Referral link copied ✓"); }} className="mt-3 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm flex items-center justify-center gap-2"><Copy size={13} />Copy Referral Link</button>
              </Glass>
              <div className="grid grid-cols-2 gap-3">
                <Stat icon={User} label="Referred" value={String(referredCount)} />
                <Stat icon={Gift} label="Credit Owed" value={fmt(cust.referralCreditOwed || 0)} />
              </div>

              {sortedTiers.length > 0 && (
                <Glass className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-white/70">
                      {currentTier ? <>Unlocked: {currentTier.icon} {currentTier.reward}</> : "Refer a friend to start earning rewards"}
                    </div>
                    {nextTier && <div className="text-[10px] text-white/40">{nextTier.minReferrals - referredCount} more to {nextTier.icon} {nextTier.label}</div>}
                  </div>
                  {nextTier && (
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-3">
                      <div className="h-full bg-gradient-to-r from-red-600 to-red-800 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {sortedTiers.map(t => {
                      const reached = referredCount >= t.minReferrals;
                      return (
                        <div key={t.id} className={"flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg " + (reached ? "bg-green-950/20 text-green-300" : "text-white/40")}>
                          <span className="flex items-center gap-1.5">{t.icon} {t.label} ({t.minReferrals})</span>
                          <span className="flex items-center gap-1">{reached && <CheckCircle size={11} />}{t.reward}</span>
                        </div>
                      );
                    })}
                  </div>
                </Glass>
              )}
            </div>
          );
        })()}

        {tab === "payment" && (
          <div className="space-y-3">
            <Glass className="p-4">
              <div className="text-sm font-medium mb-2">Saved Payment Methods</div>
              {myCards.length > 0 ? (
                <div className="space-y-2 mb-2">
                  {myCards.map(card => {
                    const isDefault = card.id === cust.savedPaymentMethodId;
                    const canRemove = !isDefault || myCards.length > 1 || !(cust.recurringPayment?.enabled || jobs.some(j => j.customerId === cust.id && j.isRecurring));
                    return (
                      <div key={card.id} className={"flex items-center justify-between p-2.5 rounded-xl border " + (isDefault ? "border-emerald-600/40 bg-emerald-950/10" : "border-white/10 bg-white/5")}>
                        <div className="text-xs text-white/70 flex items-center gap-2">
                          <CreditCard size={14} className={isDefault ? "text-emerald-400" : "text-white/40"} />
                          {(card.brand || "Card").replace(/^./, c => c.toUpperCase())} •••• {card.last4}
                          {card.expMonth ? <span className="text-white/30">· exp {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}</span> : null}
                          {isDefault && <Badge tone="green">Default</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          {!isDefault && (
                            <button
                              disabled={cardsBusyId === card.id}
                              onClick={() => {
                                const label = `${(card.brand || "Card").replace(/^./, c => c.toUpperCase())} •••• ${card.last4}`;
                                setCustomers((prev: Customer[]) => prev.map(c => c.id === cust.id ? { ...c, savedPaymentMethodId: card.id, savedPaymentMethodLabel: label } : c));
                                patchCust({ savedPaymentMethodId: card.id, savedPaymentMethodLabel: label } as any);
                                toast?.("Default card updated ✓", "green");
                              }}
                              className="text-[11px] text-purple-400 hover:text-purple-300"
                            >Make Default</button>
                          )}
                          {canRemove && (
                            <button
                              disabled={cardsBusyId === card.id}
                              onClick={async () => {
                                setCardsBusyId(card.id);
                                try {
                                  await detachMyPaymentMethod(session!.access_token!, card.id);
                                  const remaining = myCards.filter(c => c.id !== card.id);
                                  if (isDefault) {
                                    const next = remaining[0];
                                    const label = next ? `${(next.brand || "Card").replace(/^./, c => c.toUpperCase())} •••• ${next.last4}` : "";
                                    setCustomers((prev: Customer[]) => prev.map(c => c.id === cust.id ? { ...c, savedPaymentMethodId: next?.id || "", savedPaymentMethodLabel: label } : c));
                                    patchCust({ savedPaymentMethodId: next?.id || "", savedPaymentMethodLabel: label } as any);
                                  }
                                  setMyCards(remaining);
                                  toast?.("Card removed", "green");
                                } catch (e: any) {
                                  toast?.("Couldn't remove card: " + (e?.message || "unknown error"), "red");
                                } finally {
                                  setCardsBusyId(null);
                                }
                              }}
                              className="text-[11px] text-red-400 hover:text-red-300"
                            >Remove</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-white/40 mb-2">No cards saved yet.</div>
              )}
              <button onClick={() => setShowSaveCard(true)} disabled={!active?.settings?.stripePublishableKey} className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm flex items-center justify-center gap-2 disabled:opacity-40"><CreditCard size={14} />{myCards.length > 0 ? "Add Another Card" : "Save a Card"}</button>
              {!active?.settings?.stripePublishableKey && <div className="text-[10px] text-white/30 mt-2">{companyName} hasn't connected online payments yet.</div>}
            </Glass>

            {isCommercial && (
              <Glass className="p-4 space-y-3">
                <div className="text-sm font-medium flex items-center gap-1.5"><Repeat size={14} />Recurring Payment</div>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!cust.recurringPayment?.enabled} onChange={(e: any) => patchCust(c => ({ recurringPayment: { ...(c.recurringPayment || { frequency: "monthly" }), enabled: e.target.checked } }))} className="accent-red-600" />Enable recurring billing</label>
                {cust.recurringPayment?.enabled && (
                  <>
                    <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
                      {(["monthly", "quarterly"] as const).map(f => (
                        <button key={f} onClick={() => patchCust(c => ({ recurringPayment: { ...c.recurringPayment!, frequency: f } }))} className={"flex-1 py-1.5 rounded-lg text-xs capitalize transition " + (cust.recurringPayment?.frequency === f ? "bg-red-700/40 text-white" : "text-white/50")}>{f}</button>
                      ))}
                    </div>
                    <GInput type="number" placeholder="Amount per charge ($)" value={cust.recurringPayment?.amount || ""} onChange={(e: any) => patchCust(c => ({ recurringPayment: { ...c.recurringPayment!, amount: Number(e.target.value) } }))} className="!text-sm" />
                    <div className="text-[10px] text-white/30">{companyName} will reach out before each charge — saved card required.</div>
                  </>
                )}
              </Glass>
            )}
          </div>
        )}
      </div>

      <StripePaymentModal
        open={!!payingInv}
        onClose={() => setPayingInv(null)}
        publishableKey={active?.settings?.stripePublishableKey || ""}
        stripeAccountId={active?.settings?.stripeAccountId}
        amount={payingInv?.total || 0}
        description={`${companyName} — Invoice #${payingInv?.id || ""}`}
        invoiceId={payingInv?.id}
        allowSaveCard
        onSuccess={(paymentIntentId, savedCard) => {
          const invId = payingInv?.id;
          if (savedCard) {
            const isFirstCard = myCards.length === 0;
            const patch: any = { stripeCustomerId: savedCard.stripeCustomerId, cardConsentAt: new Date().toISOString() };
            if (isFirstCard) { patch.savedPaymentMethodId = savedCard.paymentMethodId; patch.savedPaymentMethodLabel = savedCard.label; }
            setCustomers((prev: Customer[]) => prev.map(c => c.id === cust.id ? { ...c, ...patch } : c));
            patchCust(patch);
            (async () => {
              try {
                const { data: sessData } = await supabase.auth.getSession();
                const token = sessData.session?.access_token;
                await fetch("/api/public-data", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ action: "client_save_card_link", ...savedCard, consentAt: patch.cardConsentAt, setAsDefault: isFirstCard }),
                });
                refreshMyCards();
              } catch (e: any) { console.warn("[Payment] card save-on-file sync failed:", e?.message); }
            })();
          }
          // Global `estimates` prop is owner_id-scoped/empty for this
          // customer session now — this page renders from portalData, so
          // update that instead. Still call setEstimates too in case it's
          // ever non-empty (e.g. owner previewing this portal).
          setEstimates((prev: Estimate[]) => prev.map(e => e.id === invId ? { ...e, paidAt: today(), stripePaymentIntentId: paymentIntentId, stripePaymentStatus: "paid" as const } : e));
          patchActiveEstimates(ests => ests.map(e => e.id === invId ? { ...e, paidAt: today(), stripePaymentIntentId: paymentIntentId, stripePaymentStatus: "paid" as const } : e));
          // Persist to Supabase so the OWNER's CRM poll sees the payment and
          // fires an owner notification (BUG 15 / FEATURE 5).
          if (invId) {
            (supabase as any).from("estimates").update({ paidAt: today(), stripePaymentIntentId: paymentIntentId, stripePaymentStatus: "paid" }).eq("id", invId).then(() => {}).catch(() => {});
          }
          sendPaymentReceipt({
            customerPhone: cust.phone, customerEmail: cust.email, customerFirstName: cust.firstName, customerId: cust.id,
            amountCents: Math.round((payingInv?.total || 0) * 100), description: `Invoice #${invId || ""}`, invoiceId: invId,
          }).catch((e: any) => console.warn("[PaymentReceipt] failed:", e?.message));
          toast?.("Payment received ✓", "green");
          setPayingInv(null);
        }}
      />

      <SaveCardModal
        open={showSaveCard}
        onClose={() => setShowSaveCard(false)}
        publishableKey={active?.settings?.stripePublishableKey || ""}
        stripeAccountId={active?.settings?.stripeAccountId}
        ownerId={(cust as any).owner_id}
        email={cust.email}
        name={`${cust.firstName} ${cust.lastName}`}
        existingStripeCustomerId={cust.stripeCustomerId}
        isRecurringClient={!!cust.recurringPayment?.enabled || jobs.some(j => j.customerId === cust.id && j.isRecurring)}
        onSaved={async (stripeCustomerId, paymentMethodId, label, consentAt) => {
          // First card ever saved becomes the default automatically; a
          // second/third card just joins the list (myCards) without
          // disturbing whichever one is already the default — the customer
          // picks explicitly via "Make Default" above.
          const isFirstCard = myCards.length === 0;
          const patch: any = { stripeCustomerId, cardConsentAt: consentAt || cust.cardConsentAt };
          if (isFirstCard) { patch.savedPaymentMethodId = paymentMethodId; patch.savedPaymentMethodLabel = label; }
          setCustomers((prev: Customer[]) => prev.map(c => c.id === cust.id ? { ...c, ...patch } : c));
          patchCust(patch);
          setShowSaveCard(false);
          refreshMyCards();
          // BUG FIX — this used to only update local React state, with no
          // Supabase write at all. The card really did get saved on
          // Stripe's side, but the CRM never durably linked it to this
          // customer's row, so it silently disappeared again on next
          // login/page refresh even though the toast said "Card saved ✓."
          try {
            const { data: sessData } = await supabase.auth.getSession();
            const token = sessData.session?.access_token;
            const res = await fetch("/api/public-data", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: "client_save_card_link", stripeCustomerId, paymentMethodId, label, consentAt: patch.cardConsentAt, setAsDefault: isFirstCard }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || data?.error) { toast?.("Card saved, but didn't sync — it may not appear next time you log in (" + (data?.error || "sync failed") + ")", "yellow"); return; }
            toast?.("Card saved ✓", "green");
          } catch (e: any) {
            toast?.("Card saved, but didn't sync — it may not appear next time you log in", "yellow");
          }
        }}
      />

      {/* MULTI-BUSINESS — "Connect to another business" from inside an
          already-logged-in portal, same search/request flow as the
          logged-in-but-no-account screen above. */}
      <Modal open={findOpen} onClose={() => setFindOpen(false)} title="Connect to a Business">
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <GInput placeholder="Search by business name..." value={findQuery} onChange={(e: any) => searchBusinesses(e.target.value)} className="!text-sm !pl-9" />
          </div>
          {findBusy && <div className="text-center text-xs text-white/30">Searching…</div>}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {findResults.filter(b => !(portalData?.accounts || []).some(a => (a.customer as any).owner_id === b.ownerId)).map(b => {
              const isConnecting = connectingOwnerId === b.ownerId;
              const isConnected = connectedOwnerIds.includes(b.ownerId);
              return (
                <div key={b.ownerId} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{b.companyName}</div>
                    {b.companyPhone && <div className="text-[11px] text-white/40">{b.companyPhone}</div>}
                  </div>
                  {isConnected ? (
                    <Badge tone="green">Requested</Badge>
                  ) : (
                    <GBtn disabled={isConnecting} onClick={() => requestConnect(b.ownerId)} className="!text-xs !py-1.5 flex-shrink-0">
                      {isConnecting ? "Sending…" : <><Plus size={12} className="inline mr-1" />Connect</>}
                    </GBtn>
                  )}
                </div>
              );
            })}
            {!findBusy && findQuery.trim().length >= 2 && findResults.length === 0 && (
              <div className="text-center text-xs text-white/30 py-4">No businesses found matching "{findQuery}"</div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
