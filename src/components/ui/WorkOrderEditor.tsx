// WorkOrderEditor.tsx — make or change a work order without leaving the Work
// Orders page.
//
// FEATURE (owner request, second time) — "a work order is an estimate that
// doesn't need approval... you need to be able to create line items." The
// line items used to live only on the Jobs page's long "Schedule Job" form
// and deep inside the job's detail screen, so from Work Orders it looked
// like they didn't exist. This screen puts them first: customer, line items
// (saved services or typed on the spot, each with a description), then
// date, crew, materials, required photos and notes. A work order is still an
// ordinary jobs row (isWorkOrder), so the field portal, calendar and
// invoicing all keep working.
import React, { useState } from "react";
import { ExternalLink } from "lucide-react";
import { fmt, uid, today } from "../../lib/utils";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";
import { GInput } from "./GInput";
import { GDate } from "./GDate";
import { GTxt } from "./GTxt";
import { CustomerPicker } from "./CustomerPicker";
import { JobLinesEditor, PhotoReqsEditor, TextListEditor, WorkOrderTypePicker, applyWorkOrderType, jobLinesTotal, cleanLines, cleanReqs, type JobLine, type PhotoReq } from "./WorkOrderFields";

type Draft = {
  customerId: string; address: string; scheduledDate: string; scheduledTime: string; crew: string[];
  workOrderNumber: string; workOrderClient: string; lineItems: JobLine[]; equipment: string[];
  photoRequirements: PhotoReq[]; checklist: { id: string; label: string }[]; notes: string;
  requiresManagerSignoff: boolean; isNightJob: boolean; amount: string;
};

const fromJob = (j: any): Draft => ({
  customerId: j?.customerId || "", address: j?.address || "", scheduledDate: j ? (j.scheduledDate || "") : today(), scheduledTime: j?.scheduledTime || "",
  crew: Array.isArray(j?.crew) ? j.crew : [], workOrderNumber: j?.workOrderNumber || "", workOrderClient: j?.workOrderClient || "",
  lineItems: j?.lineItems || [], equipment: j?.equipment || [], photoRequirements: j?.photoRequirements || [], checklist: [],
  notes: j?.notes || "", requiresManagerSignoff: !!j?.requiresManagerSignoff, isNightJob: !!j?.isNightJob,
  amount: j?.amount ? String(j.amount) : "",
});

export function WorkOrderEditor({
  job = null, open, onClose, onSave, onOpenJob, customers = [], employees = [], services = [], setServices = null, settings = {} as any,
}: {
  job?: any; open: boolean; onClose: () => void; onSave: (job: any, isNew: boolean) => Promise<boolean> | boolean;
  onOpenJob?: (id: string) => void; customers?: any[]; employees?: any[]; services?: any[]; setServices?: any; settings?: any;
}) {
  const [d, setD] = useState<Draft>(() => fromJob(job));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  React.useEffect(() => { if (open) { setD(fromJob(job)); setErr(""); } }, [open, job?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const upd = (patch: Partial<Draft>) => setD(x => ({ ...x, ...patch }));
  const linesTotal = jobLinesTotal(cleanLines(d.lineItems));
  const isNew = !job;

  const save = async () => {
    if (!d.customerId) { setErr("Pick a customer first."); return; }
    setErr(""); setSaving(true);
    const lines = cleanLines(d.lineItems);
    const cust = customers.find((c: any) => c.id === d.customerId);
    const assignedAt = Object.fromEntries(d.crew.filter(id => !(job?.crew || []).includes(id)).map(id => [id, Date.now()]));
    const patch: any = {
      customerId: d.customerId, address: d.address || cust?.address || "",
      scheduledDate: d.scheduledDate, scheduledTime: d.scheduledTime,
      crew: d.crew, ...(Object.keys(assignedAt).length ? { crewAssignedAt: { ...(job?.crewAssignedAt || {}), ...assignedAt } } : {}),
      // A job from an accepted quote stays what it was (residential pay
      // rates, calendar view); only new work orders are marked commercial.
      ...(isNew || job?.isWorkOrder ? { isWorkOrder: true, jobType: job?.jobType || "commercial" } : {}),
      workOrderNumber: d.workOrderNumber, workOrderClient: d.workOrderClient,
      lineItems: lines, equipment: d.equipment, photoRequirements: cleanReqs(d.photoRequirements),
      notes: d.notes, requiresManagerSignoff: d.requiresManagerSignoff, isNightJob: d.isNightJob,
      amount: lines.length ? linesTotal : (parseFloat(d.amount) || 0),
    };
    const steps = d.checklist.filter(c => c.label.trim()).map(c => ({ id: c.id, label: c.label.trim(), done: false }));
    if (steps.length) patch.preChecklist = [...(job?.preChecklist || []), ...steps];
    if (!d.scheduledDate) patch.tags = Array.from(new Set([...(job?.tags || []), "Needs Scheduling"]));
    else if (job?.tags?.includes("Needs Scheduling")) patch.tags = job.tags.filter((t: string) => t !== "Needs Scheduling");
    const full = isNew
      ? { id: uid(), status: "scheduled", priority: "normal", checklist: [], photos: [], commLog: [], chemicalsUsed: [], tags: patch.tags || [], loggedHours: 0, createdAt: today(), ...patch }
      : patch;
    const ok = await onSave(full, isNew);
    setSaving(false);
    if (ok) onClose();
  };

  const activeEmps = employees.filter((e: any) => e.status !== "inactive");
  return (
    <Modal open={open} onClose={onClose} title={isNew ? "New Work Order" : `Work Order${job?.workOrderNumber ? " #" + job.workOrderNumber : ""}`} maxW="max-w-2xl">
      <div className="space-y-4" data-wo-editor>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Customer</label>
          <CustomerPicker customers={customers} value={d.customerId} onChange={id => { const c = customers.find((x: any) => x.id === id); upd({ customerId: id, address: d.address || c?.address || "" }); }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-white/50 mb-1 block">Work Order #</label><GInput placeholder="WO-4521" value={d.workOrderNumber} onChange={e => upd({ workOrderNumber: e.target.value })} /></div>
          <div><label className="text-[11px] text-white/50 mb-1 block">Client / store</label><GInput placeholder="Home Depot #4521" value={d.workOrderClient} onChange={e => upd({ workOrderClient: e.target.value })} /></div>
        </div>

        <div className="p-3 rounded-xl border border-purple-700/30 bg-purple-950/10 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-white">Line items</div>
            {cleanLines(d.lineItems).length > 0 && <div className="text-sm text-white/80" data-wo-total>Total <b>{fmt(linesTotal)}</b></div>}
          </div>
          <WorkOrderTypePicker types={settings?.workOrderTypes || []} onPick={t => setD(x => ({ ...x, ...applyWorkOrderType(x, t) }))} />
          <JobLinesEditor lines={d.lineItems} services={services} setServices={setServices} onChange={lineItems => upd({ lineItems })} />
          {cleanLines(d.lineItems).length === 0 && (
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Or just a total ($)</label>
              <GInput type="number" min="0" placeholder="0" value={d.amount} onChange={e => upd({ amount: e.target.value })} className="!w-40" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[11px] text-white/50 mb-1 block">Date <span className="text-white/30">(blank = needs a date)</span></label><GDate value={d.scheduledDate} onChange={e => upd({ scheduledDate: e.target.value })} /></div>
          <div><label className="text-[11px] text-white/50 mb-1 block">Time</label><GInput type="time" value={d.scheduledTime} onChange={e => upd({ scheduledTime: e.target.value })} /></div>
        </div>
        <div><label className="text-[11px] text-white/50 mb-1 block">Address</label><GInput value={d.address} onChange={e => upd({ address: e.target.value })} placeholder="Job address" /></div>

        <div>
          <label className="text-[11px] text-white/50 mb-1 block">Crew</label>
          <div className="flex gap-1.5 flex-wrap">
            {activeEmps.map((e: any) => {
              const sel = d.crew.includes(e.id);
              return <button key={e.id} type="button" data-wo-crew onClick={() => upd({ crew: sel ? d.crew.filter(x => x !== e.id) : [...d.crew, e.id] })}
                className={"text-xs px-3 py-1.5 rounded-lg border transition " + (sel ? "bg-purple-900/40 border-purple-500/50 text-purple-200" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>{e.firstName} {(e.lastName || "")[0] || ""}{e.lastName ? "." : ""}</button>;
            })}
            {activeEmps.length === 0 && <div className="text-[11px] text-white/30">No active employees yet</div>}
          </div>
        </div>

        <div>
          <label className="text-[11px] text-white/50 mb-1 block">Materials to bring <span className="text-white/30">(crew checks these off before starting)</span></label>
          <TextListEditor items={d.equipment} onChange={equipment => upd({ equipment })} placeholder="e.g. Bird pellets" addLabel="Add material" />
        </div>
        <div>
          <label className="text-[11px] text-white/50 mb-1 block">Required photos/videos <span className="text-white/30">(how many the crew must take)</span></label>
          <PhotoReqsEditor reqs={d.photoRequirements} onChange={photoRequirements => upd({ photoRequirements })} />
        </div>
        {d.checklist.length > 0 && (
          <div>
            <label className="text-[11px] text-white/50 mb-1 block">Checklist steps to add</label>
            <TextListEditor items={d.checklist.map(c => c.label)} onChange={labels => upd({ checklist: labels.map(label => d.checklist.find(c => c.label === label) || { id: uid(), label }) })} placeholder="Add a step" addLabel="Add step" />
          </div>
        )}
        <div><label className="text-[11px] text-white/50 mb-1 block">Notes / instructions for the crew</label><GTxt rows={3} value={d.notes} onChange={e => upd({ notes: e.target.value })} /></div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={d.isNightJob} onChange={e => upd({ isNightJob: e.target.checked })} className="accent-purple-600 w-3.5 h-3.5" /><span className="text-xs text-white/70">Night job</span></label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={d.requiresManagerSignoff} onChange={e => upd({ requiresManagerSignoff: e.target.checked })} className="accent-purple-600 w-3.5 h-3.5" /><span className="text-xs text-white/70">Needs manager sign-off</span></label>
        </div>

        {err && <div className="text-xs text-red-300">{err}</div>}
        <div className="flex gap-2 pt-1 flex-wrap">
          <GBtn onClick={save} disabled={saving} className="flex-1 !justify-center" data-wo-save-editor>{saving ? "Saving…" : isNew ? "Create Work Order" : "Save Work Order"}</GBtn>
          {!isNew && onOpenJob && <GBtn variant="ghost" onClick={() => { onClose(); onOpenJob(job.id); }}><ExternalLink size={13} className="inline mr-1.5" />Photos, checklist & payment</GBtn>}
          <GBtn variant="ghost" onClick={onClose} disabled={saving}>Cancel</GBtn>
        </div>
      </div>
    </Modal>
  );
}
