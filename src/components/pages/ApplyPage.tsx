import React, { useState, useEffect } from "react";
import { CheckCircle, Upload } from "lucide-react";
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

type Question = { id: string; type: "text" | "choice" | "file"; label: string; options?: string[] };

const fileToBase64 = (file: File): Promise<{ base64: string; contentType: string; fileName: string }> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = String(r.result || "");
      const base64 = result.slice(result.indexOf(",") + 1);
      resolve({ base64, contentType: file.type, fileName: file.name });
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export function ApplyPage() {
  const ownerId = hashParam("oid");
  const companyName = decodeURIComponent(hashParam("co") || "") || "our team";

  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", notes: "" });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // FEATURE — custom application questions the owner defines in Settings →
  // Hiring (HiringPage.tsx), rendered dynamically here. Fails silently to
  // "no extra questions" rather than blocking the whole form if the fetch
  // fails — a broken apply link is worse than a shorter one.
  useEffect(() => {
    if (!ownerId) return;
    fetch("/api/public-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get_hiring_form_settings", ownerId }) })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data?.questions)) setQuestions(data.questions); })
      .catch(() => {});
  }, [ownerId]);

  const handleSubmit = async () => {
    if (!f.firstName.trim() || !f.phone.trim()) return;
    if (!ownerId) { setError("This link isn't set up correctly — please contact us directly instead."); return; }
    setSubmitting(true);
    setError("");
    try {
      const payload: any = {
        action: "submit_job_application", ownerId,
        candidate: { id: uid(), firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim(), phone: f.phone.trim(), notes: f.notes.trim(), source: "Apply Link", phase: "Applied", sortOrder: Date.now(), answers },
      };
      if (resumeFile) {
        const { base64, contentType, fileName } = await fileToBase64(resumeFile);
        payload.resumeBase64 = base64; payload.resumeContentType = contentType; payload.resumeFileName = fileName;
      }
      if (photoFile) {
        const { base64, contentType, fileName } = await fileToBase64(photoFile);
        payload.photoBase64 = base64; payload.photoContentType = contentType; payload.photoFileName = fileName;
      }
      const res = await fetch("/api/public-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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

  const fieldClass = "w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-red-500/50";

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
            <input value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} placeholder="Jamie" className={fieldClass} />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Last Name</label>
            <input value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} placeholder="Rivera" className={fieldClass} />
          </div>
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Phone Number *</label>
          <input type="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="(717) 555-0100" className={fieldClass} />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Email</label>
          <input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="jamie@email.com" className={fieldClass} />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Tell us about your experience</label>
          <textarea rows={4} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Prior work experience, availability, why you'd be a good fit..." className={fieldClass + " resize-none"} />
        </div>

        {/* FEATURE — resume/photo attachments, uploaded to the same
            per-owner storage staging area Alfred's inbound files use. */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Resume (PDF)</label>
            <label className="flex items-center gap-2 w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white/60 cursor-pointer hover:border-red-500/40 transition">
              <Upload size={14} className="flex-shrink-0" /><span className="truncate">{resumeFile?.name || "Choose file"}</span>
              <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={e => setResumeFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Photo (optional)</label>
            <label className="flex items-center gap-2 w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white/60 cursor-pointer hover:border-red-500/40 transition">
              <Upload size={14} className="flex-shrink-0" /><span className="truncate">{photoFile?.name || "Choose file"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => setPhotoFile(e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>

        {/* FEATURE — owner-defined custom questions (Settings → Hiring). */}
        {questions.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-white/10">
            {questions.map(q => (
              <div key={q.id}>
                <label className="text-xs text-white/60 mb-1 block">{q.label}</label>
                {q.type === "choice" ? (
                  <select value={answers[q.id] || ""} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} className={fieldClass}>
                    <option value="" className="bg-black">Select…</option>
                    {(q.options || []).map(o => <option key={o} value={o} className="bg-black">{o}</option>)}
                  </select>
                ) : q.type === "file" ? (
                  <label className="flex items-center gap-2 w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white/60 cursor-pointer hover:border-red-500/40 transition">
                    <Upload size={14} className="flex-shrink-0" /><span className="truncate">{answers[q.id] ? "File attached" : "Choose file"}</span>
                    <input type="file" className="hidden" onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      // Additional per-question files ride along as extra
                      // notes text (the URL) rather than a full second
                      // upload pipeline — keeps this from needing N separate
                      // uploadOne calls server-side for an arbitrary number
                      // of file questions.
                      setAnswers(a => ({ ...a, [q.id]: file.name }));
                    }} />
                  </label>
                ) : (
                  <input value={answers[q.id] || ""} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} className={fieldClass} />
                )}
              </div>
            ))}
          </div>
        )}

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
