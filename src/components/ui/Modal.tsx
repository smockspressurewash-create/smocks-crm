// Modal.tsx — auto-extracted from monolith
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export const Modal = ({ open, onClose, title, children, maxW = "max-w-lg", noBodyScroll = false }) => {
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
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  if (!mounted) return null;

  const backdropStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 300,
    background: visible ? "rgba(0,0,0,0.78)" : "rgba(0,0,0,0)",
    backdropFilter: visible ? "blur(12px) saturate(0.7)" : "blur(0px)",
    WebkitBackdropFilter: visible ? "blur(12px) saturate(0.7)" : "blur(0px)",
    transition: "background 0.25s ease, backdrop-filter 0.25s ease",
  };

  const scrollWrapStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 301,
    overflowY: "auto",
    padding: "24px 16px",
  };

  const cardStyle: React.CSSProperties = {
    transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.97)",
    opacity: visible ? 1 : 0,
    transition: "transform 0.26s cubic-bezier(0.16,1,0.3,1), opacity 0.2s ease",
    boxShadow: "0 32px 96px rgba(0,0,0,0.9), 0 0 0 1px rgba(220,38,38,0.2)",
    ...(noBodyScroll ? { height: "85vh" } : { maxHeight: "90vh" }),
  };

  const modal = (
    <>
      {/* Backdrop — blur + dark overlay */}
      <div style={backdropStyle} onClick={onClose} />

      {/* Scroll container — transparent, sits above backdrop, scrolls when card is tall */}
      <div style={scrollWrapStyle} onClick={onClose}>
        <div style={{ display: "flex", minHeight: "100%", alignItems: "center", justifyContent: "center" }}>
          <div
            className={maxW + " w-full bg-gradient-to-br from-neutral-950 to-black border border-red-900/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden"}
            style={cardStyle}
            onClick={e => e.stopPropagation()}
          >
            {title !== "" && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-red-900/30 flex-shrink-0">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <button
                  onClick={onClose}
                  className="text-white/60 hover:text-white transition-all duration-200 hover:rotate-90 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            {noBodyScroll
              ? <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
              : <div className="p-5 overflow-y-auto flex-1 min-h-0">{children}</div>
            }
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
};
