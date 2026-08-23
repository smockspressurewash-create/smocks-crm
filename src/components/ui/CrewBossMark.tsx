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
// This exact layout (100x100 canvas, curved arms, letter position/size) was
// chosen by actually rendering candidates with Playwright and inspecting
// the pixels — prior rounds adjusted coordinates by calculation alone and
// kept clipping against the rounded corners or crossing behind the letters
// in ways that weren't caught until the user saw the real render.
export function CrewBossMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none">
      <g stroke="#ffffff" strokeWidth={7.5} strokeLinecap="round">
        <path d="M39 54 Q21 66 13 80" />
        <path d="M61 54 Q79 66 87 80" />
      </g>
      <circle cx="13" cy="80" r="5" fill="#ffffff" />
      <circle cx="87" cy="80" r="5" fill="#ffffff" />
      <circle cx="50" cy="22" r="9" fill="#ffffff" />
      <path d="M36 78 C36 55 42 46 50 46 C58 46 64 55 64 78 C64 87 58 90 50 90 C42 90 36 87 36 78 Z" fill="#ffffff" />
      <text x="12" y="72" fontFamily="Arial, Helvetica, sans-serif" fontWeight={900} fontSize={43} fill="#ffffff" textAnchor="middle">C</text>
      <text x="88" y="72" fontFamily="Arial, Helvetica, sans-serif" fontWeight={900} fontSize={43} fill="#ffffff" textAnchor="middle">B</text>
    </svg>
  );
}
