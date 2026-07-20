// PageFade.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";

// FIX 19 — className is optional and defaults to unset so every existing
// caller keeps its current (block, natural-height) layout; passed only for
// pages (Alfred) that need this wrapper to actually participate in a flex
// height chain instead of just sizing to its content.
export const PageFade = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 10); return () => clearTimeout(t); }, []);
  return (
    <div className={className} style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(10px)", transition: "opacity 0.3s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
      {children}
    </div>
  );
};

