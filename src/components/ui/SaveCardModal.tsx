import React, { useEffect, useRef, useState } from "react";
import { CreditCard, AlertCircle, CheckCircle } from "lucide-react";
import { loadStripeJs, createStripeCustomer, createSetupIntent } from "../../lib/stripe";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";

// Mirrors StripePaymentModal's flow but for SetupIntent (save card, no charge) —
// used by the client portal to attach a payment method for future/recurring use.
// See lib/stripe.ts's round-12 security comment — the secret key lives
// server-side only now, in functions/api/stripe-action.ts.
export function SaveCardModal({
  open, onClose, publishableKey, email, name, existingStripeCustomerId,
  onSaved, companyName = "the company", enteredByEmployee = false,
}: {
  open: boolean; onClose: () => void;
  publishableKey: string;
  email: string; name: string; existingStripeCustomerId?: string;
  onSaved: (stripeCustomerId: string, paymentMethodId: string, label: string) => void;
  companyName?: string;
  // FEATURE (round 13, item 10) — true when an EMPLOYEE is keying this card
  // in on the customer's behalf (in-person, field portal), not the customer
  // typing their own card into their own portal — the consent wording below
  // reads correctly for both cases.
  enteredByEmployee?: boolean;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "processing" | "success" | "error">("loading");
  const [error, setError] = useState("");
  // FEATURE (round 13, item 11) — legal consent checkbox, gating Save, on
  // every card-on-file form in the app (this component is the single one
  // used by both the customer self-service flow and the new employee-entry
  // flow below) — protects the owner with an explicit authorization on
  // record before any card is stored for future/recurring charges.
  const [agreed, setAgreed] = useState(false);
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const customerIdRef = useRef<string>("");
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("loading");
    setError("");
    setAgreed(false);
    (async () => {
      try {
        if (!publishableKey) throw new Error("Stripe is not fully configured.");
        const customerId = existingStripeCustomerId || (await createStripeCustomer(email, name)).id;
        if (cancelled) return;
        customerIdRef.current = customerId;
        const intent = await createSetupIntent(customerId);
        if (cancelled) return;
        const stripe = await loadStripeJs(publishableKey);
        if (cancelled) return;
        stripeRef.current = stripe;
        const elements = stripe.elements({ clientSecret: intent.client_secret });
        elementsRef.current = elements;
        const el = elements.create("payment");
        if (mountRef.current) el.mount(mountRef.current);
        setStatus("ready");
      } catch (e: any) {
        if (!cancelled) { setError(e.message || "Failed to start"); setStatus("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [open, publishableKey, email, name, existingStripeCustomerId]);

  const confirm = async () => {
    if (!stripeRef.current || !elementsRef.current || !agreed) return;
    setStatus("processing");
    setError("");
    const { error: confirmError, setupIntent } = await stripeRef.current.confirmSetup({
      elements: elementsRef.current,
      redirect: "if_required",
    });
    if (confirmError) { setError(confirmError.message || "Failed to save card"); setStatus("ready"); return; }
    setStatus("success");
    onSaved(customerIdRef.current, setupIntent?.payment_method || "", "Card on file");
  };

  return (
    <Modal open={open} onClose={onClose} title="Save Payment Method" maxW="max-w-md">
      <div className="space-y-4">
        {status === "loading" && <div className="text-center py-8 text-white/50 text-sm">Loading…</div>}
        {status === "error" && (
          <div className="p-3 rounded-xl bg-red-950/30 border border-red-700/40 text-red-300 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        {status === "success" ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle size={40} className="text-green-400 mx-auto" />
            <div className="font-semibold text-green-300">Card saved for future payments</div>
          </div>
        ) : (
          <>
            <div ref={mountRef} className={status === "loading" || status === "error" ? "hidden" : ""} />
            {(status === "ready" || status === "processing") && (
              <>
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 flex-shrink-0" />
                  <span className="text-[12px] text-white/70 leading-relaxed">
                    {enteredByEmployee
                      ? `I confirm the customer has authorized ${companyName} to keep this card on file and charge it for future services.`
                      : `I authorize ${companyName} to keep this card on file and charge it for future services I approve.`}
                  </span>
                </label>
                <GBtn onClick={confirm} disabled={status === "processing" || !agreed} className="w-full !justify-center !py-3">
                  <CreditCard size={16} />{status === "processing" ? "Saving…" : "Save Card"}
                </GBtn>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
