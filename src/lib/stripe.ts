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

// ─── Payment Intents (direct from browser) ────────────────────────────────────
// NOTE: this calls the Stripe API directly from the browser using the secret key,
// the same direct-from-browser pattern this codebase already uses for Twilio
// (see lib/messaging.ts twilioSend). That means the secret key is reachable from
// the browser session it's configured in. It is NOT safe for a multi-tenant or
// public-facing deployment — a real backend should create payment intents. This
// is the "no backend yet" tradeoff explicitly accepted for this app.

export interface StripePaymentIntent {
  id: string;
  client_secret: string;
  status: string;
}

export const createPaymentIntent = async (
  secretKey: string,
  amountCents: number,
  currency: string,
  description: string,
  metadata?: Record<string, string>
): Promise<StripePaymentIntent> => {
  const body = new URLSearchParams({
    amount: String(Math.round(amountCents)),
    currency,
    description,
    "automatic_payment_methods[enabled]": "true",
  });
  // FIX 1 (mobile round 8) — metadata.invoiceId is how the server-side
  // stripe-webhook function (functions/api/stripe-webhook.ts) knows which
  // invoice a payment_intent.succeeded event belongs to, so it can mark that
  // invoice paid itself instead of trusting the client's own claim.
  if (metadata) Object.entries(metadata).forEach(([k, v]) => body.set(`metadata[${k}]`, v));
  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(secretKey + ":")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Stripe error ${res.status}`);
  }
  return res.json();
};

export const retrievePaymentIntent = async (secretKey: string, id: string): Promise<StripePaymentIntent> => {
  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${id}`, {
    headers: { Authorization: `Basic ${btoa(secretKey + ":")}` },
  });
  if (!res.ok) throw new Error(`Stripe error ${res.status}`);
  return res.json();
};

// ─── Checkout Sessions (hosted checkout page) ─────────────────────────────────
// Alternative to the embedded Payment Element flow above: creates a Checkout
// Session and redirects the browser to Stripe's own hosted page, then Stripe
// redirects back to successUrl/cancelUrl. Same direct-from-browser secret-key
// tradeoff as createPaymentIntent above.

export interface StripeCheckoutSession {
  id: string;
  url: string;
  payment_status: string;
  payment_intent?: string;
}

export const createCheckoutSession = async (
  secretKey: string,
  opts: { amountCents: number; currency: string; description: string; successUrl: string; cancelUrl: string; customerEmail?: string; invoiceId?: string }
): Promise<StripeCheckoutSession> => {
  const body = new URLSearchParams({
    mode: "payment",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    "line_items[0][price_data][currency]": opts.currency,
    "line_items[0][price_data][product_data][name]": opts.description,
    "line_items[0][price_data][unit_amount]": String(Math.round(opts.amountCents)),
    "line_items[0][quantity]": "1",
  });
  if (opts.customerEmail) body.set("customer_email", opts.customerEmail);
  // FIX 1 (mobile round 8) — client_reference_id is how the server-side
  // stripe-webhook function identifies which invoice a checkout.session
  // belongs to, so IT (not the client) is the one that marks the invoice paid.
  if (opts.invoiceId) {
    body.set("client_reference_id", opts.invoiceId);
    body.set("metadata[invoiceId]", opts.invoiceId);
  }
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(secretKey + ":")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Stripe error ${res.status}`);
  }
  return res.json();
};

export const retrieveCheckoutSession = async (secretKey: string, sessionId: string): Promise<StripeCheckoutSession> => {
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Basic ${btoa(secretKey + ":")}` },
  });
  if (!res.ok) throw new Error(`Stripe error ${res.status}`);
  return res.json();
};

// ─── Customers + saved payment methods (for the client portal) ───────────────

export interface StripeCustomerObj { id: string; email?: string; name?: string }

export const createStripeCustomer = async (secretKey: string, email: string, name: string): Promise<StripeCustomerObj> => {
  const body = new URLSearchParams({ email, name });
  const res = await fetch("https://api.stripe.com/v1/customers", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(secretKey + ":")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Stripe error ${res.status}`);
  }
  return res.json();
};

export interface StripeSetupIntent { id: string; client_secret: string; status: string }

export const createSetupIntent = async (secretKey: string, customerId: string): Promise<StripeSetupIntent> => {
  const body = new URLSearchParams({ customer: customerId, "payment_method_types[0]": "card" });
  const res = await fetch("https://api.stripe.com/v1/setup_intents", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(secretKey + ":")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Stripe error ${res.status}`);
  }
  return res.json();
};

export const chargeSavedPaymentMethod = async (
  secretKey: string,
  customerId: string,
  paymentMethodId: string,
  amountCents: number,
  currency: string,
  description: string
): Promise<StripePaymentIntent> => {
  const body = new URLSearchParams({
    amount: String(Math.round(amountCents)),
    currency,
    description,
    customer: customerId,
    payment_method: paymentMethodId,
    off_session: "true",
    confirm: "true",
  });
  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(secretKey + ":")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Stripe error ${res.status}`);
  }
  return res.json();
};

export const refundPaymentIntent = async (secretKey: string, paymentIntentId: string): Promise<void> => {
  const res = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(secretKey + ":")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ payment_intent: paymentIntentId }).toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Stripe refund error ${res.status}`);
  }
};
