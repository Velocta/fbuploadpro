-- ADU buffer downloader: synced-page gate, processing lock, stale reset, buffer accounting

alter table public.reels
  add column if not exists download_claimed_at timestamptz;

drop index if exists public.idx_reels_page_status_downloaded;

create index if not exists idx_reels_page_status_buffer
  on public.reels (page_id, status, id)
  where status in ('pending', 'downloaded', 'processing');

create or replace function public.reset_stale_adu_reel_downloads(p_stale_minutes int default 40)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reset_count integer;
begin
  update public.reels
  set
    status = 'pending',
    download_claimed_at = null
  where status = 'processing'
    and download_claimed_at is not null
    and download_claimed_at < now() - make_interval(mins => p_stale_minutes)
    and download_retries < 3;

  get diagnostics v_reset_count = row_count;
  return v_reset_count;
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
      coalesce(p.posts_per_day, 0) * 4 as buffer_target
    from public.pages p
    where p.status = 'active'
      and p.sync_status = 'synced'
      and coalesce(p.posts_per_day, 0) > 0
  ),
  page_buffer as (
    select ap.id as page_id, ap.buffer_target
    from active_pages ap
    where (
      select count(*)::int
      from public.reels r
      where r.page_id = ap.id
        and r.status in ('downloaded', 'processing')
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

create or replace function public.mark_adu_reel_downloaded(
  p_reel_id bigint,
  p_media_object_key text,
  p_media_size_bytes bigint,
  p_media_content_type text,
  p_media_sha256 text,
  p_reel_caption text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.reels
  set
    status = 'downloaded',
    media_object_key = p_media_object_key,
    media_size_bytes = p_media_size_bytes,
    media_content_type = p_media_content_type,
    media_sha256 = p_media_sha256,
    reel_caption = coalesce(nullif(trim(p_reel_caption), ''), reel_caption, '...'),
    downloaded_at = now(),
    download_retries = 0,
    download_claimed_at = null
  where id = p_reel_id
    and status in ('pending', 'processing');
end;
$$;

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
    download_claimed_at = null
  where id = p_reel_id;
end;
$$;
