-- Monthly "50% off your first month" email to owners still mid-trial
-- (functions/api/platform-billing.ts's send_trial_discount_emails action).
--
-- MANUAL SETUP REQUIRED before running this file:
--   1. In the Cloudflare Pages dashboard, add env vars:
--        CRON_SECRET              — any long random string you make up
--        PLATFORM_RESEND_API_KEY  — a Resend.com API key for CrewBoss's OWN
--                                    transactional email account (not an
--                                    owner's Gmail — this is the platform
--                                    emailing ITS OWN trial customers)
--        PLATFORM_RESEND_FROM     — e.g. "CrewBoss <billing@yourdomain.com>"
--        APP_ORIGIN                — e.g. "https://app.yourdomain.com" (used
--                                    to build the offer link in the email)
--   2. Replace YOUR_CRON_SECRET_HERE below with the exact same value you put
--      in CRON_SECRET above.
--   3. Replace YOUR_CLOUDFLARE_PAGES_URL below with your real deployed URL.
--   4. Run this whole file in the Supabase SQL Editor.
--
-- Safe to skip entirely if you don't want this feature yet — nothing else
-- in the app depends on it.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-trial-discount-emails',
  '0 14 1 * *', -- 1st of every month, 2pm UTC
  $$
  select net.http_post(
    url := 'https://YOUR_CLOUDFLARE_PAGES_URL/api/platform-billing',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET_HERE'),
    body := jsonb_build_object('action', 'send_trial_discount_emails')
  );
  $$
);
