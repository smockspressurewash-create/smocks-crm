import React from "react";

// Brand mark: a stick-figure mascot with arms raised, holding the "C" and
// "B" letters like handles — replaces the earlier plain spray-arc mark
// (itself a replacement for literal "CB" text) per explicit feedback that
// the logo should have a character, not just letters. Kept as a single
// shared component (used in App.tsx's login/sidebar badges, EmployeePortal's
// header, and MarketingShared's nav/footer) instead of duplicating the same
// SVG in five places, since public/favicon.svg is a separate static asset
// (can't reference a React component) but should stay visually identical.
export function CrewBossMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <g stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="32" cy="19" r="6.5" fill="#ffffff" stroke="none" />
        <path d="M32 26 L32 41" />
        <path d="M32 41 L23 57" />
        <path d="M32 41 L41 57" />
        <path d="M32 29 L16 19" />
        <path d="M32 29 L48 19" />
      </g>
      <text x="12" y="25" fontFamily="Arial, Helvetica, sans-serif" fontWeight={900} fontSize={17} fill="#ffffff" textAnchor="middle">C</text>
      <text x="52" y="25" fontFamily="Arial, Helvetica, sans-serif" fontWeight={900} fontSize={17} fill="#ffffff" textAnchor="middle">B</text>
    </svg>
  );
}
