-- Alfred Cockpit: progress bar + preview link per item.
-- progress        0–100 while Claude works (shown as a progress bar on the card)
-- progress_label  short text for the current step ("Building", "Deploying preview"…)
-- preview_url     link to the private preview of the change before it goes live
alter table public.cockpit_items add column if not exists progress integer;
alter table public.cockpit_items add column if not exists progress_label text;
alter table public.cockpit_items add column if not exists preview_url text;
