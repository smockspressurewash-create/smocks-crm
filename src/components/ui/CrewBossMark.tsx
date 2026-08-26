import React from "react";

// Brand mark. Kept as a single shared component (used across App.tsx's
// login/sidebar badges, EmployeePortal's login screen and header,
// ClientAuthPortal's login screen, and MarketingShared's nav/footer)
// instead of duplicating the same SVG in six places, since public/favicon.svg
// is a separate static asset (can't reference a React component) but should
// stay visually identical.
//
// BUG FIX — "fix the logo on the landing page." The previous design (a
// small person silhouette — head, body, legs — with "C"/"B" letters woven
// around it) was detailed enough that it needed real screen real estate to
// read as anything but a blob; every actual usage of this component renders
// it at 16–20px (nav badges, sidebar, login screens), the exact same size
// class that caused favicon.svg to need this identical simplification
// already (see that file's own BUG FIX comment — "doesn't fit fully,
// corners are cut off"). This never got applied here, so the mark still
// looked broken specifically where the icon was small enough to matter,
// including the landing page's nav. Matches favicon.svg's simple "C"+"B"
// wordmark exactly so the brand mark is now genuinely identical everywhere,
// not just intended to be.
export function CrewBossMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      <text x="32" y="68" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" fontWeight={800} fontSize={48} fill="#ffffff" textAnchor="middle">C</text>
      <text x="68" y="68" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" fontWeight={800} fontSize={48} fill="#dc2626" textAnchor="middle">B</text>
    </svg>
  );
}
