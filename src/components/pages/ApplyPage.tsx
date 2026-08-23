import React, { useState } from "react";
import { CheckCircle } from "lucide-react";
import { uid } from "../../lib/utils";

// Public-facing job application form — no auth required. URL:
// #/apply?oid=OWNER_ID&co=COMPANY_NAME (see HiringPage.tsx's "Apply Link").
// Routed through /api/public-data's submit_job_application action (service
// role) — same reasoning as LeadFormPage.tsx/TrashCanSignupPage.tsx: an
// anonymous applicant has no session for owner_id-scoped RLS to resolve.
function hashParam(key: string): string {
  const hash = window.location.hash;
  const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(q).get(key) || "";
}

export function ApplyPage() {
  const ownerId = hashParam("oid");
  const companyName = decodeURIComponent(hashParam("co") || "") || "our team";

  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!f.firstName.trim() || !f.phone.trim()) return;
    if (!ownerId) { setError("This link isn't set up correctly — please contact us directly instead."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/public-data", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_job_application", ownerId,
          candidate: { id: uid(), firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim(), phone: f.phone.trim(), notes: f.notes.trim(), source: "Apply Link", phase: "Applied", sortOrder: Date.now() },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) throw new Error(data?.error || `Application failed (${res.status})`);
      setSubmitted(true);
    } catch (e: any) {
      console.error("[Apply] submit failed:", e?.message);
      setError("Something went wrong submitting your application — please reach out directly instead.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle size={48} className="text-green-400 mb-3" />
        <div className="text-xl font-bold text-green-400">Application received!</div>
        <div className="text-white/60 text-sm mt-1">Thanks for applying to {companyName} — we'll be in touch soon.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-5">
        <div className="font-bold text-lg">Join {companyName}</div>
        <div className="text-red-200 text-xs mt-0.5">Tell us a bit about yourself</div>
      </div>
      <div className="p-6 max-w-lg mx-auto space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">First Name *</label>
            <input value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} placeholder="Jamie"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-red-500/50" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Last Name</label>
            <input value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} placeholder="Rivera"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-red-500/50" />
          </div>
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Phone Number *</label>
          <input type="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="(717) 555-0100"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-red-500/50" />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Email</label>
          <input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="jamie@email.com"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-red-500/50" />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Tell us about your experience</label>
          <textarea rows={4} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Prior work experience, availability, why you'd be a good fit..."
            className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:border-red-500/50" />
        </div>
        {error && <div className="text-xs text-red-400 bg-red-950/20 border border-red-700/30 rounded-xl px-3 py-2">{error}</div>}
        <button
          onClick={handleSubmit}
          disabled={!f.firstName.trim() || !f.phone.trim() || submitting}
          className="w-full py-4 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-xl hover:from-red-500 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting…" : "Submit Application →"}
        </button>
      </div>
    </div>
  );
}
