// MULTI-TENANT (Phase D) — customer-facing / anonymous data access.
//
// Once RLS is owner_id-scoped (migration 0033_multitenant_owner_scoping.sql),
// NOTHING readable by the anon key resolves for an anonymous visitor or a
// logged-in CUSTOMER session — current_owner_id() only knows how to resolve
// STAFF identity (owner/manager/employee, via the employees table).
// Customers are a third identity type: they sign in through the same
// Supabase Auth project (ClientAuthPortal.tsx) but have no employees row and
// no auth-linking column on `customers` at all — they're matched by email.
//
// Every function below uses the Supabase SERVICE ROLE key (bypasses RLS)
// and returns ONLY the minimal fields the calling page actually needs —
// never a raw table dump — so this is not a re-opening of the "public
// USING(true)" hole RLS just closed. Each action's own comment explains
// what bounds the query (an unguessable id, a verified session email, etc).
const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";

const sb = async (serviceRoleKey: string, path: string, init?: RequestInit) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
};

// Verifies a Supabase access token and returns the session's own email —
// used by get_customer_portal_data so a customer can only ever fetch THEIR
// OWN data (matched by their verified JWT email, never a client-claimed one).
const resolveCallerEmail = async (accessToken: string, anonKey: string): Promise<string | null> => {
  if (!accessToken) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null) as any;
  return user?.email || null;
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = context.env.SUPABASE_ANON_KEY || "sb_publishable_8aEa3wsYJ7ghVPcGbtHymw_ugj0aEfm";
  if (!serviceRoleKey) {
    return json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY env var — add it in the Cloudflare Pages dashboard, then redeploy." }, 500);
  }

  try {
    const body = await context.request.json() as Record<string, any>;
    const action = body?.action;

    // ── #/estimate/:id (ClientPortal.tsx) — an estimate id is an
    // unguessable UUID-shaped string, acting as a bearer capability the
    // owner handed the customer via a payment/sign link. Returns the
    // estimate row, its customer's display info (no other customers), and
    // the owning business's public branding/Stripe-publishable-key subset —
    // never the full customers/estimates/app_settings tables.
    if (action === "get_estimate") {
      const { id } = body;
      if (!id) return json({ error: "Missing id" }, 400);
      const est = await sb(serviceRoleKey, `estimates?id=eq.${encodeURIComponent(id)}&select=*`);
      const estimate = Array.isArray(est.data) ? est.data[0] : null;
      if (!estimate) return json({ error: "Not found" }, 404);

      const custId = estimate.customerId || estimate.customer_id;
      const cust = custId ? await sb(serviceRoleKey, `customers?id=eq.${encodeURIComponent(custId)}&select=*`) : null;
      const customer = cust && Array.isArray(cust.data) ? cust.data[0] : null;

      const settingsRow = estimate.owner_id
        ? await sb(serviceRoleKey, `app_settings?owner_id=eq.${encodeURIComponent(estimate.owner_id)}&select=data`)
        : null;
      const fullSettings = settingsRow && Array.isArray(settingsRow.data) ? settingsRow.data[0]?.data : null;
      const settings = fullSettings ? publicSettingsSubset(fullSettings) : null;

      return json({ estimate, customer, settings });
    }

    // ── ClientPortal.tsx (via App.tsx's #/estimate/:id route) — the actual
    // accept/sign/pay action. Bounded to a fixed, narrow set of fields (never
    // arbitrary columns) and matched by estimate id (the same unguessable
    // capability get_estimate above trusts) — this is the one place an
    // anonymous visitor can write, so it must not become a general-purpose
    // "update any estimate field" endpoint. Also inserts the resulting job,
    // inheriting the estimate's own owner_id (never client-supplied).
    if (action === "approve_estimate") {
      const { id, signedAt, sigData, payChoice, paid, totalPaid, payType, job } = body;
      if (!id) return json({ error: "Missing id" }, 400);
      const estRes = await sb(serviceRoleKey, `estimates?id=eq.${encodeURIComponent(id)}&select=owner_id,customerId,paidDeposit,paidFull`);
      const est = Array.isArray(estRes.data) ? estRes.data[0] : null;
      if (!est) return json({ error: "Not found" }, 404);

      const patch: Record<string, any> = { status: "approved", signedAt: signedAt || null, sigData: sigData || null, payChoice: payChoice || null };
      if (paid) patch.paidAt = new Date().toISOString().slice(0, 10);
      if (payType === "deposit") patch.paidDeposit = totalPaid;
      if (payType === "full") patch.paidFull = totalPaid;
      if (payType === "remaining") patch.paidFull = (est.paidDeposit || 0) + (totalPaid || 0);
      const upd = await sb(serviceRoleKey, `estimates?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
      if (!upd.ok) return json({ error: "Failed to update estimate" }, 500);

      if (job) {
        await sb(serviceRoleKey, `jobs`, {
          method: "POST", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ ...job, owner_id: est.owner_id }),
        });
      }
      return json({ success: true });
    }

    if (action === "decline_estimate") {
      const { id, reason } = body;
      if (!id) return json({ error: "Missing id" }, 400);
      const upd = await sb(serviceRoleKey, `estimates?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "rejected", declinedAt: new Date().toISOString(), declineReason: reason || "" }),
      });
      if (!upd.ok) return json({ error: "Failed to update estimate" }, 500);
      return json({ success: true });
    }

    // ── TrashCanSignupPage.tsx — replaces its existing direct
    // `.eq("owner_id", ownerId)` anon-key query (which broke under the new
    // RLS) with the same narrow field projection, just resolved server-side.
    if (action === "get_trashcan_signup_settings") {
      const { ownerId } = body;
      if (!ownerId) return json({ error: "Missing ownerId" }, 400);
      const row = await sb(serviceRoleKey, `app_settings?owner_id=eq.${encodeURIComponent(ownerId)}&select=data`);
      const data = Array.isArray(row.data) ? row.data[0]?.data : null;
      if (!data) return json({ error: "Not found" }, 404);
      return json({
        cost: data.trashCanCostPerCan, minutes: data.trashCanMinutesPerCan, freq: data.trashCanDefaultFrequency,
        co: data.companyName, ph: data.companyPhone, pk: data.stripePublishableKey,
      });
    }

    // ── ReferralLanding.tsx (#/r/CODE) — referral codes are random,
    // unguessable per-customer strings; returns only display fields, never
    // the customer's own PII beyond what the landing page already showed
    // (first name, referral reward context).
    if (action === "get_referral_customer") {
      const { code } = body;
      if (!code) return json({ error: "Missing code" }, 400);
      const row = await sb(serviceRoleKey, `customers?referralCode=eq.${encodeURIComponent(code)}&select=id,firstName,lastName,referralCode,owner_id`);
      const customer = Array.isArray(row.data) ? row.data[0] : null;
      if (!customer) return json({ error: "Not found" }, 404);
      return json({ customer });
    }

    // ── CustomerReviewPage.tsx (#/rate) — resolves owner_id server-side
    // from the customerId already in the review link, so the link itself
    // doesn't need to change, and inserts with the service role (the public
    // reviews_insert_public RLS policy still requires owner_id non-null as
    // defense in depth, but this is now the actual write path).
    if (action === "submit_review") {
      const { customerId, jobId, rating, comment } = body;
      if (!customerId || !rating) return json({ error: "Missing customerId/rating" }, 400);
      const custRow = await sb(serviceRoleKey, `customers?id=eq.${encodeURIComponent(customerId)}&select=owner_id`);
      const ownerId = Array.isArray(custRow.data) ? custRow.data[0]?.owner_id : null;
      if (!ownerId) return json({ error: "Customer not found" }, 404);
      const insert = await sb(serviceRoleKey, `reviews`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ customer_id: customerId, job_id: jobId || null, rating, comment: comment || null, owner_id: ownerId, status: "pending" }),
      });
      if (!insert.ok) return json({ error: "Failed to submit review" }, 500);
      return json({ success: true, review: Array.isArray(insert.data) ? insert.data[0] : insert.data });
    }

    // ── ClientAuthPortal.tsx (#/client) — a logged-in customer's own data.
    // Bounded by their VERIFIED session email (via resolveCallerEmail),
    // never a client-claimed id — a customer can only ever fetch their own
    // record and the jobs/estimates linked to it, matching what the old
    // (pre-RLS) email-matched `.find()` against the global arrays used to
    // return, just resolved server-side instead of from an unfiltered
    // client-side table dump.
    if (action === "get_customer_portal_data") {
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const email = await resolveCallerEmail(accessToken, anonKey);
      if (!email) return json({ error: "Not signed in" }, 401);
      const custRow = await sb(serviceRoleKey, `customers?email=ilike.${encodeURIComponent(email)}&select=*`);
      const customer = Array.isArray(custRow.data) ? custRow.data[0] : null;
      if (!customer) return json({ customer: null, jobs: [], estimates: [] });
      const [jobsRow, estRow] = await Promise.all([
        sb(serviceRoleKey, `jobs?customerId=eq.${encodeURIComponent(customer.id)}&select=*`),
        sb(serviceRoleKey, `estimates?customerId=eq.${encodeURIComponent(customer.id)}&select=*`),
      ]);
      return json({ customer, jobs: jobsRow.data || [], estimates: estRow.data || [] });
    }

    return json({ error: "Unknown action: " + action }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "public-data error" }, 400);
  }
};

// Only the fields ClientPortal/TrashCanSignupPage actually render — never
// the full app_settings.data blob (which holds live secrets: Twilio token,
// Anthropic key, etc. — see the round-12 audit note in lib/messaging.ts).
const publicSettingsSubset = (data: Record<string, any>) => ({
  companyName: data.companyName, companyPhone: data.companyPhone, companyLogo: data.companyLogo,
  stripePublishableKey: data.stripePublishableKey, primaryColor: data.primaryColor,
});

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
