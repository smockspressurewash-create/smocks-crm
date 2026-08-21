// ─── Stripe.js loader ──────────────────────────────────────────────────────────

let stripeJsPromise: Promise<any> | null = null;

export const loadStripeJs = (publishableKey: string): Promise<any> => {
  if (!stripeJsPromise) {
    stripeJsPromise = new Promise((resolve, reject) => {
      if ((window as any).Stripe) { resolve((window as any).Stripe); return; }
      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.onload = () => resolve((window as any).Stripe);
      script.onerror = () => reject(new Error("Failed to load Stripe.js"));
      document.head.appendChild(script);
    });
  }
  return stripeJsPromise.then(Stripe => Stripe(publishableKey));
};

// SECURITY AUDIT (round 12) — every function below used to take a `secretKey`
// and call api.stripe.com DIRECTLY FROM THE BROWSER with it. That secret key
// came from `settings.stripeSecretKeyEnc`, which is loaded into every
// session's settings object — including ClientPortal.tsx/ClientAuthPortal.tsx,
// the customer-facing payment pages. "Encrypted" there only meant XOR'd with
// a hardcoded salt shipped in the same bundle (lib/crypto.ts) — trivially
// reversible, handing full Stripe account access to any customer who opened
// a payment link. All of that now routes through functions/api/stripe-action.ts,
// a same-origin Cloudflare Function that holds the real secret key in an
// environment variable and never returns it to the client. Nothing in this
// file touches a Stripe secret key anymore — only the publishable key
// (loadStripeJs above), which is safe to expose by design.
const stripeAction = async (action: string, params: Record<string, any> = {}, accessToken?: string): Promise<any> => {
  const res = await fetch("/api/stripe-action", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data?.error || `Stripe error ${res.status}`);
  return data;
};

// ─── Per-owner Stripe account management (Settings → Integrations → Stripe) ──
// Secret key / webhook secret never round-trip through app_settings.data
// (loaded into every session including unauthenticated portals — see the
// round-12 audit note above) — these two calls are the ONLY place they're
// ever sent, straight to stripe-action.ts, which stores them in the
// service-role-only owner_stripe_accounts table and never returns them.

export interface OwnerStripeStatus {
  connected: boolean;
  stripeAccountId: string;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  publishableKey: string;
  mode: "test" | "live";
  webhookUrl: string;
}

export const getOwnerStripeStatus = async (accessToken: string): Promise<OwnerStripeStatus> =>
  stripeAction("get_owner_keys_status", {}, accessToken);

export const saveOwnerStripeKeys = async (
  accessToken: string,
  keys: { publishableKey?: string; secretKey?: string; webhookSecret?: string; mode?: "test" | "live" }
): Promise<void> => {
  await stripeAction("save_owner_keys", keys, accessToken);
};

// ─── Stripe Connect (OAuth) ────────────────────────────────────────────────
// "Connect with Stripe" — see functions/api/stripe-connect-oauth.ts. Gets
// the authorize URL, then the caller does `window.location.href = url`;
// Stripe redirects back to that same Function's GET handler, which saves
// the connected account id and redirects into #/settings.
export const getStripeConnectAuthorizeUrl = async (accessToken: string): Promise<string> => {
  const res = await fetch("/api/stripe-connect-oauth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action: "get_authorize_url" }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data?.error || `Stripe Connect error ${res.status}`);
  return data.url;
};

// ─── Owner-side saved-card management (Customer detail → Payment Methods) ──
// Owner-CRM-only — never exposed to ClientPortal/ClientAuthPortal. Requires
// the caller's own Supabase session token so stripe-action.ts can verify
// which business's Stripe account to query, same as the Settings save flow.

export interface StripeSavedCard { id: string; brand?: string; last4?: string; expMonth?: number; expYear?: number }

export const listCustomerPaymentMethods = async (accessToken: string, customerId: string): Promise<StripeSavedCard[]> => {
  const data = await stripeAction("list_payment_methods", { customerId }, accessToken);
  return data.paymentMethods || [];
};

export const detachPaymentMethod = async (accessToken: string, paymentMethodId: string): Promise<void> => {
  await stripeAction("detach_payment_method", { paymentMethodId }, accessToken);
};

// ─── Customer-facing "card on file" display (ClientAuthPortal.tsx) ────────
// Customer sessions are a separate Supabase auth realm from owner/employee
// ones and can't use listCustomerPaymentMethods above (that's gated to
// owner/employee callers only) — this is the customer-safe counterpart,
// verified server-side against the caller's own email, returning only
// their own single card.
export const getMySavedCard = async (accessToken: string): Promise<StripeSavedCard | null> => {
  const data = await stripeAction("get_my_saved_card", {}, accessToken);
  return data.card || null;
};

// ─── Payment Intents ───────────────────────────────────────────────────────────

export interface StripePaymentIntent {
  id: string;
  client_secret: string;
  status: string;
}

export const createPaymentIntent = async (
  amountCents: number,
  currency: string,
  description: string,
  metadata?: Record<string, string>
): Promise<StripePaymentIntent> =>
  stripeAction("create_payment_intent", {
    amountCents,
    currency,
    description,
    invoiceId: metadata?.invoiceId,
  });

export const retrievePaymentIntent = async (id: string): Promise<StripePaymentIntent> =>
  stripeAction("retrieve_payment_intent", { id });

// ─── Checkout Sessions (hosted checkout page) ─────────────────────────────────

export interface StripeCheckoutSession {
  id: string;
  url: string;
  payment_status: string;
  payment_intent?: string;
}

export const createCheckoutSession = async (
  opts: { amountCents: number; currency: string; description: string; successUrl: string; cancelUrl: string; customerEmail?: string; invoiceId?: string }
): Promise<StripeCheckoutSession> =>
  stripeAction("create_checkout_session", opts);

export const retrieveCheckoutSession = async (sessionId: string): Promise<StripeCheckoutSession> =>
  stripeAction("retrieve_checkout_session", { sessionId });

// ─── Customers + saved payment methods (for the client portal) ───────────────

export interface StripeCustomerObj { id: string; email?: string; name?: string }

export const createStripeCustomer = async (email: string, name: string): Promise<StripeCustomerObj> =>
  stripeAction("create_customer", { email, name });

export interface StripeSetupIntent { id: string; client_secret: string; status: string }

export const createSetupIntent = async (customerId: string): Promise<StripeSetupIntent> =>
  stripeAction("create_setup_intent", { customerId });

export const chargeSavedPaymentMethod = async (
  customerId: string,
  paymentMethodId: string,
  amountCents: number,
  currency: string,
  description: string,
  invoiceId?: string,
  // MULTI-TENANT (Phase F) — which business's Stripe secret key to charge
  // with. stripe-action.ts resolves invoiceId's own owner_id first (never
  // trusts the client) and only falls back to this when no invoiceId is
  // given — e.g. the trash-can inconvenience fee charge, which has no
  // invoice yet at charge time. Callers running from an employee session
  // (whose own Supabase session isn't necessarily the OWNER's) must pass the
  // job/customer's owner_id explicitly here so the right business gets
  // charged instead of silently falling back to the platform-wide key.
  ownerId?: string
): Promise<StripePaymentIntent> =>
  stripeAction("charge_saved_payment_method", { customerId, paymentMethodId, amountCents, currency, description, invoiceId, ownerId });

export const refundPaymentIntent = async (paymentIntentId: string): Promise<void> => {
  await stripeAction("refund", { paymentIntentId });
};
