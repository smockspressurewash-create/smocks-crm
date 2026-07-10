import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { supabase } from "./lib/supabase";
import "./index.css";

// Mount immediately — React renders from cached (localStorage) state right
// away; auth resolves in the background via App.tsx's own onAuthStateChange
// listener and getSession() call. This used to `await` (with a 3s timeout
// fallback) supabase.auth.initialize() before the FIRST render() call, which
// meant an unstyled, un-mounted #root against the near-black body background
// (index.css `background: #050505`) for up to 3 seconds on every reload — a
// real, visible black-screen delay, not a perceived one. Firing it without
// awaiting removes that delay entirely; any failure is just logged, never
// blocks rendering.
supabase.auth.initialize().catch(err => console.error("supabase.auth.initialize() failed:", err));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
