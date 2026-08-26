// ─── Square Web Payments SDK loader ────────────────────────────────────────────
// Mirrors lib/stripe.ts's loadStripeJs exactly — same lazy-singleton-promise
// pattern, same "load the real vendor SDK once, reuse it" shape. Square's
// access token/location id never reach the browser; everything server-side
// goes through functions/api/square-action.ts (same-origin proxy, same
// reasoning as stripe-action.ts's own security-audit comment).

// No sandbox mode — always the real Square Web Payments SDK, same as Stripe
// (which has never had a test-mode switch here either). One real charge
// path, not a test one that silently doesn't move money.
let squareSdkPromise: Promise<any> | null = null;

export const loadSquareJs = (): Promise<any> => {
  if (!squareSdkPromise) {
    squareSdkPromise = new Promise((resolve, reject) => {
      if ((window as any).Square) { resolve((window as any).Square); return; }
      const script = document.createElement("script");
      script.src = "https://web.squarecdn.com/v1/square.js";
      script.onload = () => resolve((window as any).Square);
      script.onerror = () => reject(new Error("Failed to load Square Web Payments SDK"));
      document.head.appendChild(script);
    });
  }
  return squareSdkPromise;
};

const squareAction = async (action: string, body: Record<string, unknown>): Promise<any> => {
  let authHeader: string | undefined;
  try {
    const { supabase } = await import("./supabase");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) authHeader = `Bearer ${session.access_token}`;
  } catch { /* anonymous customer — no session, fine for public actions */ }
  const res = await fetch("/api/square-action", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authHeader ? { Authorization: authHeader } : {}) },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || data?.error) throw new Error(data?.error || `Square error ${res.status}`);
  return data;
};

export interface SquarePublicConfig {
  connected: boolean;
  applicationId?: string;
  locationId?: string;
  mode?: "sandbox" | "production";
}

// Public — safe for an anonymous customer page to call (no secret involved,
// same trust level as fetching a Stripe publishable key).
export const getPublicSquareConfig = (ownerId: string): Promise<SquarePublicConfig> =>
  squareAction("get_public_square_config", { ownerId });

export const createSquarePayment = (opts: { sourceId: string; invoiceId?: string; amountCents?: number; tipCents?: number; description?: string; ownerId?: string }): Promise<{ id: string; status: string }> =>
  squareAction("create_payment", opts);

// Owner-authenticated Settings actions.
export const getOwnerSquareStatus = (accessToken: string) =>
  fetch("/api/square-action", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action: "get_owner_square_status" }),
  }).then(r => r.json());

export const saveOwnerSquareKeys = (accessToken: string, opts: { squareAccessToken?: string; squareLocationId?: string; squareApplicationId?: string; mode?: "sandbox" | "production" }) =>
  fetch("/api/square-action", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action: "save_owner_square_keys", ...opts }),
  }).then(r => r.json());
