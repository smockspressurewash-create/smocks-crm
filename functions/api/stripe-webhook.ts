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

const markInvoicePaid = async (invoiceId: string, paymentIntentId: string): Promise<boolean> => {
  const paidAt = new Date().toISOString().slice(0, 10);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ paidAt, stripePaymentStatus: "paid", stripePaymentIntentId: paymentIntentId }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[StripeWebhook] Supabase update failed:", res.status, errText);
  }
  return res.ok;
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const secret = context.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response(JSON.stringify({ error: "Server missing STRIPE_WEBHOOK_SECRET env var — add it in the Cloudflare Pages dashboard" }), {
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
    let invoiceId: string | undefined;
    let paymentIntentId: string | undefined;
    let isPaid = false;

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data?.object || {};
      invoiceId = session.metadata?.invoiceId || session.client_reference_id;
      paymentIntentId = session.payment_intent || session.id;
      isPaid = session.payment_status === "paid";
    } else if (event.type === "payment_intent.succeeded") {
      const intent = event.data?.object || {};
      invoiceId = intent.metadata?.invoiceId;
      paymentIntentId = intent.id;
      isPaid = true;
    } else {
      // Unhandled event type — acknowledge so Stripe stops retrying it.
      return new Response(JSON.stringify({ received: true, ignored: event.type }), { headers: { "Content-Type": "application/json" } });
    }

    if (!invoiceId || !isPaid) {
      // Nothing to do (e.g. a session that expired unpaid) — not a transient
      // failure, so acknowledge rather than making Stripe retry forever.
      return new Response(JSON.stringify({ received: true, skipped: true }), { headers: { "Content-Type": "application/json" } });
    }

    const ok = await markInvoicePaid(invoiceId, paymentIntentId || "");
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
