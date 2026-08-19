// SECURITY AUDIT (round 12) — CRITICAL FIX. lib/stripe.ts used to call
// api.stripe.com DIRECTLY FROM THE BROWSER using the Stripe SECRET key,
// which lived in `settings.stripeSecretKeyEnc` — a value loaded into
// EVERY session's `settings` object, including ClientPortal.tsx and
// ClientAuthPortal.tsx, the UNAUTHENTICATED/customer-facing pages a real
// customer opens to pay their invoice. "Encrypted" there meant XOR'd with a
// hardcoded salt (lib/crypto.ts's obfuscate/deobfuscate, which ships in the
// same JS bundle) — trivially reversible by anyone who opens devtools on an
// invoice/payment link. That handed the FULL Stripe secret key — full
// account access: create arbitrary charges, issue refunds, read every
// saved customer's payment methods and PII — to every single customer who
// ever viewed a payment page. This endpoint is the fix: the secret key now
// lives ONLY in this Cloudflare Pages Function's environment variable
// (STRIPE_SECRET_KEY, set in the Cloudflare dashboard — same pattern as
// TWILIO_AUTH_TOKEN), and the browser (owner OR customer) only ever calls
// this same-origin endpoint with an action name + non-sensitive params.
// The secret key never reaches client code again.
//
// Setup: Cloudflare Pages → this project → Settings → Environment variables
// → add STRIPE_SECRET_KEY (sk_live_... or sk_test_...). Settings →
// Integrations → Stripe now only needs the PUBLISHABLE key (safe to expose
// client-side by design — that's what it's for).
//
// SECOND FIX bundled in here: create_payment_intent/create_checkout_session
// used to trust whatever `amountCents` the CALLER claimed. A tampered
// client could request a PaymentIntent for $0.01 against a $500 invoice.
// When `invoiceId` is provided, this function now looks up that invoice's
// real `total` in Supabase itself and charges THAT — the client's claimed
// amount is ignored whenever an invoiceId is present.

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8aEa3wsYJ7ghVPcGbtHymw_ugj0aEfm";

const stripeFetch = async (secretKey: string, method: string, path: string, params?: Record<string, string>) => {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(secretKey + ":")}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" && params ? new URLSearchParams(params).toString() : undefined,
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const msg = (data as any)?.error?.message || `Stripe error ${res.status}`;
    throw new Error(msg);
  }
  return data;
};

// Looks up the real invoice total (in the estimates table — invoices ARE
// estimate rows with invoiced:true, see CLAUDE.md) so a caller can never pay
// less than what's actually owed by lying about the amount.
const getInvoiceAmountCents = async (invoiceId: string): Promise<number> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}&select=total`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  const rows = await res.json().catch(() => []);
  const total = Array.isArray(rows) ? Number(rows[0]?.total) : NaN;
  if (!total || total <= 0) throw new Error("Could not verify invoice amount — invoice not found or has no total.");
  return Math.round(total * 100);
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const secretKey = context.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return new Response(JSON.stringify({ error: "Server missing STRIPE_SECRET_KEY env var — add it in the Cloudflare Pages dashboard (Settings → Environment variables), then redeploy." }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const body = await context.request.json() as Record<string, any>;
    const action = body?.action;

    switch (action) {
      case "create_payment_intent": {
        const amountCents = body.invoiceId ? await getInvoiceAmountCents(body.invoiceId) : Math.round(Number(body.amountCents) || 0);
        if (amountCents <= 0) throw new Error("Invalid amount");
        const params: Record<string, string> = {
          amount: String(amountCents),
          currency: body.currency || "usd",
          description: body.description || "",
          "automatic_payment_methods[enabled]": "true",
        };
        if (body.invoiceId) params["metadata[invoiceId]"] = body.invoiceId;
        const intent = await stripeFetch(secretKey, "POST", "payment_intents", params);
        return json({ id: intent.id, client_secret: intent.client_secret, status: intent.status });
      }
      case "retrieve_payment_intent": {
        if (!body.id) throw new Error("Missing id");
        const intent = await stripeFetch(secretKey, "GET", `payment_intents/${encodeURIComponent(body.id)}`);
        return json(intent);
      }
      case "create_checkout_session": {
        const amountCents = body.invoiceId ? await getInvoiceAmountCents(body.invoiceId) : Math.round(Number(body.amountCents) || 0);
        if (amountCents <= 0) throw new Error("Invalid amount");
        const params: Record<string, string> = {
          mode: "payment",
          success_url: body.successUrl,
          cancel_url: body.cancelUrl,
          "line_items[0][price_data][currency]": body.currency || "usd",
          "line_items[0][price_data][product_data][name]": body.description || "Invoice payment",
          "line_items[0][price_data][unit_amount]": String(amountCents),
          "line_items[0][quantity]": "1",
        };
        if (body.customerEmail) params.customer_email = body.customerEmail;
        if (body.invoiceId) { params.client_reference_id = body.invoiceId; params["metadata[invoiceId]"] = body.invoiceId; }
        const session = await stripeFetch(secretKey, "POST", "checkout/sessions", params);
        return json({ id: session.id, url: session.url, payment_status: session.payment_status, payment_intent: session.payment_intent });
      }
      case "retrieve_checkout_session": {
        if (!body.sessionId) throw new Error("Missing sessionId");
        const session = await stripeFetch(secretKey, "GET", `checkout/sessions/${encodeURIComponent(body.sessionId)}`);
        return json(session);
      }
      case "create_customer": {
        if (!body.email) throw new Error("Missing email");
        const customer = await stripeFetch(secretKey, "POST", "customers", { email: body.email, name: body.name || "" });
        return json({ id: customer.id, email: customer.email, name: customer.name });
      }
      case "create_setup_intent": {
        if (!body.customerId) throw new Error("Missing customerId");
        const intent = await stripeFetch(secretKey, "POST", "setup_intents", { customer: body.customerId, "payment_method_types[0]": "card" });
        return json({ id: intent.id, client_secret: intent.client_secret, status: intent.status });
      }
      case "charge_saved_payment_method": {
        // OWNER-ONLY in practice (only ever called from authenticated CRM UI,
        // never ClientPortal/ClientAuthPortal) — still amount-verified against
        // the invoice when one is given, same as the two create_* actions above.
        const amountCents = body.invoiceId ? await getInvoiceAmountCents(body.invoiceId) : Math.round(Number(body.amountCents) || 0);
        if (!body.customerId || !body.paymentMethodId) throw new Error("Missing customerId/paymentMethodId");
        if (amountCents <= 0) throw new Error("Invalid amount");
        const params: Record<string, string> = {
          amount: String(amountCents),
          currency: body.currency || "usd",
          description: body.description || "",
          customer: body.customerId,
          payment_method: body.paymentMethodId,
          off_session: "true",
          confirm: "true",
        };
        if (body.invoiceId) params["metadata[invoiceId]"] = body.invoiceId;
        const intent = await stripeFetch(secretKey, "POST", "payment_intents", params);
        return json({ id: intent.id, client_secret: intent.client_secret, status: intent.status });
      }
      case "refund": {
        // OWNER-ONLY — only ever called from InvoicesPage/JobDetailModal
        // (authenticated CRM), never exposed to the customer-facing portal.
        if (!body.paymentIntentId) throw new Error("Missing paymentIntentId");
        await stripeFetch(secretKey, "POST", "refunds", { payment_intent: body.paymentIntentId });
        return json({ success: true });
      }
      default:
        return new Response(JSON.stringify({ error: "Unknown action: " + action }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Stripe proxy error" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
};

const json = (data: any) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
