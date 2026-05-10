import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Download, FileText, DollarSign, Receipt, TrendingUp, Percent, Briefcase, Clock, Users, UserCheck } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { Stat } from '../ui/Stat';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { fmt, today, daysSince, TIMEFRAMES, filterByTimeframe } from '../../lib/utils';

const TimeframeSelector = ({ value, onChange, options = ["7d", "30d", "90d", "6m", "1y", "all"], compact = false }: any) => {
  const show = TIMEFRAMES.filter(t => options.includes(t.key));
  return (
    <div className={"flex gap-1 bg-black/40 border border-red-900/30 rounded-xl p-1 " + (compact ? "text-[10px]" : "text-xs")}>
      {show.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={"px-2.5 py-1 rounded-lg font-semibold transition-all " + (value === t.key ? "bg-gradient-to-r from-red-600 to-red-800 text-white shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5")}
        >{t.label}</button>
      ))}
    </div>
  );
};

export function ReportsPage({ jobs = [], customers = [], estimates = [], expenses = [], employees = [], chemicals = [] }: any) {
  const [timeframe, setTimeframe] = useState("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const tfJobs = (() => {
    if (timeframe === "custom" && customStart && customEnd) {
      return jobs.filter((j: any) => j.status === "completed" && j.scheduledDate >= customStart && j.scheduledDate <= customEnd);
    }
    return filterByTimeframe(jobs.filter((j: any) => j.status === "completed"), "scheduledDate", timeframe);
  })();

  const tfEstimates = timeframe === "custom" && customStart && customEnd 
    ? estimates.filter((e: any) => e.createdAt >= customStart && e.createdAt <= customEnd)
    : filterByTimeframe(estimates, "createdAt", timeframe);

  const tfExpenses = timeframe === "custom" && customStart && customEnd
    ? expenses.filter((e: any) => e.date >= customStart && e.date <= customEnd)
    : filterByTimeframe(expenses, "date", timeframe);

  const totalRev = tfJobs.reduce((s: number, j: any) => s + j.amount, 0);
  const totalExp = tfExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const approved = tfEstimates.filter((e: any) => e.status === "approved").length;
  const cr = tfEstimates.length ? Math.round((approved / tfEstimates.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-lg">Reports</h2>
          <div className="text-xs text-white/50">Showing {tfJobs.length} jobs</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} options={["7d","30d","90d","6m","1y","all","custom"]} />
          <GBtn variant="ghost" className="!text-xs"><Download size={12} className="mr-1" />CSV</GBtn>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="Revenue" value={fmt(totalRev)} />
        <Stat icon={Receipt} label="Expenses" value={fmt(totalExp)} />
        <Stat icon={TrendingUp} label="Gross Profit" value={fmt(totalRev - totalExp)} />
        <Stat icon={Percent} label="Close Rate" value={cr + "%"} />
      </div>

      <Glass className="p-5">
        <h3 className="font-semibold mb-4">Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="name" stroke="#ffffff60" fontSize={12} />
            <YAxis stroke="#ffffff60" fontSize={12} tickFormatter={v => "$" + v} />
            <Tooltip contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid #9f1239" }} />
            <Area type="monotone" dataKey="revenue" stroke="#e11d48" fill="#e11d4844" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="text-center text-white/40 text-xs italic mt-4">Chart data generation pending...</div>
      </Glass>
    </div>
  );
}
