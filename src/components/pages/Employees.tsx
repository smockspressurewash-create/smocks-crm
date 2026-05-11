// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { uid, today, daysSince, fmt, daysFromNow } from '../../lib/utils';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { GSel } from '../ui/GSel';
import { Modal } from '../ui/Modal';
import { Glass } from '../ui/Glass';
import { PageFade } from '../ui/PageFade';
import { VoiceMicButton } from '../ui/VoiceMicButton';
import { MODELS, callModel, parseRateLimitError } from '../../lib/ai';
import { twilioSend, sendEmail } from '../../lib/messaging';
import { sendGmailEmail, createCalendarEvent, uploadToDrive } from '../../lib/google';
import { personalities } from '../../lib/constants';

// Destructure common icons to avoid rewriting component code
const { 
  Bot, Settings, X, Plus, Search, Edit, Trash2, Send, Activity, Users,
  MessageSquare, Mic, Play, Volume2, Cloud, FileImage, Link, ArrowRight,
  CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Menu, Zap, Clock, GripVertical, RefreshCw, Copy, Paperclip, Target, Workflow, BarChart2,
  Lock, Key, Image: ImageIcon, MapPin, Map, Sun, Wind, Umbrella, CheckSquare, Save, XCircle
} = LucideIcons;

export function EmployeesPage({ employees = [], setEmployees, jobs = [] }) {
  const [modal, setModal] = useState({ open: false, data: null });
  const [view, setView] = useState("list"); // list | hours | payroll
  const [payPeriodStart, setPayPeriodStart] = usePersistent("smocks.payPeriodStart", (() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10); })());
  const [payPeriodEnd, setPayPeriodEnd] = usePersistent("smocks.payPeriodEnd", today());
  const [f, setF] = useState({ firstName: "", lastName: "", role: "Technician", status: "active", hourlyRate: 18, phone: "", email: "", startDate: today(), emergencyContact: "", notes: "" });

  useEffect(() => { if (modal.data) setF(modal.data); else setF({ firstName: "", lastName: "", role: "Technician", status: "active", hourlyRate: 18, phone: "", email: "", startDate: today(), emergencyContact: "", notes: "" }); }, [modal]);

  const save = () => {
    if (!f.firstName.trim()) return;
    if (f.id) setEmployees(prev => prev.map(e => e.id === f.id ? { ...f } : e));
    else setEmployees(prev => [...prev, { ...f, id: uid() }]);
    setModal({ open: false, data: null });
  };
  const del = id => { if (confirm("Remove employee?")) setEmployees(prev => prev.filter(e => e.id !== id)); };
  const toggle = id => setEmployees(prev => prev.map(e => e.id === id ? { ...e, status: e.status === "active" ? "inactive" : "active" } : e));

  const roles = ["Owner", "Lead Technician", "Technician", "Helper", "Office", "Sales"];

  // Calculate real hours from jobs (loggedHours on jobs they're crewed on)
  const getEmployeeHours = (empId, startDate, endDate) => {
    return jobs
      .filter(j => (j.crew || []).includes(empId) && j.status === "completed" && j.scheduledDate >= startDate && j.scheduledDate <= endDate)
      .reduce((s, j) => s + Number(j.loggedHours || j.duration || 0), 0);
  };

  const totalPayroll = employees.filter(e => e.status === "active").reduce((s, e) => {
    const hrs = getEmployeeHours(e.id, payPeriodStart, payPeriodEnd);
    return s + hrs * e.hourlyRate;
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-black/40 border border-red-900/30 rounded-xl p-1">
            {["list","hours","payroll"].map(v => <button key={v} onClick={() => setView(v)} className={"px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition " + (view === v ? "bg-gradient-to-r from-red-600 to-red-800 text-white" : "text-white/50 hover:text-white")}>{v === "hours" ? "⏱ Hours" : v === "payroll" ? "💰 Payroll" : "👥 Team"}</button>)}
          </div>
          <div className="text-xs text-white/50">{employees.filter(e => e.status === "active").length} active</div>
        </div>
        <GBtn onClick={() => setModal({ open: true, data: null })}><Plus size={14} className="inline mr-1.5" />Add Employee</GBtn>
      </div>

      {view === "list" && <div className="grid md:grid-cols-2 gap-4">
        {employees.map(e => (
          <Glass key={e.id} className={"p-4 group " + (e.status === "inactive" ? "opacity-60" : "")}>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-base font-bold flex-shrink-0">{e.firstName[0]}{e.lastName[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{e.firstName} {e.lastName}</span>
                  <Badge tone={e.status === "active" ? "green" : "gray"}>{e.status}</Badge>
                  <Badge tone="blue">{e.role}</Badge>
                </div>
                <div className="text-xs text-white/60 mt-1 space-y-0.5">
                  {e.phone && <div className="flex items-center gap-1"><Phone size={10} />{e.phone}</div>}
                  {e.email && <div className="flex items-center gap-1"><Mail size={10} />{e.email}</div>}
                  <div className="flex items-center gap-1"><DollarSign size={10} />{fmt(e.hourlyRate)}/hr</div>
                  {e.startDate && <div className="flex items-center gap-1"><Calendar size={10} />Started {e.startDate}</div>}
                </div>
                {e.notes && <div className="text-[10px] text-white/40 mt-1 italic">{e.notes}</div>}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                <button onClick={() => setModal({ open: true, data: e })} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"><Edit size={12} /></button>
                <button onClick={() => toggle(e.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50">{e.status === "active" ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                <button onClick={() => del(e.id)} className="p-1.5 rounded-lg hover:bg-red-900/30 text-white/50 hover:text-red-400"><Trash2 size={12} /></button>
              </div>
            </div>
          </Glass>
        ))}
        {employees.length === 0 && <div className="md:col-span-2 text-center py-16 text-white/40"><Users2 size={40} className="mx-auto mb-3 opacity-30" /><div>No employees yet</div></div>}
      </div>}

      {view === "hours" && <>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span>Period:</span>
            <GDate value={payPeriodStart} onChange={e => setPayPeriodStart(e.target.value)} className="!text-xs !py-1.5 !w-36" />
            <span>to</span>
            <GDate value={payPeriodEnd} onChange={e => setPayPeriodEnd(e.target.value)} className="!text-xs !py-1.5 !w-36" />
          </div>
        </div>
        <Glass className="overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-red-900/30 bg-black/40">
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-white/60">Employee</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Jobs</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Hours</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Rate</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Est. Pay</th>
            </tr></thead>
            <tbody>
              {employees.filter(e => e.status === "active").map(e => {
                const empJobs = jobs.filter(j => (j.crew||[]).includes(e.id) && j.status === "completed" && j.scheduledDate >= payPeriodStart && j.scheduledDate <= payPeriodEnd);
                const hrs = empJobs.reduce((s,j) => s + Number(j.loggedHours||j.duration||0), 0);
                const cost = hrs * e.hourlyRate;
                return <tr key={e.id} className="border-b border-red-900/10 hover:bg-white/5">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-xs font-bold">{e.firstName[0]}</div>{e.firstName} {e.lastName}</div></td>
                  <td className="px-4 py-3 text-right text-white/60">{empJobs.length}</td>
                  <td className="px-4 py-3 text-right text-white/80">{hrs.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right text-white/60">{fmt(e.hourlyRate)}/hr</td>
                  <td className="px-4 py-3 text-right font-bold text-red-400">{fmt(cost)}</td>
                </tr>;
              })}
              <tr className="bg-red-950/20 font-bold border-t border-red-900/30">
                <td className="px-4 py-3" colSpan={4}>Total Payroll Est.</td>
                <td className="px-4 py-3 text-right text-red-400 text-base">{fmt(totalPayroll)}</td>
              </tr>
            </tbody>
          </table>
          <div className="p-3 text-[10px] text-white/30 border-t border-red-900/20">Hours pulled from logged time on completed jobs assigned to each crew member. Add hours via the clock in/out button on job cards.</div>
        </Glass>
      </>}

      {view === "payroll" && <div className="space-y-4">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span>Pay period:</span>
            <GDate value={payPeriodStart} onChange={e => setPayPeriodStart(e.target.value)} className="!text-xs !py-1.5 !w-36" />
            <span>—</span>
            <GDate value={payPeriodEnd} onChange={e => setPayPeriodEnd(e.target.value)} className="!text-xs !py-1.5 !w-36" />
          </div>
          <button onClick={() => {
            const rows = employees.filter(e => e.status === "active").map(e => {
              const hrs = getEmployeeHours(e.id, payPeriodStart, payPeriodEnd);
              const gross = hrs * e.hourlyRate;
              const fica = gross * 0.0765;
              const net = gross - fica;
              return `${e.firstName} ${e.lastName},${e.role},${hrs.toFixed(1)},${e.hourlyRate},${gross.toFixed(2)},${fica.toFixed(2)},${net.toFixed(2)}`;
            }).join("\n");
            const csv = "Name,Role,Hours,Rate,Gross,FICA (7.65%),Net\n" + rows;
            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "payroll-" + payPeriodStart + ".csv"; a.click();
          }} className="text-xs px-3 py-1.5 bg-black/40 border border-red-900/30 text-white/60 hover:text-white rounded-xl transition flex items-center gap-1"><Download size={12} />Export CSV</button>
        </div>
        <div className="grid gap-4">
          {employees.filter(e => e.status === "active").map(e => {
            const hrs = getEmployeeHours(e.id, payPeriodStart, payPeriodEnd);
            const gross = hrs * e.hourlyRate;
            const fica = gross * 0.0765;
            const net = gross - fica;
            const empJobs = jobs.filter(j => (j.crew||[]).includes(e.id) && j.status === "completed" && j.scheduledDate >= payPeriodStart && j.scheduledDate <= payPeriodEnd);
            return <Glass key={e.id} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center font-bold">{e.firstName[0]}{e.lastName[0]}</div>
                <div className="flex-1"><div className="font-semibold">{e.firstName} {e.lastName}</div><div className="text-xs text-white/50">{e.role} · {fmt(e.hourlyRate)}/hr</div></div>
                <div className="text-right"><div className="text-xl font-black text-green-400">{fmt(net)}</div><div className="text-[10px] text-white/40">net pay</div></div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs text-center">
                <div className="p-2 bg-black/40 rounded-xl"><div className="text-white/50 mb-0.5">Jobs</div><div className="font-bold">{empJobs.length}</div></div>
                <div className="p-2 bg-black/40 rounded-xl"><div className="text-white/50 mb-0.5">Hours</div><div className="font-bold">{hrs.toFixed(1)}h</div></div>
                <div className="p-2 bg-black/40 rounded-xl"><div className="text-white/50 mb-0.5">Gross</div><div className="font-bold text-red-400">{fmt(gross)}</div></div>
                <div className="p-2 bg-black/40 rounded-xl"><div className="text-white/50 mb-0.5">FICA</div><div className="font-bold text-yellow-400">-{fmt(fica)}</div></div>
              </div>
              {empJobs.length > 0 && <div className="mt-3 text-[10px] text-white/40">Jobs: {empJobs.map(j => j.scheduledDate).join(", ")}</div>}
            </Glass>;
          })}
        </div>
        <Glass className="p-4 !bg-gradient-to-r !from-red-950/30 !to-black/60 !border-red-600/40 text-center">
          <div className="text-xs text-white/50 mb-1">Total Payroll Period {payPeriodStart} — {payPeriodEnd}</div>
          <div className="text-3xl font-black text-red-400">{fmt(totalPayroll)}</div>
          <div className="text-[10px] text-white/30 mt-1">Gross · FICA employer match additional 7.65%</div>
        </Glass>
      </div>}

      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={modal.data ? "Edit Employee" : "Add Employee"} maxW="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">First name</label><GInput value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Last name</label><GInput value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Role</label><GSel value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>{roles.map(r => <option key={r} value={r} className="bg-black">{r}</option>)}</GSel></div>
            <div><label className="text-xs text-white/60 mb-1 block">Hourly Rate ($)</label><GInput type="number" step="0.5" value={f.hourlyRate} onChange={e => setF({ ...f, hourlyRate: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Phone</label><GInput value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="(717) 555-0100" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Email</label><GInput type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Start Date</label><GDate value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Status</label><GSel value={f.status} onChange={e => setF({ ...f, status: e.target.value })}><option value="active" className="bg-black">Active</option><option value="inactive" className="bg-black">Inactive</option></GSel></div>
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Emergency Contact</label><GInput value={f.emergencyContact} onChange={e => setF({ ...f, emergencyContact: e.target.value })} placeholder="Name — (717) 555-0000" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Notes</label><GTxt rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
          <div className="flex gap-2 justify-end pt-2">
            <GBtn variant="ghost" onClick={() => setModal({ open: false, data: null })}>Cancel</GBtn>
            <GBtn onClick={save} disabled={!f.firstName.trim()}>Save</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
