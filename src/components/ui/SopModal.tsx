// SopModal.tsx — item 2: SOPs / instructions the owner uploads (Markdown
// text, or a PDF via a data: URL — no separate storage bucket needed, small
// enough documents for this to be fine), stored in the sop_documents table
// (migration 0032). One component, used two ways: owner side (editable=true,
// EmployeeSopPage.tsx) gets full CRUD; employee portal (editable=false) gets
// a read-only list — same data, same RLS-permissive table (single-owner app,
// see CLAUDE.md), so employees always see whatever the owner last saved with
// no separate sync path to keep correct.
import React, { useState, useEffect } from "react";
import { X, BookOpen, Plus, Trash2, Edit, FileText, Upload } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { uid } from "../../lib/utils";

interface SopDoc {
  id: string;
  title: string;
  kind: "markdown" | "pdf";
  content?: string;
  file_url?: string;
  updated_at?: string;
  frequency?: "daily" | "monthly" | "general";
  assignedEmployeeIds?: string[];
  checklist?: { id: string; text: string; done?: boolean }[];
}

export function SopModal({ open, onClose, editable = false, ownerId = "", employees = [], currentEmployeeId = "" }: { open: boolean; onClose: () => void; editable?: boolean; ownerId?: string; employees?: { id: string; firstName?: string; lastName?: string }[]; currentEmployeeId?: string }) {
  const [docs, setDocs] = useState<SopDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SopDoc | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (supabase as any).from("sop_documents").select("*").order("updated_at", { ascending: false })
      .then((r: any) => {
        if (!r?.error && Array.isArray(r.data)) {
          setDocs(r.data);
          if (r.data.length > 0 && !activeId) setActiveId(r.data[0].id);
        } else if (r?.error) {
          console.warn("[SOP] load failed:", r.error.message);
        }
      })
      .catch((e: any) => console.warn("[SOP] load failed:", e?.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const active = docs.find(d => d.id === activeId);
  // Employees only see SOPs assigned to them specifically, or ones with no
  // assignment at all (empty assignedEmployeeIds = visible to everyone) —
  // the owner side (editable) always sees every SOP so nothing gets "lost".
  const visibleDocs = (!editable && currentEmployeeId)
    ? docs.filter(d => !d.assignedEmployeeIds?.length || d.assignedEmployeeIds.includes(currentEmployeeId))
    : docs;

  const toggleActiveChecklistItem = async (itemId: string) => {
    if (!active) return;
    const updated = (active.checklist || []).map(c => c.id === itemId ? { ...c, done: !c.done } : c);
    setDocs(prev => prev.map(d => d.id === active.id ? { ...d, checklist: updated } : d));
    const res = await (supabase as any).from("sop_documents").update({ checklist: updated }).eq("id", active.id);
    if (res?.error) console.error("[SOP] checklist update failed:", res.error.message);
  };

  const save = async () => {
    if (!editing || !editing.title.trim()) return;
    const isNew = !docs.some(d => d.id === editing.id);
    const nowIso = new Date().toISOString();
    const record = { ...editing, updated_at: nowIso };
    setDocs(prev => isNew ? [record, ...prev] : prev.map(d => d.id === record.id ? record : d));
    setActiveId(record.id);
    setEditing(null);
    const res = isNew
      ? await (supabase as any).from("sop_documents").insert({ ...record, owner_id: ownerId })
      : await (supabase as any).from("sop_documents").update({ title: record.title, kind: record.kind, content: record.content, file_url: record.file_url, frequency: record.frequency, assignedEmployeeIds: record.assignedEmployeeIds, checklist: record.checklist, updated_at: nowIso }).eq("id", record.id);
    if (res?.error) console.error("[SOP] save failed:", res.error.message);
  };

  const addChecklistItem = () => setEditing(prev => prev ? { ...prev, checklist: [...(prev.checklist || []), { id: uid(), text: "", done: false }] } : prev);
  const updateChecklistItem = (id: string, text: string) => setEditing(prev => prev ? { ...prev, checklist: (prev.checklist || []).map(c => c.id === id ? { ...c, text } : c) } : prev);
  const removeChecklistItem = (id: string) => setEditing(prev => prev ? { ...prev, checklist: (prev.checklist || []).filter(c => c.id !== id) } : prev);
  const toggleAssignedEmployee = (empId: string) => setEditing(prev => {
    if (!prev) return prev;
    const cur = prev.assignedEmployeeIds || [];
    return { ...prev, assignedEmployeeIds: cur.includes(empId) ? cur.filter(id => id !== empId) : [...cur, empId] };
  });

  const remove = async (id: string) => {
    if (!window.confirm("Delete this SOP document?")) return;
    setDocs(prev => prev.filter(d => d.id !== id));
    if (activeId === id) setActiveId(null);
    const res = await (supabase as any).from("sop_documents").delete().eq("id", id);
    if (res?.error) console.error("[SOP] delete failed:", res.error.message);
  };

  const handlePdfUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setEditing(prev => prev ? { ...prev, kind: "pdf", file_url: String(reader.result) } : prev);
    };
    reader.readAsDataURL(file);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur flex items-center justify-center sm:p-4" onClick={onClose}>
      <div className="w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[85vh] bg-neutral-950 border border-white/10 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-red-600 to-red-800 flex-shrink-0">
          <div className="font-bold text-white flex items-center gap-2"><BookOpen size={16} />SOPs & Instructions</div>
          <div className="flex items-center gap-2">
            {editable && <button onClick={() => setEditing({ id: uid(), title: "", kind: "markdown", content: "" })} className="p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white transition" title="New SOP"><Plus size={18} /></button>}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/15 text-white transition"><X size={18} /></button>
          </div>
        </div>

        {editing ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder={"Title (e.g. \"Post-Job Cleanup Checklist\")"}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-red-500/50" />
            <div className="flex gap-2">
              <button onClick={() => setEditing({ ...editing, kind: "markdown" })} className={"flex-1 py-2.5 rounded-xl border text-xs font-semibold transition " + (editing.kind === "markdown" ? "border-red-500/60 bg-red-950/30 text-red-300" : "border-white/10 bg-white/5 text-white/50")}>Text / Markdown</button>
              <button onClick={() => setEditing({ ...editing, kind: "pdf" })} className={"flex-1 py-2.5 rounded-xl border text-xs font-semibold transition " + (editing.kind === "pdf" ? "border-red-500/60 bg-red-950/30 text-red-300" : "border-white/10 bg-white/5 text-white/50")}>PDF</button>
            </div>
            {editing.kind === "markdown" ? (
              <textarea value={editing.content || ""} onChange={e => setEditing({ ...editing, content: e.target.value })} rows={10} placeholder="Write the instructions here — plain text or Markdown (## headers, - lists, **bold**)."
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:border-red-500/50 font-mono" />
            ) : (
              <div className="space-y-2">
                <label className="flex items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-white/15 cursor-pointer hover:border-white/30 transition text-white/50 text-sm">
                  <Upload size={16} />{editing.file_url ? "Replace PDF" : "Choose PDF file"}
                  <input type="file" accept="application/pdf" className="hidden" onChange={e => e.target.files?.[0] && handlePdfUpload(e.target.files[0])} />
                </label>
                {editing.file_url && <div className="text-xs text-green-400 flex items-center gap-1.5"><FileText size={12} />PDF attached ✓</div>}
              </div>
            )}

            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Frequency</label>
              <div className="flex gap-2">
                {(["daily", "monthly", "general"] as const).map(f => (
                  <button key={f} onClick={() => setEditing({ ...editing, frequency: f })} className={"flex-1 py-2 rounded-xl border text-xs font-semibold capitalize transition " + (((editing.frequency || "general") === f) ? "border-red-500/60 bg-red-950/30 text-red-300" : "border-white/10 bg-white/5 text-white/50")}>{f}</button>
                ))}
              </div>
            </div>

            {employees.length > 0 && (
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Assign to <span className="normal-case text-white/30">(none selected = everyone)</span></label>
                <div className="flex flex-wrap gap-1.5">
                  {employees.map(emp => {
                    const on = (editing.assignedEmployeeIds || []).includes(emp.id);
                    return (
                      <button key={emp.id} onClick={() => toggleAssignedEmployee(emp.id)} className={"px-2.5 py-1.5 rounded-lg text-xs transition " + (on ? "bg-red-700/40 text-white border border-red-700/50" : "bg-white/5 text-white/50 border border-white/10")}>
                        {emp.firstName} {emp.lastName?.[0] || ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wider">Checklist</label>
                <button onClick={addChecklistItem} className="text-[10px] text-red-400 hover:text-red-300">+ Add item</button>
              </div>
              <div className="space-y-1.5">
                {(editing.checklist || []).map(item => (
                  <div key={item.id} className="flex items-center gap-1.5">
                    <input value={item.text} onChange={e => updateChecklistItem(item.id, e.target.value)} placeholder="Checklist item…" className="flex-1 bg-white/5 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-red-500/50" />
                    <button onClick={() => removeChecklistItem(item.id)} className="p-1.5 text-white/30 hover:text-red-400 transition"><Trash2 size={12} /></button>
                  </div>
                ))}
                {(editing.checklist || []).length === 0 && <div className="text-[10px] text-white/30">No checklist items.</div>}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 pb-1">
              <button onClick={() => setEditing(null)} className="px-4 py-2.5 rounded-xl text-sm text-white/60 hover:text-white transition">Cancel</button>
              <button onClick={save} disabled={!editing.title.trim()} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-red-600 to-red-800 text-white disabled:opacity-50">Save</button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
            <div className="w-full sm:w-40 flex-shrink-0 max-h-40 sm:max-h-none border-b sm:border-b-0 sm:border-r border-white/10 overflow-y-auto overflow-x-hidden">
              {loading && <div className="p-3 text-xs text-white/40">Loading…</div>}
              {!loading && visibleDocs.length === 0 && <div className="p-3 text-xs text-white/40">No SOPs yet{editable ? " — hit + to add one" : ""}.</div>}
              {visibleDocs.map(d => (
                <button key={d.id} onClick={() => setActiveId(d.id)} className={"w-full text-left px-3 py-3 sm:py-2.5 text-xs border-b border-white/5 transition " + (activeId === d.id ? "bg-red-950/30 text-white" : "text-white/50 hover:text-white hover:bg-white/5")}>
                  {d.title}
                  {d.frequency && d.frequency !== "general" && <span className="ml-1.5 text-[9px] uppercase text-white/30">· {d.frequency}</span>}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {!active ? (
                <div className="text-center text-white/30 text-sm py-12">Select a document</div>
              ) : active.kind === "pdf" && active.file_url ? (
                <iframe src={active.file_url} title={active.title} className="w-full h-full min-h-[400px] rounded-xl border border-white/10" />
              ) : (
                <div className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed break-words">{active.content || "(empty)"}</div>
              )}
              {active && (active.checklist || []).length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Checklist</div>
                  {(active.checklist || []).map(item => (
                    <label key={item.id} className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                      <input type="checkbox" checked={!!item.done} onChange={() => toggleActiveChecklistItem(item.id)} className="accent-red-600" />
                      <span className={item.done ? "line-through text-white/40" : ""}>{item.text}</span>
                    </label>
                  ))}
                </div>
              )}
              {editable && active && (
                <div className="flex gap-2 justify-end pt-3 mt-3 border-t border-white/10">
                  <button onClick={() => setEditing(active)} className="px-3 py-2 rounded-lg text-xs text-white/60 hover:text-white transition flex items-center gap-1"><Edit size={11} />Edit</button>
                  <button onClick={() => remove(active.id)} className="px-3 py-2 rounded-lg text-xs text-red-400 hover:text-red-300 transition flex items-center gap-1"><Trash2 size={11} />Delete</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
