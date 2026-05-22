-- Posting job recovery performance indexes (stale/retry scans)
-- Date: 2026-05-04

create index if not exists idx_posting_jobs_status_lease_expires
  on public.posting_jobs (status, lease_expires_at);

create index if not exists idx_posting_jobs_status_next_retry
  on public.posting_jobs (status, next_retry_at);

create index if not exists idx_posting_jobs_status_updated_at
  on public.posting_jobs (status, updated_at desc);
