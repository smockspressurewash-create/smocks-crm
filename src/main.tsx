import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { supabase } from "./lib/supabase";
import "./index.css";

(async () => {
  // Must never block the app from rendering — if this hangs (network issue, an
  // ad-blocker/privacy extension blocking *.supabase.co, a CORS hiccup) or
  // throws, React must still mount. A previous version awaited this with no
  // timeout and no catch, so a stuck/rejected promise here meant nothing ever
  // rendered at all: no React, no console logs, no error — just a black page.
  try {
    await Promise.race([
      supabase.auth.initialize(),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);
  } catch (err) {
    console.error("supabase.auth.initialize() failed:", err);
  }
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
})();
