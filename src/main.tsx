import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { supabase } from "./lib/supabase";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import "./index.css";

// AUDIT 1 — the only ErrorBoundary in the app previously lived INSIDE App.tsx
// wrapping just the routed CRM page content (<SafePage>). Every other render
// path — the header/sidebar/notifications shell around it, plus the early
// `return <EmployeePortal/>` / <ClientAuthPortal/> / <ReferralLanding/> /
// <CustomerReviewPage/> / <ResetPassword/> branches in App.tsx that run
// BEFORE that boundary is ever reached — had nothing catching a thrown error.
// React unmounts the whole tree on an uncaught render error, and index.css
// sets the page background to near-black (#050505), so any one of those
// throwing produced exactly a silent black screen with only a console error.
// Wrapping the single root render call here is the one change that protects
// every path at once, including ones added in the future.
window.addEventListener("error", (e) => console.error("[Boot] window error:", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => console.error("[Boot] unhandled promise rejection:", e.reason));

// Mount immediately — React renders from cached (localStorage) state right
// away; auth resolves in the background via App.tsx's own onAuthStateChange
// listener and getSession() call. This used to `await` (with a 3s timeout
// fallback) supabase.auth.initialize() before the FIRST render() call, which
// meant an unstyled, un-mounted #root against the near-black body background
// (index.css `background: #050505`) for up to 3 seconds on every reload — a
// real, visible black-screen delay, not a perceived one. Firing it without
// awaiting removes that delay entirely; any failure is just logged, never
// blocks rendering.
supabase.auth.initialize().catch(err => console.error("[Boot] supabase.auth.initialize() failed:", err));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
