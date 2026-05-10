import React, { useState, useEffect } from 'react';
import { Plus, Clock, Play, Tag, X, Users, Clipboard, Eye, FileText, Download, FlaskConical, DollarSign, MessageSquare, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { GSel } from './GSel';
import { GInput } from './GInput';
import { GBtn } from './GBtn';
import { GTxt } from './GTxt';
import { Glass } from './Glass';
import { Badge } from './Badge';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { fmt, uid, today, recurringFreqs, priorityLevels, jobTagOptions, equipmentList } from '../../lib/utils';

export function JobDetailModal({ jobId, job, onClose, customers = [], employees = [], updateJob, toast }: any) {
  const [commNote, setCommNote] = useState("");
  const [commType, setCommType] = useState("note");
  const [chemName, setChemName] = useState("");
  const [chemGal, setChemGal] = useState<any>(0);
  const [chemCost, setChemCost] = useState<any>(0);
  const [tagInput, setTagInput] = useState("");
  const [attName, setAttName] = useState("");
  const [attType, setAttType] = useState("pdf");
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!job?.clockInAt) return;
    const h = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(h);
  }, [job?.clockInAt]);

  if (!job) return null;
  const c = customers.find((x: any) => x.id === job.customerId);

  const toggleCrew = (eid: string) => {
    const crew = job.crew || [];
    updateJob(jobId, { crew: crew.includes(eid) ? crew.filter((x: any) => x !== eid) : [...crew, eid] });
  };
  const toggleEquip = (eq: string) => {
    const list = job.equipment || [];
    updateJob(jobId, { equipment: list.includes(eq) ? list.filter((x: any) => x !== eq) : [...list, eq] });
  };
  const toggleTag = (t: string) => {
    const tags = job.tags || [];
    updateJob(jobId, { tags: tags.includes(t) ? tags.filter((x: any) => x !== t) : [...tags, t] });
  };
  const addTag = () => {
    if (!tagInput.trim()) return;
    const tags = job.tags || [];
    if (tags.includes(tagInput.trim())) { setTagInput(""); return; }
    updateJob(jobId, { tags: [...tags, tagInput.trim()] });
    setTagInput("");
  };
  const removeTag = (t: string) => updateJob(jobId, { tags: (job.tags || []).filter((x: any) => x !== t) });
  const addAtt = () => {
    if (!attName.trim()) return;
    const entry = { id: uid(), name: attName.trim(), type: attType };
    updateJob(jobId, { attachments: [...(job.attachments || []), entry] });
    setAttName("");
  };
  const removeAtt = (id: string) => updateJob(jobId, { attachments: (job.attachments || []).filter((a: any) => a.id !== id) });
  const clockIn = () => { updateJob(jobId, { clockInAt: Date.now() }); if (toast) toast("Clocked in"); };
  const clockOut = () => {
    const started = job.clockInAt;
    if (!started) return;
    const hrs = (Date.now() - started) / 3600000;
    const rounded = Math.round(hrs * 100) / 100;
    updateJob(jobId, { clockInAt: null, loggedHours: Math.round(((Number(job.loggedHours) || 0) + rounded) * 100) / 100 });
    if (toast) toast("+" + rounded + "h logged");
  };
  const addComm = () => {
    if (!commNote.trim()) return;
    const entry = { id: uid(), type: commType, date: today(), note: commNote.trim() };
    updateJob(jobId, { commLog: [...(job.commLog || []), entry] });
    setCommNote("");
  };
  const addChem = () => {
    if (!chemName.trim()) return;
    const entry = { name: chemName, gallons: Number(chemGal), cost: Number(chemCost) };
    updateJob(jobId, { chemicalsUsed: [...(job.chemicalsUsed || []), entry] });
    setChemName(""); setChemGal(0); setChemCost(0);
  };
  const removeChem = (idx: number) => updateJob(jobId, { chemicalsUsed: (job.chemicalsUsed || []).filter((_: any, i: number) => i !== idx) });

  const totalChemCost = (job.chemicalsUsed || []).reduce((s: number, c: any) => s + Number(c.cost), 0);
  const totalGallons = (job.chemicalsUsed || []).reduce((s: number, c: any) => s + Number(c.gallons), 0);

  const liveHrs = job.clockInAt ? (Date.now() - job.clockInAt) / 3600000 : 0;
  const liveDisplay = (() => {
    const total = Math.floor(liveHrs * 3600);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
  })();

  const attIcon = (t: string) => t === "image" ? "🖼️" : t === "pdf" ? "📄" : "📎";

  return (
    <Modal open={!!jobId} onClose={onClose} title={"Job · " + (c?.firstName + " " + c?.lastName)} maxW="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><AlertCircle size={10} />Priority</label>
            <GSel value={job.priority || "normal"} onChange={(e: any) => updateJob(jobId, { priority: e.target.value })}>
              {priorityLevels.map((p: any) => <option key={p.key} value={p.key} className="bg-black">{p.label}</option>)}
            </GSel>
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Est. Duration (hrs)</label><GInput type="number" step="0.25" value={job.duration || ""} onChange={(e: any) => updateJob(jobId, { duration: e.target.value })} placeholder="e.g. 3.5" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Recurring</label><GSel value={job.recurringFreq || "monthly"} onChange={(e: any) => updateJob(jobId, { recurringFreq: e.target.value, isRecurring: true })}>{recurringFreqs.map(f => <option key={f} value={f} className="bg-black">{f}</option>)}</GSel></div>
        </div>

        <Glass className={"p-3 " + (job.clockInAt ? "!bg-green-950/20 !border-green-600/40" : "!bg-black/40")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={"p-2 rounded-lg " + (job.clockInAt ? "bg-green-900/40 animate-pulse" : "bg-white/5")}><Clock size={14} className={job.clockInAt ? "text-green-400" : "text-white/60"} /></div>
              <div>
                <div className="text-xs text-white/60 uppercase tracking-wider">Time Tracking</div>
                <div className="text-sm">
                  {job.clockInAt ? <span className="font-mono text-green-400 text-base font-bold">{liveDisplay}</span> : <span className="text-white/50">Logged: <span className="text-white font-semibold">{job.loggedHours || 0}h</span></span>}
                  {!job.clockInAt && job.duration && <span className="text-white/40"> · est {job.duration}h</span>}
                </div>
              </div>
            </div>
            {job.clockInAt ? <GBtn variant="danger" onClick={clockOut} className="!text-xs">Clock Out</GBtn> : <GBtn onClick={clockIn} className="!text-xs"><Play size={10} className="inline mr-1" />Clock In</GBtn>}
          </div>
        </Glass>

        <div>
          <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Tag size={10} />Tags</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {jobTagOptions.map(t => {
              const sel = (job.tags || []).includes(t);
              return <button key={t} onClick={() => toggleTag(t)} className={"text-[10px] px-2.5 py-1 rounded-full border transition " + (sel ? "bg-red-900/40 border-red-500/50 text-red-300" : "bg-white/5 border-white/10 text-white/50 hover:text-white")}>{t}</button>;
            })}
          </div>
          {(job.tags || []).filter((t: string) => !jobTagOptions.includes(t)).length > 0 && <div className="flex gap-1 flex-wrap mb-2">
            {(job.tags || []).filter((t: string) => !jobTagOptions.includes(t)).map((t: string) => <span key={t} className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-700/40 text-blue-300">{t}<button onClick={() => removeTag(t)} className="hover:text-red-400"><X size={8} /></button></span>)}
          </div>}
          <div className="flex gap-2">
            <GInput placeholder="Custom tag..." value={tagInput} onChange={(e: any) => setTagInput(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && addTag()} className="!py-1.5 !text-xs" />
            <GBtn onClick={addTag} className="!py-1.5 !px-3"><Plus size={12} /></GBtn>
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Users size={10} />Crew</label>
          <div className="flex gap-2 flex-wrap">
            {employees.filter((e: any) => e.status === "active").map((e: any) => {
              const sel = (job.crew || []).includes(e.id);
              return <button key={e.id} onClick={() => toggleCrew(e.id)} className={"text-xs px-3 py-1.5 rounded-lg border transition " + (sel ? "bg-red-900/40 border-red-500/50 text-red-300" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>{e.firstName} {e.lastName[0]}.</button>;
            })}
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">Equipment Used</label>
          <div className="flex gap-2 flex-wrap">
            {equipmentList.map(eq => {
              const sel = (job.equipment || []).includes(eq);
              return <button key={eq} onClick={() => toggleEquip(eq)} className={"text-xs px-3 py-1.5 rounded-lg border transition " + (sel ? "bg-red-900/40 border-red-500/50 text-red-300" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>{eq}</button>;
            })}
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Clipboard size={10} />Internal Notes (crew only)</label>
          <GTxt rows={2} value={job.internalNotes || ""} onChange={(e: any) => updateJob(jobId, { internalNotes: e.target.value })} placeholder="Site details, warnings, tips for next visit..." />
        </div>

        <Glass className="p-3 !bg-black/40">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1"><Eye size={10} />Before / After Photos</div>
            <div className="text-xs text-white/50">{(job.photos || []).length} photo{(job.photos || []).length !== 1 ? "s" : ""}</div>
          </div>

          {(() => {
            const beforePhoto = (job.photos || []).find((p: any) => p.type === "before" && p.dataUrl);
            const afterPhoto = (job.photos || []).find((p: any) => p.type === "after" && p.dataUrl);
            if (!beforePhoto || !afterPhoto) return null;
            return <BeforeAfterSlider before={beforePhoto.dataUrl} after={afterPhoto.dataUrl} />;
          })()}

          {(job.photos || []).length > 0 && <div className="grid grid-cols-3 gap-2 mb-2 mt-2">
            {(job.photos || []).map((p: any, i: number) => (
              <div key={p.id || i} className="relative group aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-neutral-800 to-neutral-900 border border-red-900/30">
                {p.dataUrl ? <img src={p.dataUrl} alt={p.caption || ""} className="absolute inset-0 w-full h-full object-cover" />
                  : <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-40">{p.type === "before" ? "📷" : p.type === "after" ? "✨" : "🖼️"}</div>}
                <div className={"absolute top-1 left-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded " + (p.type === "before" ? "bg-blue-600/90" : p.type === "after" ? "bg-green-600/90" : "bg-black/70")}>{p.type || "photo"}</div>
                <button onClick={() => updateJob(jobId, { photos: (job.photos || []).filter((x: any) => x !== p) })} className="absolute top-1 right-1 p-1 rounded bg-black/70 opacity-0 group-hover:opacity-100 hover:bg-red-900/80 text-white/80"><X size={10} /></button>
                {p.caption && <div className="absolute bottom-0 left-0 right-0 p-1 text-[9px] bg-gradient-to-t from-black/90 to-transparent truncate">{p.caption}</div>}
              </div>
            ))}
          </div>}
          <div className="grid grid-cols-2 gap-2">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e: any) => {
                const files = Array.from(e.target.files || []);
                files.forEach((f: any) => {
                  const r = new FileReader();
                  r.onload = (ev: any) => {
                    const newPhoto = { id: uid(), type: "before", caption: "Before — " + today(), dataUrl: ev.target.result, addedAt: today() };
                    updateJob(jobId, { photos: [...(job.photos || []), newPhoto] });
                  };
                  r.readAsDataURL(f);
                });
                e.target.value = "";
                if (toast) toast("Before photo added");
              }} />
              <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-950/30 hover:bg-blue-900/40 border border-blue-700/40 text-blue-300 text-xs font-medium transition"><Plus size={12} />📷 Before</div>
            </label>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e: any) => {
                const files = Array.from(e.target.files || []);
                files.forEach((f: any) => {
                  const r = new FileReader();
                  r.onload = (ev: any) => {
                    const newPhoto = { id: uid(), type: "after", caption: "After — " + today(), dataUrl: ev.target.result, addedAt: today() };
                    updateJob(jobId, { photos: [...(job.photos || []), newPhoto] });
                  };
                  r.readAsDataURL(f);
                });
                e.target.value = "";
                if (toast) toast("After photo added");
              }} />
              <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-green-950/30 hover:bg-green-900/40 border border-green-700/40 text-green-300 text-xs font-medium transition"><Plus size={12} />✨ After</div>
            </label>
          </div>
        </Glass>

        <Glass className="p-3 !bg-black/40">
          <div className="flex items-center justify-between mb-2"><div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1"><FileText size={10} />Attachments</div><div className="text-xs text-white/50">{(job.attachments || []).length} file{(job.attachments || []).length !== 1 ? "s" : ""}</div></div>
          <div className="grid grid-cols-7 gap-2 mb-2">
            <GInput placeholder="Filename" value={attName} onChange={(e: any) => setAttName(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && addAtt()} className="col-span-4 !py-1.5 !text-xs" />
            <GSel value={attType} onChange={(e: any) => setAttType(e.target.value)} className="col-span-2 !py-1.5 !text-xs">
              <option value="pdf" className="bg-black">PDF</option>
              <option value="image" className="bg-black">Image</option>
              <option value="other" className="bg-black">Other</option>
            </GSel>
            <GBtn onClick={addAtt} className="col-span-1 !py-1.5"><Plus size={12} /></GBtn>
          </div>
          {(job.attachments || []).length > 0 && <div className="space-y-1">
            {(job.attachments || []).map((a: any) => <div key={a.id} className="flex items-center justify-between text-xs p-2 bg-white/5 rounded hover:bg-white/10">
              <div className="flex items-center gap-2 flex-1 min-w-0"><span>{attIcon(a.type)}</span><span className="truncate">{a.name}</span></div>
              <div className="flex items-center gap-1"><button onClick={() => { if (toast) toast("Would download " + a.name); }} className="p-1 text-white/50 hover:text-white"><Download size={10} /></button><button onClick={() => removeAtt(a.id)} className="p-1 text-white/40 hover:text-red-400"><X size={10} /></button></div>
            </div>)}
          </div>}
        </Glass>

        <Glass className="p-3 !bg-black/40">
          <div className="flex items-center justify-between mb-2"><div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1"><FlaskConical size={10} />Chemical Usage</div><div className="text-xs text-white/50">{totalGallons}gal · {fmt(totalChemCost)}</div></div>
          <div className="grid grid-cols-7 gap-2 mb-2">
            <GInput placeholder="Chemical" value={chemName} onChange={(e: any) => setChemName(e.target.value)} className="col-span-3 !py-1.5 !text-xs" />
            <GInput type="number" step="0.1" placeholder="Gal" value={chemGal} onChange={(e: any) => setChemGal(e.target.value)} className="col-span-1 !py-1.5 !text-xs" />
            <GInput type="number" step="0.01" placeholder="Cost" value={chemCost} onChange={(e: any) => setChemCost(e.target.value)} className="col-span-2 !py-1.5 !text-xs" />
            <GBtn onClick={addChem} className="col-span-1 !py-1.5 !text-xs"><Plus size={12} /></GBtn>
          </div>
          {(job.chemicalsUsed || []).length > 0 && <div className="space-y-1">
            {(job.chemicalsUsed || []).map((ch: any, i: number) => <div key={i} className="flex items-center justify-between text-xs p-1.5 bg-white/5 rounded"><span>{ch.name}</span><span className="text-white/50">{ch.gallons}gal · {fmt(ch.cost)}</span><button onClick={() => removeChem(i)} className="text-red-400 hover:text-red-300"><X size={10} /></button></div>)}
          </div>}
        </Glass>

        <Glass className="p-3 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3 flex items-center gap-1"><DollarSign size={10} />Job Costing & Profitability</div>
          <div className="flex items-center gap-3 mb-3 p-2 bg-black/40 border border-red-900/30 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer text-sm flex-1">
              <input type="checkbox" checked={!!job.isCash} onChange={(e: any) => updateJob(jobId, { isCash: e.target.checked })} className="w-4 h-4" />
              <span className="text-white/80">💵 Cash payment</span>
            </label>
            {job.isCash && <span className="text-[9px] px-2 py-1 rounded-full bg-green-900/30 border border-green-700/40 text-green-300">Separate for taxes</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs p-2 bg-black/40 border border-red-900/20 rounded-xl">
              <input type="checkbox" checked={!!job.noShow} onChange={(e: any) => updateJob(jobId, { noShow: e.target.checked })} className="w-3.5 h-3.5" />
              <span className="text-white/70">🚫 No-show</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs p-2 bg-black/40 border border-blue-900/20 rounded-xl">
              <input type="checkbox" checked={!!job.rainGuarantee} onChange={(e: any) => updateJob(jobId, { rainGuarantee: e.target.checked, rainGuaranteeDate: e.target.checked ? today() : null })} className="w-3.5 h-3.5" />
              <span className="text-white/70">🌧️ Rain guarantee</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wider">Labor Cost ($)</label>
              <GInput type="number" step="0.01" value={job.laborCost || ""} onChange={(e: any) => updateJob(jobId, { laborCost: Number(e.target.value) })} placeholder="0.00" className="!py-1.5 !text-xs mt-1" />
            </div>
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wider">Material Cost ($)</label>
              <GInput type="number" step="0.01" value={job.materialCost || ""} onChange={(e: any) => updateJob(jobId, { materialCost: Number(e.target.value) })} placeholder="0.00" className="!py-1.5 !text-xs mt-1" />
            </div>
          </div>
          {(() => {
            const labor = Number(job.laborCost) || 0;
            const materials = Number(job.materialCost) || 0;
            const chems = totalChemCost;
            const totalCost = labor + materials + chems;
            const revenue = job.amount || 0;
            const profit = revenue - totalCost;
            const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
            const marginTone = Number(margin) >= 60 ? "text-green-400" : Number(margin) >= 40 ? "text-yellow-400" : "text-red-400";
            return <div className="space-y-1.5">
              <div className="grid grid-cols-4 gap-2 text-center text-[10px] mb-2">
                <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50">Revenue</div><div className="font-bold text-white">{fmt(revenue)}</div></div>
                <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50">Costs</div><div className="font-bold text-red-400">{fmt(totalCost)}</div></div>
                <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50">Profit</div><div className={"font-bold " + (profit >= 0 ? "text-green-400" : "text-red-400")}>{fmt(profit)}</div></div>
                <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50">Margin</div><div className={"font-bold " + marginTone}>{margin}%</div></div>
              </div>
            </div>;
          })()}
        </Glass>

        <Glass className="p-3 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-2 flex items-center gap-1"><MessageSquare size={10} />Communication Log</div>
          <div className="flex gap-2 mb-2">
            <GSel value={commType} onChange={(e: any) => setCommType(e.target.value)} className="!w-28 !py-1.5 !text-xs">
              <option value="note" className="bg-black">note</option>
              <option value="call" className="bg-black">call</option>
              <option value="text" className="bg-black">text</option>
              <option value="email" className="bg-black">email</option>
            </GSel>
            <GInput placeholder="Add entry..." value={commNote} onChange={(e: any) => setCommNote(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && addComm()} className="!py-1.5 !text-xs" />
            <GBtn onClick={addComm} className="!py-1.5"><Plus size={12} /></GBtn>
          </div>
          {(job.commLog || []).length > 0 && <div className="space-y-1 max-h-32 overflow-y-auto">
            {(job.commLog || []).slice().reverse().map((e: any) => <div key={e.id} className="text-xs p-2 bg-white/5 rounded flex items-center gap-2"><Badge tone="gray">{e.type}</Badge><span className="flex-1">{e.note}</span><span className="text-white/40">{e.date}</span></div>)}
          </div>}
        </Glass>

        <div className="flex justify-end"><GBtn onClick={onClose}>Done</GBtn></div>
      </div>
    </Modal>
  );
}
