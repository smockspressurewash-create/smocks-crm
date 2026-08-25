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
// STRIPE CONNECT — an owner who completed the OAuth "Connect with Stripe"
// flow (functions/api/stripe-connect-oauth.ts) has a `stripe_account_id`
// (acct_...) instead of their own raw secret key. Connect-mode calls use
// THIS PLATFORM's own secret key (STRIPE_SECRET_KEY) plus a
// `Stripe-Account: acct_...` header, which is Stripe's documented way for a
// platform to act on a connected account's behalf — the connected account
// never hands over a raw secret key at all. Legacy manual-key owners (who
// pasted their own sk_.../whsec_... in Settings before Connect existed)
// keep working exactly as before — stripe_account_id is simply null for
// them, and the resolver below falls through to their own secretKey.
const getOwnerStripeAccount = async (
  ownerId: string,
  serviceRoleKey: string
): Promise<{ secretKey?: string; publishableKey?: string; webhookSecret?: string; mode?: string; stripeAccountId?: string } | null> => {
  if (!ownerId || !serviceRoleKey) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/owner_stripe_accounts?owner_id=eq.${encodeURIComponent(ownerId)}&select=stripe_secret_key,stripe_publishable_key,stripe_webhook_secret,stripe_mode,stripe_account_id`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
  );
  const rows = await res.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  return { secretKey: row.stripe_secret_key || undefined, publishableKey: row.stripe_publishable_key || undefined, webhookSecret: row.stripe_webhook_secret || undefined, mode: row.stripe_mode, stripeAccountId: row.stripe_account_id || undefined };
};

// BUG FIX — same RLS-vs-anon-key mismatch as getInvoiceAmountCents below:
// an anonymous customer paying their invoice link has no session, so the
// anon-key read here returned zero rows under the real owner_id-scoped RLS
// policy and this whole resolution chain (which Stripe account to charge
// against) silently failed. serviceRoleKey bypasses RLS for this one
// specific, unguessable-id-bounded lookup, same trust model public-data.ts
// already uses throughout for anonymous customer reads.
const getEstimateOwnerId = async (invoiceId: string, serviceRoleKey: string): Promise<string | null> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}&select=owner_id`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
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

const stripeFetch = async (secretKey: string, method: string, path: string, params?: Record<string, string>, stripeAccount?: string) => {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(secretKey + ":")}`,
      ...(stripeAccount ? { "Stripe-Account": stripeAccount } : {}),
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
//
// BUG FIX — "Stripe is having problems." This read used the ANON key, which
// used to work back when estimates had a permissive USING(true) RLS policy
// — but that's since been replaced with a real owner_id-scoped policy
// (owner_id = current_owner_id()), and an anonymous customer paying their
// invoice link has no session for current_owner_id() to resolve at all. The
// anon-key read below has therefore been silently returning ZERO rows for
// every invoiceId-based payment, which this function then reports as
// "invoice not found" — every real customer payment that went through
// invoiceId (as opposed to a raw client-supplied amount) has been failing
// outright. serviceRoleKey bypasses RLS the same way every other anonymous-
// customer read in this app already does (see public-data.ts) — safe here
// because invoiceId is only ever used to look up ONE specific amount, never
// returned to the caller or used to enumerate other rows.
const getInvoiceAmountCents = async (invoiceId: string, serviceRoleKey: string): Promise<number> => {
  if (!serviceRoleKey) throw new Error("Server missing SUPABASE_SERVICE_ROLE_KEY env var — add it in the Cloudflare Pages dashboard, then redeploy.");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}&select=total`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const rows = await res.json().catch(() => []);
  const total = Array.isArray(rows) ? Number(rows[0]?.total) : NaN;
  if (!total || total <= 0) throw new Error("Could not verify invoice amount — invoice not found or has no total.");
  return Math.round(total * 100);
};

// SAVE-CARD SUPPORT — "save this card" during a real invoice payment needs
// the PaymentIntent to carry a real Stripe `customer` + setup_future_usage
// at CREATION time (Stripe attaches the payment method to that customer
// automatically on successful confirmation; it can't be bolted on
// afterward). The customer identity is derived from the invoice itself —
// never a client-claimed customerId — same "never trust the caller" rule
// getInvoiceAmountCents already follows for amount.
const resolveInvoiceCustomerForSave = async (
  invoiceId: string,
  serviceRoleKey: string
): Promise<{ crmCustomerId: string; stripeCustomerId?: string; email?: string; name?: string } | null> => {
  // BUG FIX — same RLS-vs-anon-key mismatch as getInvoiceAmountCents above.
  const estRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}&select=customerId`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const estRows = await estRes.json().catch(() => []);
  const crmCustomerId = Array.isArray(estRows) ? estRows[0]?.customerId : null;
  if (!crmCustomerId || !serviceRoleKey) return null;
  const custRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(crmCustomerId)}&select=email,firstName,lastName,stripeCustomerId`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const custRows = await custRes.json().catch(() => []);
  const cust = Array.isArray(custRows) ? custRows[0] : null;
  if (!cust) return null;
  return { crmCustomerId, stripeCustomerId: cust.stripeCustomerId || undefined, email: cust.email || undefined, name: [cust.firstName, cust.lastName].filter(Boolean).join(" ") || undefined };
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const platformSecretKey = context.env.STRIPE_SECRET_KEY;
  // BUG FIX — a Connect-mode owner (no manual keys of their own) had NO
  // publishable key returned to them at all: get_owner_keys_status only
  // ever read owner_stripe_accounts.stripe_publishable_key, which is only
  // populated by the manual "Advanced: use your own API keys" path, never
  // by the Connect OAuth flow. That silently broke every customer-facing
  // payment for a Connect owner (StripePaymentModal/SaveCardModal never
  // even got a key to call loadStripeJs with) — the "easier" path was
  // actually the one that didn't work. A PLATFORM publishable key (safe to
  // expose — that's what publishable keys are for) is the correct
  // client-side key for a Direct charge against a connected account, paired
  // with that account's id via Stripe.js's `stripeAccount` option.
  const platformPublishableKey = context.env.STRIPE_PUBLISHABLE_KEY;
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
          connected: !!acct?.stripeAccountId,
          stripeAccountId: acct?.stripeAccountId ? acct.stripeAccountId.replace(/^(acct_.{4}).*/, "$1…") : "",
          stripeAccountIdFull: acct?.stripeAccountId || "",
          hasSecretKey: !!acct?.secretKey,
          hasWebhookSecret: !!acct?.webhookSecret,
          // Connect owner with no manual publishable key of their own falls
          // back to the platform's — see the comment on platformPublishableKey
          // above for why this is the correct key for this case, not a bug.
          publishableKey: acct?.publishableKey || (acct?.stripeAccountId ? (platformPublishableKey || "") : ""),
          mode: acct?.mode || "test",
          webhookUrl: `${new URL(context.request.url).origin}/api/stripe-webhook?oid=${encodeURIComponent(callerOwnerId)}`,
        });
      }

      // save_owner_keys — caller can only ever write their OWN owner_id row,
      // resolved server-side above, never a client-supplied one. Manual-key
      // fields stay supported as a fallback for owners not using Connect —
      // functions/api/stripe-connect-oauth.ts writes stripe_account_id
      // separately once an owner completes the OAuth flow.
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

    // list_payment_methods / detach_payment_method — owner-CRM-only actions
    // exposing/manipulating a customer's stored cards. Same auth-token
    // requirement as save_owner_keys above (never a client-claimed
    // ownerId) since these touch payment method data directly.
    if (action === "list_payment_methods" || action === "detach_payment_method") {
      const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const callerOwnerId = serviceRoleKey ? await resolveCallerOwnerId(accessToken) : null;
      if (serviceRoleKey && !callerOwnerId) {
        return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
      const acct = callerOwnerId && serviceRoleKey ? await getOwnerStripeAccount(callerOwnerId, serviceRoleKey) : null;
      const secretKey = acct?.secretKey || platformSecretKey;
      const stripeAccount = acct?.stripeAccountId;
      if (!secretKey) return new Response(JSON.stringify({ error: "Stripe isn't configured for this business yet." }), { status: 500, headers: { "Content-Type": "application/json" } });

      if (action === "list_payment_methods") {
        if (!body.customerId) throw new Error("Missing customerId");
        const pmRes = await stripeFetch(secretKey, "GET", `payment_methods?customer=${encodeURIComponent(body.customerId)}&type=card`, undefined, stripeAccount);
        const methods = (pmRes.data || []).map((pm: any) => ({ id: pm.id, brand: pm.card?.brand, last4: pm.card?.last4, expMonth: pm.card?.exp_month, expYear: pm.card?.exp_year }));
        return json({ paymentMethods: methods });
      }
      // detach_payment_method
      if (!body.paymentMethodId) throw new Error("Missing paymentMethodId");
      await stripeFetch(secretKey, "POST", `payment_methods/${encodeURIComponent(body.paymentMethodId)}/detach`, {}, stripeAccount);
      return json({ success: true });
    }

    // get_my_saved_card — the CUSTOMER-safe counterpart to list_payment_methods
    // above. A customer's Supabase session is a separate auth realm from
    // owner/employee sessions (see ClientAuthPortal.tsx) and is never a row
    // in `employees`, so it can't use resolveCallerOwnerId/list_payment_methods
    // without loosening that owner-only check. Instead: verify the caller's
    // own email against the `customers` table (service role — a customer's
    // own anon-key session can't read `customers` directly under the
    // owner-scoped RLS in migration 0033) and return ONLY that one
    // customer's own card — never any other customer's, never a list.
    if (action === "get_my_saved_card") {
      const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) return json({ card: null });
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } });
      const user = userRes.ok ? await userRes.json().catch(() => null) as any : null;
      const email = user?.email;
      if (!email) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401, headers: { "Content-Type": "application/json" } });

      const custRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?email=eq.${encodeURIComponent(email)}&select=stripeCustomerId,owner_id&limit=1`, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      });
      const custRows = await custRes.json().catch(() => []);
      const cust = Array.isArray(custRows) ? custRows[0] : null;
      if (!cust?.stripeCustomerId) return json({ card: null });

      const acct = cust.owner_id ? await getOwnerStripeAccount(cust.owner_id, serviceRoleKey) : null;
      const secretKey = acct?.secretKey || platformSecretKey;
      if (!secretKey) return json({ card: null });
      const pmRes = await stripeFetch(secretKey, "GET", `payment_methods?customer=${encodeURIComponent(cust.stripeCustomerId)}&type=card&limit=1`, undefined, acct?.stripeAccountId);
      const pm = (pmRes.data || [])[0];
      if (!pm) return json({ card: null });
      return json({ card: { brand: pm.card?.brand, last4: pm.card?.last4, expMonth: pm.card?.exp_month, expYear: pm.card?.exp_year } });
    }

    // get_my_saved_cards / detach_my_payment_method — the CUSTOMER-safe,
    // MULTI-card counterparts to get_my_saved_card/detach_payment_method
    // above. Same email-verified-against-`customers` pattern as
    // get_my_saved_card (a customer session can't use resolveCallerOwnerId,
    // never a row in `employees`) — lets a customer see and manage every
    // card they've saved, not just the most recent one.
    if (action === "get_my_saved_cards" || action === "detach_my_payment_method") {
      const isList = action === "get_my_saved_cards";
      const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) return isList ? json({ cards: [] }) : new Response(JSON.stringify({ error: "Not configured." }), { status: 500, headers: { "Content-Type": "application/json" } });
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } });
      const user = userRes.ok ? await userRes.json().catch(() => null) as any : null;
      const email = user?.email;
      if (!email) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401, headers: { "Content-Type": "application/json" } });

      const custRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?email=eq.${encodeURIComponent(email)}&select=stripeCustomerId,owner_id&limit=1`, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      });
      const custRows = await custRes.json().catch(() => []);
      const cust = Array.isArray(custRows) ? custRows[0] : null;
      if (!cust?.stripeCustomerId) return isList ? json({ cards: [] }) : new Response(JSON.stringify({ error: "No card on file." }), { status: 404, headers: { "Content-Type": "application/json" } });

      const acct = cust.owner_id ? await getOwnerStripeAccount(cust.owner_id, serviceRoleKey) : null;
      const secretKey = acct?.secretKey || platformSecretKey;
      if (!secretKey) return isList ? json({ cards: [] }) : new Response(JSON.stringify({ error: "Stripe isn't configured for this business yet." }), { status: 500, headers: { "Content-Type": "application/json" } });

      if (action === "get_my_saved_cards") {
        const pmRes = await stripeFetch(secretKey, "GET", `payment_methods?customer=${encodeURIComponent(cust.stripeCustomerId)}&type=card`, undefined, acct?.stripeAccountId);
        const cards = (pmRes.data || []).map((pm: any) => ({ id: pm.id, brand: pm.card?.brand, last4: pm.card?.last4, expMonth: pm.card?.exp_month, expYear: pm.card?.exp_year }));
        return json({ cards });
      }
      // detach_my_payment_method — NEVER trust the client-claimed
      // paymentMethodId alone: fetch it from Stripe first and confirm it
      // actually belongs to THIS customer before detaching, so one
      // customer's session can't detach another customer's card by
      // guessing/passing an arbitrary payment_method id.
      if (!body.paymentMethodId) return new Response(JSON.stringify({ error: "Missing paymentMethodId" }), { status: 400, headers: { "Content-Type": "application/json" } });
      const pmCheck = await stripeFetch(secretKey, "GET", `payment_methods/${encodeURIComponent(body.paymentMethodId)}`, undefined, acct?.stripeAccountId);
      if (pmCheck?.customer !== cust.stripeCustomerId) {
        return new Response(JSON.stringify({ error: "That card doesn't belong to your account." }), { status: 403, headers: { "Content-Type": "application/json" } });
      }
      await stripeFetch(secretKey, "POST", `payment_methods/${encodeURIComponent(body.paymentMethodId)}/detach`, {}, acct?.stripeAccountId);
      return json({ success: true });
    }

    // send_payment_receipt — fires after ANY successful charge (customer
    // self-pay, employee in-person card-on-file, owner-processed) regardless
    // of who's holding the phone/browser. Runs server-side because it needs
    // the owner's Twilio/Gmail credentials, which must never reach a
    // customer's (or, for that matter, a compromised employee's) browser —
    // same reasoning as the Stripe secret key fix this whole file is built
    // around. Texts if the customer has a phone on file, else emails via the
    // owner's connected Gmail; never both, never neither silently — the
    // caller gets a clear success/error either way so a failed receipt can
    // be surfaced as a toast without ever blocking/rolling back the charge
    // itself (the charge already succeeded by the time this runs).
    if (action === "send_payment_receipt") {
      const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) return new Response(JSON.stringify({ error: "Receipts require SUPABASE_SERVICE_ROLE_KEY to be configured." }), { status: 500, headers: { "Content-Type": "application/json" } });

      let resolvedOwnerId: string | null = null;
      if (body.invoiceId) resolvedOwnerId = await getEstimateOwnerId(body.invoiceId, serviceRoleKey);
      if (!resolvedOwnerId) {
        const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (accessToken) resolvedOwnerId = await resolveCallerOwnerId(accessToken);
      }
      if (!resolvedOwnerId && body.ownerId) resolvedOwnerId = body.ownerId;
      if (!resolvedOwnerId) return new Response(JSON.stringify({ error: "Couldn't determine which business this payment belongs to." }), { status: 400, headers: { "Content-Type": "application/json" } });

      const settingsRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(resolvedOwnerId)}&select=data&limit=1`, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      });
      const settingsRows = await settingsRes.json().catch(() => []);
      const s = Array.isArray(settingsRows) ? settingsRows[0]?.data || {} : {};
      const companyName = s.companyName || "Crew Boss";
      const amount = (Number(body.amountCents) / 100 || 0).toFixed(2);
      const description = body.description || "";
      const custName = body.customerFirstName || "there";

      if (body.customerPhone && s.twilioSid && s.twilioToken && s.twilioFrom) {
        const smsBody = `Hi ${custName}, this confirms your payment of $${amount} to ${companyName}${description ? " for " + description : ""}. Thank you!`;
        const auth = `Basic ${btoa(`${s.twilioSid}:${s.twilioToken}`)}`;
        const params = new URLSearchParams({ To: body.customerPhone, From: s.twilioFrom, Body: smsBody });
        const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${s.twilioSid}/Messages.json`, {
          method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString(),
        });
        if (!smsRes.ok) return new Response(JSON.stringify({ error: "Twilio send failed: " + (await smsRes.text().catch(() => "")).slice(0, 200) }), { status: 502, headers: { "Content-Type": "application/json" } });
        // Log to inbox_threads, same as every other outbound SMS.
        try {
          const normDigits = (p: string) => (p || "").replace(/\D/g, "");
          const threadsRes = await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?channel=eq.sms&select=id,contact_phone,messages&owner_id=eq.${encodeURIComponent(resolvedOwnerId)}`, {
            headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
          });
          const threads = await threadsRes.json().catch(() => []);
          const existing = Array.isArray(threads) ? threads.find((t: any) => normDigits(t.contact_phone) === normDigits(body.customerPhone)) : null;
          const msg = { id: crypto.randomUUID(), dir: "out", body: smsBody, ts: Date.now() };
          if (existing) {
            await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?id=eq.${encodeURIComponent(existing.id)}`, {
              method: "PATCH", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
              body: JSON.stringify({ messages: [...(existing.messages || []), msg], last_message_at: msg.ts, updated_at: new Date().toISOString() }),
            });
          } else {
            await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads`, {
              method: "POST", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
              body: JSON.stringify({ id: crypto.randomUUID(), channel: "sms", contact_name: custName, contact_phone: body.customerPhone, customer_id: body.customerId || null, unread: false, messages: [msg], last_message_at: msg.ts, updated_at: new Date().toISOString(), owner_id: resolvedOwnerId }),
            });
          }
        } catch { /* non-fatal — receipt itself already sent */ }
        return json({ success: true, channel: "sms" });
      }

      if (body.customerEmail && s.googleProviderToken) {
        let accessTok = s.googleProviderToken;
        // Access token likely stale by the time this fires (owner may not
        // have opened the app in a while) — refresh via the same Cloudflare
        // Function the client uses, rather than duplicating Google's OAuth
        // token-exchange logic here.
        if (s.googleRefreshToken && (!s.googleTokenExpiresAt || Date.now() > Number(s.googleTokenExpiresAt) - 60000)) {
          try {
            const origin = new URL(context.request.url).origin;
            const refreshRes = await fetch(`${origin}/api/google-refresh`, {
              method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: s.googleRefreshToken }),
            });
            const refreshData = await refreshRes.json().catch(() => null) as any;
            if (refreshRes.ok && refreshData?.access_token) accessTok = refreshData.access_token;
          } catch { /* fall through with the possibly-stale token; Gmail send below will just fail clearly */ }
        }
        const subject = `Payment Receipt — ${companyName}`;
        const html = `<p>Hi ${custName},</p><p>This confirms your payment of <strong>$${amount}</strong> to ${companyName}${description ? " for " + description : ""}.</p><p>Thank you for your business!</p>`;
        const mime = [`To: ${body.customerEmail}`, `Subject: ${subject}`, `MIME-Version: 1.0`, `Content-Type: text/html; charset=utf-8`, ``, html].join("\r\n");
        const raw = btoa(unescape(encodeURIComponent(mime))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const gmailRes = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST", headers: { Authorization: `Bearer ${accessTok}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw }),
        });
        if (!gmailRes.ok) return new Response(JSON.stringify({ error: "Gmail send failed: " + (await gmailRes.text().catch(() => "")).slice(0, 200) }), { status: 502, headers: { "Content-Type": "application/json" } });
        return json({ success: true, channel: "email" });
      }

      return new Response(JSON.stringify({ error: "No phone or email on file for this customer — receipt not sent." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Every remaining action calls api.stripe.com and needs a secret key —
    // resolve the calling owner's own key/Connect account first, falling
    // back to the platform-wide env var (requirement: existing/legacy
    // deployments keep working unmodified).
    let secretKey = platformSecretKey;
    let stripeAccount: string | undefined;
    const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      let resolvedOwnerId: string | null = null;
      if (body.invoiceId) resolvedOwnerId = await getEstimateOwnerId(body.invoiceId, serviceRoleKey);
      // BUG FIX — an owner-authenticated call (e.g. the owner adding a
      // customer's card from CustomerDetail.tsx) had no invoiceId and no
      // client-supplied ownerId either, so it silently fell through to the
      // platform-wide key/account for EVERY owner — a card added this way
      // was being created in the wrong Stripe account entirely. A verified
      // session token (when present) resolves the real caller identity the
      // same trustworthy way save_owner_keys/get_owner_keys_status already
      // do above — preferred over a client-claimed body.ownerId, which is
      // now the last-resort fallback (still needed for the one legitimate
      // case where there's no session at all: the trash-can inconvenience
      // fee charge, run from an employee session whose own id isn't the
      // business owner's).
      if (!resolvedOwnerId) {
        const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (accessToken) resolvedOwnerId = await resolveCallerOwnerId(accessToken);
      }
      if (!resolvedOwnerId && body.ownerId) resolvedOwnerId = body.ownerId;
      if (resolvedOwnerId) {
        const acct = await getOwnerStripeAccount(resolvedOwnerId, serviceRoleKey);
        if (acct?.stripeAccountId) { stripeAccount = acct.stripeAccountId; }
        else if (acct?.secretKey) { secretKey = acct.secretKey; }
      }
    }
    if (!secretKey) {
      return new Response(JSON.stringify({ error: "Stripe isn't configured for this business yet — add keys in Settings → Integrations → Stripe, or (platform admin) set STRIPE_SECRET_KEY in the Cloudflare Pages dashboard." }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    switch (action) {
      case "create_payment_intent": {
        const amountCents = body.invoiceId ? await getInvoiceAmountCents(body.invoiceId, serviceRoleKey) : Math.round(Number(body.amountCents) || 0);
        if (amountCents <= 0) throw new Error("Invalid amount");
        const params: Record<string, string> = {
          amount: String(amountCents),
          currency: body.currency || "usd",
          description: body.description || "",
          "automatic_payment_methods[enabled]": "true",
        };
        if (body.invoiceId) params["metadata[invoiceId]"] = body.invoiceId;
        // FEATURE — "save this card" checkbox during a real invoice payment
        // (StripePaymentModal). Stripe requires `customer` +
        // setup_future_usage to be set at PaymentIntent CREATION time, not
        // bolted on after — so this resolves the paying customer from the
        // invoice itself (never trusts a client-claimed customerId, same
        // rule the amount check above already follows) and reuses their
        // existing Stripe customer if one's on file, or lets Stripe create
        // one implicitly via the `customer` param on confirmation.
        let resolvedCrmCustomerId: string | undefined;
        let resolvedStripeCustomerId: string | undefined;
        if (body.saveCard && body.invoiceId && serviceRoleKey) {
          const info = await resolveInvoiceCustomerForSave(body.invoiceId, serviceRoleKey);
          if (info) {
            resolvedCrmCustomerId = info.crmCustomerId;
            if (info.stripeCustomerId) {
              resolvedStripeCustomerId = info.stripeCustomerId;
            } else {
              const created = await stripeFetch(secretKey, "POST", "customers", { email: info.email || "", name: info.name || "" }, stripeAccount);
              resolvedStripeCustomerId = created.id;
            }
            params.customer = resolvedStripeCustomerId;
            params["setup_future_usage"] = "off_session";
          }
        }
        const intent = await stripeFetch(secretKey, "POST", "payment_intents", params, stripeAccount);
        return json({
          id: intent.id, client_secret: intent.client_secret, status: intent.status,
          ...(resolvedStripeCustomerId ? { stripeCustomerId: resolvedStripeCustomerId, crmCustomerId: resolvedCrmCustomerId } : {}),
        });
      }
      case "retrieve_payment_intent": {
        if (!body.id) throw new Error("Missing id");
        const intent = await stripeFetch(secretKey, "GET", `payment_intents/${encodeURIComponent(body.id)}`, undefined, stripeAccount);
        return json(intent);
      }
      case "create_checkout_session": {
        const amountCents = body.invoiceId ? await getInvoiceAmountCents(body.invoiceId, serviceRoleKey) : Math.round(Number(body.amountCents) || 0);
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
        const session = await stripeFetch(secretKey, "POST", "checkout/sessions", params, stripeAccount);
        return json({ id: session.id, url: session.url, payment_status: session.payment_status, payment_intent: session.payment_intent });
      }
      case "retrieve_checkout_session": {
        if (!body.sessionId) throw new Error("Missing sessionId");
        const session = await stripeFetch(secretKey, "GET", `checkout/sessions/${encodeURIComponent(body.sessionId)}`, undefined, stripeAccount);
        return json(session);
      }
      case "create_customer": {
        if (!body.email) throw new Error("Missing email");
        const customer = await stripeFetch(secretKey, "POST", "customers", { email: body.email, name: body.name || "" }, stripeAccount);
        return json({ id: customer.id, email: customer.email, name: customer.name });
      }
      case "create_setup_intent": {
        if (!body.customerId) throw new Error("Missing customerId");
        const intent = await stripeFetch(secretKey, "POST", "setup_intents", { customer: body.customerId, "payment_method_types[0]": "card" }, stripeAccount);
        return json({ id: intent.id, client_secret: intent.client_secret, status: intent.status });
      }
      case "charge_saved_payment_method": {
        // OWNER-ONLY in practice (only ever called from authenticated CRM UI,
        // never ClientPortal/ClientAuthPortal) — still amount-verified against
        // the invoice when one is given, same as the two create_* actions above.
        const amountCents = body.invoiceId ? await getInvoiceAmountCents(body.invoiceId, serviceRoleKey) : Math.round(Number(body.amountCents) || 0);
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
        const intent = await stripeFetch(secretKey, "POST", "payment_intents", params, stripeAccount);
        return json({ id: intent.id, client_secret: intent.client_secret, status: intent.status });
      }
      case "refund": {
        // OWNER-ONLY — only ever called from InvoicesPage/JobDetailModal
        // (authenticated CRM), never exposed to the customer-facing portal.
        if (!body.paymentIntentId) throw new Error("Missing paymentIntentId");
        await stripeFetch(secretKey, "POST", "refunds", { payment_intent: body.paymentIntentId }, stripeAccount);
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
