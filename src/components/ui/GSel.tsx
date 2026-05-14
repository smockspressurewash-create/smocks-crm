// GSel.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";

export const GSel = ({ className = "", children, ...r }) => <select className={"w-full bg-black/40 backdrop-blur-md border border-red-900/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500/60 transition-all duration-200 " + className} {...r}>{children}</select>;
const GTxt = ({ className = "", ...r }) => <textarea className={"w-full bg-black/40 backdrop-blur-md border border-red-900/30 rounded-xl px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-red-500/60 transition-all duration-200 resize-none " + className} {...r} />;

// Inject CSS into document.head — works in artifact sandbox unlike <style> tags in JSX
const useGlobalStyles = () => {
  useEffect(() => {
    const id = "smocks-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      @keyframes smockFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      @keyframes smockPulse { 0%,100%{opacity:.5} 50%{opacity:1} }
      @keyframes smockSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes smockFadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      @keyframes smockSlideRight { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
      @keyframes smockScale { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
      @keyframes smockShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      @keyframes smockToastIn { from{opacity:0;transform:translateX(110%)} to{opacity:1;transform:translateX(0)} }
      @keyframes smockGlow { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0)} 50%{box-shadow:0 0 20px 4px rgba(220,38,38,.15)} }
      .anim-float { animation: smockFloat 5s ease-in-out infinite; }
      .anim-pulse { animation: smockPulse 2s ease-in-out infinite; }
      .anim-spin-slow { animation: smockSpin 10s linear infinite; }
      .anim-fade-up { animation: smockFadeUp .4s cubic-bezier(.16,1,.3,1) both; }
      .anim-slide-right { animation: smockSlideRight .3s cubic-bezier(.16,1,.3,1) both; }
      .anim-scale { animation: smockScale .25s cubic-bezier(.34,1.4,.64,1) both; }
      .anim-toast { animation: smockToastIn .35s cubic-bezier(.16,1,.3,1) both; }
      .anim-glow { animation: smockGlow 2.5s ease-in-out infinite; }
      .glass-hover { transition: border-color .2s,box-shadow .2s,transform .15s; }
      .glass-hover:hover { box-shadow: 0 0 0 1px rgba(220,38,38,.3), 0 8px 32px -8px rgba(0,0,0,.9); border-color: rgba(220,38,38,.4) !important; }
      .glass-hover:active { transform: scale(.997); }
      .btn-hover { transition: transform .15s, box-shadow .15s; }
      .btn-hover:hover { transform: translateY(-1px); box-shadow: 0 4px 20px -4px rgba(220,38,38,.4); }
      .btn-hover:active { transform: scale(.97); }
      .shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,.06), transparent); background-size: 200%; animation: smockShimmer 2s infinite; }
      ::-webkit-scrollbar { width: 3px; height: 3px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(220,38,38,.35); border-radius: 2px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(220,38,38,.6); }
      input[type=date]::-webkit-calendar-picker-indicator { filter:invert(1); opacity:.6; }
      input[type=range] { accent-color: #dc2626; }
      input[type=checkbox] { accent-color: #dc2626; }
    `;
    document.head.appendChild(el);
    return () => { /* keep it — no cleanup needed */ };
  }, []);
};

// Page transition wrapper — fade-in-up on page change
