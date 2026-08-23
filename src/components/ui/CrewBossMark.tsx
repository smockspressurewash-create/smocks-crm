import React from "react";

// Brand mark: a flat rounded mascot silhouette (matching the reference
// avatar style — solid head + shoulders, no thin stick-figure lines) with
// arms reaching down to hands holding up the large "C" and "B" letters.
// Kept as a single shared component (used in App.tsx's login/sidebar
// badges, EmployeePortal's header, and MarketingShared's nav/footer)
// instead of duplicating the same SVG in five places, since
// public/favicon.svg is a separate static asset (can't reference a React
// component) but should stay visually identical.
//
// Canvas is 88x88, not 64x64 — the letters were clipping against a 64
// viewBox's own edges once they got large/spread enough to look right, so
// the whole canvas was widened (not just the letter positions) to give them
// room to sit farther from the body and get bigger without clipping.
export function CrewBossMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 88 88" className={className} fill="none">
      <g stroke="#ffffff" strokeWidth={8.9} strokeLinecap="round">
        <path d="M34 42 L12 58" fill="none" />
        <path d="M54 42 L76 58" fill="none" />
      </g>
      <circle cx="12" cy="58" r="5.8" fill="#ffffff" />
      <circle cx="76" cy="58" r="5.8" fill="#ffffff" />
      <circle cx="44" cy="22" r="8.9" fill="#ffffff" />
      <path d="M31.6 63.3 C31.6 45.4 37.1 38.5 44 38.5 C50.9 38.5 56.4 45.4 56.4 63.3 C56.4 70.1 50.9 72.9 44 72.9 C37.1 72.9 31.6 70.1 31.6 63.3 Z" fill="#ffffff" />
      <text x="12" y="58" fontFamily="Arial, Helvetica, sans-serif" fontWeight={900} fontSize={38} fill="#ffffff" textAnchor="middle">C</text>
      <text x="76" y="58" fontFamily="Arial, Helvetica, sans-serif" fontWeight={900} fontSize={38} fill="#ffffff" textAnchor="middle">B</text>
    </svg>
  );
}
