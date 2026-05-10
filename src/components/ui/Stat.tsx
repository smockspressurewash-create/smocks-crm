import React from 'react';
import { Glass } from './Glass';

export const Stat = ({ icon: Icon, label, value, change }: any) => (
  <Glass className="p-4">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">{label}</div>
        <div className="text-xl font-bold">{value}</div>
        {change && (
          <div className={"text-[10px] mt-1 " + (change.startsWith("+") ? "text-green-400" : "text-red-400")}>
            {change} <span className="text-white/30">vs last month</span>
          </div>
        )}
      </div>
      <div className="p-2 bg-red-900/20 rounded-lg text-red-400">
        {Icon && <Icon size={16} />}
      </div>
    </div>
  </Glass>
);
