-- Persist source reel caption for V2 publishing fallback behavior.
alter table if exists public.posting_jobs_v2
  add column if not exists reel_caption text;
