// Shared outbound fetch with a time limit (same approach as call-model.ts).
// BUG FIX (audit 2026-11-17) — calls to Twilio, Stripe, Google and the
// geocoder had no time limit, so a stuck provider left the request hanging
// until Cloudflare killed it. A timeout now throws an error the caller
// already handles, never a silent success.
export const DEFAULT_FETCH_TIMEOUT_MS = 15000;

export const fetchWithTimeout = async (url: string, opts: RequestInit = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      let host = "provider";
      try { host = new URL(url).hostname; } catch { /* keep generic name */ }
      throw new Error(`Request to ${host} timed out.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};
