// FEATURE — "let people sign up and pay for CrewBoss, and help me get
// paid." This is the PLATFORM's own billing (CrewBoss charging a signed-up
// business owner a subscription) — completely separate from stripe-action.ts
// (that file is per-owner, for THEIR business charging ITS OWN customers).
// Requires two NEW Cloudflare Pages env vars, distinct from the existing
// STRIPE_SECRET_KEY/STRIPE_PUBLISHABLE_KEY (which stay per-owner):
//   PLATFORM_STRIPE_SECRET_KEY      — the CrewBoss platform's own Stripe secret key
//   PLATFORM_STRIPE_WEBHOOK_SECRET  — see platform-billing-webhook.ts
// Plan prices are defined server-side below (PLANS), matching
// src/components/pages/LandingPage.tsx's PLANS export — kept as the same
// numbers, not fetched from Stripe, so pricing-page copy and what's
// actually charged can never drift apart silently. Checkout uses Stripe's
// inline `price_data` (a real, fully supported recurring-price shape) so
// nothing needs to be pre-created as a Product/Price in the Stripe
// dashboard — just the one secret key.
const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8aEa3wsYJ7ghVPcGbtHymw_ugj0aEfm";
const TRIAL_DAYS = 14;

const PLANS: Record<string, { monthly: number; annual: number }> = {
  solo: { monthly: 29, annual: 23 },
  crew: { monthly: 59, annual: 47 },
  growth: { monthly: 119, annual: 95 },
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
  if (!res.ok) throw new Error((data as any)?.error?.message || `Stripe error ${res.status}`);
  return data;
};

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    const body = await context.request.json() as Record<string, any>;
    const action = body?.action;
    const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
    const platformSecretKey = context.env.PLATFORM_STRIPE_SECRET_KEY;
    if (!serviceRoleKey) return json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY." }, 500);

    const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const ownerId = await resolveCallerOwnerId(accessToken);
    if (!ownerId) return json({ error: "Not signed in." }, 401);
    const svcHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };

    // start_trial — called once, right after a new owner finishes signing
    // up. Idempotent: never resets an existing trial/subscription row.
    if (action === "start_trial") {
      const existing = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?owner_id=eq.${encodeURIComponent(ownerId)}&select=owner_id`, { headers: svcHeaders });
      const existingRows = await existing.json().catch(() => []);
      if (Array.isArray(existingRows) && existingRows.length > 0) return json({ success: true, alreadyStarted: true });
      const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions`, {
        method: "POST",
        headers: { ...svcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ owner_id: ownerId, status: "trialing", trial_ends_at: trialEndsAt }),
      });
      if (!res.ok) return json({ error: "Couldn't start trial — " + (await res.text().catch(() => "")).slice(0, 200) }, 500);
      return json({ success: true, trialEndsAt });
    }

    if (action === "get_status") {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?owner_id=eq.${encodeURIComponent(ownerId)}&select=*&limit=1`, { headers: svcHeaders });
      const rows = await res.json().catch(() => []);
      return json({ subscription: Array.isArray(rows) ? rows[0] || null : null });
    }

    if (action === "create_checkout_session") {
      if (!platformSecretKey) return json({ error: "Platform billing isn't configured yet (PLATFORM_STRIPE_SECRET_KEY missing)." }, 500);
      const plan = String(body.plan || "").toLowerCase();
      const interval = body.interval === "year" ? "year" : "month";
      const priceDef = PLANS[plan];
      if (!priceDef) return json({ error: `Unknown plan "${body.plan}".` }, 400);
      const amountCents = Math.round((interval === "year" ? priceDef.annual : priceDef.monthly) * 100);

      // Reuse an existing Stripe customer for this owner if one's on file
      // (avoids creating a duplicate customer object every time they visit
      // the billing page), else let Checkout create one.
      const subRes = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?owner_id=eq.${encodeURIComponent(ownerId)}&select=stripe_customer_id&limit=1`, { headers: svcHeaders });
      const subRows = await subRes.json().catch(() => []);
      const existingCustomerId = Array.isArray(subRows) ? subRows[0]?.stripe_customer_id : undefined;

      const params: Record<string, string> = {
        mode: "subscription",
        success_url: body.successUrl,
        cancel_url: body.cancelUrl,
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": `CrewBoss — ${plan[0].toUpperCase() + plan.slice(1)} (${interval === "year" ? "Annual" : "Monthly"})`,
        "line_items[0][price_data][unit_amount]": String(amountCents),
        "line_items[0][price_data][recurring][interval]": interval,
        "line_items[0][quantity]": "1",
        "metadata[ownerId]": ownerId,
        "metadata[plan]": plan,
        "metadata[interval]": interval,
        "subscription_data[metadata][ownerId]": ownerId,
        "subscription_data[metadata][plan]": plan,
        "subscription_data[metadata][interval]": interval,
      };
      if (existingCustomerId) params.customer = existingCustomerId;
      else if (body.email) params.customer_email = body.email;
      const session = await stripeFetch(platformSecretKey, "POST", "checkout/sessions", params);
      return json({ url: session.url });
    }

    // create_portal_session — real Stripe-hosted self-service billing
    // (update card, change plan, cancel) instead of building a custom
    // cancel/upgrade UI here.
    if (action === "create_portal_session") {
      if (!platformSecretKey) return json({ error: "Platform billing isn't configured yet." }, 500);
      const subRes = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?owner_id=eq.${encodeURIComponent(ownerId)}&select=stripe_customer_id&limit=1`, { headers: svcHeaders });
      const subRows = await subRes.json().catch(() => []);
      const customerId = Array.isArray(subRows) ? subRows[0]?.stripe_customer_id : undefined;
      if (!customerId) return json({ error: "No billing account on file yet — subscribe first." }, 400);
      const portal = await stripeFetch(platformSecretKey, "POST", "billing_portal/sessions", { customer: customerId, return_url: body.returnUrl });
      return json({ url: portal.url });
    }

    return json({ error: "Unknown action: " + action }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "Platform billing error" }, 400);
  }
};
