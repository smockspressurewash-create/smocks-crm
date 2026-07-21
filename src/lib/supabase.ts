import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://boaqaihymgmrhnjtiqrs.supabase.co';
const supabaseAnonKey = 'sb_publishable_8aEa3wsYJ7ghVPcGbtHymw_ugj0aEfm';

// [GoogleConnect] — CRITICAL: this must run BEFORE createClient() below.
// createClient() is configured with detectSessionInUrl: true, which kicks
// off its OWN async parsing of window.location.hash the moment the client
// is constructed — and (per ResetPassword.tsx's own comments, confirming
// this is real, observed behavior) it clears the hash once it's done. Our
// app ALSO needs provider_token/provider_refresh_token out of that same
// hash — Google-specific fields Supabase's own session object does not
// reliably expose after the fact (App.tsx's applyGoogleIdentity has to read
// them from a raw hash string for exactly this reason). Whichever parser
// runs first can silently consume the hash before the other gets a look:
// if Supabase's internal async detection wins that race, the owner's
// browser lands back from Google's consent screen, the tokens vanish
// before App.tsx's own extraction effect ever fires, and Settings keeps
// showing "Not connected" with no error anywhere. Reading the raw hash
// synchronously here, at module load, before createClient() exists to
// start racing us, guarantees we always win.
if (typeof window !== "undefined" && window.location.hash.includes("provider_token")) {
  try {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const providerToken = params.get("provider_token");
    const providerRefreshToken = params.get("provider_refresh_token");
    if (providerToken) sessionStorage.setItem("smocks.gpt", providerToken);
    if (providerRefreshToken) sessionStorage.setItem("smocks.grt", providerRefreshToken);
    console.log("[GoogleConnect] pre-init hash bridge — provider_token captured:", !!providerToken, "· refresh_token captured:", !!providerRefreshToken);
  } catch (e: any) {
    console.warn("[GoogleConnect] pre-init hash bridge failed:", e?.message);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
