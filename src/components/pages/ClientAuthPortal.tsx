import React, { useEffect, useRef, useState } from "react";
import { Lock, Mail, User, Phone, LogOut, CreditCard, Receipt, CheckCircle, Clock, Gift, Copy, Repeat, ImageIcon, ChevronRight } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { fmt, uid, today } from "../../lib/utils";
import type { Customer, Estimate, Job, AppSettings } from "../../types";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { Badge } from "../ui/Badge";
import { Stat } from "../ui/Stat";
import { StripePaymentModal } from "../ui/StripePaymentModal";
import { SaveCardModal } from "../ui/SaveCardModal";

// Public, unauthenticated-by-default route (#/client) — a customer-facing
// portal with its own Supabase email/password auth, intentionally separate
// from the owner/employee auth handled in App.tsx (see the route guards
// added there). Customers are matched to their CRM record by email since
// there's no backend to mint a dedicated client_id at signup time.
export function ClientAuthPortal({
  customers = [], setCustomers = (() => {}) as any,
  estimates = [], setEstimates = (() => {}) as any,
  jobs = [], settings = {} as AppSettings, estimateTemplates = [], toast = (() => {}) as any,
}: {
  customers?: Customer[]; setCustomers?: any;
  estimates?: Estimate[]; setEstimates?: any;
  jobs?: Job[]; settings?: AppSettings; estimateTemplates?: any[]; toast?: any;
}) {
  const [session, setSession] = useState<any>(null);
  const [checked, setChecked] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [tab, setTab] = useState<"invoices" | "jobs" | "referrals" | "payment">("invoices");
  const [payingInv, setPayingInv] = useState<Estimate | null>(null);
  const [showSaveCard, setShowSaveCard] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session || null);
      setChecked(true);
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const cust = session?.user?.email
    ? customers.find(c => (c.email || "").toLowerCase() === session.user.email.toLowerCase())
    : null;

  // BUG 10 — if an OWNER/employee is logged in and lands on #/client, they'll
  // have a session but no matching customer record, which used to strand them
  // on "Setting up your account…". Detect a staff session (matches the owner's
  // configured email, or a row in the employees table) and bounce them to the
  // main app instead of showing the customer setup screen.
  useEffect(() => {
    if (!checked || !session?.user?.email || cust) return;
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
        if (!customers.find(c => (c.email || "").toLowerCase() === email.trim().toLowerCase())) {
          const id = uid();
          const referralCode = (firstName.slice(0, 3) || "REF").toUpperCase() + id.slice(-4).toUpperCase();
          setCustomers((prev: Customer[]) => [...prev, {
            id, firstName: firstName || "Customer", lastName: lastName || "", email: email.trim(), phone,
            address: "", tags: [], totalSpent: 0, createdAt: today(), referralCode,
          } as Customer]);
        }
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

  const signOut = async () => { await supabase.auth.signOut({ scope: "local" }); setSession(null); };

  const companyName = settings?.companyName || "Crew Boss";

  if (!checked) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white/40 text-sm">Loading…</div>;
  }

  // ── Logged out — login / signup form ──────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center mx-auto shadow-lg shadow-red-900/40">
              <span className="text-xl font-black text-white">{companyName[0]}</span>
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
            <GInput type="password" placeholder="Password" value={password} onChange={(e: any) => setPassword(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && handleAuth()} className="!text-sm" />
            {authError && <div className="text-xs text-red-400">{authError}</div>}
            <GBtn onClick={handleAuth} disabled={authBusy} className="w-full !py-3">{authBusy ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}</GBtn>
          </Glass>
        </div>
      </div>
    );
  }

  // ── Logged in, no matching customer record yet ─────────────────────────────
  if (!cust) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 text-center">
        <div className="max-w-sm space-y-3">
          <div className="text-white font-semibold">Setting up your account…</div>
          <div className="text-xs text-white/40">We couldn't find a customer record for {session.user.email}. Contact {companyName} to link your account, or sign out and try a different email.</div>
          <GBtn variant="ghost" onClick={signOut}><LogOut size={13} className="inline mr-1.5" />Sign Out</GBtn>
        </div>
      </div>
    );
  }

  const myInvoices = estimates.filter(e => e.customerId === cust.id && e.invoiced);
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
  const myJobs = jobs.filter(j => j.customerId === cust.id).sort((a, b) => (b.scheduledDate || "").localeCompare(a.scheduledDate || ""));
  const completedJobs = myJobs.filter(j => j.status === "completed");
  const referredCustomers = customers.filter(c => c.referredBy === cust.id);
  const referralLink = `${window.location.origin}${window.location.pathname}#/referral?ref=${cust.referralCode || ""}`;
  const isCommercial = !!cust.isCommercial || (cust.tags || []).includes("Commercial");

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="bg-gradient-to-r from-red-600 to-red-800 px-5 py-4 flex items-center justify-between">
        <div>
          <div className="font-bold">{companyName}</div>
          <div className="text-red-200 text-xs">Hi {cust.firstName} 👋</div>
        </div>
        <button onClick={signOut} className="text-white/80 hover:text-white flex items-center gap-1 text-xs"><LogOut size={14} />Sign Out</button>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={Receipt} label="Outstanding" value={fmt(outstanding.reduce((s, e) => s + e.total, 0))} />
          <Stat icon={CheckCircle} label="Jobs Done" value={String(completedJobs.length)} />
          <Stat icon={Gift} label="Referral Credit" value={fmt(cust.referralCreditOwed || 0)} />
        </div>

        <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl overflow-x-auto">
          {([["invoices", "Invoices", Receipt], ["jobs", "Past Jobs", Clock], ["referrals", "Referrals", Gift], ["payment", "Payment", CreditCard]] as const).map(([key, label, Icon]) => (
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
                <GBtn onClick={() => setPayingInv(inv)} className="!text-xs !py-2"><CreditCard size={13} className="inline mr-1" />Pay Now</GBtn>
              </Glass>
            ))}
            {outstanding.length === 0 && <div className="text-center py-6 text-white/30 text-sm">No outstanding invoices 🎉</div>}

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

        {tab === "jobs" && (
          <div className="space-y-3">
            {myJobs.length === 0 && <div className="text-center py-6 text-white/30 text-sm">No jobs on file yet</div>}
            {myJobs.map(j => (
              <Glass key={j.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">{j.address}</div>
                  <Badge tone={j.status === "completed" ? "green" : j.status === "cancelled" ? "red" : "blue"}>{j.status}</Badge>
                </div>
                <div className="text-xs text-white/40">{j.scheduledDate}</div>
                {(j.photos || []).length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto">
                    {j.photos.map(p => <img key={p.id} src={p.dataUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-white/10 flex-shrink-0" />)}
                  </div>
                )}
              </Glass>
            ))}
          </div>
        )}

        {tab === "referrals" && (
          <div className="space-y-3">
            <Glass className="p-4">
              <div className="text-xs text-white/50 mb-1">Your referral code</div>
              <div className="text-2xl font-bold tracking-wider">{cust.referralCode || "—"}</div>
              <button onClick={() => { navigator.clipboard.writeText(referralLink); toast?.("Referral link copied ✓"); }} className="mt-3 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm flex items-center justify-center gap-2"><Copy size={13} />Copy Referral Link</button>
            </Glass>
            <div className="grid grid-cols-2 gap-3">
              <Stat icon={User} label="Referred" value={String(referredCustomers.length)} />
              <Stat icon={Gift} label="Credit Owed" value={fmt(cust.referralCreditOwed || 0)} />
            </div>
          </div>
        )}

        {tab === "payment" && (
          <div className="space-y-3">
            <Glass className="p-4">
              <div className="text-sm font-medium mb-1">Saved Payment Method</div>
              {cust.savedPaymentMethodLabel ? (
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/60 flex items-center gap-2"><CreditCard size={14} />{cust.savedPaymentMethodLabel}</div>
                  <button onClick={() => setShowSaveCard(true)} className="text-xs text-purple-400 hover:text-purple-300">Replace</button>
                </div>
              ) : (
                <button onClick={() => setShowSaveCard(true)} disabled={!settings?.stripePublishableKey} className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm flex items-center justify-center gap-2 disabled:opacity-40"><CreditCard size={14} />Save a Card</button>
              )}
              {!settings?.stripePublishableKey && <div className="text-[10px] text-white/30 mt-2">{companyName} hasn't connected online payments yet.</div>}
            </Glass>

            {isCommercial && (
              <Glass className="p-4 space-y-3">
                <div className="text-sm font-medium flex items-center gap-1.5"><Repeat size={14} />Recurring Payment</div>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!cust.recurringPayment?.enabled} onChange={(e: any) => setCustomers((prev: Customer[]) => prev.map(c => c.id === cust.id ? { ...c, recurringPayment: { ...(c.recurringPayment || { frequency: "monthly" }), enabled: e.target.checked } } : c))} className="accent-red-600" />Enable recurring billing</label>
                {cust.recurringPayment?.enabled && (
                  <>
                    <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
                      {(["monthly", "quarterly"] as const).map(f => (
                        <button key={f} onClick={() => setCustomers((prev: Customer[]) => prev.map(c => c.id === cust.id ? { ...c, recurringPayment: { ...c.recurringPayment!, frequency: f } } : c))} className={"flex-1 py-1.5 rounded-lg text-xs capitalize transition " + (cust.recurringPayment?.frequency === f ? "bg-red-700/40 text-white" : "text-white/50")}>{f}</button>
                      ))}
                    </div>
                    <GInput type="number" placeholder="Amount per charge ($)" value={cust.recurringPayment?.amount || ""} onChange={(e: any) => setCustomers((prev: Customer[]) => prev.map(c => c.id === cust.id ? { ...c, recurringPayment: { ...c.recurringPayment!, amount: Number(e.target.value) } } : c))} className="!text-sm" />
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
        publishableKey={settings?.stripePublishableKey || ""}
        secretKeyEnc={settings?.stripeSecretKeyEnc || ""}
        amount={payingInv?.total || 0}
        description={`${companyName} — Invoice #${payingInv?.id || ""}`}
        onSuccess={(paymentIntentId) => {
          const invId = payingInv?.id;
          setEstimates((prev: Estimate[]) => prev.map(e => e.id === invId ? { ...e, paidAt: today(), stripePaymentIntentId: paymentIntentId, stripePaymentStatus: "paid" as const } : e));
          // Persist to Supabase so the OWNER's CRM poll sees the payment and
          // fires an owner notification (BUG 15 / FEATURE 5).
          if (invId) {
            (supabase as any).from("estimates").update({ paidAt: today(), stripePaymentIntentId: paymentIntentId, stripePaymentStatus: "paid" }).eq("id", invId).then(() => {}).catch(() => {});
          }
          toast?.("Payment received ✓", "green");
          setPayingInv(null);
        }}
      />

      <SaveCardModal
        open={showSaveCard}
        onClose={() => setShowSaveCard(false)}
        publishableKey={settings?.stripePublishableKey || ""}
        secretKeyEnc={settings?.stripeSecretKeyEnc || ""}
        email={cust.email}
        name={`${cust.firstName} ${cust.lastName}`}
        existingStripeCustomerId={cust.stripeCustomerId}
        onSaved={(stripeCustomerId, paymentMethodId, label) => {
          setCustomers((prev: Customer[]) => prev.map(c => c.id === cust.id ? { ...c, stripeCustomerId, savedPaymentMethodId: paymentMethodId, savedPaymentMethodLabel: label } : c));
          toast?.("Card saved ✓", "green");
          setShowSaveCard(false);
        }}
      />
    </div>
  );
}
