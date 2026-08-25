import React from "react";

// Brand mark. Kept as a single shared component (used across App.tsx's
// login/sidebar badges, EmployeePortal's login screen and header,
// ClientAuthPortal's login screen, and MarketingShared's nav/footer)
// instead of duplicating the same SVG in six places, since public/favicon.svg
// is a separate static asset (can't reference a React component) but should
// stay visually identical.
//
// This layout (person narrower, arms hanging at the sides instead of
// reaching toward the letters) was chosen after actually rendering
// candidates with Playwright and inspecting the pixels — every earlier
// version where the arms/hands reached for the letters kept reading as "the
// letters are touching the person" regardless of how the letters themselves
// were sized/positioned. Verified clearance from the person on both sides
// and zero clipping against the SVG's own bounds before finalizing.
export function CrewBossMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none">
      <g stroke="#ffffff" strokeWidth={6} strokeLinecap="round">
        <path d="M43 58 L37 76" />
        <path d="M57 58 L63 76" />
      </g>
      <circle cx="50" cy="26" r="8" fill="#ffffff" />
      <path d="M40 74 C40 54 44 48 50 48 C56 48 60 54 60 74 C60 82 56 85 50 85 C44 85 40 82 40 74 Z" fill="#ffffff" />
      <text x="12" y="70" fontFamily="Arial, Helvetica, sans-serif" fontWeight={900} fontSize={43} fill="#ffffff" textAnchor="middle">C</text>
      <text x="88" y="70" fontFamily="Arial, Helvetica, sans-serif" fontWeight={900} fontSize={43} fill="#ffffff" textAnchor="middle">B</text>
    </svg>
  );
}
