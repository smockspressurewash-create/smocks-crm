# CrewBoss CRM

A CRM for pressure-washing businesses (formerly "Smock's OS" — mid-rebrand to "Crew Boss" / "CrewBoss"; you'll see both names in code comments, branding strings, and localStorage keys prefixed `smocks.*`). Single-tenant per deployment: one business owner + their crew, not a multi-tenant SaaS (see Database section).

## Tech stack

- **React 18.3** + **TypeScript 5.7** + **Vite 6**, Tailwind CSS 3.4
- **Supabase JS 2.105** — auth + Postgres database, no separate backend server
- **Deployment**: Cloudflare Pages (build: `npm run build`, output: `dist/`). No `wrangler.toml` in the repo — Pages project config (build command, env vars) lives in the Cloudflare dashboard, not source-controlled.
- **Integrations**: Google (Calendar, Gmail send, Maps/Places, OAuth) via `lib/google.ts` + `lib/googleApi.ts`; Twilio (SMS) and Gmail-send via `lib/messaging.ts`; Stripe via `lib/stripe.ts` (no `@stripe/stripe-js` package — direct API calls, same pattern as Twilio).
- `tsconfig.app.json`: `strict: false`, `noUnusedLocals: false` — the codebase leans on `any` heavily and TS build will only fail on real type errors, not unused-var/strictness issues. Build command is `tsc -b && vite build`.
- Env vars (`.env` / `.env.production`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Database

Supabase project ref: `boaqaihymgmrhnjtiqrs` (`https://boaqaihymgmrhnjtiqrs.supabase.co`).

**No backend server** — the anon key can't run DDL, so schema changes (new columns/tables, RLS policies) must be applied manually by the user in the Supabase SQL Editor. There's a `supabase/migrations/` folder with a couple of numbered `.sql` files documenting past schema fixes (`0001_employee_google_columns.sql`, `0002_employee_shift_columns.sql`) — **when you hand the user new required SQL, consider adding it there as the next numbered file** rather than only pasting it in chat, so there's a durable record of what schema this app actually depends on.

Known tables: `jobs`, `customers`, `estimates` (also doubles as **invoices** — an invoice is just an estimate row with `invoiced: true`), `employees`, `job_requests`, `app_settings` (keyed by `owner_id` = the owner's Supabase auth user id, holds the entire `settings` object as JSONB — this is how API keys/integrations sync cross-device), `invites` (employee invite codes/links), `inbox_threads` (SMS conversation sync — see below). `organizations` and `profiles` tables are referenced in one place (first-run company setup) but wrapped in a try/catch with "may not exist yet" — treat them as optional/aspirational multi-tenancy scaffolding, not load-bearing.

IDs are real UUID v4, generated via `uid()` in `lib/utils.ts` (uses `crypto.randomUUID()` with a manual fallback). **This matters**: an earlier version of `uid()` generated short base-36 strings, which failed silently against `uuid`-typed columns ("invalid input syntax for type uuid") and was a root cause of several "saves don't work" bugs across the app. If a new insert/update mysteriously fails, check whether it's writing a non-UUID id before assuming the write logic is wrong.

**Postgres folds unquoted column identifiers to lowercase.** Columns created without double quotes (e.g. `dayClockInAt`) land as `dayclockinat`. Several `normalize*` functions in `App.tsx`/`EmployeePortal.tsx` defensively read every casing variant (`e.dayClockInAt ?? e.dayclockinat ?? e.day_clock_in_at`). When writing new migration SQL, always double-quote camelCase column names.

**RLS is owner_id-scoped, not permissive.** `jobs`, `customers`, `estimates`, `employees` (and others) each have a single `<table>_owner_scoped` policy: `USING (owner_id = current_owner_id())` / `WITH CHECK (...)` — `current_owner_id()` is a `SECURITY DEFINER` SQL function that resolves `auth.uid()` to that user's `employees.owner_id` (falling back to their own uid for the owner account itself). This came from `supabase/migrations/0033_multitenant_owner_scoping.sql`. **This means an UPDATE/DELETE whose row doesn't match the caller's `owner_id` returns SUCCESS with zero rows affected — PostgREST does not error on an RLS-filtered 0-row write.** Every `.update()`/`.delete()` that matters for correctness must append `.select("id")` and treat an empty `data` array as a real failure (see `updateJob` in `JobsPage.tsx`/`EmployeePortal.tsx`, and `InvoicesPage.tsx`'s delete handlers, for the established pattern) — checking only `result.error` is not enough and has caused real "my change didn't actually save, but no error appeared" bugs. If a Supabase read returns 0 rows unexpectedly (especially `employees`), suspect this scoping (a missing/mismatched `owner_id` on the row, or a caller whose `employees.user_id` doesn't resolve to the expected owner), not a data problem.

**"Safe column" retry pattern**: `updateJob` in `EmployeePortal.tsx` (and similar in `JobsPage.tsx`) has a `CORE_JOB_COLUMNS` whitelist it retries with core columns and swallows column type mismatches. Postgres/PostgREST rejects an *entire* update if any single column in the patch doesn't exist or doesn't type-check — so one bad field can silently drop unrelated ones (e.g. `status`) unless a retry-with-safe-subset exists. When adding a new field that gets written via one of these `updateJob` helpers, add it to the whitelist too, or a missing column elsewhere in the app can quietly eat your write.

## Critical rules (violate these and you WILL re-introduce fixed bugs)

- **Never default to Resend.** Email must try the owner's connected Gmail account first (`sendOwnerGmailOnly` / `sendViaGmail` in `lib/messaging.ts`, uses the owner's OAuth `provider_token`, no Resend fallback). Generic `sendEmail()` still falls back to Resend and is used for owner Settings/admin flows, but **OTW, Running Late, and in-portal invoice sends must use `sendOwnerGmailOnly`, not `sendEmail`** — this was a repeated regression. SMS goes through `twilioSend`, never a Resend/email substitute.
- `crewAssignedAt` on the `jobs` table is **JSONB** (`{ [employeeId]: timestampMs }`), not TEXT.
- Google Places autocomplete uses the new **`AutocompleteSuggestion.fetchAutocompleteSuggestions`** API (`AddressAutocomplete.tsx`), not the deprecated `AutocompleteService` — Google blocks the old API for Cloud projects created after March 2025.
- Every user-facing action must show a toast on success **and** a toast with the failure reason on error — no silent fails. This has been an explicit, repeated user requirement; several actions (crew assignment, job/estimate delete) previously had failure-only or no toasts at all.
- All async Supabase/network calls in field-portal action buttons (Complete Job, invoice send, OTW, Running Late) are wrapped in a local `withTimeout(promise, ms, label)` helper so a hung fetch can never leave a button stuck on "Sending…" forever. Keep doing this for new async button handlers.
- SMS sent from anywhere (owner Inbox, or an employee's OTW/Running Late/invoice-text in the field portal) must also be logged to `inbox_threads` via `logOutboundSmsToInbox` (`lib/messaging.ts`) so it's visible in the owner's Inbox from any device.

## Working features — do not break

- **Live Team/Crew View** (`Dashboard.tsx`): shows on-shift employees via `employees.filter(e => e.status === "active" && e.dayClockInAt)`, paired to their current job, with a status label (On Time/Running Late/Just Started/Almost Done), checklist progress bar, and photo count. Polls every 3s.
- **Shift timer sync** (`dayClockInAt`, `dayLunchStartAt`, `dayPausedMinutes` on `employees`): whole-day shift clock, distinct from the per-job `clockInAt` on `jobs` (which the owner's `JobDetailModal` also has its own Clock In/Out for, e.g. for the owner's self-assigned jobs).
- **Location sharing** (`locationSharing`, `lastLocation` on `employees`) — optimistic-update pattern with a clear-on-match effect; don't rewrite this without reading the existing optimistic-state comments first.
- **Checklist sync** (`preChecklist`/`duringChecklist`/`postChecklist` JSONB arrays on `jobs`) — written immediately on toggle, not batched.
- **Employee portal routing + auth** (`#/portal`, invite-code email/password signup, `isOwnerView` stub for the owner previewing their team) — see Auth flow below.
- **Owner self-assign**: the owner gets a real `employees` row (id `owner_<email>`, role `owner`, auto-created on login) so they appear in crew dropdowns, Live Crew View, and can clock in/out via `JobDetailModal`'s Time Tracking control.

## Key files

- `src/App.tsx` (~2000 lines) — top-level routing (hash-based, no router library), all owner/employee auth state, `resolveUserRole()`, Supabase realtime + 3s poll wiring for jobs/customers/estimates/employees, `app_settings` cross-device sync, owner-notification diff effects (invoice activity, crew activity).
- `src/components/pages/EmployeePortal.tsx` (~5300 lines, **by far the largest file**) — the field/technician portal: job list, Complete Job wizard, OTW/Running Late, checklists, photos, clock in/out, Google Calendar sync, employee-side Google OAuth linking. `JobDetailView` and `paymentStatusLabel` are top-level (not nested) so they don't remount on re-render; watch for any *new* component defined inside `EmployeePortal`'s body — that pattern caused a real remount/flicker bug before (BUG 4).
- `src/components/pages/Dashboard.tsx` — owner dashboard, Live Team View, KPIs, invoice send.
- `src/components/pages/JobsPage.tsx` — job CRUD, crew assign/request/schedule, Unscheduled-jobs banner, delete.
- `src/components/pages/EstimatesPage.tsx` / `InvoicesPage.tsx` — estimates and invoices are the same underlying `estimates` table/state, split by `invoiced: true`.
- `src/components/pages/ClientPortal.tsx` (estimate sign/pay/decline for an already-known link) vs `ClientAuthPortal.tsx` (`#/client` — full customer login portal, separate Supabase auth session from owner/employee).
- `src/lib/supabase.ts` — Supabase client init.
- `src/lib/api.ts` — LLM/model call wrapper (`callModel`, `MODELS`) for the "Alfred" AI assistant feature.
- `src/lib/messaging.ts` — all outbound comms: `twilioSend`, `sendEmail` (Resend-capable, admin use), `sendOwnerGmailOnly`/`sendViaGmail` (no Resend fallback — use for field-portal sends), `logOutboundSmsToInbox`, `emailShell`/`emailButton` (branded HTML template).
- `src/lib/utils.ts` — `uid()` (UUID v4), `fmt`, date helpers, `withTimeout`, misc shared constants.
- `src/lib/googleApi.ts` / `google.ts` — Calendar/Gmail/Drive API calls, employee Google token refresh.

## Auth flow

- **Owners**: Google OAuth (`supabase.auth.signInWithOAuth`) or email/password (`signInWithPassword`/`signUp`). First registration auto-creates an `employees` row for the owner too (role `owner`).
- **Employees**: email/password only, provisioned via an invite link (`#/portal?invite=CODE`) generated on `EmployeesPage`, backed by the `invites` table. No employee Google OAuth login — but employees *can* separately link their own Google account from within the portal (stored per-employee on `employees.google_token` etc.) for their own Gmail-send/Calendar-sync, distinct from the owner's OAuth session.
- **`resolveUserRole(session)`** in `App.tsx` — looks up the `employees` table by user id/email, returns `"owner" | "manager" | "employee"`, caches the result (see `getCachedRole`) so a returning session doesn't need to re-query every load. This is the single source of truth for which UI (owner CRM vs employee portal) a session sees.
- Routes: `#/portal` = employee portal (`EmployeePortal.tsx`), `#/client` = customer portal (`ClientAuthPortal.tsx`), `#/reset-password` = shared password-reset landing (used by owner, employee, and client — it looks up the `customers` table by email post-reset to decide whether to redirect to `/client` or `/portal`), `#/referral`, `#/rate`, `#/r/CODE` = public unauthenticated pages.

## Common bugs / gotchas

- **Missing Supabase columns.** The single most common failure mode: a feature "does nothing" or "saves but doesn't sync" because the column doesn't exist yet and PostgREST rejected the whole write. Check the browser console for `[TAG] ... error:` logs (most write paths are instrumented — `[LiveCrew]`, `[CompleteJob]`, `[OTW]`, `[RunningLate]`, `[Reschedule]`, `[Inbox]`, `[Owner Self-Assign]`, etc.) before assuming the frontend logic is wrong.
- **SMS Inbox sync**: routes through the `inbox_threads` table (see Critical rules) — if messages sent from the field portal aren't showing in the owner's Inbox, first check that table exists and RLS allows read/write.
- Casing mismatches on employee shift/location columns — see Database section.
- Non-UUID ids breaking inserts against `uuid` columns — see Database section.
