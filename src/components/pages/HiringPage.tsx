import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit, X, Phone, Mail, Copy, UserPlus, GripVertical } from "lucide-react";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GTxt } from "../ui/GTxt";
import { GSel } from "../ui/GSel";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { supabase } from "../../lib/supabase";
import { uid, withTimeout } from "../../lib/utils";
import { useIsMobile } from "../../hooks/useIsMobile";
import type { AppSettings } from "../../types";

const DEFAULT_PHASES = ["Applied", "Interview", "Offer", "Hired"];
// FEATURE — "it should have a default application you can edit." The
// public Apply form (ApplyPage.tsx) used to start completely blank until an
// owner built questions from scratch — most never would, so almost no
// applicant ever saw a custom question at all. A sensible starting set,
// editable/removable the same way any owner-added question already is (same
// settings.hiringQuestions array, same editor).
const DEFAULT_HIRING_QUESTIONS = [
  { id: "dq1", type: "text" as const, label: "Do you have reliable transportation?" },
  { id: "dq2", type: "choice" as const, label: "Do you have prior pressure-washing or field-service experience?", options: ["Yes", "No"] },
  { id: "dq3", type: "choice" as const, label: "What's your availability?", options: ["Full-time", "Part-time", "Weekends only"] },
  { id: "dq4", type: "text" as const, label: "Why do you want to work with us?" },
];

// Real Supabase-backed Kanban board for job candidates (see migration
// 0049_hiring_candidates.sql). Phases are owner-editable and stored on
// settings.hiringPhases (synced like every other setting) so renaming/
// adding/removing a phase doesn't touch the database schema at all.
export function HiringPage({ settings = {} as AppSettings, setSettings, toast, ownerId = "", onNav }: { settings?: AppSettings; setSettings?: any; toast?: any; ownerId?: string; onNav?: any }) {
  const isMobile = useIsMobile();
  const phases: string[] = (settings as any).hiringPhases?.length ? (settings as any).hiringPhases : DEFAULT_PHASES;
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; data: any }>({ open: false, data: null });
  const [phaseModalOpen, setPhaseModalOpen] = useState(false);
  const [phaseDraft, setPhaseDraft] = useState<string[]>(phases);
  const [newPhaseName, setNewPhaseName] = useState("");
  const [applyLinkOpen, setApplyLinkOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  // FEATURE — custom application questions (#38): "owners can create custom
  // forms with multiple-choice, fill-in-the-blank, file uploads." Stored on
  // settings like hiringPhases already is; ApplyPage.tsx fetches them
  // publicly via get_hiring_form_settings and renders them dynamically.
  const [questionsModalOpen, setQuestionsModalOpen] = useState(false);
  const questions: any[] = (settings as any).hiringQuestions?.length ? (settings as any).hiringQuestions : DEFAULT_HIRING_QUESTIONS;
  const [questionDraft, setQuestionDraft] = useState<any[]>(questions);
  const [candidateDetailOpen, setCandidateDetailOpen] = useState<any>(null);

  const fetchCandidates = async () => {
    try {
      // BUG FIX — "the hiring board just says 'Loading candidates' forever."
      // No timeout on this fetch meant a hung request (missing candidates
      // table, RLS misconfig, dead connection) left `loading` stuck true
      // permanently — the finally-block never ran because the await never
      // settled. withTimeout guarantees this resolves (or its catch below
      // fires) within 10s no matter what.
      const { data, error }: any = await withTimeout((supabase as any).from("candidates").select("*").order("sortOrder", { ascending: true }), 10000, "Fetch candidates");
      if (!error && Array.isArray(data)) setCandidates(data);
      else if (error) console.warn("[Hiring] fetch failed:", error.message);
    } catch (e: any) {
      console.warn("[Hiring] fetch threw:", e?.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchCandidates();
    const interval = setInterval(fetchCandidates, 5000);
    return () => clearInterval(interval);
  }, []);

  const emptyCand = () => ({ id: uid(), firstName: "", lastName: "", email: "", phone: "", phase: phases[0], notes: "", source: "Manual", sortOrder: Date.now(), owner_id: ownerId });

  const saveCandidate = async (c: any) => {
    const isNew = !candidates.some(x => x.id === c.id);
    setCandidates(prev => isNew ? [...prev, c] : prev.map(x => x.id === c.id ? c : x));
    setModal({ open: false, data: null });
    const payload = { ...c, owner_id: ownerId };
    const result = isNew
      ? await (supabase as any).from("candidates").insert(payload)
      : await (supabase as any).from("candidates").update(payload).eq("id", c.id);
    if (result?.error) {
      console.error("[Hiring] save failed:", result.error.message);
      toast?.("Saved locally, but failed to sync — " + result.error.message, "red");
    } else {
      toast?.(isNew ? "Candidate added ✓" : "Candidate updated ✓", "green");
    }
  };

  const moveCandidate = (id: string, phase: string) => {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, phase } : c));
    (supabase as any).from("candidates").update({ phase }).eq("id", id)
      .then((r: any) => { if (r?.error) toast?.("Failed to move candidate — " + r.error.message, "red"); })
      .catch((e: any) => toast?.("Failed to move candidate — " + (e?.message || "unknown error"), "red"));
  };

  const deleteCandidate = (id: string) => {
    if (!window.confirm("Delete this candidate? This can't be undone.")) return;
    setCandidates(prev => prev.filter(c => c.id !== id));
    (supabase as any).from("candidates").delete().eq("id", id)
      .then((r: any) => { if (r?.error) toast?.("Failed to delete — " + r.error.message, "red"); else toast?.("Candidate deleted", "green"); })
      .catch((e: any) => toast?.("Failed to delete — " + (e?.message || "unknown error"), "red"));
  };

  const savePhases = () => {
    const cleaned = phaseDraft.map(p => p.trim()).filter(Boolean);
    if (cleaned.length === 0) { toast?.("Keep at least one phase", "yellow"); return; }
    // Any candidate sitting on a phase that just got removed/renamed away
    // falls back to the first remaining phase rather than vanishing.
    const removed = phases.filter(p => !cleaned.includes(p));
    if (removed.length) {
      setCandidates(prev => prev.map(c => removed.includes(c.phase) ? { ...c, phase: cleaned[0] } : c));
      removed.forEach(p => {
        (supabase as any).from("candidates").update({ phase: cleaned[0] }).eq("owner_id", ownerId).eq("phase", p).catch(() => {});
      });
    }
    setSettings?.((s: any) => ({ ...s, hiringPhases: cleaned }));
    setPhaseModalOpen(false);
    toast?.("Phases updated ✓", "green");
  };

  const applyUrl = `${window.location.origin}${window.location.pathname}#/apply?oid=${encodeURIComponent(ownerId)}&co=${encodeURIComponent((settings as any).companyName || "Crew Boss")}`;

  const addQuestion = (type: "text" | "choice" | "file") => setQuestionDraft(prev => [...prev, { id: uid(), type, label: "", options: type === "choice" ? [""] : undefined }]);
  const saveQuestions = () => {
    const cleaned = questionDraft.map(q => ({ ...q, label: q.label.trim(), options: q.options?.map((o: string) => o.trim()).filter(Boolean) })).filter(q => q.label);
    setSettings?.((s: any) => ({ ...s, hiringQuestions: cleaned }));
    setQuestionsModalOpen(false);
    toast?.("Application questions saved ✓", "green");
  };

  return (
    <div className="space-y-5">
      <Glass className="p-5 !bg-gradient-to-br !from-blue-950/30 !to-black/60 !border-blue-700/30">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1"><UserPlus size={16} className="text-blue-400" /><h3 className="font-bold text-lg">Hiring</h3></div>
            <p className="text-xs text-white/60 max-w-lg">Track candidates through your hiring pipeline. Share the apply link to collect applications, or add candidates yourself.</p>
          </div>
          <div className="flex items-center gap-2">
            <GBtn variant="ghost" onClick={() => setApplyLinkOpen(true)} className="!text-xs"><Copy size={12} className="inline mr-1" />Apply Link</GBtn>
            <GBtn variant="ghost" onClick={() => { setQuestionDraft(questions); setQuestionsModalOpen(true); }} className="!text-xs"><Edit size={12} className="inline mr-1" />Application Questions</GBtn>
            <GBtn variant="ghost" onClick={() => { setPhaseDraft(phases); setPhaseModalOpen(true); }} className="!text-xs"><Edit size={12} className="inline mr-1" />Edit Phases</GBtn>
            <GBtn onClick={() => setModal({ open: true, data: emptyCand() })} className="!text-xs"><Plus size={12} className="inline mr-1" />Add Candidate</GBtn>
          </div>
        </div>
      </Glass>

      {loading ? (
        <Glass className="p-10 text-center text-sm text-white/40">Loading candidates…</Glass>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {phases.map(phase => {
            const inPhase = candidates.filter(c => c.phase === phase);
            return (
              <div key={phase}
                {...(isMobile ? {} : { onDragOver: (e: any) => e.preventDefault(), onDrop: (e: any) => { e.preventDefault(); if (dragId) moveCandidate(dragId, phase); setDragId(null); } })}
                className="w-72 flex-shrink-0 bg-black/30 border border-white/10 rounded-2xl"
              >
                <div className="p-3 border-b border-white/10 flex items-center justify-between">
                  <div className="font-semibold text-sm">{phase}</div>
                  <Badge tone="gray">{inPhase.length}</Badge>
                </div>
                <div className="p-2 space-y-2 min-h-[120px] max-h-[65vh] overflow-y-auto">
                  {inPhase.map(c => (
                    <div key={c.id}
                      {...(isMobile ? {} : { draggable: true, onDragStart: () => setDragId(c.id) })}
                      className={"p-3 bg-black/60 rounded-xl border border-white/10 select-none " + (isMobile ? "" : "cursor-grab active:cursor-grabbing")}
                    >
                      <div className="font-medium text-sm truncate">{c.firstName} {c.lastName}</div>
                      {c.source && <div className="text-[9px] text-white/30 mt-0.5">via {c.source}</div>}
                      {c.notes && <div className="text-[11px] text-white/50 mt-1 line-clamp-2">{c.notes}</div>}
                      {/* FEATURE — resume/photo attachments (#37), visible
                          right on the card instead of buried in an edit form. */}
                      {(c.resumeUrl || c.photoUrl || (c.answers && Object.keys(c.answers).length > 0)) && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {c.resumeUrl && <a href={c.resumeUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-950/40 text-blue-300 hover:bg-blue-900/50">📄 Resume</a>}
                          {c.photoUrl && <a href={c.photoUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-950/40 text-purple-300 hover:bg-purple-900/50">🖼️ Photo</a>}
                          {c.answers && Object.keys(c.answers).length > 0 && <button onClick={() => setCandidateDetailOpen(c)} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 hover:text-white/80">📝 Answers</button>}
                        </div>
                      )}
                      <div className="flex gap-1 mt-2 pt-2 border-t border-white/5">
                        {c.phone && <button onClick={() => window.location.href = "tel:" + c.phone.replace(/\D/g, "")} className="flex-1 p-1 rounded hover:bg-green-900/30 text-white/50 hover:text-green-400 flex items-center justify-center"><Phone size={10} /></button>}
                        {c.email && <button onClick={() => window.location.href = "mailto:" + c.email} className="flex-1 p-1 rounded hover:bg-purple-900/30 text-white/50 hover:text-purple-400 flex items-center justify-center"><Mail size={10} /></button>}
                        <button onClick={() => setModal({ open: true, data: c })} className="flex-1 p-1 rounded hover:bg-blue-900/30 text-white/50 hover:text-blue-400 flex items-center justify-center"><Edit size={10} /></button>
                        <button onClick={() => deleteCandidate(c.id)} className="flex-1 p-1 rounded hover:bg-red-900/30 text-white/50 hover:text-red-400 flex items-center justify-center"><Trash2 size={10} /></button>
                      </div>
                      {isMobile && (
                        <GSel value={c.phase} onChange={(e: any) => moveCandidate(c.id, e.target.value)} className="!text-[10px] !py-1 mt-1.5">
                          {phases.map(p => <option key={p} value={p} className="bg-black">{p}</option>)}
                        </GSel>
                      )}
                      {phase === phases[phases.length - 1] && (
                        <button onClick={() => { onNav?.("employees"); toast?.("Now add " + c.firstName + " as a real employee (invite from the Employees page)"); }} className="w-full mt-1.5 text-[10px] py-1 rounded-lg bg-green-900/30 border border-green-700/40 text-green-300 hover:bg-green-900/50 transition">
                          Add as Employee →
                        </button>
                      )}
                    </div>
                  ))}
                  {inPhase.length === 0 && <div className="text-center text-[11px] text-white/20 py-6">No candidates here</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Candidate add/edit modal */}
      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={candidates.some(c => c.id === modal.data?.id) ? "Edit Candidate" : "New Candidate"}>
        {modal.data && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-white/60 mb-1 block">First Name *</label><GInput value={modal.data.firstName} onChange={(e: any) => setModal(m => ({ ...m, data: { ...m.data, firstName: e.target.value } }))} /></div>
              <div><label className="text-xs text-white/60 mb-1 block">Last Name</label><GInput value={modal.data.lastName || ""} onChange={(e: any) => setModal(m => ({ ...m, data: { ...m.data, lastName: e.target.value } }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-white/60 mb-1 block">Phone</label><GInput value={modal.data.phone || ""} onChange={(e: any) => setModal(m => ({ ...m, data: { ...m.data, phone: e.target.value } }))} /></div>
              <div><label className="text-xs text-white/60 mb-1 block">Email</label><GInput value={modal.data.email || ""} onChange={(e: any) => setModal(m => ({ ...m, data: { ...m.data, email: e.target.value } }))} /></div>
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Phase</label>
              <GSel value={modal.data.phase} onChange={(e: any) => setModal(m => ({ ...m, data: { ...m.data, phase: e.target.value } }))}>
                {phases.map(p => <option key={p} value={p} className="bg-black">{p}</option>)}
              </GSel>
            </div>
            <div><label className="text-xs text-white/60 mb-1 block">Notes</label><GTxt rows={3} value={modal.data.notes || ""} onChange={(e: any) => setModal(m => ({ ...m, data: { ...m.data, notes: e.target.value } }))} placeholder="Resume highlights, interview notes, etc." /></div>
            <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
              <GBtn variant="ghost" onClick={() => setModal({ open: false, data: null })}>Cancel</GBtn>
              <GBtn onClick={() => saveCandidate(modal.data)} disabled={!modal.data.firstName?.trim()}>Save</GBtn>
            </div>
          </div>
        )}
      </Modal>

      {/* Phase editor */}
      <Modal open={phaseModalOpen} onClose={() => setPhaseModalOpen(false)} title="Edit Hiring Phases">
        <div className="space-y-3">
          <div className="space-y-2">
            {phaseDraft.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <GripVertical size={14} className="text-white/20 flex-shrink-0" />
                <GInput value={p} onChange={(e: any) => setPhaseDraft(prev => prev.map((x, idx) => idx === i ? e.target.value : x))} className="!text-sm flex-1" />
                <button onClick={() => setPhaseDraft(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 text-red-400/60 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <GInput value={newPhaseName} onChange={(e: any) => setNewPhaseName(e.target.value)} placeholder="New phase name" className="!text-sm flex-1" onKeyDown={(e: any) => { if (e.key === "Enter" && newPhaseName.trim()) { setPhaseDraft(prev => [...prev, newPhaseName.trim()]); setNewPhaseName(""); } }} />
            <GBtn variant="ghost" onClick={() => { if (newPhaseName.trim()) { setPhaseDraft(prev => [...prev, newPhaseName.trim()]); setNewPhaseName(""); } }}><Plus size={14} /></GBtn>
          </div>
          <div className="text-[10px] text-white/30">Candidates on a removed phase move to the first remaining phase automatically.</div>
          <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
            <GBtn variant="ghost" onClick={() => setPhaseModalOpen(false)}>Cancel</GBtn>
            <GBtn onClick={savePhases}>Save Phases</GBtn>
          </div>
        </div>
      </Modal>

      {/* Application questions editor (#38) */}
      <Modal open={questionsModalOpen} onClose={() => setQuestionsModalOpen(false)} title="Application Questions">
        <div className="space-y-3">
          <div className="text-[11px] text-white/40">Shown on your Apply link below the standard fields. Applicants answer these when they apply.</div>
          <div className="space-y-3">
            {questionDraft.map((q, i) => (
              <div key={q.id} className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <GInput value={q.label} onChange={(e: any) => setQuestionDraft(prev => prev.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} placeholder="Question text" className="!text-sm flex-1" />
                  <Badge tone="gray">{q.type === "choice" ? "Multiple choice" : q.type === "file" ? "File upload" : "Text"}</Badge>
                  <button onClick={() => setQuestionDraft(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 text-red-400/60 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
                {q.type === "choice" && (
                  <div className="space-y-1.5 pl-2">
                    {(q.options || []).map((opt: string, oi: number) => (
                      <div key={oi} className="flex items-center gap-2">
                        <GInput value={opt} onChange={(e: any) => setQuestionDraft(prev => prev.map((x, idx) => idx === i ? { ...x, options: x.options.map((o: string, oidx: number) => oidx === oi ? e.target.value : o) } : x))} placeholder={`Option ${oi + 1}`} className="!text-xs flex-1" />
                        <button onClick={() => setQuestionDraft(prev => prev.map((x, idx) => idx === i ? { ...x, options: x.options.filter((_: any, oidx: number) => oidx !== oi) } : x))} className="p-1 text-white/30 hover:text-red-400"><X size={12} /></button>
                      </div>
                    ))}
                    <button onClick={() => setQuestionDraft(prev => prev.map((x, idx) => idx === i ? { ...x, options: [...(x.options || []), ""] } : x))} className="text-[10px] text-blue-400 hover:text-blue-300">+ Add option</button>
                  </div>
                )}
              </div>
            ))}
            {questionDraft.length === 0 && <div className="text-center text-[11px] text-white/30 py-4">No custom questions yet</div>}
          </div>
          <div className="flex gap-2">
            <GBtn variant="ghost" onClick={() => addQuestion("text")} className="!text-xs flex-1">+ Fill-in-the-blank</GBtn>
            <GBtn variant="ghost" onClick={() => addQuestion("choice")} className="!text-xs flex-1">+ Multiple choice</GBtn>
            <GBtn variant="ghost" onClick={() => addQuestion("file")} className="!text-xs flex-1">+ File upload</GBtn>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
            <GBtn variant="ghost" onClick={() => setQuestionsModalOpen(false)}>Cancel</GBtn>
            <GBtn onClick={saveQuestions}>Save Questions</GBtn>
          </div>
        </div>
      </Modal>

      {/* Candidate answers detail */}
      <Modal open={!!candidateDetailOpen} onClose={() => setCandidateDetailOpen(null)} title={candidateDetailOpen ? `${candidateDetailOpen.firstName} ${candidateDetailOpen.lastName || ""} — Answers` : "Answers"}>
        {candidateDetailOpen && (
          <div className="space-y-3">
            {Object.entries(candidateDetailOpen.answers || {}).map(([qid, val]: [string, any]) => {
              const q = questions.find(x => x.id === qid);
              return <div key={qid}><div className="text-xs text-white/40 mb-0.5">{q?.label || qid}</div><div className="text-sm">{String(val) || "—"}</div></div>;
            })}
            {Object.keys(candidateDetailOpen.answers || {}).length === 0 && <div className="text-center text-white/30 text-sm py-4">No answers recorded</div>}
          </div>
        )}
      </Modal>

      {/* Apply link */}
      <Modal open={applyLinkOpen} onClose={() => setApplyLinkOpen(false)} title="Apply Link">
        <div className="space-y-3">
          <div className="text-xs text-white/60 leading-relaxed">Share this link (post it on job boards, your website, social media) — anyone who fills it out lands directly in your "{phases[0]}" column.</div>
          <pre className="text-[11px] bg-black/60 border border-white/10 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all text-white/80">{applyUrl}</pre>
          <div className="flex gap-2">
            <GBtn onClick={() => { navigator.clipboard?.writeText(applyUrl).catch(() => {}); toast?.("Link copied ✓"); }} className="!text-xs"><Copy size={12} className="inline mr-1" />Copy Link</GBtn>
            <GBtn variant="ghost" onClick={() => window.open(applyUrl, "_blank", "noopener,noreferrer")} className="!text-xs">Open in New Tab</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
