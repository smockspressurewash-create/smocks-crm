import React, { useState, useEffect, useRef } from 'react';
import { Search, Navigation, CheckSquare, Plus, MapPin, Clock, Edit, FileText, Play, CheckCircle, Repeat, X, Trash2, Users, Download, FlaskConical, DollarSign, AlertCircle, Tag, Ban, RefreshCw, Send, Cloud } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { Badge } from '../ui/Badge';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { GSel } from '../ui/GSel';
import { GTxt } from '../ui/GTxt';
import { Modal } from '../ui/Modal';
import { uid, today, fmt, daysSince, daysFromNow } from '../../lib/utils';
import { twilioSend } from '../../lib/messaging';
import { weatherRisk } from '../../lib/weather';

const cancelReasons = ["Weather", "Customer request", "No show", "Equipment failure", "Other"];
const equipmentList = ["Pressure Washer", "Soft Wash", "Surface Cleaner", "Gutter Wand", "Ladder", "X-Jet", "Ball Valve"];
const recurringFreqs = ["weekly", "bi-weekly", "monthly", "quarterly", "annually"];
const priorityLevels = [
  { key: "urgent", label: "Urgent", tone: "red", color: "bg-red-600" },
  { key: "high", label: "High", tone: "yellow", color: "bg-yellow-600" },
  { key: "normal", label: "Normal", tone: "blue", color: "bg-blue-600" },
  { key: "low", label: "Low", tone: "gray", color: "bg-gray-600" }
];
const jobTagOptions = ["Emergency", "Warranty", "Follow-up", "HOA", "Commercial", "VIP"];

export function JobsPage({ jobs = [], setJobs, customers = [], employees = [], estimates = [], setEstimates = () => { }, settings = {}, toast, setTimeline = () => { } }: any) {
  const [tab, setTab] = useState("scheduled");
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [routeOpen, setRouteOpen] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<any[]>([]);

  const filtered = jobs.filter((j: any) => j.status === tab).filter((j: any) => {
    if (!search.trim()) return true;
    const c = customers.find((x: any) => x.id === j.customerId);
    const q = search.toLowerCase();
    return (c?.firstName + " " + c?.lastName).toLowerCase().includes(q) || (j.address || "").toLowerCase().includes(q);
  });

  const move = (jid: string, ns: string) => {
    setJobs(jobs.map((j: any) => j.id === jid ? { ...j, status: ns } : j));
    toast("Job moved to " + ns);
  };

  const updateJob = (jid: string, patch: any) => setJobs(jobs.map((j: any) => j.id === jid ? { ...j, ...patch } : j));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          {["scheduled", "in_progress", "completed", "cancelled"].map(t => (
            <button key={t} onClick={() => setTab(t)} className={"px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition " + (tab === t ? "bg-red-900/40 border-red-500/50 text-white" : "bg-black/40 border-red-900/30 text-white/60 hover:text-white")}>
              {t.replace("_", " ")} ({jobs.filter((j: any) => j.status === t).length})
            </button>
          ))}
        </div>
        <GBtn onClick={() => setRouteOpen(true)} variant="ghost" className="!text-xs"><Navigation size={12} className="mr-1.5" />Route</GBtn>
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <GInput placeholder="Search jobs..." value={search} onChange={(e: any) => setSearch(e.target.value)} className="!pl-9 !py-1.5 !text-xs" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((j: any) => {
          const c = customers.find((x: any) => x.id === j.customerId);
          return (
            <Glass key={j.id} className="p-5 hover:border-red-600/50 transition-all">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-bold">{c?.firstName} {c?.lastName}</div>
                  <div className="text-xs text-white/50 flex items-center gap-1 mt-0.5"><MapPin size={10} />{j.address}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-red-400">{fmt(j.amount)}</div>
                  <div className="text-[10px] text-white/40">{j.scheduledDate}</div>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-red-900/10">
                <GBtn onClick={() => setDetailId(j.id)} variant="ghost" className="!text-xs flex-1">Details</GBtn>
                {tab === "scheduled" && <GBtn onClick={() => move(j.id, "in_progress")} className="!text-xs flex-1">Start</GBtn>}
                {tab === "in_progress" && <GBtn onClick={() => move(j.id, "completed")} className="!text-xs flex-1">Complete</GBtn>}
              </div>
            </Glass>
          );
        })}
      </div>

      {detailId && <JobDetailModal jobId={detailId} job={jobs.find((j: any) => j.id === detailId)} onClose={() => setDetailId(null)} customers={customers} employees={employees} updateJob={updateJob} toast={toast} />}
    </div>
  );
}

function JobDetailModal({ jobId, job, onClose, customers, employees, updateJob, toast }: any) {
  if (!job) return null;
  const c = customers.find((x: any) => x.id === job.customerId);

  return (
    <Modal open={!!jobId} onClose={onClose} title="Job Details" maxW="max-w-2xl">
      <div className="space-y-4">
        <div className="flex items-center gap-4 p-4 bg-black/40 rounded-xl border border-white/5">
          <div className="flex-1">
            <div className="text-lg font-bold">{c?.firstName} {c?.lastName}</div>
            <div className="text-xs text-white/50">{job.address}</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-red-400">{fmt(job.amount)}</div>
            <Badge tone="blue">{job.status.replace("_", " ")}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Priority</label>
            <GSel value={job.priority || "normal"} onChange={(e: any) => updateJob(jobId, { priority: e.target.value })}>
              {priorityLevels.map(p => <option key={p.key} value={p.key} className="bg-black">{p.label}</option>)}
            </GSel>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Date</label>
            <GInput type="date" value={job.scheduledDate} onChange={(e: any) => updateJob(jobId, { scheduledDate: e.target.value })} className="[color-scheme:dark]" />
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">Checklist</label>
          <div className="space-y-2 p-3 bg-black/40 rounded-xl border border-white/5">
            {(job.checklist || []).map((ck: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <input type="checkbox" checked={ck.done} onChange={() => {
                  const nck = [...(job.checklist || [])];
                  nck[idx] = { ...nck[idx], done: !nck[idx].done };
                  updateJob(jobId, { checklist: nck });
                }} />
                <span className={"text-xs " + (ck.done ? "line-through text-white/40" : "")}>{ck.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">Internal Notes</label>
          <GTxt rows={3} value={job.notes || ""} onChange={(e: any) => updateJob(jobId, { notes: e.target.value })} />
        </div>

        <div className="flex justify-end gap-2">
          <GBtn variant="ghost" onClick={onClose}>Close</GBtn>
        </div>
      </div>
    </Modal>
  );
}
