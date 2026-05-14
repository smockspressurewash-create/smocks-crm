// PBar.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";

export const PBar = ({ value, max }) => {
  const p = Math.min(100, (value / max) * 100);
  return <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-red-900/30"><div className="h-full bg-gradient-to-r from-red-500 to-red-700 rounded-full transition-all" style={{ width: p + "%" }} /></div>;
};

