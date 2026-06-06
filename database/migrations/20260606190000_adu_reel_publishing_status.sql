-- ADU: reserve reels.status = processing for downloader only; use publishing for posting pipeline.

alter type public.reel_status_enum add value if not exists 'publishing';

-- Backfill: split existing processing rows by pipeline.
update public.reels r
set status = 'publishing'
where r.status = 'processing'
  and exists (
    select 1
    from public.adu_posting_jobs j
    where j.reel_internal_id = r.id
      and j.status in ('pending_publish', 'publishing')
  );

update public.reels r
set status = 'downloaded'
where r.status = 'processing'
  and r.download_claimed_at is null
  and r.media_object_key is not null;

update public.reels r
set
  status = 'pending',
  download_claimed_at = null
where r.status = 'processing'
  and r.download_claimed_at is null
  and r.media_object_key is null;

create or replace function public.create_due_adu_posting_jobs(p_mode text default 'prod')
returns table (
  job_id uuid,
  trace_id uuid,
  agency_id uuid,
  page_id uuid,
  reel_internal_id bigint,
  platform public.source_platform_enum,
  source_username text,
  reel_id text,
  fb_page_id text,
  fb_page_access_token text,
  media_object_key text,
  media_size_bytes bigint,
  media_content_type text,
  media_sha256 text,
  reel_caption text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.system_settings where id = 1 and posting_v2_intake_paused = true) then
    return;
  end if;

  return query
  with due_pages as (
    select *
    from public.get_pages_due_posting()
  ),
  candidate_reels as (
    select
      dp.agency_id,
      dp.id as page_id,
      dp.source_platform as platform,
      dp.source_username,
      dp.fb_page_id,
      dp.fb_page_access_token,
      r.id as reel_internal_id,
      r.reel_id,
      r.media_object_key,
      r.media_size_bytes,
      r.media_content_type,
      r.media_sha256,
      coalesce(nullif(trim(r.reel_caption), ''), '...') as reel_caption
    from due_pages dp
    join lateral (
      select rr.*
      from public.reels rr
      where rr.page_id = dp.id
        and rr.status = 'downloaded'
        and rr.media_object_key is not null
      order by rr.id asc
      limit 1
      for update skip locked
    ) r on true
  ),
  completed_pages as (
    update public.pages p
    set status = 'completed'
    where p.id in (select dp.id from due_pages dp)
      and p.id not in (select cr.page_id from candidate_reels cr)
      and p.status = 'active'
      and not exists (
        select 1
        from public.reels r
        where r.page_id = p.id
          and r.status in ('pending', 'processing', 'publishing', 'failed')
      )
      and not exists (
        select 1
        from public.adu_posting_jobs aj
        where aj.page_id = p.id
          and aj.status in ('pending_publish', 'publishing')
      )
    returning p.id
  ),
  inserted_jobs as (
    insert into public.adu_posting_jobs (
      job_id,
      trace_id,
      mode,
      agency_id,
      page_id,
      reel_internal_id,
      platform,
      source_username,
      reel_id,
      fb_page_id,
      fb_page_access_token,
      status,
      media_object_key,
      media_size_bytes,
      media_content_type,
      media_sha256,
      reel_caption
    )
    select
      gen_random_uuid(),
      gen_random_uuid(),
      p_mode,
      cr.agency_id,
      cr.page_id,
      cr.reel_internal_id,
      cr.platform,
      cr.source_username,
      cr.reel_id,
      cr.fb_page_id,
      cr.fb_page_access_token,
      'pending_publish',
      cr.media_object_key,
      cr.media_size_bytes,
      cr.media_content_type,
      cr.media_sha256,
      cr.reel_caption
    from candidate_reels cr
    on conflict do nothing
    returning *
  ),
  skipped_inserts as (
    insert into public.errors (error_message, error_phase, metadata)
    select
      'adu_posting_job_insert_skipped',
      'posting_v2_schedule',
      jsonb_build_object(
        'page_id', cr.page_id,
        'reel_internal_id', cr.reel_internal_id,
        'reel_id', cr.reel_id
      )
    from candidate_reels cr
    where not exists (
      select 1
      from inserted_jobs ij
      where ij.reel_internal_id = cr.reel_internal_id
    )
    returning id
  ),
  mark_reels as (
    update public.reels r
    set status = 'publishing'
    where r.id in (select ij.reel_internal_id from inserted_jobs ij)
      and r.status = 'downloaded'
    returning r.id
  )
  select
    ij.job_id,
    ij.trace_id,
    ij.agency_id,
    ij.page_id,
    ij.reel_internal_id,
    ij.platform,
    ij.source_username,
    ij.reel_id,
    ij.fb_page_id,
    ij.fb_page_access_token,
    ij.media_object_key,
    ij.media_size_bytes,
    ij.media_content_type,
    ij.media_sha256,
    ij.reel_caption
  from inserted_jobs ij;
end;
$$;

create or replace function public.claim_publish_jobs_adu(p_limit int default 100)
returns setof public.adu_posting_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  with exhausted as (
    update public.adu_posting_jobs j
    set
      status = 'failed_to_publish',
      publish_started_at = null,
      last_error_code = coalesce(j.last_error_code, 'publish_retries_exhausted'),
      last_error_message = coalesce(
        nullif(trim(j.last_error_message), ''),
        'Maximum publish retries exceeded'
      ),
      updated_at = now()
    where j.status = 'pending_publish'
      and j.publish_retries > 5
    returning j.reel_internal_id
  )
  update public.reels r
  set status = 'downloaded'
  from exhausted e
  where r.id = e.reel_internal_id
    and r.status = 'publishing';

  return query
  with locked as (
    select
      j.job_id,
      p.fb_page_access_token,
      p.fb_page_id
    from public.adu_posting_jobs j
    join public.pages p on p.id = j.page_id
    join public.users u on u.id = j.agency_id
    cross join public.system_settings s
    where j.status = 'pending_publish'
      and j.publish_retries <= 5
      and s.id = 1
      and s.posting_v2_intake_paused = false
      and p.status = 'active'
      and p.sync_status = 'synced'
      and u.is_active_override = true
    order by j.updated_at asc
    limit greatest(1, p_limit)
    for update of j skip locked
  )
  update public.adu_posting_jobs j
  set
    status = 'publishing',
    publish_started_at = now(),
    fb_page_access_token = l.fb_page_access_token,
    fb_page_id = l.fb_page_id,
    updated_at = now()
  from locked l
  where j.job_id = l.job_id
  returning j.*;
end;
$$;

create or replace function public.reset_stale_publish_jobs_adu(p_older_than_seconds int default 300, p_limit int default 1000)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int := 0;
begin
  with stale as (
    select j.job_id, j.reel_internal_id, j.graph_post_id
    from public.adu_posting_jobs j
    where j.status = 'publishing'
      and coalesce(j.publish_started_at, j.updated_at) < now() - make_interval(secs => greatest(1, p_older_than_seconds))
    order by j.updated_at asc
    limit greatest(1, p_limit)
  ),
  reset_jobs as (
    update public.adu_posting_jobs j
    set
      status = 'pending_publish',
      publish_started_at = null,
      updated_at = now()
    from stale s
    where j.job_id = s.job_id
    returning j.job_id, j.reel_internal_id, j.graph_post_id
  ),
  released_reels as (
    update public.reels r
    set status = 'downloaded'
    from reset_jobs rj
    where r.id = rj.reel_internal_id
      and r.status = 'publishing'
      and rj.graph_post_id is null
    returning r.id
  )
  select count(*)::int into v_count from reset_jobs;

  return v_count;
end;
$$;

create or replace function public.release_publish_job_adu(
  p_job_id uuid,
  p_error_code text default null,
  p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.adu_posting_jobs%rowtype;
begin
  update public.adu_posting_jobs j
  set
    status = 'pending_publish',
    publish_started_at = null,
    last_error_code = coalesce(nullif(trim(p_error_code), ''), j.last_error_code),
    last_error_message = coalesce(nullif(trim(p_error_message), ''), j.last_error_message),
    updated_at = now()
  where j.job_id = p_job_id
    and j.status = 'publishing'
  returning j.*
  into v_job;

  if not found then
    return false;
  end if;

  if v_job.graph_post_id is null then
    update public.reels r
    set status = 'downloaded'
    where r.id = v_job.reel_internal_id
      and r.status = 'publishing';
  end if;

  return true;
end;
$$;

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
    and download_retries < 3
    and (
      download_claimed_at is null
      or download_claimed_at < now() - make_interval(mins => p_stale_minutes)
    );

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
          and r.status in ('downloaded', 'processing')
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

grant execute on function public.create_due_adu_posting_jobs(text) to service_role;
grant execute on function public.claim_publish_jobs_adu(int) to service_role;
grant execute on function public.reset_stale_publish_jobs_adu(int, int) to service_role;
grant execute on function public.release_publish_job_adu(uuid, text, text) to service_role;
