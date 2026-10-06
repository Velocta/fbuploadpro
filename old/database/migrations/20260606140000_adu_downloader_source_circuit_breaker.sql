-- ADU downloader: rolling 24h download_failed circuit breaker per page.
-- >7 failures in 24h: skip buffer claims for that page (page stays active).
-- >30 failures in 24h: mark page creator_suspended (source creator likely gone; distinct from FB account_suspended).

alter type public.profile_status_enum add value if not exists 'creator_suspended';

alter table public.reels
  add column if not exists download_failed_at timestamptz;

create index if not exists idx_reels_page_download_failed_at
  on public.reels (page_id, download_failed_at desc)
  where status = 'download_failed';

create or replace function public.mark_adu_reel_download_failed(p_reel_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.reels
  set
    status = case
      when download_retries >= 3 then 'download_failed'::public.reel_status_enum
      else 'pending'::public.reel_status_enum
    end,
    download_failed_at = case
      when download_retries >= 3 then now()
      else null
    end,
    download_claimed_at = null
  where id = p_reel_id;
end;
$$;

create or replace function public.claim_adu_buffer_downloads(p_limit int default 10)
returns table (
  reel_internal_id bigint,
  page_id uuid,
  platform public.platform_enum,
  username text,
  reel_id text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(p_limit, 0) <= 0 then
    return;
  end if;

  -- Source creator likely suspended/unavailable: stop downloads and posting for this page.
  update public.pages p
  set
    status = 'creator_suspended',
    updated_at = now()
  where p.status = 'active'
    and (
      select count(*)::int
      from public.reels r
      where r.page_id = p.id
        and r.status = 'download_failed'
        and r.download_failed_at >= now() - interval '24 hours'
    ) > 30;

  return query
  with active_pages as (
    select
      p.id,
      coalesce(p.posts_per_day, 0) * 4 as buffer_target
    from public.pages p
    where p.status = 'active'
      and p.sync_status = 'synced'
      and coalesce(p.posts_per_day, 0) > 0
      and (
        select count(*)::int
        from public.reels r
        where r.page_id = p.id
          and r.status = 'download_failed'
          and r.download_failed_at >= now() - interval '24 hours'
      ) <= 7
  ),
  page_buffer as (
    select ap.id as page_id, ap.buffer_target
    from active_pages ap
    where (
      select count(*)::int
      from public.reels r
      where r.page_id = ap.id
        and (
          r.status = 'downloaded'
          or (r.status = 'processing' and r.download_claimed_at is not null)
        )
    ) < ap.buffer_target
  ),
  locked as (
    select r.id
    from page_buffer pb
    join public.reels r on r.page_id = pb.page_id
    where r.status = 'pending'
      and r.download_retries < 3
    order by r.id asc
    limit p_limit
    for update skip locked
  )
  update public.reels r
  set
    status = 'processing',
    download_retries = r.download_retries + 1,
    download_claimed_at = now()
  from locked l
  where r.id = l.id
  returning r.id, r.page_id, r.platform, r.username, r.reel_id;
end;
$$;
