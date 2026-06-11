-- Create failed_r2_deletions table to queue failed deletions of R2 objects
create table if not exists public.failed_r2_deletions (
  id uuid primary key default gen_random_uuid(),
  bucket_name text not null,
  object_key text not null,
  retry_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.failed_r2_deletions enable row level security;

-- Policies for service_role access (used by Cloudflare Workers)
drop policy if exists "Service role full access failed_r2_deletions" on public.failed_r2_deletions;
create policy "Service role full access failed_r2_deletions"
  on public.failed_r2_deletions
  for all
  to service_role
  using (true)
  with check (true);
