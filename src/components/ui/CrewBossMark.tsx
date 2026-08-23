import React from "react";

// Brand mark: a flat rounded mascot silhouette (matching the reference
// avatar style — solid head + shoulders, no thin stick-figure lines) with
// large, high-contrast "C" and "B" letters at its sides. Kept as a single
// shared component (used in App.tsx's login/sidebar badges, EmployeePortal's
// header, and MarketingShared's nav/footer) instead of duplicating the same
// SVG in five places, since public/favicon.svg is a separate static asset
// (can't reference a React component) but should stay visually identical.
export function CrewBossMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      <circle cx="32" cy="16" r="6.5" fill="#ffffff" />
      <path d="M23 46 C23 33 27 28 32 28 C37 28 41 33 41 46 C41 51 37 53 32 53 C27 53 23 51 23 46 Z" fill="#ffffff" />
      <text x="12" y="40" fontFamily="Arial, Helvetica, sans-serif" fontWeight={900} fontSize={24} fill="#ffffff" textAnchor="middle">C</text>
      <text x="52" y="40" fontFamily="Arial, Helvetica, sans-serif" fontWeight={900} fontSize={24} fill="#ffffff" textAnchor="middle">B</text>
    </svg>
  );
}
