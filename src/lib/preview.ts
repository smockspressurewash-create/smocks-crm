import { supabase } from "./supabase";

// Alfred Cockpit previews are Cloudflare branch deployments
// (https://cockpit-xxxxxxxx.smocks-crm.pages.dev). In a preview the app:
//  - signs the owner in from a one-time token in the link (?th=…), because a
//    preview is a different web address and can't see the live app's sign-in,
//  - opens straight on the screen the change is about (?go=/customers),
//  - skips first-run pop-ups (onboarding, setup checklist, product tour,
//    notification prompts) so the change is what you see,
//  - shows a small "Preview" bar with a way back to the Cockpit.
// cockpit-*.localhost = the same, for local browser checks (scripts/e2e/cockpit-preview.cjs).
export const IS_PREVIEW = typeof location !== "undefined"
  && ((/\.smocks-crm\.pages\.dev$/.test(location.hostname) && location.hostname !== "smocks-crm.pages.dev")
    || /^cockpit-[a-z0-9-]+\.localhost$/.test(location.hostname));

export const LIVE_COCKPIT_URL = "https://smocks-crm.pages.dev/#/cockpit";

export const needsPreviewSignIn = () => IS_PREVIEW && new URLSearchParams(location.search).has("th");

// Run before the app renders. Always cleans the token out of the address bar.
export async function completePreviewSignIn(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const tokenHash = params.get("th") || "";
  const go = (params.get("go") || "").replace(/^#?\/?/, "");
  try {
    // Drop any session left from an earlier preview of a different account.
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (error) console.error("[Preview] sign-in link failed:", error.message);
  } catch (e: any) {
    console.error("[Preview] sign-in threw:", e?.message);
  } finally {
    history.replaceState(null, "", location.pathname + (go ? "#/" + go : location.hash || "#/dashboard"));
  }
}
