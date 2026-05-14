// Glass.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";

export const Glass = ({ children, className = "", ...r }) => <div className={"glass-hover bg-black/40 backdrop-blur-xl border border-red-900/30 rounded-2xl shadow-lg " + className} {...r}>{children}</div>;

const GBtn = ({ children, onClick, variant = "primary", className = "", disabled, ...r }) => {
  const v = {
    primary: "bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white border-red-500/50",
    ghost: "bg-white/5 hover:bg-white/10 text-white border-white/10",
    danger: "bg-red-950/50 hover:bg-red-900/60 text-red-200 border-red-800/50"
  };
  return <button type="button" disabled={disabled} onClick={onClick} className={v[variant] + " btn-hover backdrop-blur-md border rounded-xl px-4 py-2 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed " + className} {...r}>{children}</button>;
};

