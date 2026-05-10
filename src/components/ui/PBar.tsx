import React from 'react';

export const PBar = ({ value, max }: any) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
      <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-500" style={{ width: pct + "%" }} />
    </div>
  );
};
