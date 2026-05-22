-- Migration: Scraper Optimizations
-- Description: Adds the errors table and updates the job fetching RPC to support platform filtering.
-- Date: 2026-02-09

-- 1. Create Errors Table (if it doesn't exist)
create table if not exists public.errors (
  id uuid default gen_random_uuid() primary key,
  agency_id uuid references public.users(id) on delete cascade,
  page_id uuid references public.pages(id) on delete cascade,
  reel_id bigint references public.reels(id) on delete set null,
  error_message text not null,
  stack_trace text,
  error_phase text,
  retry_count int default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Enable RLS on errors table
alter table public.errors enable row level security;

-- Add Service Role Policy for errors
do $$ 
begin
    if not exists (
        select 1 from pg_policies 
        where tablename = 'errors' and policyname = 'Service role full access'
    ) then
        create policy "Service role full access" on public.errors for all to service_role using (true) with check (true);
    end if;
end $$;

-- 2. Update get_next_pending_page RPC
-- We drop the old one first because the signature (parameters) has changed.
drop function if exists public.get_next_pending_page();

create or replace function public.get_next_pending_page(p_platform public.source_platform_enum default null)
returns table (id uuid, source_username text, source_platform public.source_platform_enum) as $$
begin
  return query
  update public.pages
  set sync_status = 'processing'
  where public.pages.id = (
    select p.id
    from public.pages p
    where p.sync_status = 'pending'
    and (p_platform is null or p.source_platform = p_platform)
    limit 1
    for update skip locked
  )
  returning public.pages.id, public.pages.source_username, public.pages.source_platform;
end;
$$ language plpgsql security definer;

comment on function public.get_next_pending_page is 'Fetches the next pending page for sync. Optionally filters by platform (e.g., instagram).';
