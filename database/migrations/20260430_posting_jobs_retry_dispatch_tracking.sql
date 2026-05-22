-- Posting pipeline reliability: dispatch/retry tracking fields
-- Date: 2026-04-30

alter table if exists public.posting_jobs
  add column if not exists dispatch_count int not null default 0;

alter table if exists public.posting_jobs
  add column if not exists stale_redispatch_count int not null default 0;

alter table if exists public.posting_jobs
  add column if not exists last_error_class text;
