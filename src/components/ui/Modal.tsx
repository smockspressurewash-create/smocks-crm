// @ts-nocheck
// Modal.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Search, TrendingUp, DollarSign, Clock, CheckCircle, AlertTriangle, AlertCircle, Star, Target, BarChart3 } from "lucide-react";

export const Modal = ({ open, onClose, title, children, maxW = "max-w-lg" }) => {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const t = setTimeout(() => setVisible(true), 16);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  if (!mounted) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: visible ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(8px) saturate(0.8)" : "blur(0px)",
        WebkitBackdropFilter: visible ? "blur(8px) saturate(0.8)" : "blur(0px)",
        transition: "background 0.25s ease, backdrop-filter 0.25s ease"
      }}
      onClick={onClose}
    >
      <div
        className={maxW + " w-full bg-gradient-to-br from-neutral-950 to-black border border-red-900/40 rounded-2xl shadow-2xl flex flex-col"}
        style={{
          maxHeight: "90vh",
          transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.97)",
          opacity: visible ? 1 : 0,
          transition: "transform 0.28s cubic-bezier(0.34,1.2,0.64,1), opacity 0.22s ease",
          boxShadow: "0 25px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(220,38,38,0.15)"
        }}
        onClick={e => e.stopPropagation()}
      >
        {title !== "" && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-red-900/30 flex-shrink-0">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-all duration-200 hover:rotate-90 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"><X size={18} /></button>
          </div>
        )}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

