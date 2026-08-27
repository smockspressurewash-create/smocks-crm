-- Auto-charge a customer's card on file when a recurring job dispatched to
-- them is marked complete (as opposed to the fixed-cadence Stripe
-- subscription billing in customers.recurringPlan) - dates for a recurring
-- JOB fluctuate (a Monday one month, a Thursday the next), so billing here
-- is tied to actual job completion, not a calendar day.
alter table public.customers add column if not exists "autoChargeRecurringJobs" boolean default false;
