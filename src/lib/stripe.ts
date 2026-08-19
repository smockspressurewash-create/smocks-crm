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
const stripeAction = async (action: string, params: Record<string, any> = {}): Promise<any> => {
  const res = await fetch("/api/stripe-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data?.error || `Stripe error ${res.status}`);
  return data;
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
  invoiceId?: string
): Promise<StripePaymentIntent> =>
  stripeAction("charge_saved_payment_method", { customerId, paymentMethodId, amountCents, currency, description, invoiceId });

export const refundPaymentIntent = async (paymentIntentId: string): Promise<void> => {
  await stripeAction("refund", { paymentIntentId });
};
