-- Posting pipeline effectively-once state fields
-- Date: 2026-04-30

alter table if exists public.posting_jobs
  add column if not exists media_object_key text;

alter table if exists public.posting_jobs
  add column if not exists media_sha256 text;

alter table if exists public.posting_jobs
  add column if not exists download_attempt_count int not null default 0;

alter table if exists public.posting_jobs
  add column if not exists publish_attempt_count int not null default 0;

alter table if exists public.posting_jobs
  add column if not exists next_retry_at timestamptz;

alter table if exists public.posting_jobs
  add column if not exists lease_expires_at timestamptz;

alter table if exists public.posting_jobs
  add column if not exists terminal_reason text;
