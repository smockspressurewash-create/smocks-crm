import React, { useState } from 'react';
import { Heart, DollarSign, Target, PieChart as PieIcon, Plus, Trash2 } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { Stat } from '../ui/Stat';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { fmt, uid, today } from '../../lib/utils';

export function PersonalBudgetPage({ jobs = [], settings = {} }: any) {
  const [personalExp, setPersonalExp] = useState([
    { id: "1", label: "Mortgage", amount: 1800 },
    { id: "2", label: "Groceries", amount: 600 },
    { id: "3", label: "Utilities", amount: 300 }
  ]);

  const totalPersonal = personalExp.reduce((s, e) => s + e.amount, 0);
  const businessNet = jobs.filter((j: any) => j.status === "completed").reduce((s: number, j: any) => s + j.amount, 0) * 0.4; // 40% margin assumption

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Heart} label="Personal Burn" value={fmt(totalPersonal)} />
        <Stat icon={DollarSign} label="Owner Draw (Est)" value={fmt(businessNet)} />
        <Stat icon={Target} label="Freedom Mult" value={(businessNet / totalPersonal).toFixed(1) + "x"} />
      </div>

      <Glass className="p-5">
        <h3 className="font-semibold mb-4">Personal Expenses</h3>
        <div className="space-y-2">
          {personalExp.map(e => (
            <div key={e.id} className="flex justify-between items-center p-3 bg-black/40 rounded-xl border border-white/5">
              <span className="text-white/70">{e.label}</span>
              <span className="font-bold">{fmt(e.amount)}</span>
            </div>
          ))}
        </div>
      </Glass>
    </div>
  );
}
