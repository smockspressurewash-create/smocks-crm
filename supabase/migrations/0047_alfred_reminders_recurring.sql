-- Supports "from now on, every day, remind me to X" — set_reminder (text
-- Alfred) can now pass recurring: "daily" | "weekly", and check-reminders.ts
-- reschedules the row for its next occurrence after sending instead of
-- leaving it done forever.
alter table public.alfred_reminders add column if not exists recurring text;
