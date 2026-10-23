# Browser checks (Playwright, mocked backend)

Drive the real app in Chrome with Supabase and `/api/*` mocked, so nothing touches production data. Screenshots land in `<os temp>/crewboss-e2e/`.

```bash
npm run dev -- --port 5181 --host 127.0.0.1     # in another terminal (or background)
node scripts/e2e/<script>.cjs http://127.0.0.1:5181
```

Needs Google Chrome installed (`channel: "chrome"`); GitHub's ubuntu runners have it.

| Script | Checks |
|---|---|
| `smock-est.cjs` | Public quote/invoice links (`#/estimate/ID`) on desktop + phone: no crash (React #310), Pay vs Review & Sign, Paid in full |
| `smock-flow.cjs` | Quote: sign → "pay after service", and decline |
| `smock-pay.cjs` | Balance after deposit and deposit payments send the right `payType` / amount to `/api/stripe-action` |
| `smock-dep1.cjs` | $1 quote with 50% deposit, tax, flat deposit — amounts shown and sent (cents) |
| `smock-emp.cjs` | Employee signed in on the device opens a customer link; sign-out when the logout request fails |
| `smock-builder.cjs` | Owner → Quotes → New on a phone: horizontal overflow, AI pricing "Add", deposit display |
| `cockpit-preview.cjs` | A Cockpit preview link signs in from its one-time token, opens the right screen, no pop-ups, Preview bar (run vite on 5182; uses cockpit-*.localhost) |
| `cockpit-ui.cjs` | Alfred Cockpit visible after reload for the owner email, card states (question, approval, progress, preview, live) |
| `lead-embed.cjs` | Lead form embedded in an iframe on another origin submits with the business id |
| `customer-import.cjs` | Customer CSV import: column matching, merge into an existing customer, imports stay customers (not leads) by default |
| `bulk-delete.cjs` | Deleting 1,000+ customers goes out in batches and nothing comes back after a reload |
| `owner-screens.cjs` | Desktop + phone: Jobs day clock bar / tap card to open / work details only on the owner's own job; Inbox customer-file pop-up + Edit; vehicle fields + problem log; Accountability (no meditation); Lead Intake select all → Move to Customers |
| `voice-note.cjs` | Alfred chat voice note with Chrome's fake mic, desktop + phone: records, Stop works, audio reaches /api/alfred-transcribe, transcript shows, Send puts it in the chat |

Pattern for a new check: copy the closest script. The mocked owner session is seeded into `localStorage` (`sb-boaqaihymgmrhnjtiqrs-auth-token`) or created through the login form; `ctx.route(/boaqaihymgmrhnjtiqrs\.supabase\.co/ …)` answers REST calls (return the owner `employees` row so `resolveUserRole` says owner).
