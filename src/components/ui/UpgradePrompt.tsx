// FEATURE — "whenever they (or any base account) hits their plan limit
// ... it prompts them to upgrade to a higher tier." Shown in place of the
// normal add-flow whenever a limit check fails (see planLimits.ts) —
// explains WHY (current count vs. the limit) and sends them straight to
// Settings → Billing, which already has real Stripe Checkout wired up.
import React from "react";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";
import { Lock } from "lucide-react";
import { PLAN_TIER_LABEL, type PlanTier } from "../../lib/planLimits";

export function UpgradePrompt({ open, onClose, onUpgrade, tier, resource, limit }: {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  tier: PlanTier;
  resource: string; // e.g. "customers", "team members"
  limit: number;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Plan limit reached" maxW="max-w-sm">
      <div className="space-y-5 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-red-950/40 border border-red-700/40 flex items-center justify-center">
          <Lock size={22} className="text-red-400" />
        </div>
        <div>
          <div className="text-base font-semibold text-white">You've hit the {resource} limit on {PLAN_TIER_LABEL[tier]}</div>
          <div className="text-sm text-white/50 mt-1.5">{PLAN_TIER_LABEL[tier]} allows up to {limit} {resource}. Upgrade to add more.</div>
        </div>
        <div className="flex gap-2 justify-center">
          <GBtn variant="ghost" onClick={onClose}>Not now</GBtn>
          <GBtn onClick={onUpgrade}>View Plans</GBtn>
        </div>
      </div>
    </Modal>
  );
}
