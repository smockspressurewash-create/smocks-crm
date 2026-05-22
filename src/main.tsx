import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { supabase } from "./lib/supabase";
import "./index.css";

(async () => {
  await supabase.auth.initialize();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
})();
