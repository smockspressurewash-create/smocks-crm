import React, { useEffect, useRef, useState } from "react";
import { CreditCard, X, AlertCircle, CheckCircle } from "lucide-react";
import { loadStripeJs, createPaymentIntent } from "../../lib/stripe";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";

// Real Stripe Payment Element flow: loads Stripe.js, creates a PaymentIntent
// via the same-origin functions/api/stripe-action.ts proxy (the secret key
// lives server-side only — see that file and lib/stripe.ts's own comments
// for the round-12 security fix), mounts the Payment Element against its
// client_secret, and confirms payment in-place without leaving the page.
export function StripePaymentModal({
  open, onClose, publishableKey, stripeAccountId, amount, currency = "usd", description = "",
  onSuccess, invoiceId, allowSaveCard = false, tipCents = 0,
}: {
  open: boolean; onClose: () => void;
  publishableKey: string;
  // Required for a Stripe Connect owner — see lib/stripe.ts's loadStripeJs
  // comment. Undefined/omitted is a safe no-op for a legacy manual-key owner.
  stripeAccountId?: string;
  // Display-only total (what the UI shows, the Payment Request Button's own
  // total). When invoiceId is set, the REAL charge amount is always
  // server-verified from the invoice's own stored total + tipCents below —
  // this `amount` is never trusted for the actual charge in that case, only
  // used for what's shown on screen before the customer confirms.
  amount: number; currency?: string; description?: string;
  // savedCard is only populated when allowSaveCard was on, the customer
  // checked the box, AND the server could resolve a real customer to save
  // it against (requires invoiceId) — the caller persists it (see
  // ClientAuthPortal.tsx's client_save_card_link usage).
  onSuccess: (paymentIntentId: string, savedCard?: { stripeCustomerId: string; paymentMethodId: string; label: string }) => void;
  invoiceId?: string;
  // FEATURE — "when customers add new cards, they are automatically saved
  // when the box is checked." Only meaningful (and only rendered) when
  // invoiceId is present, since saving requires a real, server-resolved
  // customer identity — see stripe-action.ts's resolveInvoiceCustomerForSave.
  // Defaults OFF: the box itself defaults unchecked too, so saving a card
  // is always an explicit, affirmative customer choice, never assumed.
  allowSaveCard?: boolean;
  // BUG FIX — "payment security in general." When invoiceId is present the
  // server ignores the client `amount` entirely and charges the invoice's
  // own stored total instead — which used to silently strip any tip the
  // customer added. A tip only ever adds to the charge (never a way to
  // underpay), so it's accepted separately here and added to the verified
  // base amount server-side (see stripe-action.ts's create_payment_intent).
  tipCents?: number;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "processing" | "success" | "error">("loading");
  const [error, setError] = useState("");
  const [saveCard, setSaveCard] = useState(false);
  const resolvedStripeCustomerRef = useRef<string>("");
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const intentIdRef = useRef<string>("");
  const clientSecretRef = useRef<string>("");
  const mountRef = useRef<HTMLDivElement | null>(null);
  // FEATURE (round 13, item 8) — "tap to pay" investigation. True merchant-
  // side NFC tap-to-pay (the owner's phone acting as a card reader, e.g.
  // Stripe's "Tap to Pay on iPhone/Android") requires the Stripe Terminal
  // SDK running inside a native iOS/Android app (or dedicated Stripe reader
  // hardware) — it is NOT available to a web page in a mobile browser, so it
  // isn't buildable in this Vite/React CRM without shipping a native app.
  // What IS achievable from the web today: the customer's OWN device doing a
  // contactless one-tap confirmation (Face ID/fingerprint) via their saved
  // Apple Pay/Google Pay card, using Stripe's Payment Request Button API.
  // That's implemented below — it mounts automatically only when the
  // visiting browser/device actually supports it (canMakePayment()).
  const [prButtonAvailable, setPrButtonAvailable] = useState(false);
  const prMountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("loading");
    setError("");
    (async () => {
      try {
        if (!publishableKey) throw new Error("Stripe is not fully configured — add your publishable key in Settings → Integrations.");
        // FIX 1 (mobile round 8) — metadata.invoiceId lets the server-side
        // stripe-webhook function identify and mark this invoice paid itself
        // once Stripe confirms the charge, instead of relying only on this
        // modal's own client-side onSuccess callback. The server-side
        // functions/api/stripe-action.ts also re-derives the real amount from
        // the invoice itself when invoiceId is present, ignoring whatever
        // amount this client claims.
        const intent = await createPaymentIntent(Math.round(amount * 100), currency, description, invoiceId ? { invoiceId } : undefined, allowSaveCard && saveCard, Math.round(tipCents));
        if (cancelled) return;
        intentIdRef.current = intent.id;
        clientSecretRef.current = intent.client_secret;
        resolvedStripeCustomerRef.current = intent.stripeCustomerId || "";
        const stripe = await loadStripeJs(publishableKey, stripeAccountId);
        if (cancelled) return;
        stripeRef.current = stripe;
        const elements = stripe.elements({ clientSecret: intent.client_secret });
        elementsRef.current = elements;
        const paymentElement = elements.create("payment");
        if (mountRef.current) paymentElement.mount(mountRef.current);

        // Payment Request Button (Apple Pay / Google Pay) — see comment
        // above on why this, not real NFC terminal tap-to-pay, is what's
        // feasible from a web page.
        const pr = stripe.paymentRequest({
          country: "US",
          currency,
          total: { label: description || "Payment", amount: Math.round(amount * 100) },
          requestPayerName: true,
        });
        const canPay = await pr.canMakePayment().catch(() => null);
        if (!cancelled && canPay) {
          setPrButtonAvailable(true);
          const prButton = elements.create("paymentRequestButton", { paymentRequest: pr });
          if (prMountRef.current) prButton.mount(prMountRef.current);
          pr.on("paymentmethod", async (ev: any) => {
            const { error: confirmErr, paymentIntent } = await stripe.confirmCardPayment(
              clientSecretRef.current,
              { payment_method: ev.paymentMethod.id },
              { handleActions: false }
            );
            if (confirmErr) {
              ev.complete("fail");
              setError(confirmErr.message || "Payment failed");
              setStatus("ready");
              return;
            }
            ev.complete("success");
            if (paymentIntent.status === "requires_action") {
              const { error: actionErr } = await stripe.confirmCardPayment(clientSecretRef.current);
              if (actionErr) { setError(actionErr.message || "Payment failed"); setStatus("ready"); return; }
            }
            setStatus("success");
            onSuccess(intentIdRef.current, saveCard && resolvedStripeCustomerRef.current ? {
              stripeCustomerId: resolvedStripeCustomerRef.current,
              paymentMethodId: ev.paymentMethod.id,
              label: ev.paymentMethod.card ? `${ev.paymentMethod.card.brand} ····${ev.paymentMethod.card.last4}` : "Saved card",
            } : undefined);
          });
        }
        setStatus("ready");
      } catch (e: any) {
        if (!cancelled) { setError(e.message || "Failed to start payment"); setStatus("error"); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, publishableKey, stripeAccountId, amount, currency, description, invoiceId, allowSaveCard && saveCard]);

  const confirmPayment = async () => {
    if (!stripeRef.current || !elementsRef.current) return;
    setStatus("processing");
    setError("");
    const { error: confirmError, paymentIntent } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      redirect: "if_required",
    });
    if (confirmError) {
      setError(confirmError.message || "Payment failed");
      setStatus("ready");
      return;
    }
    setStatus("success");
    const pmId = typeof paymentIntent?.payment_method === "string" ? paymentIntent.payment_method : paymentIntent?.payment_method?.id;
    onSuccess(intentIdRef.current, saveCard && resolvedStripeCustomerRef.current && pmId ? {
      stripeCustomerId: resolvedStripeCustomerRef.current,
      paymentMethodId: pmId,
      label: "Saved card",
    } : undefined);
  };

  return (
    <Modal open={open} onClose={onClose} title="Pay with Stripe" maxW="max-w-md">
      <div className="space-y-4">
        {status === "loading" && (
          <div className="text-center py-8 text-white/50 text-sm">Loading payment form…</div>
        )}
        {status === "error" && (
          <div className="p-3 rounded-xl bg-red-950/30 border border-red-700/40 text-red-300 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {status === "success" ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle size={40} className="text-green-400 mx-auto" />
            <div className="font-semibold text-green-300">Payment successful</div>
          </div>
        ) : (
          <>
            {prButtonAvailable && (status === "ready" || status === "processing") && (
              <div className="space-y-2">
                <div ref={prMountRef} />
                <div className="text-center text-[10px] text-white/30 flex items-center gap-2"><div className="flex-1 h-px bg-white/10" />or pay by card<div className="flex-1 h-px bg-white/10" /></div>
              </div>
            )}
            <div ref={mountRef} className={status === "loading" || status === "error" ? "hidden" : ""} />
            {allowSaveCard && invoiceId && (status === "ready" || status === "processing") && (
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveCard}
                  onChange={e => setSaveCard(e.target.checked)}
                  disabled={status === "processing"}
                  className="mt-0.5 w-4 h-4 accent-red-500 cursor-pointer flex-shrink-0"
                />
                <span className="text-xs text-white/60 leading-snug">
                  Save this card for future payments — securely stored by Stripe, your full card number is never sent to or stored by us.
                </span>
              </label>
            )}
            {(status === "ready" || status === "processing") && (
              <GBtn onClick={confirmPayment} disabled={status === "processing"} className="w-full !justify-center !py-3">
                <CreditCard size={16} />{status === "processing" ? "Processing…" : `Pay $${amount.toFixed(2)}`}
              </GBtn>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
