-- ADU downloader: do not let hungry pages with no claimable pending reels pin min_level.
-- Fixes claim_empty deadlock when level-0 pages have posted/failed/processing reels but zero pending.

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
      coalesce(p.posts_per_day, 0) * 1 as buffer_target
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
    select
      ap.id as page_id,
      ap.buffer_target,
      (
        select count(*)::int
        from public.reels r
        where r.page_id = ap.id
          and (
            r.status = 'downloaded'
            or (r.status = 'processing' and r.download_claimed_at is not null)
          )
      ) as buffer_filled
    from active_pages ap
  ),
  hungry_pages as (
    select pb.page_id, pb.buffer_filled
    from page_buffer pb
    where pb.buffer_filled < pb.buffer_target
      and exists (
        select 1
        from public.reels r
        where r.page_id = pb.page_id
          and r.status = 'pending'
          and r.download_retries < 3
      )
  ),
  min_level as (
    select min(hp.buffer_filled) as level
    from hungry_pages hp
  ),
  eligible_pages as (
    select hp.page_id
    from hungry_pages hp
    cross join min_level ml
    where hp.buffer_filled = ml.level
  ),
  one_per_page as (
    select distinct on (r.page_id)
      r.id
    from eligible_pages ep
    join public.reels r on r.page_id = ep.page_id
    where r.status = 'pending'
      and r.download_retries < 3
    order by r.page_id, r.id asc
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
