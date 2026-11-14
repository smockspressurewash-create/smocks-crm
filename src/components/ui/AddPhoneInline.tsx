// Small "add a phone number" box used inside the bulk text windows.
//
// Owner report: some trash can and cleaning customers showed up as
// "no phone" when sending a blast text, and the only fix was to leave the
// text window, open each customer card, add the number and start over. The
// box lets the owner type the number right there; it is saved to the
// customer and the customer is ticked for the text.
import React, { useState } from "react";
import { supabase } from "../../lib/supabase";

export const phoneDigits = (v: string) => {
  const d = String(v || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
};

// Saves the number on screen at once and in the database; if the database
// refuses, the screen goes back and the owner is told. Customer edits are
// not saved by the screen list on its own (the background save only pushes
// brand-new customers), so this write is what makes the number stick.
export async function saveCustomerPhone(
  customerId: string,
  phone: string,
  setCustomers: ((fn: (prev: any[]) => any[]) => void) | undefined,
  toast?: (msg: string, tone?: string) => void,
): Promise<boolean> {
  let old: string | undefined;
  setCustomers?.(prev => prev.map(c => { if (c.id !== customerId) return c; old = c.phone; return { ...c, phone }; }));
  try {
    const { data, error } = await (supabase as any).from("customers").update({ phone }).eq("id", customerId).select("id");
    if (error || !data || data.length === 0) throw new Error(error?.message || "the customer wasn't found");
    toast?.("Phone number saved", "green");
    return true;
  } catch (e: any) {
    setCustomers?.(prev => prev.map(c => c.id === customerId && c.phone === phone ? { ...c, phone: old ?? "" } : c));
    toast?.("Couldn't save the phone number: " + (e?.message || "unknown error"), "red");
    return false;
  }
}

export function AddPhoneInline({ onSave, disabled = false }: { onSave: (phone: string) => Promise<boolean> | void; disabled?: boolean }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const d = phoneDigits(v);
  const ok = d.length === 10;
  const save = async () => {
    if (!ok || disabled || busy) return;
    setBusy(true);
    const r = await onSave(d);
    setBusy(false);
    if (r !== false) setV("");
  };
  return (
    <span className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()} data-add-phone>
      <input
        type="tel"
        inputMode="tel"
        value={v}
        disabled={disabled}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
        placeholder="Add phone"
        aria-label="Add phone number"
        className="w-28 bg-black/40 border border-white/15 rounded-lg px-2 py-1 text-[16px] md:text-[11px] text-white placeholder-white/30 focus:outline-none focus:border-white/40"
      />
      <button
        type="button"
        disabled={!ok || disabled || busy}
        onClick={save}
        className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-green-700/70 text-white disabled:opacity-30 hover:bg-green-600"
      >{busy ? "…" : "Save"}</button>
    </span>
  );
}
