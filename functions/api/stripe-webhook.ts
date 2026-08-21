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
//      payment_intent.succeeded
// 3. Stripe shows the signing secret ("whsec_...") when you create the
//    endpoint — that's the value for STRIPE_WEBHOOK_SECRET.
//
// Supabase's URL + anon key are the same public values already embedded in
// the client bundle (src/lib/supabase.ts) — safe to reuse here since this
// project's RLS policies are already permissive (FOR ALL USING (true), see
// CLAUDE.md — single-owner app, not multi-tenant), so this doesn't grant the
// webhook any access the client doesn't already have. What it DOES add is
// that a payment can now only be marked paid by someone holding Stripe's
// webhook signing secret, not by anyone with browser devtools open.

const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8aEa3wsYJ7ghVPcGbtHymw_ugj0aEfm";

// Stripe's signature scheme: header is "t=<timestamp>,v1=<hex hmac>[,v0=...]".
// The signed payload is "<timestamp>.<raw body>", HMAC-SHA256'd with the
// webhook secret. Verified here with the platform's native Web Crypto
// SubtleCrypto (available in the Cloudflare Workers runtime) rather than a
// Stripe SDK, matching this codebase's existing "direct API calls, no SDK"
// pattern (see lib/stripe.ts).
const verifyStripeSignature = async (payload: string, sigHeader: string, secret: string): Promise<boolean> => {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(
    sigHeader.split(",").map(kv => {
      const idx = kv.indexOf("=");
      return [kv.slice(0, idx), kv.slice(idx + 1)];
    })
  );
  const timestamp = parts["t"];
  const v1 = parts["v1"];
  if (!timestamp || !v1) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
};

// AUDIT (round 12) — every write now goes through this one helper: reads the
// invoice's current paymentLog, appends the new event, and PATCHes both the
// log and whatever status fields this event type implies. paymentFailedAt/
// refundedAt/disputedAt are what App.tsx's existing owner-notification diff
// effect watches (same mechanism paidAt/clientViewedAt already use), so a
// webhook event surfaces as a toast/bell/email without this function needing
// its own email-sending logic (which would mean re-implementing Gmail OAuth
// token handling here — the notification path already exists client-side).
const logPaymentEvent = async (
  invoiceId: string,
  entry: { type: "paid" | "failed" | "refunded" | "disputed"; amount?: number; stripePaymentIntentId?: string; note?: string },
  statusPatch: Record<string, unknown>
): Promise<boolean> => {
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}&select=paymentLog`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  const rows = await getRes.json().catch(() => []);
  const existingLog = Array.isArray(rows) && Array.isArray(rows[0]?.paymentLog) ? rows[0].paymentLog : [];
  const newLog = [...existingLog, { id: crypto.randomUUID(), at: new Date().toISOString(), ...entry }];

  const res = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ ...statusPatch, paymentLog: newLog }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[StripeWebhook] Supabase update failed:", res.status, errText);
  }
  return res.ok;
};

const markInvoicePaid = (invoiceId: string, paymentIntentId: string, amount?: number): Promise<boolean> => {
  const paidAt = new Date().toISOString().slice(0, 10);
  return logPaymentEvent(
    invoiceId,
    { type: "paid", amount, stripePaymentIntentId: paymentIntentId, note: "Paid via Stripe" },
    { paidAt, stripePaymentStatus: "paid", stripePaymentIntentId: paymentIntentId }
  );
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

  try {
    let ok = true;

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data?.object || {};
      const invoiceId = session.metadata?.invoiceId || session.client_reference_id;
      const paymentIntentId = session.payment_intent || session.id;
      if (invoiceId && session.payment_status === "paid") {
        ok = await markInvoicePaid(invoiceId, paymentIntentId || "", (session.amount_total || 0) / 100);
      }
    } else if (event.type === "payment_intent.succeeded") {
      const intent = event.data?.object || {};
      const invoiceId = intent.metadata?.invoiceId;
      if (invoiceId) ok = await markInvoicePaid(invoiceId, intent.id, (intent.amount || 0) / 100);
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
          { paymentFailedAt: new Date().toISOString() }
        );
      }
    } else if (event.type === "charge.refunded") {
      // AUDIT (round 12) — catches refunds issued directly from the Stripe
      // dashboard too, not just the app's own Refund button (InvoicesPage.tsx),
      // so the CRM's paid/refunded status can never drift out of sync with
      // what Stripe itself actually did.
      const charge = event.data?.object || {};
      const invoiceId = charge.metadata?.invoiceId;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : undefined;
      if (invoiceId) {
        ok = await logPaymentEvent(
          invoiceId,
          { type: "refunded", amount: (charge.amount_refunded || 0) / 100, stripePaymentIntentId: paymentIntentId, note: "Refunded via Stripe" },
          { refundedAt: new Date().toISOString().slice(0, 10), stripePaymentStatus: "refunded", paidAt: null }
        );
      }
    } else if (event.type === "charge.dispute.created") {
      // AUDIT (round 12) — a chargeback/dispute is the single highest-urgency
      // payment event this app can receive (the owner has a very short
      // window to respond with evidence in the Stripe dashboard) and was
      // previously invisible to the CRM entirely.
      const dispute = event.data?.object || {};
      const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : undefined;
      const invoiceId = dispute.metadata?.invoiceId; // rarely present on the dispute object itself
      if (invoiceId) {
        ok = await logPaymentEvent(
          invoiceId,
          { type: "disputed", amount: (dispute.amount || 0) / 100, stripePaymentIntentId: paymentIntentId, note: dispute.reason || "Dispute opened" },
          { disputedAt: new Date().toISOString() }
        );
      } else {
        console.warn("[StripeWebhook] dispute.created with no invoiceId on the charge metadata — check the Stripe dashboard directly:", paymentIntentId);
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
