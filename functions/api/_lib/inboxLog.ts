// One way for server code to record a text in the SMS inbox.
//
// BUG FIX (owner report: "duplicate phone numbers" in the inbox) — the
// automation runner, payment receipts and public-page texts each looked for
// the conversation by stripping non-digits only, so "+17175551234" and
// "717-555-1234" never matched and a second conversation was created for
// the same person. find_or_create_inbox_thread matches on the normalized
// number (leading 1 dropped) and appends atomically, the same path the app
// itself uses.
const SUPABASE_URL = "https://boaqaihymgmrhnjtiqrs.supabase.co";

export async function logSmsToInbox(
  serviceRoleKey: string,
  opts: { ownerId: string | null; phone: string; name: string; customerId?: string | null; body: string; dir?: "out" | "in"; via?: string; unread?: boolean },
): Promise<void> {
  const message: Record<string, any> = { id: crypto.randomUUID(), dir: opts.dir || "out", body: opts.body, ts: Date.now(), status: "sent" };
  if (opts.via) message.via = opts.via;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_or_create_inbox_thread`, {
      method: "POST",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_owner_id: opts.ownerId, p_channel: "sms", p_contact_phone: opts.phone, p_contact_name: opts.name || opts.phone,
        p_customer_id: opts.customerId || null, p_message: message, p_unread: !!opts.unread,
      }),
    });
  } catch { /* non-fatal — the text itself already went out */ }
}
