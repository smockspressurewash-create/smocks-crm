// FEATURE — live Twilio account health check ("is the account actually able
// to send", not just "are credentials present"). Same same-origin CORS-proxy
// pattern as twilio-send.ts/twilio-campaign-status.ts (Twilio's REST API
// returns no CORS headers for a browser-origin fetch). Two Twilio endpoints,
// fetched in parallel:
//   - GET /2010-04-01/Accounts/{Sid}.json      → account.status: "active" |
//     "suspended" (non-payment, abuse, etc.) | "closed"
//   - GET /2010-04-01/Accounts/{Sid}/Balance.json → current balance/currency
// A suspended account still returns 200 on the Account fetch (status just
// says "suspended") — that's the actual "can this account send" signal the
// owner asked for, more reliable than balance alone (a $0.00 balance can
// still be a perfectly active pay-as-you-go account with a card on file).
export const onRequestPost = async (context: { request: Request }) => {
  try {
    const { sid, token } = await context.request.json() as { sid?: string; token?: string };
    if (!sid || !token) {
      return new Response(JSON.stringify({ error: "Missing sid/token" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    const auth = `Basic ${btoa(`${sid}:${token}`)}`;
    const [acctRes, balRes] = await Promise.all([
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { headers: { Authorization: auth } }),
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`, { headers: { Authorization: auth } }),
    ]);
    const acctData = await acctRes.json().catch(() => ({} as any));
    if (!acctRes.ok) {
      // A 401 here almost always means a bad SID/Token, not an account
      // problem — surface Twilio's own message rather than guessing.
      return new Response(JSON.stringify({ error: acctData?.message || `Twilio error ${acctRes.status}`, raw: acctData }), {
        status: acctRes.status, headers: { "Content-Type": "application/json" },
      });
    }
    const balData = balRes.ok ? await balRes.json().catch(() => ({} as any)) : null;

    return new Response(JSON.stringify({
      accountStatus: acctData?.status ?? null,       // "active" | "suspended" | "closed"
      accountType: acctData?.type ?? null,            // "Trial" | "Full"
      friendlyName: acctData?.friendly_name ?? null,
      balance: balData?.balance ?? null,
      currency: balData?.currency ?? null,
      balanceError: balRes.ok ? null : `Balance check failed (${balRes.status})`,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Proxy error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
