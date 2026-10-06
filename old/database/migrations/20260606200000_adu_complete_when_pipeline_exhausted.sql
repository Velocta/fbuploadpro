-- Auto-complete ADU pages when the posting slot fires but no downloaded reel is available
-- and no pipeline work remains. Skipped reels (status failed) are terminal like posted —
-- they must not block pages.status = completed.

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
          -- pending/download/processing/publishing only; skipped (failed) is terminal
          and r.status in ('pending', 'processing', 'publishing')
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

grant execute on function public.create_due_adu_posting_jobs(text) to service_role;
