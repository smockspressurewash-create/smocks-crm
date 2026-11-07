// The real Account SID ("AC…") for a saved Twilio login.
//
// Owners often save an API Key ("SK…" + its secret) instead of the Account
// SID + Auth Token. Twilio accepts an API Key for sending and reading
// messages, but account-level lookups (/Accounts/{sid}.json, Balance,
// phone numbers) need the Account SID in the URL, so with "SK…" they 404:
// the Twilio status check and Alfred's health check reported texting as
// broken while texts were going out fine. An API Key can list the account it
// belongs to, which gives the real SID.
//
// Health check 2026-11 — sends now use this too, so every Messages.json URL
// carries the real Account SID whichever login was saved (Twilio documents
// the Account SID as the URL path segment). The lookup is cached per key, so
// it costs one extra request per worker, not one per text.
const acCache = new Map<string, string>();
export async function twilioAccountSid(sid: string, token: string): Promise<string> {
  if (!sid || /^AC/i.test(sid)) return sid;
  const hit = acCache.get(sid);
  if (hit) return hit;
  try {
    const r = await fetch("https://api.twilio.com/2010-04-01/Accounts.json?PageSize=1", { headers: { Authorization: "Basic " + btoa(`${sid}:${token}`) } });
    const d: any = await r.json().catch(() => null);
    const ac = d?.accounts?.[0]?.sid;
    if (typeof ac === "string" && /^AC/i.test(ac)) { acCache.set(sid, ac); return ac; }
    return sid;
  } catch {
    return sid;
  }
}
