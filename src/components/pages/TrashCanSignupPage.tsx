import React, { useState, useEffect } from "react";
import { CheckCircle, Trash2, CreditCard } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { uid, today } from "../../lib/utils";
import { loadStripeJs, createStripeCustomer, createSetupIntent } from "../../lib/stripe";

// Public-facing Trash Can Cleaning signup form (round 13, items 16-18) — no
// auth required. URL: #/trash-cans?oid=OWNER_ID&co=COMPANY_NAME&ph=COMPANY_PHONE&
// cost=COST_PER_CAN&min=MINUTES_PER_CAN&freq=DEFAULT_FREQUENCY&pk=STRIPE_PUBLISHABLE_KEY
//
// Same reasoning as LeadFormPage.tsx: deliberately does NOT read the whole
// app_settings row (holds live secrets — Twilio token, Stripe SECRET key,
// Google token — behind a permissive RLS policy). The co/ph/cost/min/freq/pk
// query params remain as an offline fallback for pre-existing copied links,
// but on load (ITEM 10) this now also tries a live, narrow refetch keyed by
// `oid` (the owner's id) using PostgREST's `column->>path` selector, which
// asks Postgres to project only these specific JSONB keys out of the
// `settings` blob server-side — the secret fields never leave the database,
// so this is safe to call from an anonymous page unlike `select("*")` would
// be. That means pricing/schedule changes the owner makes in Settings show
// up on this page immediately, without needing to re-copy/re-share the link.
function hashParam(key: string): string {
  const hash = window.location.hash;
  const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(q).get(key) || "";
}

export function TrashCanSignupPage() {
  const ownerId = hashParam("oid");
  const [companyName, setCompanyName] = useState(decodeURIComponent(hashParam("co") || "") || "Trash Can Cleaning");
  const [companyPhone, setCompanyPhone] = useState(decodeURIComponent(hashParam("ph") || ""));
  const [costPerCan, setCostPerCan] = useState(Number(hashParam("cost")) || 5);
  const [minutesPerCan, setMinutesPerCan] = useState(Number(hashParam("min")) || 5);
  const [defaultFreq, setDefaultFreq] = useState((hashParam("freq") || "weekly") as "weekly" | "monthly" | "quarterly");
  const [publishableKey, setPublishableKey] = useState(hashParam("pk"));
  // Inconvenience fee (Settings → Trash Cans → "Cans Not Out Fee") — no link
  // query-param fallback for this one since it's new; always comes from the
  // live /api/public-data fetch below, same source as everything else here.
  const [feeName, setFeeName] = useState("");
  const [feeAmount, setFeeAmount] = useState(0);
  // Stripe Connect owner's account id — required for the client-side
  // Stripe.js instance to confirm this signup form's card against the
  // right connected account. See loadStripeJs's stripeAccount param.
  const [stripeAccountId, setStripeAccountId] = useState("");

  useEffect(() => {
    if (!ownerId) return;
    (async () => {
      try {
        // MULTI-TENANT (Phase D) — was a direct anon-key `.from("app_settings")`
        // read scoped by `.eq("owner_id", ownerId)`. Once RLS is owner_id-scoped
        // (0033_multitenant_owner_scoping.sql), current_owner_id() can't resolve
        // for this anonymous visitor, so that read would return nothing. Routed
        // through /api/public-data (service role, bypasses RLS) instead — same
        // narrow field projection, just resolved server-side.
        const res = await fetch("/api/public-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_trashcan_signup_settings", ownerId }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || data.error) return;
        if (data.cost != null) setCostPerCan(Number(data.cost) || costPerCan);
        if (data.minutes != null) setMinutesPerCan(Number(data.minutes) || minutesPerCan);
        if (data.freq) setDefaultFreq(data.freq);
        if (data.co) setCompanyName(data.co);
        if (data.ph) setCompanyPhone(data.ph);
        if (data.pk) setPublishableKey(data.pk);
        if (data.stripeAccountId) setStripeAccountId(data.stripeAccountId);
        if (data.feeName) setFeeName(data.feeName);
        if (data.feeAmount != null) setFeeAmount(Number(data.feeAmount) || 0);
      } catch (e: any) {
        console.warn("[TrashCanSignup] live settings refresh failed, using link params:", e?.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", address: "", cans: 2 });
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "quarterly" | "onetime">(defaultFreq);
  const [startDate, setStartDate] = useState(today());
  const [agreed, setAgreed] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [cardStatus, setCardStatus] = useState<"idle" | "loading" | "ready" | "processing">("idle");
  const [cardError, setCardError] = useState("");
  const stripeRef = React.useRef<any>(null);
  const elementsRef = React.useRef<any>(null);
  const stripeCustomerIdRef = React.useRef<string>("");
  const paymentMethodIdRef = React.useRef<string>("");
  const cardMountRef = React.useRef<HTMLDivElement | null>(null);

  const price = Math.max(0, Number(f.cans) || 0) * costPerCan;

  const startCardSetup = async () => {
    if (!publishableKey) { setCardError("Card on file isn't available — this business hasn't connected Stripe."); return; }
    setCardStatus("loading");
    setCardError("");
    try {
      const cust = await createStripeCustomer(f.email.trim(), `${f.firstName} ${f.lastName}`.trim(), ownerId);
      stripeCustomerIdRef.current = cust.id;
      const intent = await createSetupIntent(cust.id, ownerId);
      const stripe = await loadStripeJs(publishableKey, stripeAccountId || undefined);
      stripeRef.current = stripe;
      const elements = stripe.elements({ clientSecret: intent.client_secret });
      elementsRef.current = elements;
      const el = elements.create("payment");
      if (cardMountRef.current) el.mount(cardMountRef.current);
      setCardStatus("ready");
    } catch (e: any) {
      setCardError(e?.message || "Failed to load card form");
      setCardStatus("idle");
    }
  };

  const confirmCard = async (): Promise<boolean> => {
    if (!stripeRef.current || !elementsRef.current) return false;
    setCardStatus("processing");
    const { error: confirmError, setupIntent } = await stripeRef.current.confirmSetup({ elements: elementsRef.current, redirect: "if_required" });
    if (confirmError) { setCardError(confirmError.message || "Failed to save card"); setCardStatus("ready"); return false; }
    paymentMethodIdRef.current = setupIntent?.payment_method || "";
    return true;
  };

  const handleSubmit = async () => {
    if (!f.firstName.trim() || !f.phone.trim() || !f.address.trim() || !f.cans || !agreed || !smsOptIn) return;
    setSubmitting(true);
    setError("");
    try {
      // Card on file is required for recurring service (this is a
      // put-a-card-on-file-and-be-billed flow, not pay-now) — confirm it
      // before creating any records, so we never save a job with no way to
      // actually bill it.
      if (publishableKey && cardStatus === "ready") {
        const ok = await confirmCard();
        if (!ok) { setSubmitting(false); return; }
      }
      const customerId = uid();
      const newCustomer: any = {
        id: customerId, firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim(), phone: f.phone.trim(),
        address: f.address.trim(), leadSource: "Trash Can Signup", tags: ["Trash Can"], createdAt: today(), totalSpent: 0, pipelineStage: "lead",
        smsOptIn: true, smsOptInAt: new Date().toISOString(),
        ...(stripeCustomerIdRef.current ? { stripeCustomerId: stripeCustomerIdRef.current, savedPaymentMethodId: paymentMethodIdRef.current, savedPaymentMethodLabel: "Card on file" } : {}),
      };
      let { error: custErr } = await (supabase as any).from("customers").insert(newCustomer);
      if (custErr) {
        const { smsOptIn: _a, smsOptInAt: _b, stripeCustomerId: _c, savedPaymentMethodId: _d, savedPaymentMethodLabel: _e, ...core } = newCustomer;
        const retry = await (supabase as any).from("customers").insert(core);
        custErr = retry.error;
      }
      if (custErr) throw new Error(custErr.message);

      const isRecurring = frequency !== "onetime";
      const recurringFreq = frequency === "onetime" ? undefined : frequency;
      const newJob: any = {
        id: uid(), customerId, address: f.address.trim(), status: "scheduled", scheduledDate: startDate,
        amount: price, serviceCategory: "trash_can", cansCount: Number(f.cans) || 1,
        notes: `Trash can cleaning — ${f.cans} can(s) — signed up via public form`,
        tags: [], commLog: [], chemicalsUsed: [], equipment: [], crew: [],
        isRecurring, ...(recurringFreq ? { recurringFreq, recurringMode: "preset" } : {}),
        createdAt: today(),
      };
      const { error: jobErr } = await (supabase as any).from("jobs").insert(newJob);
      if (jobErr) throw new Error(jobErr.message);

      setSubmitted(true);
    } catch (e: any) {
      console.error("[TrashCanSignup] failed:", e?.message);
      setError("Something went wrong submitting your request — please call or text us instead.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle size={48} className="text-green-400 mb-3" />
        <div className="text-xl font-bold text-green-400">You're all set!</div>
        <div className="text-white/60 text-sm mt-1">We'll confirm your first {frequency === "onetime" ? "cleaning" : frequency + " cleaning"} shortly.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-5">
        <div className="font-bold text-lg text-white flex items-center gap-2"><Trash2 size={18} />{companyName} — Trash Can Cleaning</div>
        <div className="text-red-200 text-xs mt-0.5">Fresh, clean cans — set it and forget it{companyPhone ? ` · ${companyPhone}` : ""}</div>
      </div>
      <div className="p-6 max-w-lg mx-auto space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-white/60 mb-1 block">First Name *</label><input value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-red-500/50" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Last Name</label><input value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-red-500/50" /></div>
        </div>
        <div><label className="text-xs text-white/60 mb-1 block">Phone Number *</label><input type="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="(717) 555-0100" className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-red-500/50" /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Email</label><input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-red-500/50" /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Property Address *</label><input value={f.address} onChange={e => setF({ ...f, address: e.target.value })} placeholder="412 Oak Ridge Ln, York PA" className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-red-500/50" /></div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Number of Cans *</label>
            <input type="number" min={1} value={f.cans} onChange={e => setF({ ...f, cans: Number(e.target.value) || 1 })} className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Schedule</label>
            <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50">
              <option value="weekly" className="bg-black">Weekly</option>
              <option value="monthly" className="bg-black">Monthly</option>
              <option value="quarterly" className="bg-black">Quarterly</option>
              <option value="onetime" className="bg-black">One-time only</option>
            </select>
          </div>
        </div>
        <div><label className="text-xs text-white/60 mb-1 block">First cleaning date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50" /></div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-red-950/40 to-black/60 border border-red-600/40 text-center">
          <div className="text-3xl font-bold">${price.toFixed(2)}</div>
          <div className="text-xs text-white/60 mt-1">per cleaning ({f.cans} can{Number(f.cans) !== 1 ? "s" : ""} × ${costPerCan.toFixed(2)})</div>
        </div>

        <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 flex-shrink-0" />
          <span className="text-[12px] text-white/70 leading-relaxed">I authorize {companyName} to keep a card on file and charge ${price.toFixed(2)} per cleaning{frequency !== "onetime" ? ` on a ${frequency} recurring basis` : ""}. I can cancel or reschedule any time.{feeAmount > 0 && ` If cans aren't left out/accessible on the scheduled day, a $${feeAmount.toFixed(2)} ${feeName || "inconvenience fee"} may apply.`}</span>
        </label>
        <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
          <input type="checkbox" checked={smsOptIn} onChange={e => setSmsOptIn(e.target.checked)} className="mt-0.5 flex-shrink-0" />
          <span className="text-[11px] text-white/60 leading-relaxed">
            By checking this box, I agree to receive text messages from {companyName} about my service (reminders, on-the-way updates). Message/data rates may apply. Reply STOP to unsubscribe. See{" "}
            <a href={"#/terms?co=" + encodeURIComponent(companyName)} target="_blank" rel="noopener noreferrer" className="text-red-400 underline">Terms</a> and{" "}
            <a href={"#/privacy?co=" + encodeURIComponent(companyName)} target="_blank" rel="noopener noreferrer" className="text-red-400 underline">Privacy Policy</a>.
          </span>
        </label>

        {agreed && publishableKey && (
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <div className="text-xs text-white/60 flex items-center gap-1.5"><CreditCard size={12} />Card on file</div>
            {cardStatus === "idle" && <button onClick={startCardSetup} className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm">Add card</button>}
            {cardStatus === "loading" && <div className="text-center text-xs text-white/40 py-3">Loading…</div>}
            <div ref={cardMountRef} className={cardStatus === "ready" || cardStatus === "processing" ? "" : "hidden"} />
            {cardError && <div className="text-xs text-red-400">{cardError}</div>}
          </div>
        )}

        {error && <div className="text-xs text-red-400 bg-red-950/20 border border-red-700/30 rounded-xl px-3 py-2">{error}</div>}
        <button
          onClick={handleSubmit}
          disabled={!f.firstName.trim() || !f.phone.trim() || !f.address.trim() || !f.cans || !agreed || !smsOptIn || submitting}
          className="w-full py-4 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-xl hover:from-red-500 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting…" : `Sign Up — $${price.toFixed(2)}/cleaning`}
        </button>
        <div className="text-center text-[10px] text-white/30">🔒 Payment secured by Stripe · No spam</div>
      </div>
    </div>
  );
}
