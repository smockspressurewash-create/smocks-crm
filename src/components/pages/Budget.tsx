import React from 'react';
import { PieChart as PieIcon, DollarSign, Receipt, TrendingUp, AlertCircle } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { Stat } from '../ui/Stat';
import { fmt } from '../../lib/utils';

export function BudgetPage({ jobs = [], estimates = [], expenses = [], settings = {} }: any) {
  const taxRate = settings.taxRate || 25;
  const grossRev = jobs.filter((j: any) => j.status === "completed").reduce((s: number, j: any) => s + j.amount, 0);
  const totalExp = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const taxableIncome = Math.max(0, grossRev - totalExp);
  const estimatedTax = taxableIncome * (taxRate / 100);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Glass className="p-5 border-l-4 border-l-red-500">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Gross Revenue</div>
          <div className="text-2xl font-bold">{fmt(grossRev)}</div>
        </Glass>
        <Glass className="p-5 border-l-4 border-l-yellow-500">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Total Expenses</div>
          <div className="text-2xl font-bold">{fmt(totalExp)}</div>
        </Glass>
        <Glass className="p-5 border-l-4 border-l-green-500">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Estimated Tax ({taxRate}%)</div>
          <div className="text-2xl font-bold text-green-400">{fmt(estimatedTax)}</div>
        </Glass>
      </div>

      <Glass className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle size={16} className="text-yellow-400" />
          <h3 className="font-semibold text-sm">Tax Liability Note</h3>
        </div>
        <p className="text-xs text-white/60 leading-relaxed">
          This estimate is based on a flat {taxRate}% tax rate on your net profit (Gross Revenue - Expenses). 
          Consult with a tax professional for accurate filing. We recommend setting aside {fmt(estimatedTax / 4)} per quarter for estimated payments.
        </p>
      </Glass>
    </div>
  );
}
