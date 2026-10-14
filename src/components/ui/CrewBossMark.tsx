import React, { useId } from "react";

// Brand mark — the CB monogram (white C, red B on a dark rounded tile).
// It is the whole app icon, tile included, so call sites render it on its
// own at the size they want (no red badge around it). public/favicon.svg,
// public/favicon-maskable.svg and the icon-*.png files are the same drawing
// as static assets (they can't import a React component) — keep them in
// sync if this changes.
export function CrewBossMark({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="CrewBoss">
      <defs>
        <linearGradient id={`cb-tile-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d1d22" />
          <stop offset="1" stopColor="#0a0a0c" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill={`url(#cb-tile-${id})`} />
      <rect x="1" y="1" width="98" height="98" rx="23" fill="none" stroke="#ffffff" strokeOpacity="0.09" strokeWidth="2" />
      <path d="M45.6 36.4 A17.5 17.5 0 1 0 45.6 63.6" fill="none" stroke="#ffffff" strokeWidth="9.5" strokeLinecap="round" />
      <path d="M58 32.5 V67.5 M58 32.5 H65.5 A7.9 7.9 0 0 1 65.5 48.3 H58 M58 48.3 H67 A9.6 9.6 0 0 1 67 67.5 H58" fill="none" stroke="#ef2b2b" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
