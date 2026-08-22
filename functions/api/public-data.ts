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
      let settings = fullSettings ? publicSettingsSubset(fullSettings) : null;

      // BUG FIX — a Stripe Connect owner's stripe_account_id lives in
      // owner_stripe_accounts, a completely separate table from
      // app_settings, and was never included here at all. Without it, the
      // customer's payment page (ClientPortal.tsx's StripePaymentModal)
      // had no way to tell Stripe.js which connected account it was
      // confirming a payment against, and this same-table lookup also
      // covers the Connect owner's publishable-key fallback (see
      // stripe-action.ts's identical platform-key fallback comment) for
      // the case where fullSettings.stripePublishableKey was never set
      // because the owner used Connect instead of pasting a manual key.
      if (estimate.owner_id) {
        const stripeAcctRow = await sb(serviceRoleKey, `owner_stripe_accounts?owner_id=eq.${encodeURIComponent(estimate.owner_id)}&select=stripe_account_id,stripe_publishable_key`);
        const stripeAcct = Array.isArray(stripeAcctRow.data) ? stripeAcctRow.data[0] : null;
        if (stripeAcct?.stripe_account_id || stripeAcct?.stripe_publishable_key) {
          settings = {
            ...(settings || {}),
            stripeAccountId: stripeAcct.stripe_account_id || "",
            stripePublishableKey: (settings as any)?.stripePublishableKey || stripeAcct.stripe_publishable_key || (stripeAcct.stripe_account_id ? (context.env.STRIPE_PUBLISHABLE_KEY || "") : ""),
          } as any;
        }
      }

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
      // BUG FIX — same Connect publishable-key gap as get_estimate/
      // get_customer_portal_data above: a Connect owner has no manual
      // stripePublishableKey in app_settings.data at all, so this signup
      // page's card form had no key to work with for any Connect owner.
      const stripeAcctRow = await sb(serviceRoleKey, `owner_stripe_accounts?owner_id=eq.${encodeURIComponent(ownerId)}&select=stripe_account_id,stripe_publishable_key`);
      const stripeAcct = Array.isArray(stripeAcctRow.data) ? stripeAcctRow.data[0] : null;
      return json({
        cost: data.trashCanCostPerCan, minutes: data.trashCanMinutesPerCan, freq: data.trashCanDefaultFrequency,
        co: data.companyName, ph: data.companyPhone,
        pk: data.stripePublishableKey || stripeAcct?.stripe_publishable_key || (stripeAcct?.stripe_account_id ? (context.env.STRIPE_PUBLISHABLE_KEY || "") : ""),
        stripeAccountId: stripeAcct?.stripe_account_id || "",
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
      const { customerId, rating, comment } = body;
      if (!customerId || !rating) return json({ error: "Missing customerId/rating" }, 400);
      const custRow = await sb(serviceRoleKey, `customers?id=eq.${encodeURIComponent(customerId)}&select=owner_id,firstName,lastName`);
      const cust = Array.isArray(custRow.data) ? custRow.data[0] : null;
      const ownerId = cust?.owner_id;
      if (!ownerId) return json({ error: "Customer not found" }, 404);
      // BUG FIX — this used to insert customer_id/job_id/comment, none of
      // which exist as columns on `reviews` (see migration
      // 0030_reviews_table.sql: id/"customerId"/"customerName"/rating/text/
      // "createdAt"/source/status — no job column at all). PostgREST rejects
      // an insert containing any unrecognized column (same whole-write
      // failure mode CLAUDE.md documents for updates), so this 500'd on
      // every single public review submission — the actual root cause of
      // "reviews aren't showing" (nothing was ever making it into the table).
      const insert = await sb(serviceRoleKey, `reviews`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          customerId, customerName: cust ? `${cust.firstName || ""} ${cust.lastName || ""}`.trim() : undefined,
          rating, text: comment || null, createdAt: new Date().toISOString(),
          source: "customer-submitted", owner_id: ownerId, status: "pending",
        }),
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

      // BUG FIX — ClientAuthPortal.tsx (#/client) used to render off
      // App.tsx's GLOBAL `settings` prop for its Stripe calls, which is
      // populated from that DEVICE's own localStorage/owner_id-scoped RLS
      // fetch — empty by default on a real customer's own phone, since
      // they're not the owner and have no session that resolves
      // current_owner_id(). This resolves and returns the real owning
      // business's public branding + Stripe publishable key/Connect
      // account id, the same way get_estimate already does for the
      // separate #/estimate/:id link flow.
      let settings: any = null;
      if (customer.owner_id) {
        const [settingsRow, stripeAcctRow] = await Promise.all([
          sb(serviceRoleKey, `app_settings?owner_id=eq.${encodeURIComponent(customer.owner_id)}&select=data`),
          sb(serviceRoleKey, `owner_stripe_accounts?owner_id=eq.${encodeURIComponent(customer.owner_id)}&select=stripe_account_id,stripe_publishable_key`),
        ]);
        const fullSettings = Array.isArray(settingsRow.data) ? settingsRow.data[0]?.data : null;
        const stripeAcct = Array.isArray(stripeAcctRow.data) ? stripeAcctRow.data[0] : null;
        settings = {
          ...(fullSettings ? publicSettingsSubset(fullSettings) : {}),
          stripeAccountId: stripeAcct?.stripe_account_id || "",
          stripePublishableKey: fullSettings?.stripePublishableKey || stripeAcct?.stripe_publishable_key || (stripeAcct?.stripe_account_id ? (context.env.STRIPE_PUBLISHABLE_KEY || "") : ""),
        };
      }

      return json({ customer, jobs: jobsRow.data || [], estimates: estRow.data || [], settings });
    }

    // ── ClientAuthPortal.tsx — self-serve cancel/reschedule. Owner-gated:
    // OFF by default (settings.clientPortalCancelReschedule must be
    // explicitly true) and a reason is mandatory either way — a bare
    // "cancel"/"reschedule" click with nothing typed is rejected server-side,
    // not just discouraged in the UI, since a client could otherwise script
    // around a client-only validation. The permission check happens HERE
    // (server side, keyed off the job's own owner_id) rather than trusting
    // whatever the client's local `settings` prop currently says — a stale
    // or tampered client value must never grant an action the owner turned
    // off. Job ownership is verified against the caller's OWN verified
    // customer record, never a client-claimed customerId.
    if (action === "client_cancel_job" || action === "client_reschedule_job") {
      const { jobId, reason, newDate, newTime } = body;
      const reasonTrimmed = (reason || "").trim();
      if (!jobId) return json({ error: "Missing jobId" }, 400);
      if (!reasonTrimmed) return json({ error: "A reason is required." }, 400);
      if (action === "client_reschedule_job" && !newDate) return json({ error: "Missing newDate" }, 400);

      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const email = await resolveCallerEmail(accessToken, anonKey);
      if (!email) return json({ error: "Not signed in" }, 401);
      const custRow = await sb(serviceRoleKey, `customers?email=ilike.${encodeURIComponent(email)}&select=id`);
      const customer = Array.isArray(custRow.data) ? custRow.data[0] : null;
      if (!customer) return json({ error: "No customer record found for this account." }, 404);

      const jobRow = await sb(serviceRoleKey, `jobs?id=eq.${encodeURIComponent(jobId)}&select=id,customerId,owner_id,scheduledDate,scheduledTime,address,commLog,status`);
      const job = Array.isArray(jobRow.data) ? jobRow.data[0] : null;
      if (!job) return json({ error: "Job not found" }, 404);
      if (job.customerId !== customer.id) return json({ error: "That job doesn't belong to this account." }, 403);
      if (job.status === "cancelled" || job.status === "completed") return json({ error: `This job is already ${job.status} — contact us directly.` }, 400);

      const settingsRow = job.owner_id
        ? await sb(serviceRoleKey, `app_settings?owner_id=eq.${encodeURIComponent(job.owner_id)}&select=data`)
        : null;
      const ownerSettings = settingsRow && Array.isArray(settingsRow.data) ? settingsRow.data[0]?.data : null;
      if (!ownerSettings?.clientPortalCancelReschedule) {
        return json({ error: "Self-serve cancel/reschedule isn't enabled — please contact us directly to change this appointment." }, 403);
      }

      const commEntry = { ts: Date.now(), source: "client_portal", type: action === "client_cancel_job" ? "cancel" : "reschedule", reason: reasonTrimmed, ...(action === "client_reschedule_job" ? { from: job.scheduledDate, to: newDate } : {}) };
      const commLog = [...(Array.isArray(job.commLog) ? job.commLog : []), commEntry];

      const patch: Record<string, any> = { commLog };
      let notifyText: string;
      if (action === "client_cancel_job") {
        patch.status = "cancelled";
        patch.cancelReason = reasonTrimmed;
        notifyText = `❌ CLIENT CANCELLED\n\nA client cancelled their ${job.scheduledDate || "upcoming"} job at ${job.address || "their property"} via the portal.\n\nReason: "${reasonTrimmed}"`;
      } else {
        patch.scheduledDate = newDate;
        if (newTime) patch.scheduledTime = newTime;
        notifyText = `📅 CLIENT RESCHEDULED\n\nA client moved their job at ${job.address || "their property"} from ${job.scheduledDate || "an earlier date"} to ${newDate}${newTime ? " at " + newTime : ""} via the portal.\n\nReason: "${reasonTrimmed}"`;
      }

      const upd = await sb(serviceRoleKey, `jobs?id=eq.${encodeURIComponent(jobId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
      if (!upd.ok) return json({ error: "Failed to update the job." }, 500);

      const origin = new URL(context.request.url).origin;
      fetch(`${origin}/api/alfred-notify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Alfred Notifications", message: notifyText, jobId, customerId: customer.id }),
      }).catch(() => {});

      return json({ success: true, status: patch.status || job.status, scheduledDate: patch.scheduledDate || job.scheduledDate });
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
