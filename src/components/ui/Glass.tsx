import React from 'react';

export const Glass = ({ children, className = "", ...r }: any) => (
  <div className={"glass-hover bg-black/40 backdrop-blur-xl border border-red-900/30 rounded-2xl shadow-lg " + className} {...r}>{children}</div>
);

export const GBtn = ({ children, onClick, variant = "primary", className = "", disabled, ...r }: any) => {
  const v: any = {
    primary: "bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white border-red-500/50",
    ghost: "bg-white/5 hover:bg-white/10 text-white border-white/10",
    danger: "bg-red-950/50 hover:bg-red-900/60 text-red-200 border-red-800/50"
  };
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={v[variant] + " btn-hover backdrop-blur-md border rounded-xl px-4 py-2 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed " + className} {...r}>
      {children}
    </button>
  );
};

export const GInput = ({ className = "", ...r }: any) => (
  <input className={"w-full bg-black/40 backdrop-blur-md border border-red-900/30 rounded-xl px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all duration-200 " + className} {...r} />
);

export const GDate = ({ className = "", ...r }: any) => (
  <input type="date" className={"w-full bg-black/40 backdrop-blur-md border border-red-900/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500/60 transition-all duration-200 [color-scheme:dark] " + className} {...r} />
);

export const GSel = ({ className = "", children, ...r }: any) => (
  <select className={"w-full bg-black/40 backdrop-blur-md border border-red-900/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500/60 transition-all duration-200 " + className} {...r}>{children}</select>
);

export const GTxt = ({ className = "", ...r }: any) => (
  <textarea className={"w-full bg-black/40 backdrop-blur-md border border-red-900/30 rounded-xl px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-red-500/60 transition-all duration-200 resize-none " + className} {...r} />
);
