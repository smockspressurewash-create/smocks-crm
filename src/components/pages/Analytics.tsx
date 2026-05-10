import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, Briefcase, Users } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { Stat } from '../ui/Stat';
import { fmt } from '../../lib/utils';

export function AnalyticsPage({ jobs = [], customers = [], estimates = [], expenses = [] }: any) {
  const totalRev = jobs.filter((j: any) => j.status === "completed").reduce((s: number, j: any) => s + j.amount, 0);
  const totalExp = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const profit = totalRev - totalExp;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={TrendingUp} label="Revenue Growth" value="+15%" />
        <Stat icon={DollarSign} label="Profit Margin" value={totalRev > 0 ? Math.round((profit / totalRev) * 100) + "%" : "0%"} />
        <Stat icon={Briefcase} label="Avg Job Size" value={fmt(jobs.length > 0 ? totalRev / jobs.length : 0)} />
        <Stat icon={Users} label="Cust LTV" value={fmt(customers.length > 0 ? totalRev / customers.length : 0)} />
      </div>

      <Glass className="p-5">
        <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-white/50">Revenue vs Expenses</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={jobs.slice(-10).map((j: any) => ({ 
              name: j.scheduledDate ? j.scheduledDate.split('-').slice(1).join('/') : '??', 
              revenue: j.amount || 0 
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#ffffff40" fontSize={10} tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} />
              <Tooltip 
                cursor={{ fill: '#ffffff05' }}
                contentStyle={{ backgroundColor: '#000', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '12px' }}
                itemStyle={{ color: '#ef4444' }}
              />
              <Bar dataKey="revenue" fill="#dc2626" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Glass>

      <Glass className="p-5">
        <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-white/50">Profit Trend</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={jobs.slice(-15).map((j: any, i: number) => ({ 
              name: i, 
              profit: (j.amount || 0) * 0.45 
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="name" hide />
              <YAxis stroke="#ffffff40" fontSize={10} tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#000', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '12px' }}
              />
              <Line type="monotone" dataKey="profit" stroke="#ef4444" strokeWidth={3} dot={false} animationDuration={1500} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Glass>
    </div>
  );
}
