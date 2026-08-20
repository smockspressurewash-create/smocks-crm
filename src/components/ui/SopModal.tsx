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
}

export function SopModal({ open, onClose, editable = false }: { open: boolean; onClose: () => void; editable?: boolean }) {
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
        }
      })
      .catch((e: any) => console.warn("[SOP] load failed:", e?.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const active = docs.find(d => d.id === activeId);

  const save = async () => {
    if (!editing || !editing.title.trim()) return;
    const isNew = !docs.some(d => d.id === editing.id);
    const nowIso = new Date().toISOString();
    const record = { ...editing, updated_at: nowIso };
    setDocs(prev => isNew ? [record, ...prev] : prev.map(d => d.id === record.id ? record : d));
    setActiveId(record.id);
    setEditing(null);
    const res = isNew
      ? await (supabase as any).from("sop_documents").insert(record)
      : await (supabase as any).from("sop_documents").update({ title: record.title, kind: record.kind, content: record.content, file_url: record.file_url, updated_at: nowIso }).eq("id", record.id);
    if (res?.error) console.error("[SOP] save failed:", res.error.message);
  };

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
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] bg-neutral-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-red-600 to-red-800">
          <div className="font-bold text-white flex items-center gap-2"><BookOpen size={16} />SOPs & Instructions</div>
          <div className="flex items-center gap-2">
            {editable && <button onClick={() => setEditing({ id: uid(), title: "", kind: "markdown", content: "" })} className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition" title="New SOP"><Plus size={16} /></button>}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 text-white transition"><X size={16} /></button>
          </div>
        </div>

        {editing ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder={"Title (e.g. \"Post-Job Cleanup Checklist\")"}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-red-500/50" />
            <div className="flex gap-2">
              <button onClick={() => setEditing({ ...editing, kind: "markdown" })} className={"flex-1 py-2 rounded-xl border text-xs font-semibold transition " + (editing.kind === "markdown" ? "border-red-500/60 bg-red-950/30 text-red-300" : "border-white/10 bg-white/5 text-white/50")}>Text / Markdown</button>
              <button onClick={() => setEditing({ ...editing, kind: "pdf" })} className={"flex-1 py-2 rounded-xl border text-xs font-semibold transition " + (editing.kind === "pdf" ? "border-red-500/60 bg-red-950/30 text-red-300" : "border-white/10 bg-white/5 text-white/50")}>PDF</button>
            </div>
            {editing.kind === "markdown" ? (
              <textarea value={editing.content || ""} onChange={e => setEditing({ ...editing, content: e.target.value })} rows={12} placeholder="Write the instructions here — plain text or Markdown (## headers, - lists, **bold**)."
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
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white transition">Cancel</button>
              <button onClick={save} disabled={!editing.title.trim()} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-red-600 to-red-800 text-white disabled:opacity-50">Save</button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex min-h-0">
            <div className="w-40 flex-shrink-0 border-r border-white/10 overflow-y-auto">
              {loading && <div className="p-3 text-xs text-white/40">Loading…</div>}
              {!loading && docs.length === 0 && <div className="p-3 text-xs text-white/40">No SOPs yet{editable ? " — hit + to add one" : ""}.</div>}
              {docs.map(d => (
                <button key={d.id} onClick={() => setActiveId(d.id)} className={"w-full text-left px-3 py-2.5 text-xs border-b border-white/5 transition " + (activeId === d.id ? "bg-red-950/30 text-white" : "text-white/50 hover:text-white hover:bg-white/5")}>
                  {d.title}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!active ? (
                <div className="text-center text-white/30 text-sm py-12">Select a document</div>
              ) : active.kind === "pdf" && active.file_url ? (
                <iframe src={active.file_url} title={active.title} className="w-full h-full min-h-[400px] rounded-xl border border-white/10" />
              ) : (
                <div className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{active.content || "(empty)"}</div>
              )}
              {editable && active && (
                <div className="flex gap-2 justify-end pt-3 mt-3 border-t border-white/10">
                  <button onClick={() => setEditing(active)} className="px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white transition flex items-center gap-1"><Edit size={11} />Edit</button>
                  <button onClick={() => remove(active.id)} className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 transition flex items-center gap-1"><Trash2 size={11} />Delete</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
