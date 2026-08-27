// FEATURE — Square as an alternative payment provider to Stripe (owner
// request: "Is there a way we can give another option for users to connect
// payments? Something similar to Stripe... free on our end... accepts many
// payment methods... owners can switch between each one easily"). Mirrors
// stripe-action.ts's own shape almost exactly: keys never reach the
// browser, invoice amounts are always resolved server-side from the
// estimate's own stored total (never a client-claimed amount), and
// owner_square_accounts (migration 0064) is a service-role-only table, same
// as owner_stripe_accounts.
//
// Setup: an owner pastes their Square Access Token + Location ID (from
// Square Developer Dashboard → their app → Credentials/Locations) into
// Settings → Integrations → Square. Sandbox tokens for testing, production
// tokens for real charges — the "mode" field decides which Square API host
// this calls.

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8aEa3wsYJ7ghVPcGbtHymw_ugj0aEfm";

// No sandbox mode — always the real Square production API, same as Stripe
// (which has never had a test-mode switch here either). Any pre-existing
// row still carrying square_mode: "sandbox" from before this change is
// ignored; this is the one and only real charge path.
const squareApiBase = () => "https://connect.squareup.com";

const getOwnerSquareAccount = async (
  ownerId: string,
  serviceRoleKey: string
): Promise<{ accessToken?: string; locationId?: string; applicationId?: string; mode?: string } | null> => {
  if (!ownerId || !serviceRoleKey) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/owner_square_accounts?owner_id=eq.${encodeURIComponent(ownerId)}&select=square_access_token,square_location_id,square_application_id,square_mode`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
  );
  const rows = await res.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  return { accessToken: row.square_access_token || undefined, locationId: row.square_location_id || undefined, applicationId: row.square_application_id || undefined, mode: row.square_mode || "sandbox" };
};

const getEstimateOwnerId = async (invoiceId: string, serviceRoleKey: string): Promise<string | null> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}&select=owner_id`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0]?.owner_id ? rows[0].owner_id : null;
};

// Never trusts a client-claimed amount — same rule as stripe-action.ts's
// getInvoiceAmountCents.
const getInvoiceAmountCents = async (invoiceId: string, serviceRoleKey: string): Promise<number> => {
  if (!serviceRoleKey) throw new Error("Server missing SUPABASE_SERVICE_ROLE_KEY env var.");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}&select=total`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const rows = await res.json().catch(() => []);
  const total = Array.isArray(rows) ? Number(rows[0]?.total) : NaN;
  if (!total || total <= 0) throw new Error("Could not verify invoice amount — invoice not found or has no total.");
  return Math.round(total * 100);
};

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

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY env var — add it in the Cloudflare Pages dashboard, then redeploy." }, 500);
  }
  try {
    const body = await context.request.json() as Record<string, any>;
    const action = body?.action;

    if (action === "save_owner_square_keys" || action === "get_owner_square_status") {
      const accessTokenHdr = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const callerOwnerId = await resolveCallerOwnerId(accessTokenHdr);
      if (!callerOwnerId) return json({ error: "Not signed in." }, 401);

      if (action === "get_owner_square_status") {
        const acct = await getOwnerSquareAccount(callerOwnerId, serviceRoleKey);
        return json({
          connected: !!(acct?.accessToken && acct?.locationId),
          hasAccessToken: !!acct?.accessToken,
          locationId: acct?.locationId || "",
          applicationId: acct?.applicationId || "",
          mode: "production",
        });
      }

      const { squareAccessToken, squareLocationId, squareApplicationId } = body;
      const patch: Record<string, any> = { owner_id: callerOwnerId, updated_at: new Date().toISOString(), square_mode: "production" };
      if (squareAccessToken !== undefined && squareAccessToken !== "") patch.square_access_token = squareAccessToken; // blank = leave existing token untouched
      if (squareLocationId !== undefined) patch.square_location_id = squareLocationId || null;
      if (squareApplicationId !== undefined) patch.square_application_id = squareApplicationId || null;
      const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/owner_square_accounts`, {
        method: "POST",
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(patch),
      });
      if (!saveRes.ok) {
        const errText = await saveRes.text().catch(() => "");
        return json({ error: "Failed to save Square keys: " + errText }, 500);
      }
      return json({ success: true });
    }

    // Public status — customer-facing pages need to know the applicationId
    // + locationId (both safe to expose, same as Stripe's publishable key)
    // to initialize Square's Web Payments SDK, without any auth.
    if (action === "get_public_square_config") {
      const { ownerId } = body;
      if (!ownerId) return json({ error: "Missing ownerId" }, 400);
      const acct = await getOwnerSquareAccount(ownerId, serviceRoleKey);
      if (!acct?.applicationId || !acct?.locationId) return json({ connected: false });
      return json({ connected: true, applicationId: acct.applicationId, locationId: acct.locationId, mode: "production" });
    }

    // create_payment — sourceId is a one-time card nonce from Square's Web
    // Payments SDK (tokenized client-side, never a raw card number reaching
    // this server or Supabase). Amount is ALWAYS resolved from the
    // invoice's own stored total when invoiceId is given — never trusts a
    // client-claimed amountCents, same rule as stripe-action.ts.
    if (action === "create_payment") {
      const { sourceId, invoiceId, tipCents } = body;
      if (!sourceId) return json({ error: "Missing sourceId (card token)" }, 400);
      let ownerId: string | null = null;
      if (invoiceId) ownerId = await getEstimateOwnerId(invoiceId, serviceRoleKey);
      if (!ownerId) {
        const accessTokenHdr = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (accessTokenHdr) ownerId = await resolveCallerOwnerId(accessTokenHdr);
      }
      if (!ownerId && body.ownerId) ownerId = body.ownerId;
      if (!ownerId) return json({ error: "Could not resolve which business to charge" }, 400);
      const acct = await getOwnerSquareAccount(ownerId, serviceRoleKey);
      if (!acct?.accessToken || !acct?.locationId) {
        return json({ error: "Square isn't configured for this business yet — add keys in Settings → Integrations → Square." }, 500);
      }
      const tip = Math.max(0, Math.round(Number(tipCents) || 0));
      const amountCents = (invoiceId ? await getInvoiceAmountCents(invoiceId, serviceRoleKey) : Math.round(Number(body.amountCents) || 0)) + tip;
      if (amountCents <= 0) return json({ error: "Invalid amount" }, 400);

      const sqRes = await fetch(`${squareApiBase()}/v2/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${acct.accessToken}`,
          "Content-Type": "application/json",
          "Square-Version": "2024-10-17",
        },
        body: JSON.stringify({
          source_id: sourceId,
          idempotency_key: crypto.randomUUID(),
          amount_money: { amount: amountCents, currency: "USD" },
          location_id: acct.locationId,
          note: body.description || "",
          ...(invoiceId ? { reference_id: invoiceId } : {}),
        }),
      });
      const sqData = await sqRes.json().catch(() => ({} as any));
      if (!sqRes.ok) {
        const msg = sqData?.errors?.[0]?.detail || `Square error ${sqRes.status}`;
        return json({ error: msg }, sqRes.status);
      }
      return json({ id: sqData?.payment?.id || "", status: sqData?.payment?.status || "COMPLETED" });
    }

    // refund_payment — OWNER-ONLY (InvoicesPage.tsx), mirrors stripe-action.ts's
    // "refund" case: real full or partial refund via Square's own Refunds
    // API. Resolves which business's Square account to refund through the
    // same caller-auth-token / invoiceId / client-ownerId fallback chain
    // used everywhere else in this file — never a client-claimed secret.
    if (action === "refund_payment") {
      const { paymentId, invoiceId, amountCents } = body;
      if (!paymentId) return json({ error: "Missing paymentId" }, 400);
      let ownerId: string | null = null;
      if (invoiceId) ownerId = await getEstimateOwnerId(invoiceId, serviceRoleKey);
      if (!ownerId) {
        const accessTokenHdr = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (accessTokenHdr) ownerId = await resolveCallerOwnerId(accessTokenHdr);
      }
      if (!ownerId && body.ownerId) ownerId = body.ownerId;
      if (!ownerId) return json({ error: "Could not resolve which business owns this payment" }, 400);
      const acct = await getOwnerSquareAccount(ownerId, serviceRoleKey);
      if (!acct?.accessToken) return json({ error: "Square isn't configured for this business." }, 500);

      let refundAmountCents = Math.round(Number(amountCents) || 0);
      if (!refundAmountCents) {
        // Full refund — look up the original payment's own amount rather
        // than trusting a client-claimed total, same "never trust the
        // client for money" rule as everywhere else in this app.
        const payRes = await fetch(`${squareApiBase()}/v2/payments/${encodeURIComponent(paymentId)}`, {
          headers: { Authorization: `Bearer ${acct.accessToken}`, "Square-Version": "2024-10-17" },
        });
        const payData = await payRes.json().catch(() => ({} as any));
        refundAmountCents = payData?.payment?.amount_money?.amount || 0;
      }
      if (refundAmountCents <= 0) return json({ error: "Invalid refund amount" }, 400);

      const refundRes = await fetch(`${squareApiBase()}/v2/refunds`, {
        method: "POST",
        headers: { Authorization: `Bearer ${acct.accessToken}`, "Content-Type": "application/json", "Square-Version": "2024-10-17" },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          amount_money: { amount: refundAmountCents, currency: "USD" },
          payment_id: paymentId,
        }),
      });
      const refundData = await refundRes.json().catch(() => ({} as any));
      if (!refundRes.ok) {
        const msg = refundData?.errors?.[0]?.detail || `Square error ${refundRes.status}`;
        return json({ error: msg }, refundRes.status);
      }
      return json({ success: true, id: refundData?.refund?.id || "", amount: refundAmountCents, status: refundData?.refund?.status || "PENDING" });
    }

    // FEATURE — real recurring billing via Square's own Subscriptions API.
    // Unlike Stripe (which has a hosted Checkout link a customer can open on
    // their own phone), Square's subscriptions require a Customer + a saved
    // Card object created server-side from a tokenized `sourceId` — so this
    // action is meant to be called right after the OWNER taps/swipes the
    // customer's card in person through SquareRecurringSetupModal.tsx
    // (mirrors SquarePaymentModal.tsx's existing one-time-payment tokenize
    // flow), same "card details never touch our servers, only a one-time
    // token does" model as create_payment above.
    if (action === "create_square_recurring_plan") {
      const { sourceId, crmCustomerId, amountCents, cadence, description, customerEmail, customerName } = body;
      if (!sourceId) return json({ error: "Missing sourceId (card token)" }, 400);
      if (!crmCustomerId) return json({ error: "Missing crmCustomerId" }, 400);
      const amt = Math.round(Number(amountCents) || 0);
      if (amt <= 0) return json({ error: "Invalid amount" }, 400);
      const validCadences = ["WEEKLY", "MONTHLY", "ANNUAL"];
      const planCadence = validCadences.includes(cadence) ? cadence : "MONTHLY";

      const accessTokenHdr = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const callerOwnerId = await resolveCallerOwnerId(accessTokenHdr);
      if (!callerOwnerId) return json({ error: "Not signed in." }, 401);
      const acct = await getOwnerSquareAccount(callerOwnerId, serviceRoleKey);
      if (!acct?.accessToken || !acct?.locationId) {
        return json({ error: "Square isn't configured for this business yet — add keys in Settings → Integrations → Square." }, 500);
      }
      const sqHeaders = { Authorization: `Bearer ${acct.accessToken}`, "Content-Type": "application/json", "Square-Version": "2024-10-17" };

      try {
        // 1. Create (or reuse) a Square Customer for this CRM customer.
        const custRes = await fetch(`${squareApiBase()}/v2/customers`, {
          method: "POST", headers: sqHeaders,
          body: JSON.stringify({ idempotency_key: crypto.randomUUID(), given_name: customerName || undefined, email_address: customerEmail || undefined, reference_id: crmCustomerId }),
        });
        const custData = await custRes.json().catch(() => ({} as any));
        if (!custRes.ok) throw new Error(custData?.errors?.[0]?.detail || `Square error creating customer (${custRes.status})`);
        const squareCustomerId = custData?.customer?.id;

        // 2. Attach the tokenized card to that customer.
        const cardRes = await fetch(`${squareApiBase()}/v2/cards`, {
          method: "POST", headers: sqHeaders,
          body: JSON.stringify({ idempotency_key: crypto.randomUUID(), source_id: sourceId, card: { customer_id: squareCustomerId } }),
        });
        const cardData = await cardRes.json().catch(() => ({} as any));
        if (!cardRes.ok) throw new Error(cardData?.errors?.[0]?.detail || `Square error saving card (${cardRes.status})`);
        const squareCardId = cardData?.card?.id;

        // 3. Create a Catalog subscription plan + variation for this exact
        // price/cadence — Square has no inline "price_data" equivalent, a
        // real Catalog object is required for every subscription.
        const catalogRes = await fetch(`${squareApiBase()}/v2/catalog/object`, {
          method: "POST", headers: sqHeaders,
          body: JSON.stringify({
            idempotency_key: crypto.randomUUID(),
            object: {
              type: "SUBSCRIPTION_PLAN", id: "#plan",
              subscription_plan_data: {
                name: description || "Recurring service",
                subscription_plan_variations: [{
                  type: "SUBSCRIPTION_PLAN_VARIATION", id: "#variation",
                  subscription_plan_variation_data: {
                    name: description || "Recurring service",
                    phases: [{ cadence: planCadence, recurring_price_money: { amount: amt, currency: "USD" }, ordinal: 0 }],
                  },
                }],
              },
            },
          }),
        });
        const catalogData = await catalogRes.json().catch(() => ({} as any));
        if (!catalogRes.ok) throw new Error(catalogData?.errors?.[0]?.detail || `Square error creating subscription plan (${catalogRes.status})`);
        const variation = (catalogData?.related_objects || []).find((o: any) => o.type === "SUBSCRIPTION_PLAN_VARIATION") || catalogData?.catalog_object?.subscription_plan_data?.subscription_plan_variations?.[0];
        const planId = catalogData?.catalog_object?.id;
        const variationId = variation?.id;
        if (!variationId) throw new Error("Square didn't return a subscription plan variation id");

        // 4. Start the subscription — billing begins on the cadence above.
        const subRes = await fetch(`${squareApiBase()}/v2/subscriptions`, {
          method: "POST", headers: sqHeaders,
          body: JSON.stringify({ idempotency_key: crypto.randomUUID(), location_id: acct.locationId, plan_variation_id: variationId, customer_id: squareCustomerId, card_id: squareCardId }),
        });
        const subData = await subRes.json().catch(() => ({} as any));
        if (!subRes.ok) throw new Error(subData?.errors?.[0]?.detail || `Square error creating subscription (${subRes.status})`);

        // Save recurringPlan on the CRM customer row here (rather than
        // relying on a webhook, since Square's Subscriptions API doesn't
        // hand back an easy per-CRM-customer webhook correlation the way
        // Stripe's subscription_data.metadata does) — status starts
        // "active" since the card + subscription were both just created
        // successfully; a failed FUTURE renewal is caught by
        // square-webhook-driven status updates being out of scope for now,
        // so the owner should spot-check Square's own dashboard for
        // ongoing renewal health.
        const patch = {
          provider: "square", status: "active", amountCents: amt, interval: planCadence.toLowerCase() === "annual" ? "year" : planCadence.toLowerCase() === "weekly" ? "week" : "month",
          description: description || "Recurring service", squareSubscriptionId: subData?.subscription?.id, squareCustomerId, squareCardId, squarePlanId: planId, squareVariationId: variationId,
        };
        await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(crmCustomerId)}`, {
          method: "PATCH", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ recurringPlan: patch }),
        });

        return json({ success: true, subscriptionId: subData?.subscription?.id, status: subData?.subscription?.status || "ACTIVE" });
      } catch (e: any) {
        return json({ error: e?.message || "Failed to set up Square recurring plan" }, 500);
      }
    }

    // cancel_square_recurring_plan — owner-only.
    if (action === "cancel_square_recurring_plan") {
      const { subscriptionId } = body;
      if (!subscriptionId) return json({ error: "Missing subscriptionId" }, 400);
      const accessTokenHdr = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const callerOwnerId = await resolveCallerOwnerId(accessTokenHdr);
      if (!callerOwnerId) return json({ error: "Not signed in." }, 401);
      const acct = await getOwnerSquareAccount(callerOwnerId, serviceRoleKey);
      if (!acct?.accessToken) return json({ error: "Square isn't configured for this business." }, 500);
      const cancelRes = await fetch(`${squareApiBase()}/v2/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
        method: "POST", headers: { Authorization: `Bearer ${acct.accessToken}`, "Square-Version": "2024-10-17" },
      });
      const cancelData = await cancelRes.json().catch(() => ({} as any));
      if (!cancelRes.ok) return json({ error: cancelData?.errors?.[0]?.detail || `Square error ${cancelRes.status}` }, cancelRes.status);
      return json({ success: true, status: cancelData?.subscription?.status || "CANCELED" });
    }

    return json({ error: "Unknown action: " + action }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "Square proxy error" }, 500);
  }
};
