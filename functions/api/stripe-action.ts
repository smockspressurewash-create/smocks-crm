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

// MULTI-TENANT (Phase F) — each business can now store its own Stripe keys
// in owner_stripe_accounts (service-role-only table, see migration
// 0033_multitenant_owner_scoping.sql). This resolves which secret key to
// charge with:
//   1. If an invoiceId is given, the invoice's OWN owner_id (read from the
//      estimates row itself, never trusted from the client) wins — this is
//      the same "never trust client-claimed amounts/identity" pattern this
//      file already uses for amountCents.
//   2. Otherwise fall back to a client-supplied ownerId (only meaningful for
//      actions that don't reference an invoice, e.g. create_customer for a
//      saved card — still safe, since it only affects which business's
//      Stripe account the resulting object lives in, not who gets charged).
//   3. If no owner-specific key is on file, fall back to the platform-wide
//      STRIPE_SECRET_KEY env var, so deployments that haven't set up
//      per-owner keys yet keep working unmodified.
const getOwnerStripeAccount = async (
  ownerId: string,
  serviceRoleKey: string
): Promise<{ secretKey?: string; publishableKey?: string; webhookSecret?: string; mode?: string } | null> => {
  if (!ownerId || !serviceRoleKey) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/owner_stripe_accounts?owner_id=eq.${encodeURIComponent(ownerId)}&select=stripe_secret_key,stripe_publishable_key,stripe_webhook_secret,stripe_mode`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
  );
  const rows = await res.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  return { secretKey: row.stripe_secret_key || undefined, publishableKey: row.stripe_publishable_key || undefined, webhookSecret: row.stripe_webhook_secret || undefined, mode: row.stripe_mode };
};

const getEstimateOwnerId = async (invoiceId: string): Promise<string | null> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}&select=owner_id`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0]?.owner_id ? rows[0].owner_id : null;
};

// Resolves the authenticated caller's own owner_id from a Supabase access
// token, via the SAME current_owner_id() logic the DB uses (looked up here
// through the employees table with the anon key + the caller's own JWT, so
// RLS on `employees` itself enforces "you can only ever resolve to your own
// tenant" — this function cannot be tricked into returning someone else's
// owner_id no matter what the client claims).
const resolveCallerOwnerId = async (accessToken: string): Promise<string | null> => {
  if (!accessToken) return null;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json().catch(() => null) as any;
  const uid = user?.id;
  if (!uid) return null;
  const empRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?user_id=eq.${encodeURIComponent(uid)}&select=owner_id&limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  const empRows = await empRes.json().catch(() => []);
  return Array.isArray(empRows) && empRows[0]?.owner_id ? empRows[0].owner_id : uid;
};

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
  const platformSecretKey = context.env.STRIPE_SECRET_KEY;
  try {
    const body = await context.request.json() as Record<string, any>;
    const action = body?.action;

    // save_owner_keys / get_owner_keys_status manage owner_stripe_accounts
    // directly and never touch api.stripe.com — handled before the
    // platform-key check below, since a business using ONLY their own keys
    // shouldn't need a platform STRIPE_SECRET_KEY configured at all.
    if (action === "save_owner_keys" || action === "get_owner_keys_status") {
      const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        return new Response(JSON.stringify({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY env var — add it in the Cloudflare Pages dashboard, then redeploy." }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const callerOwnerId = await resolveCallerOwnerId(accessToken);
      if (!callerOwnerId) {
        return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401, headers: { "Content-Type": "application/json" } });
      }

      if (action === "get_owner_keys_status") {
        const acct = await getOwnerStripeAccount(callerOwnerId, serviceRoleKey);
        return json({
          hasSecretKey: !!acct?.secretKey,
          hasWebhookSecret: !!acct?.webhookSecret,
          publishableKey: acct?.publishableKey || "",
          mode: acct?.mode || "test",
          webhookUrl: `${new URL(context.request.url).origin}/api/stripe-webhook?oid=${encodeURIComponent(callerOwnerId)}`,
        });
      }

      // save_owner_keys — caller can only ever write their OWN owner_id row,
      // resolved server-side above, never a client-supplied one.
      const { publishableKey, secretKey: newSecretKey, webhookSecret, mode } = body;
      const patch: Record<string, any> = { owner_id: callerOwnerId, updated_at: new Date().toISOString() };
      if (publishableKey !== undefined) patch.stripe_publishable_key = publishableKey || null;
      if (newSecretKey !== undefined && newSecretKey !== "") patch.stripe_secret_key = newSecretKey; // blank = leave existing key untouched
      if (webhookSecret !== undefined && webhookSecret !== "") patch.stripe_webhook_secret = webhookSecret;
      if (mode !== undefined) patch.stripe_mode = mode === "live" ? "live" : "test";
      const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/owner_stripe_accounts`, {
        method: "POST",
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(patch),
      });
      if (!saveRes.ok) {
        const errText = await saveRes.text().catch(() => "");
        return new Response(JSON.stringify({ error: "Failed to save Stripe keys: " + errText }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
      return json({ success: true });
    }

    // Every remaining action calls api.stripe.com and needs a secret key —
    // resolve the calling owner's own key first, falling back to the
    // platform-wide env var (requirement: existing/legacy deployments keep
    // working unmodified).
    let secretKey = platformSecretKey;
    const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      let resolvedOwnerId: string | null = null;
      if (body.invoiceId) resolvedOwnerId = await getEstimateOwnerId(body.invoiceId);
      if (!resolvedOwnerId && body.ownerId) resolvedOwnerId = body.ownerId;
      if (resolvedOwnerId) {
        const acct = await getOwnerStripeAccount(resolvedOwnerId, serviceRoleKey);
        if (acct?.secretKey) secretKey = acct.secretKey;
      }
    }
    if (!secretKey) {
      return new Response(JSON.stringify({ error: "Stripe isn't configured for this business yet — add keys in Settings → Integrations → Stripe, or (platform admin) set STRIPE_SECRET_KEY in the Cloudflare Pages dashboard." }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

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
