import React, { useState } from "react";
import { Gift, Phone, Mail, MapPin, CheckCircle } from "lucide-react";
import { uid, today } from "../../lib/utils";
import type { Customer, AppSettings } from "../../types";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";

// Public, unauthenticated route — #/referral?ref=CODE or the shorthand #/r/CODE.
// Previously an unhandled hash rendered nothing (a black screen) since no page
// in the valid-hash list matched it; this is now registered the same way the
// client portal and reset-password routes are.
export function ReferralLanding({ customers = [], setCustomers = (() => {}) as any, settings = {} as AppSettings, toast = (() => {}) as any }: { customers?: Customer[]; setCustomers?: any; settings?: AppSettings; toast?: any }) {
  const hash = window.location.hash;
  const queryPart = hash.includes("?") ? hash.split("?")[1] : "";
  const params = new URLSearchParams(queryPart);
  const pathCode = hash.match(/^#\/?r\/([^?]+)/i)?.[1];
  const refCode = (params.get("ref") || pathCode || "").trim().toUpperCase();
  const referrer = customers.find(c => (c.referralCode || "").toUpperCase() === refCode);

  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", address: "" });
  const [busy, setBusy] = useState(false);

  const companyName = settings?.companyName || "Smock's Pressure Washing";
  const refereeDiscount = Number((settings as any)?.referralSettings?.refereeDiscount) || 10;

  const submit = () => {
    if (!f.firstName.trim() || !(f.phone.trim() || f.email.trim())) { toast?.("Name and a phone or email are required", "red"); return; }
    setBusy(true);
    const id = uid();
    const referralCode = (f.firstName.slice(0, 3) || "REF").toUpperCase() + id.slice(-4).toUpperCase();
    setCustomers((prev: Customer[]) => [...prev, {
      ...f, id, tags: [], totalSpent: 0, createdAt: today(), referralCode,
      leadSource: "Referral", referredBy: referrer?.id,
      utmSource: "referral_link", utmMedium: refCode || undefined, utmCampaign: "referral",
    } as Customer]);
    setBusy(false);
    setSubmitted(true);
    toast?.("Thanks! We'll be in touch to schedule your quote.", "green");
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 text-center">
        <div className="max-w-sm space-y-4">
          <CheckCircle size={48} className="text-green-400 mx-auto" />
          <div className="text-xl font-bold text-white">You're all set!</div>
          <div className="text-sm text-white/50">{companyName} will reach out shortly to schedule your free quote.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="bg-gradient-to-br from-red-700 to-red-950 px-6 py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
          <Gift size={28} className="text-white" />
        </div>
        <div className="text-2xl font-bold">{referrer ? `${referrer.firstName} sent you to ${companyName}!` : `Welcome to ${companyName}`}</div>
        <div className="text-red-100/80 mt-2 max-w-md mx-auto text-sm">
          {referrer
            ? `As a thank-you for being referred, you'll get ${refereeDiscount}% off your first service.`
            : `Pressure washing done right — get a free, no-obligation quote.`}
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-4">
        <Glass className="p-5 space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2"><Gift size={14} className="text-red-400" />How referrals work</div>
          <ul className="text-xs text-white/60 space-y-1.5 list-disc list-inside">
            <li>Your friend gets a referral credit when you book your first service</li>
            <li>You get {refereeDiscount}% off as a new customer</li>
            <li>No catch — just our way of saying thanks for spreading the word</li>
          </ul>
        </Glass>

        {!showForm ? (
          <GBtn onClick={() => setShowForm(true)} className="w-full !py-3.5 text-base font-bold">Get a Free Quote</GBtn>
        ) : (
          <Glass className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <GInput placeholder="First name *" value={f.firstName} onChange={(e: any) => setF({ ...f, firstName: e.target.value })} className="!text-sm" />
              <GInput placeholder="Last name" value={f.lastName} onChange={(e: any) => setF({ ...f, lastName: e.target.value })} className="!text-sm" />
            </div>
            <GInput type="tel" placeholder="Phone" value={f.phone} onChange={(e: any) => setF({ ...f, phone: e.target.value })} className="!text-sm" />
            <GInput type="email" placeholder="Email" value={f.email} onChange={(e: any) => setF({ ...f, email: e.target.value })} className="!text-sm" />
            <GInput placeholder="Property address" value={f.address} onChange={(e: any) => setF({ ...f, address: e.target.value })} className="!text-sm" name="address" autoComplete="street-address" />
            <GBtn onClick={submit} disabled={busy} className="w-full !py-3">{busy ? "Submitting…" : "Request My Quote"}</GBtn>
          </Glass>
        )}

        <div className="flex items-center justify-center gap-4 text-xs text-white/30 pt-2">
          {settings?.companyPhone && <span className="flex items-center gap-1"><Phone size={11} />{settings.companyPhone}</span>}
          {settings?.companyEmail && <span className="flex items-center gap-1"><Mail size={11} />{settings.companyEmail}</span>}
        </div>
      </div>
    </div>
  );
}
