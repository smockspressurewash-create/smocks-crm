import React, { useEffect, useRef, useState } from "react";
import { CreditCard, X, AlertCircle, CheckCircle } from "lucide-react";
import { loadStripeJs, createPaymentIntent } from "../../lib/stripe";
import { deobfuscate } from "../../lib/crypto";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";

// Real Stripe Payment Element flow: loads Stripe.js, creates a PaymentIntent
// directly from the browser (see lib/stripe.ts for the security tradeoff this
// implies), mounts the Payment Element against its client_secret, and confirms
// payment in-place without leaving the page.
export function StripePaymentModal({
  open, onClose, publishableKey, secretKeyEnc, amount, currency = "usd", description = "",
  onSuccess, invoiceId,
}: {
  open: boolean; onClose: () => void;
  publishableKey: string; secretKeyEnc: string;
  amount: number; currency?: string; description?: string;
  onSuccess: (paymentIntentId: string) => void; invoiceId?: string;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "processing" | "success" | "error">("loading");
  const [error, setError] = useState("");
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const intentIdRef = useRef<string>("");
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("loading");
    setError("");
    (async () => {
      try {
        const secretKey = deobfuscate(secretKeyEnc);
        if (!publishableKey || !secretKey) throw new Error("Stripe is not fully configured — add both keys in Settings → Integrations.");
        // FIX 1 (mobile round 8) — metadata.invoiceId lets the server-side
        // stripe-webhook function identify and mark this invoice paid itself
        // once Stripe confirms the charge, instead of relying only on this
        // modal's own client-side onSuccess callback.
        const intent = await createPaymentIntent(secretKey, Math.round(amount * 100), currency, description, invoiceId ? { invoiceId } : undefined);
        if (cancelled) return;
        intentIdRef.current = intent.id;
        const stripe = await loadStripeJs(publishableKey);
        if (cancelled) return;
        stripeRef.current = stripe;
        const elements = stripe.elements({ clientSecret: intent.client_secret });
        elementsRef.current = elements;
        const paymentElement = elements.create("payment");
        if (mountRef.current) paymentElement.mount(mountRef.current);
        setStatus("ready");
      } catch (e: any) {
        if (!cancelled) { setError(e.message || "Failed to start payment"); setStatus("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [open, publishableKey, secretKeyEnc, amount, currency, description, invoiceId]);

  const confirmPayment = async () => {
    if (!stripeRef.current || !elementsRef.current) return;
    setStatus("processing");
    setError("");
    const { error: confirmError } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      redirect: "if_required",
    });
    if (confirmError) {
      setError(confirmError.message || "Payment failed");
      setStatus("ready");
      return;
    }
    setStatus("success");
    onSuccess(intentIdRef.current);
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
            <div ref={mountRef} className={status === "loading" || status === "error" ? "hidden" : ""} />
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
