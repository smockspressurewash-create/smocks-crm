import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://boaqaihymgmrhnjtiqrs.supabase.co';
const supabaseAnonKey = 'sb_publishable_8aEa3wsYJ7ghVPcGbtHymw_ugj0aEfm';

// [GoogleConnect] — after four rounds of trying to make the React-side
// onAuthStateChange/applyGoogleIdentity flow the single source of truth (a
// closure flag, then checking `prev` inside the setState updater, then
// guarding the app_settings sync merges) and STILL seeing a second SIGNED_IN
// event with no provider_token win the race in real testing, this abandons
// that entirely. React state, onAuthStateChange, and resolveUserRole() all
// sit behind at least one await — and this codebase's own extensive comments
// elsewhere document Supabase auth calls (getSession, onAuthStateChange
// handlers awaiting a Postgrest role lookup) hanging or resolving out of
// order under real-world navigator-lock/network conditions. Any fix that
// depends on "whichever event's async chain finishes first" is fragile by
// construction, no matter how carefully the merge logic is written.
// localStorage, read/written synchronously with no await anywhere in the
// path, has no such race to lose. This block is the ENTIRE mechanism now:
// it runs at module load, before React mounts and before createClient()
// below even exists to kick off its own async detectSessionInUrl hash
// parsing — nothing else needs to run first, and nothing async can beat it.
const GOOGLE_TOKEN_KEY = "crew_google_provider_token";
const GOOGLE_REFRESH_KEY = "crew_google_refresh_token";
const GOOGLE_EMAIL_KEY = "crew_google_email";
const GOOGLE_EXPIRES_KEY = "crew_google_token_expires_at";

// Google's OAuth access_token Supabase hands back is a plain JWT with the
// user's email in its payload — decoding it is a pure base64 string op, not
// a network call, so we can learn the email with zero dependency on a
// session ever being established.
function decodeEmailFromJwt(jwt: string): string {
  try {
    const payload = jwt.split(".")[1];
    const json = JSON.parse(decodeURIComponent(escape(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))));
    return json.email || json.user_metadata?.email || "";
  } catch {
    return "";
  }
}

if (typeof window !== "undefined" && window.location.hash.includes("provider_token")) {
  try {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const providerToken = params.get("provider_token");
    const providerRefreshToken = params.get("provider_refresh_token");
    const accessToken = params.get("access_token");
    if (providerToken) {
      localStorage.setItem(GOOGLE_TOKEN_KEY, providerToken);
      localStorage.setItem(GOOGLE_EXPIRES_KEY, String(Date.now() + 55 * 60 * 1000));
      // Kept alongside for App.tsx's existing settings-object flow (Alfred,
      // invoice sends, etc. still read settings.googleProviderToken) — this
      // is a secondary consumer now, not the source of truth.
      sessionStorage.setItem("smocks.gpt", providerToken);
    }
    if (providerRefreshToken) {
      localStorage.setItem(GOOGLE_REFRESH_KEY, providerRefreshToken);
      sessionStorage.setItem("smocks.grt", providerRefreshToken);
    }
    if (accessToken) {
      const email = decodeEmailFromJwt(accessToken);
      if (email) localStorage.setItem(GOOGLE_EMAIL_KEY, email);
    }
    console.log("[GoogleConnect] localStorage bridge (pre-React) — provider_token saved:", !!providerToken, "· refresh_token saved:", !!providerRefreshToken, "· email:", localStorage.getItem(GOOGLE_EMAIL_KEY) || "(not decoded)");
  } catch (e: any) {
    console.warn("[GoogleConnect] localStorage bridge failed:", e?.message);
  }
}

// Authoritative read for "is Google connected" — Settings and any send-time
// code should call this instead of trusting settings.googleConnected/React
// state. Plain synchronous localStorage reads, nothing to race.
export function getStoredGoogleConnection(): { token: string; refreshToken: string; email: string; expiresAt: number } | null {
  try {
    const token = localStorage.getItem(GOOGLE_TOKEN_KEY) || "";
    if (!token) return null;
    return {
      token,
      refreshToken: localStorage.getItem(GOOGLE_REFRESH_KEY) || "",
      email: localStorage.getItem(GOOGLE_EMAIL_KEY) || "",
      expiresAt: Number(localStorage.getItem(GOOGLE_EXPIRES_KEY)) || 0,
    };
  } catch {
    return null;
  }
}

export function setStoredGoogleToken(token: string, expiresAt: number): void {
  try {
    localStorage.setItem(GOOGLE_TOKEN_KEY, token);
    localStorage.setItem(GOOGLE_EXPIRES_KEY, String(expiresAt));
    console.log("[GoogleConnect] setStoredGoogleToken — refreshed token saved to localStorage");
  } catch (e: any) {
    console.warn("[GoogleConnect] setStoredGoogleToken failed:", e?.message);
  }
}

// Only the owner clicking "Disconnect Google Account" should ever call this.
export function clearStoredGoogleConnection(): void {
  try {
    localStorage.removeItem(GOOGLE_TOKEN_KEY);
    localStorage.removeItem(GOOGLE_REFRESH_KEY);
    localStorage.removeItem(GOOGLE_EMAIL_KEY);
    localStorage.removeItem(GOOGLE_EXPIRES_KEY);
    console.log("[GoogleConnect] clearStoredGoogleConnection — all google localStorage keys cleared");
  } catch (e: any) {
    console.warn("[GoogleConnect] clearStoredGoogleConnection failed:", e?.message);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
