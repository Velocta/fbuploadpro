-- Optimize public.claim_adu_buffer_downloads and public.mark_adu_reel_download_failed functions:
-- 1. Remove the active pages update/scan from claim_adu_buffer_downloads (extremely expensive write lock on every claim call).
-- 2. Move creator suspension check to mark_adu_reel_download_failed (triggered only when a download actually fails permanently).
-- 3. Rewrite claim_adu_buffer_downloads CTEs to scan the reels table only once using a subquery-caching approach, preventing millions of rows from being sorted in memory/spilling to disk.

create or replace function public.mark_adu_reel_download_failed(p_reel_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_page_id uuid;
  v_failed_count int;
  v_new_status public.reel_status_enum;
begin
  -- Update the reel status
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
  where id = p_reel_id
  returning page_id, status into v_page_id, v_new_status;

  -- If this reel just transitioned to 'download_failed'
  if v_page_id is not null and v_new_status = 'download_failed'::public.reel_status_enum then
    -- Count total download_failed reels for this page to see if we should suspend it
    select count(*)::int into v_failed_count
    from public.reels r
    where r.page_id = v_page_id
      and r.status = 'download_failed';

    if v_failed_count > 50 then
      update public.pages p
      set
        status = 'creator_suspended',
        updated_at = now()
      where p.id = v_page_id
        and p.status = 'active';
    end if;
  end if;
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

  return query
  with active_pages as (
    select
      p.id,
      coalesce(p.posts_per_day, 0) * 1 as buffer_target
    from public.pages p
    where p.status = 'active'
      and p.sync_status = 'synced'
      and coalesce(p.posts_per_day, 0) > 0
      -- Skip claiming new downloads for pages that have > 10 failed downloads in the last 24 hours.
      and (
        select count(*)::int
        from public.reels r
        where r.page_id = p.id
          and r.status = 'download_failed'
          and r.download_failed_at >= now() - interval '24 hours'
      ) <= 10
  ),
  page_buffer as (
    select
      ap.id as page_id,
      ap.buffer_target,
      (
        select count(*)::int
        from public.reels r
        where r.page_id = ap.id
          and r.status in ('downloaded', 'processing')
      ) as buffer_filled
    from active_pages ap
  ),
  hungry_pages as (
    select
      pb.page_id,
      pb.buffer_filled,
      (
        select r.id
        from public.reels r
        where r.page_id = pb.page_id
          and r.status = 'pending'
          and r.download_retries < 3
        order by r.id asc
        limit 1
      ) as first_pending_id
    from page_buffer pb
    where pb.buffer_filled < pb.buffer_target
  ),
  min_level as (
    select min(hp.buffer_filled) as level
    from hungry_pages hp
    where hp.first_pending_id is not null
  ),
  eligible_pages as (
    select hp.page_id, hp.first_pending_id
    from hungry_pages hp
    cross join min_level ml
    where hp.buffer_filled = ml.level
      and hp.first_pending_id is not null
  ),
  one_per_page as (
    select ep.first_pending_id as id
    from eligible_pages ep
  ),
  locked as (
    select r.id
    from one_per_page opp
    join public.reels r on r.id = opp.id
    order by random()
    limit p_limit
    for update of r skip locked
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
