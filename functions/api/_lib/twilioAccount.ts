// The real Account SID ("AC…") for a saved Twilio login.
//
// Owners often save an API Key ("SK…" + its secret) instead of the Account
// SID + Auth Token. Twilio accepts an API Key for sending and reading
// messages, but account-level lookups (/Accounts/{sid}.json, Balance,
// phone numbers) need the Account SID in the URL, so with "SK…" they 404:
// the Twilio status check and Alfred's health check reported texting as
// broken while texts were going out fine. An API Key can list the account it
// belongs to, which gives the real SID.
export async function twilioAccountSid(sid: string, token: string): Promise<string> {
  if (/^AC/i.test(sid)) return sid;
  try {
    const r = await fetch("https://api.twilio.com/2010-04-01/Accounts.json?PageSize=1", { headers: { Authorization: "Basic " + btoa(`${sid}:${token}`) } });
    const d: any = await r.json().catch(() => null);
    const ac = d?.accounts?.[0]?.sid;
    return typeof ac === "string" && /^AC/i.test(ac) ? ac : sid;
  } catch {
    return sid;
  }
}
