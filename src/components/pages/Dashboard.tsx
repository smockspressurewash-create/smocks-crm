import React, { useState } from 'react';
import { LayoutDashboard, FileText, Briefcase, Navigation, DollarSign, Target, RefreshCw, Cloud, Truck, FlaskConical, AlertCircle, Receipt, Clock, Activity, MessageSquare, AlertTriangle, ChevronRight, CheckCircle, Ban, Calendar, Users, Star } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { Badge } from '../ui/Badge';
import { Stat } from '../ui/Stat';
import { fmt, today, daysSince, daysFromNow } from '../../lib/utils';
import { forecastFor } from '../../lib/weather';

export function Dashboard({ jobs = [], customers = [], estimates = [], automations = [], stats, goals, vehicles = [], maintenance = [], chemicals = [], settings = {}, setSettings = () => {}, onNav, toast, weatherData = {}, inboxThreads = [] }: any) {
  const pipelineVal = jobs.filter((j: any) => j.status !== "completed").reduce((s: number, j: any) => s + j.amount, 0);
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const runRate = dayOfMonth > 0 ? Math.round((stats.totalRev / dayOfMonth) * daysInMonth) : 0;
  const forecast = Math.max(runRate, Math.round(pipelineVal * (stats.closeRate / 100 || 0.6)));

  const nowD = new Date();
  const weekStart = new Date(nowD); weekStart.setDate(nowD.getDate() - nowD.getDay());
  const monthStart = new Date(nowD.getFullYear(), nowD.getMonth(), 1);
  const completedJobs = jobs.filter((j: any) => j.status === "completed");
  const revToday = completedJobs.filter((j: any) => j.scheduledDate === today()).reduce((s: number, j: any) => s + j.amount, 0);
  const revWeek = completedJobs.filter((j: any) => new Date(j.scheduledDate) >= weekStart).reduce((s: number, j: any) => s + j.amount, 0);
  const revMonth = completedJobs.filter((j: any) => new Date(j.scheduledDate) >= monthStart).reduce((s: number, j: any) => s + j.amount, 0);

  const tKey = today();
  const in7 = daysFromNow(7);
  const upcoming = jobs.filter((j: any) => j.scheduledDate >= tKey && j.scheduledDate <= in7 && j.status !== "cancelled").sort((a: any, b: any) => a.scheduledDate.localeCompare(b.scheduledDate)).slice(0, 5);

  const alerts: any[] = [];
  if (chemicals.filter((c: any) => c.stock <= c.reorderLevel).length > 0) {
    alerts.push({ key: "stock", icon: FlaskConical, tone: "red", msg: "Low chemical stock", action: () => onNav("chemicals") });
  }

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {alerts.map(a => (
            <button key={a.key} onClick={a.action} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs bg-red-950/30 border-red-600/50 text-red-300">
              <a.icon size={11} />
              <span>{a.msg}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <button onClick={() => onNav("estimates")} className="bg-gradient-to-br from-red-600 to-red-900 border border-red-500/50 rounded-2xl p-4 text-left shadow-lg">
          <FileText size={18} className="mb-2 text-white" />
          <div className="font-bold text-sm text-white">New Estimate</div>
        </button>
        <button onClick={() => onNav("jobs")} className="bg-black/40 border border-red-900/30 rounded-2xl p-4 text-left">
          <Briefcase size={18} className="mb-2 text-red-400" />
          <div className="font-bold text-sm text-white">Schedule Job</div>
        </button>
        <Glass className="p-4">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">📅 Today</div>
          <div className="text-2xl font-bold text-red-400">{fmt(revToday)}</div>
        </Glass>
        <Glass className="p-4">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">📅 This Week</div>
          <div className="text-2xl font-bold text-red-400">{fmt(revWeek)}</div>
        </Glass>
        <Glass className="p-4">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">📅 This Month</div>
          <div className="text-2xl font-bold text-red-400">{fmt(revMonth)}</div>
        </Glass>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="Total Revenue" value={fmt(stats.totalRev)} />
        <Stat icon={Briefcase} label="Active Jobs" value={stats.activeJobs} />
        <Stat icon={Target} label="Close Rate" value={stats.closeRate + "%"} />
        <Stat icon={RefreshCw} label="Forecast" value={fmt(forecast)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Glass className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm flex items-center gap-2"><Briefcase size={13} className="text-red-400" />Upcoming (7d)</div>
            </div>
            <div className="space-y-2">
              {upcoming.map((j: any) => (
                <div key={j.id} className="flex items-center gap-2 py-1.5 border-b border-red-900/10 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{j.address}</div>
                    <div className="text-[10px] text-white/50">{j.scheduledDate} · {fmt(j.amount)}</div>
                  </div>
                  <Badge tone={j.status === "completed" ? "green" : "gray"}>{j.status}</Badge>
                </div>
              ))}
            </div>
          </Glass>
        </div>
      </div>
    </div>
  );
}

function PBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
      <div className="h-full bg-red-600 transition-all duration-500" style={{ width: pct + "%" }} />
    </div>
  );
}
