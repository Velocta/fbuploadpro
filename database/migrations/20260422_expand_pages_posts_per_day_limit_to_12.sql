-- Expand pages posts_per_day upper limit from 5 to 12.
-- Date: 2026-04-22

alter table if exists public.pages
  drop constraint if exists pages_posts_per_day_check;

alter table if exists public.pages
  add constraint pages_posts_per_day_check
  check (posts_per_day <= 12);
