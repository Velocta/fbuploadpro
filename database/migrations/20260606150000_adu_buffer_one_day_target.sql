-- Reduce ADU downloader buffer target from 4 days to 1 day (posts_per_day * 1).

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
