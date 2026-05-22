-- Posting V2 pipeline schema + RPCs
-- Date: 2026-05-07

alter type public.reel_status_enum add value if not exists 'processing';

alter table public.system_settings
  add column if not exists posting_v2_intake_paused boolean not null default false;

create table if not exists public.posting_jobs_v2 (
  job_id uuid primary key default gen_random_uuid(),
  trace_id uuid not null default gen_random_uuid(),
  mode text not null default 'prod' check (mode in ('prod', 'test')),
  agency_id uuid references public.users(id) on delete set null,
  page_id uuid not null references public.pages(id) on delete cascade,
  reel_internal_id bigint not null references public.reels(id) on delete cascade,
  platform public.source_platform_enum not null,
  source_username text not null,
  reel_id text not null,
  fb_page_id text not null,
  fb_page_access_token text not null,
  status text not null default 'download_pending'
    check (status in (
      'download_pending',
      'download_processing',
      'pending_publish',
      'publishing',
      'published',
      'failed_to_download',
      'failed_to_publish',
      'integrity_error'
    )),
  download_retries int not null default 0,
  publish_retries int not null default 0,
  media_object_key text,
  media_url text,
  media_sha256 text,
  media_content_type text,
  media_size_bytes bigint,
  media_duration_ms int,
  source_fingerprint text,
  contract_version text,
  last_error_code text,
  last_error_message text,
  download_started_at timestamptz,
  publish_started_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reels_page_status_id
  on public.reels (page_id, status, id);

create index if not exists idx_posting_jobs_v2_status_updated
  on public.posting_jobs_v2 (status, updated_at);

create index if not exists idx_posting_jobs_v2_status_download_retries
  on public.posting_jobs_v2 (status, download_retries);

create index if not exists idx_posting_jobs_v2_status_publish_retries
  on public.posting_jobs_v2 (status, publish_retries);

create index if not exists idx_posting_jobs_v2_trace_id
  on public.posting_jobs_v2 (trace_id);

create unique index if not exists ux_posting_jobs_v2_active_page_reel
  on public.posting_jobs_v2 (page_id, reel_internal_id)
  where status not in ('published', 'failed_to_download', 'failed_to_publish', 'integrity_error');

create unique index if not exists ux_posting_jobs_v2_published_reel
  on public.posting_jobs_v2 (reel_internal_id)
  where status = 'published';




create or replace function public.claim_due_reels_and_create_jobs_v2(p_mode text default 'prod')
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
  fb_page_access_token text
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
      r.reel_id
    from due_pages dp
    join lateral (
      select rr.id, rr.reel_id
      from public.reels rr
      where rr.page_id = dp.id
        and rr.status = 'pending'
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
    returning p.id
  ),
  inserted_jobs as (
    insert into public.posting_jobs_v2 (
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
      status
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
      'download_pending'
    from candidate_reels cr
    on conflict do nothing
    returning
      posting_jobs_v2.job_id,
      posting_jobs_v2.trace_id,
      posting_jobs_v2.agency_id,
      posting_jobs_v2.page_id,
      posting_jobs_v2.reel_internal_id,
      posting_jobs_v2.platform,
      posting_jobs_v2.source_username,
      posting_jobs_v2.reel_id,
      posting_jobs_v2.fb_page_id,
      posting_jobs_v2.fb_page_access_token
  ),
  mark_reels as (
    update public.reels r
    set status = 'processing'
    where r.id in (select ij.reel_internal_id from inserted_jobs ij)
      and r.status = 'pending'
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
    ij.fb_page_access_token
  from inserted_jobs ij;
end;
$$;

create or replace function public.claim_download_jobs_v2(p_limit int default 100)
returns setof public.posting_jobs_v2
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with locked as (
    select j.job_id
    from public.posting_jobs_v2 j
    where j.status = 'download_pending'
      and j.download_retries <= 10
    order by j.updated_at asc
    limit greatest(1, p_limit)
    for update skip locked
  )
  update public.posting_jobs_v2 j
  set
    status = 'download_processing',
    download_started_at = now(),
    updated_at = now()
  where j.job_id in (select l.job_id from locked l)
  returning j.*;
end;
$$;

create or replace function public.claim_publish_jobs_v2(p_limit int default 100)
returns setof public.posting_jobs_v2
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with locked as (
    select j.job_id
    from public.posting_jobs_v2 j
    where j.status = 'pending_publish'
      and j.publish_retries <= 5
    order by j.updated_at asc
    limit greatest(1, p_limit)
    for update skip locked
  )
  update public.posting_jobs_v2 j
  set
    status = 'publishing',
    publish_started_at = now(),
    updated_at = now()
  where j.job_id in (select l.job_id from locked l)
  returning j.*;
end;
$$;

create or replace function public.reset_stale_download_jobs_v2(p_older_than_seconds int default 180, p_limit int default 1000)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int := 0;
begin
  with stale as (
    select j.job_id
    from public.posting_jobs_v2 j
    where j.status = 'download_processing'
      and coalesce(j.download_started_at, j.updated_at) < now() - make_interval(secs => greatest(1, p_older_than_seconds))
    order by j.updated_at asc
    limit greatest(1, p_limit)
  )
  update public.posting_jobs_v2 j
  set
    status = 'download_pending',
    download_started_at = null,
    updated_at = now()
  where j.job_id in (select s.job_id from stale s);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.reset_stale_publish_jobs_v2(p_older_than_seconds int default 180, p_limit int default 1000)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int := 0;
begin
  with stale as (
    select j.job_id
    from public.posting_jobs_v2 j
    where j.status = 'publishing'
      and coalesce(j.publish_started_at, j.updated_at) < now() - make_interval(secs => greatest(1, p_older_than_seconds))
    order by j.updated_at asc
    limit greatest(1, p_limit)
  )
  update public.posting_jobs_v2 j
  set
    status = 'pending_publish',
    publish_started_at = null,
    updated_at = now()
  where j.job_id in (select s.job_id from stale s);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.finalize_posting_job_v2(p_job_id uuid)
returns table (
  job_id uuid,
  already_finalized boolean,
  finalized boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.posting_jobs_v2%rowtype;
  v_marked boolean := false;
begin
  select *
  into v_job
  from public.posting_jobs_v2
  where posting_jobs_v2.job_id = p_job_id
  for update;

  if not found then
    raise exception 'posting_job_not_found';
  end if;

  if v_job.status = 'published' then
    return query select p_job_id, true, false;
    return;
  end if;

  select public.mark_reel_posted_with_token(v_job.reel_internal_id)
    into v_marked;

  if v_marked then
    update public.posting_jobs_v2
    set
      status = 'published',
      published_at = now(),
      publish_started_at = null,
      last_error_code = null,
      last_error_message = null,
      updated_at = now()
    where posting_jobs_v2.job_id = p_job_id;

    return query select p_job_id, false, true;
    return;
  end if;

  update public.posting_jobs_v2
  set
    status = 'published',
    published_at = now(),
    publish_started_at = null,
    updated_at = now()
  where posting_jobs_v2.job_id = p_job_id;

  return query select p_job_id, true, false;
end;
$$;
