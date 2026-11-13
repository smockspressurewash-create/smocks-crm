import { notifyOwnerInvoiceEvent } from "./_lib/ownerNotify";
import { redeemPromoForInvoice } from "./_lib/promoRedeem";
// FIX 1 (mobile round 8) — server-side, signature-verified source of truth
// for "was this invoice actually paid." Previously the ONLY place an invoice
// got marked paid was client-side code trusting its own read of the Stripe
// session/payment intent (see InvoicesPage.tsx) — a tampered client could
// call the same setEstimates/Supabase-update path directly without ever
// paying. This endpoint verifies the request really came from Stripe (HMAC
// signature check using STRIPE_WEBHOOK_SECRET) before writing anything.
//
// Setup:
// 1. Cloudflare Pages dashboard → this project → Settings → Environment
//    variables → add STRIPE_WEBHOOK_SECRET.
// 2. Stripe dashboard → Developers → Webhooks → Add endpoint →
//    https://<your-domain>/api/stripe-webhook
//    → select events: checkout.session.completed, checkout.session.async_payment_succeeded,
//      payment_intent.succeeded, payment_intent.payment_failed, charge.refunded,
//      charge.dispute.created, invoice.paid, invoice.payment_failed,
//      customer.subscription.deleted (the last three power recurring billing —
//      see create_recurring_checkout_session in stripe-action.ts)
// 3. Stripe shows the signing secret ("whsec_...") when you create the
//    endpoint — that's the value for STRIPE_WEBHOOK_SECRET.
//
// Writes here require SUPABASE_SERVICE_ROLE_KEY (see logPaymentEvent below)
// — `estimates` has owner_id-scoped RLS (migration 0033), and this webhook
// has no Supabase Auth session at all (Stripe calls it directly), so the
// anon key cannot read or write it. The HMAC signature check above is this
// endpoint's real authorization boundary: once that passes, the
// service-role key is what actually lets it record a real payment.

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";

// Stripe's signature scheme: header is "t=<timestamp>,v1=<hex hmac>[,v0=...]".
// The signed payload is "<timestamp>.<raw body>", HMAC-SHA256'd with the
// webhook secret. Verified here with the platform's native Web Crypto
// SubtleCrypto (available in the Cloudflare Workers runtime) rather than a
// Stripe SDK, matching this codebase's existing "direct API calls, no SDK"
// pattern (see lib/stripe.ts).
const verifyStripeSignature = async (payload: string, sigHeader: string, secret: string): Promise<boolean> => {
  if (!sigHeader) return false;
  // BUG FIX (integration audit 2026-11-13) — Stripe can send several v1
  // signatures at once (for example while a webhook secret is being rolled).
  // The old code kept only the last one, so a real event could be refused.
  // Any one matching v1 signature now passes.
  const pairs = sigHeader.split(",").map(kv => {
    const idx = kv.indexOf("=");
    return [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()];
  });
  const timestamp = pairs.find(([k]) => k === "t")?.[1];
  const sigs = pairs.filter(([k, v]) => k === "v1" && v).map(([, v]) => v);
  if (!timestamp || sigs.length === 0) return false;
  // Stripe's recommended replay protection: refuse events signed more than
  // 5 minutes ago (a captured old request can't be re-sent later).
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

  let anyMatch = false;
  for (const v1 of sigs) {
    if (expected.length !== v1.length) continue;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
    if (diff === 0) anyMatch = true;
  }
  return anyMatch;
};

// BUG FIX (integration audit 2026-11-13) — when the event came in on an
// owner's own webhook URL (?oid=), every read and write is limited to that
// owner's rows. Before, an event signed with ANY owner's secret could name
// another business's invoice/customer id in its metadata and change it.
const ownerFilter = (ownerId?: string) => (ownerId ? `&owner_id=eq.${encodeURIComponent(ownerId)}` : "");

// CRITICAL SECURITY/CORRECTNESS FIX — this webhook is the ONLY
// server-side-verified place an invoice ever gets marked paid (see the
// header comment above), but it was still reading/writing `estimates`
// with the ANON key. `estimates` has since moved to owner_id-scoped RLS
// (owner_id = current_owner_id(), see migration 0033 / CLAUDE.md) —
// current_owner_id() resolves via auth.uid(), and this webhook has NO
// Supabase Auth session at all (Stripe calls it directly, no JWT). That
// means every read here was silently returning ZERO rows (so a real
// existing paymentLog got quietly discarded — data loss) and every write
// was matching ZERO rows (PostgREST reports 200/204 on an RLS-filtered
// 0-row UPDATE — no error, no retry from Stripe, and the invoice was
// simply never actually marked paid). This webhook's real authorization
// boundary is the HMAC signature check above, not a Supabase session — so
// once that passes, it must use the service-role key to actually read and
// write, the same trust model stripe-action.ts already uses for every
// service-role-gated action.
const logPaymentEvent = async (
  invoiceId: string,
  entry: { type: "paid" | "failed" | "refunded" | "disputed"; amount?: number; stripePaymentIntentId?: string; stripeRefundId?: string; stripeEventId?: string; discount?: number; note?: string },
  statusPatch: Record<string, unknown>,
  serviceRoleKey: string,
  // Called once when this event is recorded for the first time (never on a
  // redelivery) — tells the owner right away (see _lib/ownerNotify.ts).
  onNew?: (invoiceId: string, entry: { type: "paid" | "failed" | "refunded" | "disputed"; amount?: number }) => Promise<void>,
  ownerId?: string
): Promise<boolean> => {
  if (!serviceRoleKey) {
    console.error("[StripeWebhook] SUPABASE_SERVICE_ROLE_KEY not configured — cannot write invoice status under owner-scoped RLS. Add it in the Cloudflare Pages dashboard.");
    return false;
  }
  const authHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}${ownerFilter(ownerId)}&select=paymentLog`, {
    headers: authHeaders,
  });
  const rows = await getRes.json().catch(() => []);
  const existingLog = Array.isArray(rows) && Array.isArray(rows[0]?.paymentLog) ? rows[0].paymentLog : [];
  // BUG FIX (audit) — Stripe delivers webhooks at-least-once (retries on any
  // non-2xx response, plus a dashboard "Resend"). checkout.session.completed
  // and payment_intent.succeeded can also both legitimately fire for the
  // SAME real payment. Without this check, every redelivery/overlap appended
  // another paymentLog entry for the same event, and — since this function's
  // whole job is recording an event, not just patching status fields — kept
  // "succeeding" every time, which is exactly the kind of duplicate this
  // dedup exists to catch. Match on type + the Stripe id that identifies the
  // underlying event (payment intent id covers paid/failed/refunded; the
  // dispute path has no payment intent on some accounts, so it also matches
  // on note+type as a fallback).
  // BUG FIX (integration audit 2026-11-13) — refunds are matched by the
  // refund id (or the Stripe event id), not the charge. Matching on the
  // charge meant a second partial refund on the same payment was thrown away
  // as a "duplicate" of the first.
  const refundKey = entry.type === "refunded" ? (entry.stripeRefundId || entry.stripeEventId) : undefined;
  const alreadyLogged = refundKey
    ? existingLog.some((e: any) => e?.type === "refunded" && (e?.stripeRefundId === refundKey || e?.stripeEventId === refundKey))
    : entry.stripePaymentIntentId
    ? existingLog.some((e: any) => e?.type === entry.type && e?.stripePaymentIntentId === entry.stripePaymentIntentId)
    : existingLog.some((e: any) => e?.type === entry.type && e?.note === entry.note);
  if (alreadyLogged) {
    console.log("[StripeWebhook] duplicate event for invoice", invoiceId, "type", entry.type, "— already recorded, skipping re-write");
    return true;
  }
  const newLog = [...existingLog, { id: crypto.randomUUID(), at: new Date().toISOString(), ...entry }];

  // .select("id") + explicit 0-row check — same reasoning as every other
  // owner_id-scoped write in this app (CLAUDE.md): PostgREST does not
  // error on an RLS-filtered 0-row UPDATE, so this must be checked
  // explicitly or a real failure here reads as a silent success.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}${ownerFilter(ownerId)}&select=id`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ ...statusPatch, paymentLog: newLog }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[StripeWebhook] Supabase update failed:", res.status, errText);
    return false;
  }
  const updated = await res.json().catch(() => []);
  if (!Array.isArray(updated) || updated.length === 0) {
    console.error("[StripeWebhook] update matched 0 rows for invoice", invoiceId, "— invoice not found or owner_id mismatch");
    return false;
  }
  if (onNew) await onNew(invoiceId, entry).catch(() => {});
  return true;
};

const markInvoicePaid = async (invoiceId: string, paymentIntentId: string, serviceRoleKey: string, amount?: number, payType?: string, tipCents?: number, onNew?: (invoiceId: string, entry: any) => Promise<void>, ownerId?: string, discountCents?: number): Promise<boolean> => {
  const paidAt = new Date().toISOString().slice(0, 10);
  // Deposit vs balance: create_payment_intent stamps metadata.payType. A
  // balance payment must also set paidFull, or the invoice keeps showing
  // the remainder as still due.
  let amounts: Record<string, any> = {};
  if (payType && amount != null) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}${ownerFilter(ownerId)}&select=paidDeposit`, { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
    const rows = await r.json().catch(() => []);
    const paidDeposit = Number(Array.isArray(rows) ? rows[0]?.paidDeposit : 0) || 0;
    const net = amount - (Number(tipCents) || 0) / 100;
    amounts = payType === "deposit" ? { paidDeposit: net } : payType === "remaining" ? { paidFull: paidDeposit + net } : { paidFull: net };
  }
  // BUG FIX (integration audit 2026-11-13) — the coupon/referral discount
  // taken on this payment is saved on its log entry, so the balance after a
  // discounted deposit is total - discount - paid (see _lib/amountDue.ts)
  // instead of quietly charging the discount back on the balance.
  const discount = (Number(discountCents) || 0) / 100;
  return logPaymentEvent(
    invoiceId,
    { type: "paid", amount, stripePaymentIntentId: paymentIntentId, note: "Paid via Stripe", ...(discount > 0 ? { discount } : {}) },
    { paidAt, ...amounts, stripePaymentStatus: "paid", stripePaymentIntentId: paymentIntentId },
    serviceRoleKey,
    onNew,
    ownerId
  );
};

// RECURRING BILLING — subscription lifecycle events don't carry an
// invoiceId (this app's estimates table), only the crmCustomerId stashed in
// subscription_data.metadata at checkout time (see stripe-action.ts's
// create_recurring_checkout_session). Patches customers.recurringPlan (a
// JSONB blob — Postgres folds the unquoted "recurringPlan" column name to
// lowercase, see CLAUDE.md, so PostgREST's own column resolution handles
// that automatically as long as this patch key matches the camelCase the
// client also reads/writes it as).
const patchCustomerRecurringPlan = async (
  crmCustomerId: string,
  patch: Record<string, unknown>,
  serviceRoleKey: string,
  ownerId?: string
): Promise<boolean> => {
  if (!serviceRoleKey || !crmCustomerId) return false;
  const authHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  // BUG FIX (integration audit 2026-11-13) — limited to the webhook's owner.
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(crmCustomerId)}${ownerFilter(ownerId)}&select=recurringPlan`, { headers: authHeaders });
  const rows = await getRes.json().catch(() => []);
  const existing = Array.isArray(rows) && rows[0]?.recurringPlan ? rows[0].recurringPlan : {};
  const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(crmCustomerId)}${ownerFilter(ownerId)}&select=id`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ recurringPlan: { ...existing, ...patch } }),
  });
  if (!res.ok) { console.error("[StripeWebhook] recurringPlan update failed:", res.status, await res.text().catch(() => "")); return false; }
  const updated = await res.json().catch(() => []);
  return Array.isArray(updated) && updated.length > 0;
};

// A successful recurring charge is real revenue and should show up in the
// owner's Dashboard/Invoices exactly like any other payment — recorded as a
// paid `estimates` row (invoices ARE estimate rows with invoiced:true, see
// CLAUDE.md) rather than only living inside the Stripe-side subscription.
const recordRecurringPayment = async (
  crmCustomerId: string,
  ownerId: string,
  amount: number,
  description: string,
  stripeInvoiceId: string,
  serviceRoleKey: string
): Promise<boolean> => {
  if (!serviceRoleKey || !ownerId) return true;
  const authHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  // BUG FIX (integration audit 2026-11-13) — only record the payment when
  // the customer really belongs to this owner, so an event can't drop a
  // fake "paid" invoice into another business's books.
  const custCheck = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(crmCustomerId)}${ownerFilter(ownerId)}&select=id&limit=1`, { headers: authHeaders });
  const custRows = await custCheck.json().catch(() => []);
  if (!Array.isArray(custRows) || custRows.length === 0) {
    console.error("[StripeWebhook] recurring payment customer not found for this owner — not recorded");
    return true;
  }
  // BUG FIX (audit) — Stripe delivers webhooks at-least-once (retries on any
  // non-2xx from this endpoint, plus a dashboard "Resend"). Without this
  // check, every redelivery of the same invoice.paid event inserted ANOTHER
  // duplicate "paid" invoice row for the same real recurring charge — see
  // migration 0081_recurring_payment_idempotency.sql.
  if (stripeInvoiceId) {
    const dupRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?stripeInvoiceId=eq.${encodeURIComponent(stripeInvoiceId)}${ownerFilter(ownerId)}&select=id&limit=1`, { headers: authHeaders });
    const dupRows = await dupRes.json().catch(() => []);
    if (Array.isArray(dupRows) && dupRows.length > 0) {
      console.log("[StripeWebhook] recurring payment for Stripe invoice", stripeInvoiceId, "already recorded as", dupRows[0].id, "— skipping duplicate insert");
      return true;
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  // BUG FIX (integration audit 2026-11-13) — the insert result was never
  // checked, so a failed save still answered Stripe "OK" and the payment was
  // lost for good. A failure now returns false, the webhook answers 500 and
  // Stripe retries.
  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      customerId: crmCustomerId,
      owner_id: ownerId,
      invoiced: true,
      status: "accepted",
      title: description || "Recurring service",
      items: [{ id: crypto.randomUUID(), description: description || "Recurring service", qty: 1, price: amount }],
      total: amount,
      paidAt: today,
      stripePaymentStatus: "paid",
      stripeInvoiceId: stripeInvoiceId || undefined,
      paymentLog: [{ id: crypto.randomUUID(), at: new Date().toISOString(), type: "paid", amount, note: "Recurring payment via Stripe (" + stripeInvoiceId + ")" }],
      createdAt: Date.now(),
    }),
  }).catch(e => { console.error("[StripeWebhook] recordRecurringPayment insert failed:", e?.message); return null; });
  if (!insRes || !insRes.ok) {
    if (insRes) console.error("[StripeWebhook] recordRecurringPayment insert failed:", insRes.status, await insRes.text().catch(() => ""));
    return false;
  }
  return true;
};

// MULTI-TENANT (Phase F) — each business configures its OWN Stripe webhook
// in its OWN Stripe dashboard, pointing at this same endpoint with an
// `?oid=<ownerId>` query param (mirrors TrashCanSignupPage.tsx's existing
// `?oid=` convention for public per-owner links). That query param — not
// anything in the payload — is what selects WHICH webhook secret to verify
// the signature against, so one owner's events can never be validated
// against (and therefore never write into) another owner's data using a
// stolen/guessed oid: an attacker without that owner's real webhook secret
// simply fails signature verification below, same as always.
const getOwnerWebhookSecret = async (ownerId: string, serviceRoleKey: string): Promise<string | null> => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/owner_stripe_accounts?owner_id=eq.${encodeURIComponent(ownerId)}&select=stripe_webhook_secret`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0]?.stripe_webhook_secret ? rows[0].stripe_webhook_secret : null;
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const url = new URL(context.request.url);
  const oid = url.searchParams.get("oid");
  // BUG FIX (integration audit 2026-11-13) — events on an owner's own
  // webhook URL only ever touch that owner's rows (see ownerFilter above).
  const scopeOwnerId = oid || undefined;

  let secret: string | null = null;
  if (oid && context.env.SUPABASE_SERVICE_ROLE_KEY) {
    secret = await getOwnerWebhookSecret(oid, context.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  // Falls back to the platform-wide secret when no ?oid= is present (the
  // original single-tenant webhook URL some deployments already have
  // configured in their Stripe dashboard keeps working unmodified) or when
  // that owner hasn't set their own webhook secret yet.
  if (!secret) secret = context.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response(JSON.stringify({ error: oid ? `No Stripe webhook secret on file for owner ${oid}, and no platform STRIPE_WEBHOOK_SECRET fallback is set.` : "Server missing STRIPE_WEBHOOK_SECRET env var — add it in the Cloudflare Pages dashboard" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  // MUST read the raw body text before any JSON parsing — the signature is
  // computed over the exact bytes Stripe sent, and re-serializing parsed
  // JSON would not reproduce the same bytes.
  const payload = await context.request.text();
  const sigHeader = context.request.headers.get("stripe-signature") || "";
  const valid = await verifyStripeSignature(payload, sigHeader, secret);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid Stripe signature" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response(JSON.stringify({ error: "Malformed JSON body" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY || "";
  try {
    let ok = true;

    const notify = (id: string, e: { type: "paid" | "failed" | "refunded" | "disputed"; amount?: number }) => notifyOwnerInvoiceEvent(context.env, url.origin, id, e.type, e.amount);
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data?.object || {};
      const invoiceId = session.metadata?.invoiceId || session.client_reference_id;
      const paymentIntentId = session.payment_intent || session.id;
      if (invoiceId && session.payment_status === "paid") {
        ok = await markInvoicePaid(invoiceId, paymentIntentId || "", serviceRoleKey, (session.amount_total || 0) / 100, session.metadata?.payType, 0, notify, scopeOwnerId, Number(session.metadata?.discountCents) || 0);
      }
    } else if (event.type === "payment_intent.succeeded") {
      const intent = event.data?.object || {};
      const invoiceId = intent.metadata?.invoiceId;
      if (invoiceId) ok = await markInvoicePaid(invoiceId, intent.id, serviceRoleKey, (intent.amount || 0) / 100, intent.metadata?.payType, Number(intent.metadata?.tipCents) || 0, notify, scopeOwnerId, Number(intent.metadata?.discountCents) || 0);
      // A coupon on this payment is used up now (once per invoice).
      if (ok && invoiceId && intent.metadata?.promoId) await redeemPromoForInvoice(serviceRoleKey, intent.metadata.promoId, invoiceId);
    } else if (event.type === "payment_intent.payment_failed") {
      // AUDIT (round 12) — previously unhandled entirely: a declined card
      // meant Stripe knew, but this app never did — no log, no owner
      // notification, nothing. Sets paymentFailedAt, which App.tsx's
      // existing owner-notification diff effect already watches (toast +
      // bell), so the owner finds out the moment it happens instead of only
      // noticing an invoice is still unpaid days later.
      const intent = event.data?.object || {};
      const invoiceId = intent.metadata?.invoiceId;
      if (invoiceId) {
        const reason = intent.last_payment_error?.message || "Card declined";
        ok = await logPaymentEvent(
          invoiceId,
          { type: "failed", amount: (intent.amount || 0) / 100, stripePaymentIntentId: intent.id, note: reason },
          { paymentFailedAt: new Date().toISOString() },
          serviceRoleKey,
          notify,
          scopeOwnerId
        );
      }
    } else if (event.type === "invoice.paid") {
      // Fires for EVERY successful recurring charge, including the very
      // first one right after checkout — this is the single source of
      // truth for "a recurring payment actually landed." (Real activation
      // for a brand-new plan happens here too, not on
      // checkout.session.completed, since a subscription Checkout session
      // doesn't carry payment_status the same way a one-time session does.)
      const invoice = event.data?.object || {};
      const subId = invoice.subscription;
      const crmCustomerId = invoice.subscription_details?.metadata?.crmCustomerId || invoice.lines?.data?.[0]?.metadata?.crmCustomerId;
      // BUG FIX (integration audit 2026-11-13) — on an owner's own webhook
      // URL the owner is that URL's owner, never one named in the metadata.
      const ownerId = oid || invoice.subscription_details?.metadata?.ownerId || invoice.lines?.data?.[0]?.metadata?.ownerId || "";
      const amount = (invoice.amount_paid || 0) / 100;
      const description = invoice.lines?.data?.[0]?.description || "Recurring service";
      if (crmCustomerId) {
        await patchCustomerRecurringPlan(crmCustomerId, { status: "active", stripeSubscriptionId: subId, lastPaidAt: new Date().toISOString(), lastAmount: amount }, serviceRoleKey, scopeOwnerId);
        ok = await recordRecurringPayment(crmCustomerId, ownerId, amount, description, invoice.id || "", serviceRoleKey);
      }
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data?.object || {};
      const crmCustomerId = invoice.subscription_details?.metadata?.crmCustomerId || invoice.lines?.data?.[0]?.metadata?.crmCustomerId;
      if (crmCustomerId) await patchCustomerRecurringPlan(crmCustomerId, { status: "payment_failed", lastFailedAt: new Date().toISOString() }, serviceRoleKey, scopeOwnerId);
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data?.object || {};
      const crmCustomerId = sub.metadata?.crmCustomerId;
      if (crmCustomerId) await patchCustomerRecurringPlan(crmCustomerId, { status: "canceled", canceledAt: new Date().toISOString() }, serviceRoleKey, scopeOwnerId);
    } else if (event.type === "charge.refunded") {
      // AUDIT (round 12) — catches refunds issued directly from the Stripe
      // dashboard too, not just the app's own Refund button (InvoicesPage.tsx),
      // so the CRM's paid/refunded status can never drift out of sync with
      // what Stripe itself actually did.
      const charge = event.data?.object || {};
      const invoiceId = charge.metadata?.invoiceId;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : undefined;
      if (invoiceId) {
        // BUG FIX (integration audit 2026-11-13) — every refund used to clear
        // paidAt and mark the invoice "refunded", even a $10 partial refund on
        // a $500 payment. Now only a full refund (charge.refunded === true)
        // does that; a partial one is saved as "partially_refunded" with the
        // running refunded total. The log entry carries this refund's own
        // amount and id (newest refund first in charge.refunds).
        const latestRefund = Array.isArray(charge.refunds?.data) ? charge.refunds.data[0] : null;
        const refundedTotal = (charge.amount_refunded || 0) / 100;
        // Newer Stripe API versions leave charge.refunds out of the webhook,
        // so this refund's own amount = running total now - total saved last time.
        let thisRefund = latestRefund?.amount != null ? latestRefund.amount / 100 : refundedTotal;
        if (latestRefund?.amount == null) {
          const prev = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}${ownerFilter(scopeOwnerId)}&select=refundedAmount`, { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } })
            .then(r => r.ok ? r.json() : []).catch(() => []);
          const before = Number(Array.isArray(prev) ? prev[0]?.refundedAmount : 0) || 0;
          thisRefund = Math.max(0, Math.round((refundedTotal - before) * 100) / 100) || refundedTotal;
        }
        const fullyRefunded = charge.refunded === true;
        ok = await logPaymentEvent(
          invoiceId,
          { type: "refunded", amount: thisRefund, stripePaymentIntentId: paymentIntentId, stripeRefundId: latestRefund?.id, stripeEventId: event.id, note: fullyRefunded ? "Refunded via Stripe" : "Partial refund via Stripe" },
          fullyRefunded
            ? { refundedAt: new Date().toISOString().slice(0, 10), refundedAmount: refundedTotal, stripePaymentStatus: "refunded", paidAt: null }
            : { refundedAt: new Date().toISOString().slice(0, 10), refundedAmount: refundedTotal, stripePaymentStatus: "partially_refunded" },
          serviceRoleKey,
          notify,
          scopeOwnerId
        );
      }
    } else if (event.type === "charge.dispute.created") {
      // AUDIT (round 12) — a chargeback/dispute is the single highest-urgency
      // payment event this app can receive (the owner has a very short
      // window to respond with evidence in the Stripe dashboard) and was
      // previously invisible to the CRM entirely.
      const dispute = event.data?.object || {};
      const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : undefined;
      let invoiceId = dispute.metadata?.invoiceId; // rarely present on the dispute object itself
      // SECURITY/CORRECTNESS FIX (audit finding, Medium) — dispute.metadata
      // almost never carries invoiceId, so this silently fell through to a
      // console.warn every time in practice — the owner had no in-app
      // signal at all that a chargeback happened. markInvoicePaid (below)
      // stamps stripePaymentIntentId onto the paid invoice's own row, so a
      // reverse lookup by that id (service-role, no owner_id needed up
      // front) reliably finds the real invoice for the common case.
      if (!invoiceId && paymentIntentId && serviceRoleKey) {
        try {
          const lookupRes = await fetch(
            `${SUPABASE_URL}/rest/v1/estimates?stripePaymentIntentId=eq.${encodeURIComponent(paymentIntentId)}${ownerFilter(scopeOwnerId)}&select=id`,
            { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
          );
          const rows = await lookupRes.json().catch(() => []);
          if (Array.isArray(rows) && rows[0]?.id) invoiceId = rows[0].id;
        } catch (e: any) {
          console.warn("[StripeWebhook] dispute invoice reverse-lookup failed:", e?.message);
        }
      }
      if (invoiceId) {
        ok = await logPaymentEvent(
          invoiceId,
          { type: "disputed", amount: (dispute.amount || 0) / 100, stripePaymentIntentId: paymentIntentId, note: dispute.reason || "Dispute opened" },
          { disputedAt: new Date().toISOString() },
          serviceRoleKey,
          notify,
          scopeOwnerId
        );
      } else {
        // Still couldn't resolve an invoice — this is now the rare case
        // (no metadata AND no matching payment intent on file), not the
        // common one. Acknowledge so Stripe doesn't retry forever; the
        // owner still gets Stripe's own dispute email/dashboard alert.
        console.error("[StripeWebhook] dispute.created with no resolvable invoice — check the Stripe dashboard directly:", paymentIntentId);
      }
    } else {
      // Unhandled event type — acknowledge so Stripe stops retrying it.
      return new Response(JSON.stringify({ received: true, ignored: event.type }), { headers: { "Content-Type": "application/json" } });
    }

    if (!ok) {
      // Genuine failure writing to Supabase — ask Stripe to retry later.
      return new Response(JSON.stringify({ error: "Failed to update invoice" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[StripeWebhook] handler error:", e?.message);
    return new Response(JSON.stringify({ error: e?.message || "Webhook handler error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
