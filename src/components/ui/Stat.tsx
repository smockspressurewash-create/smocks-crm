// @ts-nocheck
// Stat.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Search, TrendingUp, DollarSign, Clock, CheckCircle, AlertTriangle, AlertCircle, Star, Target, BarChart3 } from "lucide-react";

export const Stat = ({ icon: Icon, label, value, change }) => (
  <div className="glass-hover bg-black/40 backdrop-blur-xl border border-red-900/30 rounded-2xl shadow-lg p-5 relative overflow-hidden group cursor-default">
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: "radial-gradient(ellipse at top right, rgba(220,38,38,0.08), transparent 70%)" }} />
    <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-red-600/8 group-hover:bg-red-600/15 transition-all duration-700 group-hover:scale-150" />
    <div className="relative flex items-center justify-between mb-3">
      <div className="p-2 rounded-lg bg-gradient-to-br from-red-600 to-red-900 shadow-lg transition-all duration-300 group-hover:shadow-red-600/40 group-hover:scale-110">
        <Icon size={18} className="text-white" />
      </div>
      {change && <span className="text-xs text-red-400 font-medium flex items-center gap-1"><TrendingUp size={12} />{change}</span>}
    </div>
    <div className="relative text-2xl font-bold text-white tabular-nums">{value}</div>
    <div className="relative text-xs text-white/50 mt-1">{label}</div>
  </div>
);

