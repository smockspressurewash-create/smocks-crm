// WorkOrderFields.tsx — the editable parts of a work order, shared by the
// "New Work Order" form (JobsPage), an existing job's detail view
// (JobDetailModal) and Settings → Work order types (SettingsModal).
//
// FEATURE (user report) — "for work orders, you need to be able to create
// line items", "work orders have default services" (e.g. a Home Depot night
// job with bird checks always brings bird pellets plus two other materials
// and has its own instructions), and "set how many photos he needs to take".
// A work order type saved in Settings holds those defaults; picking it on a
// work order fills in the lines, materials, instructions, photo counts and
// checklist in one go. Everything stays editable afterwards.
import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { fmt, uid } from "../../lib/utils";
import { GInput } from "./GInput";
import { GSel } from "./GSel";
import { GTxt } from "./GTxt";

export type JobLine = { id: string; description: string; quantity: number; unitPrice: number; notes?: string; notesInternal?: boolean; serviceId?: string };
export type PhotoReq = { id: string; label: string; kind: "photo" | "video"; minCount: number; instructions?: string };
export type WorkOrderType = {
  id: string; name: string;
  lineItems: JobLine[]; materials: string[]; instructions: string;
  photoRequirements: PhotoReq[]; checklist: string[];
  isNightJob?: boolean; requiresManagerSignoff?: boolean;
};

export const emptyWorkOrderType = (): WorkOrderType => ({ id: uid(), name: "", lineItems: [], materials: [], instructions: "", photoRequirements: [], checklist: [] });
export const jobLinesTotal = (lines: JobLine[] = []) => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
export const cleanLines = (lines: JobLine[] = []) => lines.filter(l => (l.description || "").trim());
export const cleanReqs = (reqs: PhotoReq[] = []) => reqs.filter(r => (r.label || "").trim());

// Merges a saved work order type into a work order. Fresh ids so two work
// orders made from the same type never share line/requirement ids, and
// nothing already on the work order is thrown away.
export function applyWorkOrderType(cur: { lineItems?: JobLine[]; equipment?: string[]; photoRequirements?: PhotoReq[]; checklist?: { id: string; label: string }[]; notes?: string; isNightJob?: boolean; requiresManagerSignoff?: boolean }, t: WorkOrderType) {
  const equipment = [...(cur.equipment || [])];
  (t.materials || []).forEach(m => { if (m.trim() && !equipment.includes(m.trim())) equipment.push(m.trim()); });
  const notes = (cur.notes || "").includes((t.instructions || "").trim()) ? cur.notes || "" : [cur.notes, t.instructions].map(s => (s || "").trim()).filter(Boolean).join("\n\n");
  return {
    lineItems: [...(cur.lineItems || []), ...cleanLines(t.lineItems).map(l => ({ ...l, id: uid() }))],
    equipment,
    photoRequirements: [...(cur.photoRequirements || []), ...cleanReqs(t.photoRequirements).map(r => ({ ...r, id: uid() }))],
    checklist: [...(cur.checklist || []), ...(t.checklist || []).filter(s => s.trim()).map(label => ({ id: uid(), label: label.trim() }))],
    notes,
    isNightJob: cur.isNightJob || !!t.isNightJob,
    requiresManagerSignoff: cur.requiresManagerSignoff || !!t.requiresManagerSignoff,
  };
}

export function WorkOrderTypePicker({ types = [], onPick }: { types?: WorkOrderType[]; onPick: (t: WorkOrderType) => void }) {
  if (!types.length) return <div className="text-[10px] text-white/35">Tip: save work order types (default lines, materials, photos) in Settings → Company → Work order types.</div>;
  return (
    <GSel data-wo-type value="" onChange={e => { const t = types.find(x => x.id === e.target.value); if (t) onPick(t); }} className="!text-xs">
      <option value="" className="bg-black">Add a work order type (fills in its defaults)…</option>
      {types.map(t => <option key={t.id} value={t.id} className="bg-black">{t.name || "Untitled type"}</option>)}
    </GSel>
  );
}

export function JobLinesEditor({ lines = [], onChange, services = [], showPrices = true }: { lines?: JobLine[]; onChange: (lines: JobLine[]) => void; services?: any[]; showPrices?: boolean }) {
  const set = (id: string, patch: Partial<JobLine>) => onChange(lines.map(l => l.id === id ? { ...l, ...patch } : l));
  const active = services.filter((s: any) => s.active !== false && s.name);
  const addService = (sid: string) => {
    const s = active.find((x: any) => x.id === sid);
    if (!s) return;
    onChange([...lines, { id: uid(), description: s.name, quantity: 1, unitPrice: Number(s.price ?? s.basePrice) || 0, notes: s.customerDescription || "", serviceId: s.id }]);
  };
  return (
    <div className="space-y-2" data-job-lines>
      {lines.map(l => (
        <div key={l.id} className="bg-black/30 border border-white/10 rounded-lg p-1.5 space-y-1.5" data-job-line>
          <div className="flex items-center gap-1.5">
            <GInput placeholder="Service or item" value={l.description} onChange={e => set(l.id, { description: e.target.value })} className="!text-xs flex-1 min-w-0" />
            <GInput type="number" min="0" step="any" title="Quantity" value={l.quantity} onChange={e => set(l.id, { quantity: Number(e.target.value) || 0 })} className="!text-xs !w-14" />
            {showPrices && <GInput type="number" min="0" step="any" title="Price each" placeholder="$" value={l.unitPrice || ""} onChange={e => set(l.id, { unitPrice: Number(e.target.value) || 0 })} className="!text-xs !w-20" />}
            <button type="button" title="Remove line" onClick={() => onChange(lines.filter(x => x.id !== l.id))} className="text-red-400/70 hover:text-red-300 p-1 flex-shrink-0"><X size={12} /></button>
          </div>
          <GTxt rows={1} placeholder="Description / instructions for this line (optional)" value={l.notes || ""} onChange={e => set(l.id, { notes: e.target.value })} className="!text-xs" />
        </div>
      ))}
      <div className="flex items-center gap-2 flex-wrap">
        {active.length > 0 && (
          <div className="flex-1 min-w-[180px]">
            <GSel value="" onChange={e => addService(e.target.value)} className="!text-xs">
              <option value="" className="bg-black">+ Add a saved service…</option>
              {active.map((s: any) => <option key={s.id} value={s.id} className="bg-black">{s.name}{Number(s.price ?? s.basePrice) ? ` — ${fmt(Number(s.price ?? s.basePrice))}` : ""}</option>)}
            </GSel>
          </div>
        )}
        <button type="button" data-add-line onClick={() => onChange([...lines, { id: uid(), description: "", quantity: 1, unitPrice: 0, notes: "" }])} className="text-[11px] text-purple-300 hover:text-purple-200 whitespace-nowrap">+ Custom line</button>
        {showPrices && lines.length > 0 && <span className="ml-auto text-[11px] text-white/60">Total <b className="text-white">{fmt(jobLinesTotal(lines))}</b></span>}
      </div>
    </div>
  );
}

export function PhotoReqsEditor({ reqs = [], onChange }: { reqs?: PhotoReq[]; onChange: (reqs: PhotoReq[]) => void }) {
  const set = (id: string, patch: Partial<PhotoReq>) => onChange(reqs.map(r => r.id === id ? { ...r, ...patch } : r));
  return (
    <div className="space-y-2" data-photo-reqs>
      {reqs.map(r => (
        <div key={r.id} className="bg-black/30 border border-white/10 rounded-lg p-1.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <GInput placeholder="Section (e.g. loading dock)" value={r.label} onChange={e => set(r.id, { label: e.target.value })} className="!text-xs flex-1 min-w-0" />
            <GSel value={r.kind} onChange={e => set(r.id, { kind: e.target.value as any })} className="!text-xs !w-24">
              <option value="photo" className="bg-black">Photos</option>
              <option value="video" className="bg-black">Videos</option>
            </GSel>
            <GInput type="number" min="1" title="How many" value={r.minCount} onChange={e => set(r.id, { minCount: Math.max(1, Number(e.target.value) || 1) })} className="!text-xs !w-14" />
            <button type="button" title="Remove" onClick={() => onChange(reqs.filter(x => x.id !== r.id))} className="text-red-400/70 hover:text-red-300 p-1 flex-shrink-0"><X size={12} /></button>
          </div>
          <GInput placeholder="What the photo should show (optional)" value={r.instructions || ""} onChange={e => set(r.id, { instructions: e.target.value })} className="!text-xs" />
        </div>
      ))}
      <button type="button" data-add-photo-req onClick={() => onChange([...reqs, { id: uid(), label: "", kind: "photo", minCount: 1, instructions: "" }])} className="text-[11px] text-purple-300 hover:text-purple-200">+ Add required photos/videos</button>
    </div>
  );
}

export function TextListEditor({ items = [], onChange, placeholder, addLabel }: { items?: string[]; onChange: (items: string[]) => void; placeholder: string; addLabel: string }) {
  const [draft, setDraft] = useState("");
  const add = () => { const v = draft.trim(); if (!v) return; if (!items.includes(v)) onChange([...items, v]); setDraft(""); };
  return (
    <div className="space-y-1.5">
      {items.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {items.map(m => (
            <span key={m} className="text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/80 flex items-center gap-1">
              {m}<button type="button" title="Remove" onClick={() => onChange(items.filter(x => x !== m))} className="text-white/40 hover:text-red-300"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <GInput placeholder={placeholder} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={(e: any) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} className="!text-xs flex-1" />
        <button type="button" onClick={add} title={addLabel} className="px-2.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white"><Plus size={12} /></button>
      </div>
    </div>
  );
}

// Settings → Work order types.
export function WorkOrderTypesEditor({ types = [], onChange, services = [] }: { types?: WorkOrderType[]; onChange: (types: WorkOrderType[]) => void; services?: any[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const set = (id: string, patch: Partial<WorkOrderType>) => onChange(types.map(t => t.id === id ? { ...t, ...patch } : t));
  return (
    <div className="space-y-2" data-wo-types>
      {types.map(t => {
        const open = openId === t.id;
        return (
          <div key={t.id} className="rounded-lg border border-white/10 bg-black/30">
            <div className="flex items-center gap-2 p-2">
              <button type="button" onClick={() => setOpenId(open ? null : t.id)} className="flex-1 text-left min-w-0">
                <div className="text-xs font-semibold text-white truncate">{t.name || "Untitled type"}</div>
                <div className="text-[10px] text-white/40 truncate">{[cleanLines(t.lineItems).length && `${cleanLines(t.lineItems).length} line${cleanLines(t.lineItems).length > 1 ? "s" : ""}`, t.materials.length && `${t.materials.length} material${t.materials.length > 1 ? "s" : ""}`, cleanReqs(t.photoRequirements).length && `${cleanReqs(t.photoRequirements).reduce((s, r) => s + r.minCount, 0)} required photos/videos`].filter(Boolean).join(" · ") || "Tap to set it up"}</div>
              </button>
              <button type="button" onClick={() => setOpenId(open ? null : t.id)} className="text-[11px] text-purple-300">{open ? "Done" : "Edit"}</button>
              <button type="button" title="Delete type" onClick={() => { if (window.confirm(`Delete the "${t.name || "untitled"}" work order type? Work orders already made from it keep their details.`)) onChange(types.filter(x => x.id !== t.id)); }} className="text-red-400/70 hover:text-red-300 p-1"><X size={12} /></button>
            </div>
            {open && (
              <div className="p-2 pt-0 space-y-2.5">
                <div><label className="text-[10px] text-white/50 mb-1 block">Name</label><GInput data-wo-type-name placeholder="e.g. Home Depot night wash + bird check" value={t.name} onChange={e => set(t.id, { name: e.target.value })} className="!text-xs" /></div>
                <div><label className="text-[10px] text-white/50 mb-1 block">Default line items</label><JobLinesEditor lines={t.lineItems} onChange={lineItems => set(t.id, { lineItems })} services={services} /></div>
                <div><label className="text-[10px] text-white/50 mb-1 block">Materials to bring <span className="text-white/30">(crew checks these off before starting)</span></label><TextListEditor items={t.materials} onChange={materials => set(t.id, { materials })} placeholder="e.g. Bird pellets" addLabel="Add material" /></div>
                <div><label className="text-[10px] text-white/50 mb-1 block">Instructions for the crew</label><GTxt rows={3} placeholder="e.g. Check every dock light for nests. Pellets go on the roof ledge, never near the entrance." value={t.instructions} onChange={e => set(t.id, { instructions: e.target.value })} className="!text-xs" /></div>
                <div><label className="text-[10px] text-white/50 mb-1 block">Required photos/videos</label><PhotoReqsEditor reqs={t.photoRequirements} onChange={photoRequirements => set(t.id, { photoRequirements })} /></div>
                <div><label className="text-[10px] text-white/50 mb-1 block">Checklist steps</label><TextListEditor items={t.checklist} onChange={checklist => set(t.id, { checklist })} placeholder="e.g. Photo every bird nest found" addLabel="Add step" /></div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!t.isNightJob} onChange={e => set(t.id, { isNightJob: e.target.checked })} className="accent-purple-600 w-3.5 h-3.5" /><span className="text-[11px] text-white/70">Night job</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!t.requiresManagerSignoff} onChange={e => set(t.id, { requiresManagerSignoff: e.target.checked })} className="accent-purple-600 w-3.5 h-3.5" /><span className="text-[11px] text-white/70">Needs manager sign-off</span></label>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button type="button" data-add-wo-type onClick={() => { const t = emptyWorkOrderType(); onChange([...types, t]); setOpenId(t.id); }} className="text-[11px] text-purple-300 hover:text-purple-200">+ Add a work order type</button>
    </div>
  );
}

// An existing job's line items and work order details (JobDetailModal).
// Edits stay local until "Save" so typing doesn't write to the server on
// every key press.
export function WorkOrderPanel({ job, updateJob, services = [], settings = {} as any }: { job: any; updateJob: (patch: any) => void; services?: any[]; settings?: any }) {
  const fromJob = () => ({
    isWorkOrder: !!job.isWorkOrder, workOrderNumber: job.workOrderNumber || "", workOrderClient: job.workOrderClient || "",
    requiresManagerSignoff: !!job.requiresManagerSignoff, isNightJob: !!job.isNightJob,
    lineItems: (job.lineItems || []) as JobLine[], photoRequirements: (job.photoRequirements || []) as PhotoReq[],
    extra: null as null | { equipment: string[]; checklist: { id: string; label: string }[]; notes: string },
  });
  const [d, setD] = useState(fromJob);
  const [dirty, setDirty] = useState(false);
  React.useEffect(() => { if (!dirty) setD(fromJob()); }, [job]); // eslint-disable-line react-hooks/exhaustive-deps
  const upd = (patch: any) => { setD(x => ({ ...x, ...patch })); setDirty(true); };
  const pickType = (t: WorkOrderType) => {
    const base = d.extra || { equipment: job.equipment || [], checklist: [], notes: job.notes || "" };
    const m = applyWorkOrderType({ ...base, lineItems: d.lineItems, photoRequirements: d.photoRequirements, isNightJob: d.isNightJob, requiresManagerSignoff: d.requiresManagerSignoff }, t);
    upd({ isWorkOrder: true, lineItems: m.lineItems, photoRequirements: m.photoRequirements, isNightJob: m.isNightJob, requiresManagerSignoff: m.requiresManagerSignoff, extra: { equipment: m.equipment, checklist: m.checklist, notes: m.notes } });
  };
  const save = () => {
    const lines = cleanLines(d.lineItems);
    const patch: any = {
      isWorkOrder: d.isWorkOrder, workOrderNumber: d.workOrderNumber, workOrderClient: d.workOrderClient,
      requiresManagerSignoff: d.requiresManagerSignoff, isNightJob: d.isNightJob,
      lineItems: lines, photoRequirements: cleanReqs(d.photoRequirements),
    };
    if (lines.length) patch.amount = jobLinesTotal(lines);
    if (d.extra) {
      patch.equipment = d.extra.equipment;
      patch.notes = d.extra.notes;
      if (d.extra.checklist.length) patch.preChecklist = [...(job.preChecklist || []), ...d.extra.checklist.map(c => ({ ...c, done: false }))];
    }
    updateJob(patch);
    setD(x => ({ ...x, extra: null }));
    setDirty(false);
  };
  return (
    <div className="p-3 rounded-xl border border-purple-700/30 bg-purple-950/10 space-y-2.5" data-wo-panel>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={d.isWorkOrder} onChange={e => upd({ isWorkOrder: e.target.checked })} className="accent-purple-600 w-3.5 h-3.5" />
        <span className="text-xs font-semibold text-white/80">Work order <span className="font-normal text-white/40">(commercial/night job, no customer approval needed)</span></span>
      </label>
      {d.isWorkOrder && (
        <>
          <WorkOrderTypePicker types={settings?.workOrderTypes || []} onPick={pickType} />
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-white/50 mb-1 block">Work Order #</label><GInput placeholder="WO-4521" value={d.workOrderNumber} onChange={e => upd({ workOrderNumber: e.target.value })} className="!text-xs" /></div>
            <div><label className="text-[10px] text-white/50 mb-1 block">Client</label><GInput placeholder="Home Depot #4521" value={d.workOrderClient} onChange={e => upd({ workOrderClient: e.target.value })} className="!text-xs" /></div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={d.isNightJob} onChange={e => upd({ isNightJob: e.target.checked })} className="accent-purple-600 w-3.5 h-3.5" /><span className="text-[11px] text-white/70">Night job</span></label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={d.requiresManagerSignoff} onChange={e => upd({ requiresManagerSignoff: e.target.checked })} className="accent-purple-600 w-3.5 h-3.5" /><span className="text-[11px] text-white/70">Needs manager sign-off</span></label>
          </div>
        </>
      )}
      <div>
        <label className="text-[10px] text-white/50 mb-1 block">Line items</label>
        <JobLinesEditor lines={d.lineItems} services={services} onChange={lineItems => upd({ lineItems })} />
      </div>
      {d.isWorkOrder && (
        <div>
          <label className="text-[10px] text-white/50 mb-1 block">Required photos/videos</label>
          <PhotoReqsEditor reqs={d.photoRequirements} onChange={photoRequirements => upd({ photoRequirements })} />
        </div>
      )}
      {d.extra && <div className="text-[10px] text-purple-200/80">Saving also adds the type's materials, checklist steps and instructions to this job.</div>}
      {dirty && (
        <div className="flex gap-2">
          <button type="button" data-wo-save onClick={save} className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold">Save work order</button>
          <button type="button" onClick={() => { setD(fromJob()); setDirty(false); }} className="px-3 py-2 rounded-lg bg-white/5 text-white/60 text-xs">Undo changes</button>
        </div>
      )}
    </div>
  );
}
