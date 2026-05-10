import React from 'react';
import { TIMEFRAMES } from '../../lib/utils';

export const TimeframeSelector = ({ value, onChange, options = ["7d", "30d", "90d", "6m", "1y", "all"], compact = false }: any) => {
  return (
    <div className={"flex gap-0.5 bg-black/40 border border-red-900/30 rounded-xl p-1 " + (compact ? "h-8 items-center" : "")}>
      {options.map(opt => {
        const tf = TIMEFRAMES.find(t => t.key === opt);
        const a = value === opt;
        return (
          <button key={opt} onClick={() => onChange(opt)} className={"px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition " + (a ? "bg-red-600/30 text-white" : "text-white/40 hover:text-white")}>
            {tf?.label || opt}
          </button>
        );
      })}
    </div>
  );
};
