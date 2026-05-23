-- ADU buffer pipeline: extend reels, adu_posting_jobs, RPCs, delete helper

alter type public.reel_status_enum add value if not exists 'downloaded';
alter type public.reel_status_enum add value if not exists 'download_failed';

alter table public.reels
  add column if not exists media_object_key text,
  add column if not exists media_size_bytes bigint,
  add column if not exists media_content_type text,
  add column if not exists media_sha256 text,
  add column if not exists reel_caption text,
  add column if not exists downloaded_at timestamptz,
  add column if not exists graph_post_id text,
  add column if not exists download_retries int not null default 0;

create index if not exists idx_reels_page_status_downloaded
  on public.reels (page_id, status, id)
  where status in ('pending', 'downloaded');

create table if not exists public.adu_posting_jobs (
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
  status text not null default 'pending_publish'
    check (status in (
      'pending_publish',
      'publishing',
      'published',
      'failed_to_publish',
      'integrity_error'
    )),
  publish_retries int not null default 0,
  media_object_key text not null,
  media_url text,
  media_sha256 text,
  media_content_type text,
  media_size_bytes bigint,
  reel_caption text,
  graph_post_id text,
  last_error_code text,
  last_error_message text,
  publish_started_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_adu_posting_jobs_status_updated
  on public.adu_posting_jobs (status, updated_at);

create index if not exists idx_adu_posting_jobs_status_publish_retries
  on public.adu_posting_jobs (status, publish_retries);

create unique index if not exists ux_adu_posting_jobs_active_page_reel
  on public.adu_posting_jobs (page_id, reel_internal_id)
  where status not in ('published', 'failed_to_publish', 'integrity_error');

create unique index if not exists ux_adu_posting_jobs_published_reel
  on public.adu_posting_jobs (reel_internal_id)
  where status = 'published';

drop trigger if exists tr_adu_posting_jobs_updated_at on public.adu_posting_jobs;
create trigger tr_adu_posting_jobs_updated_at
before update on public.adu_posting_jobs
for each row execute procedure public.update_updated_at_column();

alter table public.adu_posting_jobs enable row level security;

drop policy if exists "Service role full access adu_posting_jobs" on public.adu_posting_jobs;
create policy "Service role full access adu_posting_jobs"
  on public.adu_posting_jobs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Super Admin read adu_posting_jobs" on public.adu_posting_jobs;
create policy "Super Admin read adu_posting_jobs"
  on public.adu_posting_jobs
  for select
  using (public.get_my_role() = 'super_admin');

drop policy if exists "Agency read own adu_posting_jobs" on public.adu_posting_jobs;
create policy "Agency read own adu_posting_jobs"
  on public.adu_posting_jobs
  for select
  using (agency_id = auth.uid());

-- Agency can read reels for their pages (for Reels tab)
drop policy if exists "Agency read own page reels" on public.reels;
create policy "Agency read own page reels"
  on public.reels
  for select
  using (
    exists (
      select 1 from public.pages p
      where p.id = reels.page_id and p.agency_id = auth.uid()
    )
  );

drop policy if exists "Agency update downloaded reel caption" on public.reels;
create policy "Agency update downloaded reel caption"
  on public.reels
  for update
  using (
    status = 'downloaded'
    and exists (
      select 1 from public.pages p
      where p.id = reels.page_id and p.agency_id = auth.uid()
    )
  )
  with check (
    status = 'downloaded'
    and exists (
      select 1 from public.pages p
      where p.id = reels.page_id and p.agency_id = auth.uid()
    )
  );

drop policy if exists "Agency delete downloaded reels" on public.reels;
create policy "Agency delete downloaded reels"
  on public.reels
  for delete
  using (
    status = 'downloaded'
    and exists (
      select 1 from public.pages p
      where p.id = reels.page_id and p.agency_id = auth.uid()
    )
  );

create or replace function public.delete_page_with_reels(p_page_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '120s'
as $$
begin
  if not exists (
    select 1
    from public.pages p
    where p.id = p_page_id
      and (p.agency_id = auth.uid() or public.get_my_role() = 'super_admin')
  ) then
    raise exception 'forbidden';
  end if;

  -- Delete reels in batches to avoid statement timeout
  loop
    delete from public.reels
    where id in (
      select id from public.reels
      where page_id = p_page_id
      limit 5000
    );
    exit when not found;
  end loop;

  delete from public.pages where id = p_page_id;
end;
$$;

grant execute on function public.delete_page_with_reels(uuid) to authenticated;

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
  mark_reels as (
    update public.reels r
    set status = 'processing'
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
  return query
  with locked as (
    select j.job_id
    from public.adu_posting_jobs j
    where j.status = 'pending_publish'
      and j.publish_retries <= 5
    order by j.updated_at asc
    limit greatest(1, p_limit)
    for update skip locked
  )
  update public.adu_posting_jobs j
  set
    status = 'publishing',
    publish_started_at = now(),
    updated_at = now()
  where j.job_id in (select l.job_id from locked l)
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
    select j.job_id
    from public.adu_posting_jobs j
    where j.status = 'publishing'
      and coalesce(j.publish_started_at, j.updated_at) < now() - make_interval(secs => greatest(1, p_older_than_seconds))
    order by j.updated_at asc
    limit greatest(1, p_limit)
  )
  update public.adu_posting_jobs j
  set
    status = 'pending_publish',
    publish_started_at = null,
    updated_at = now()
  where j.job_id in (select s.job_id from stale s);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.finalize_posting_job_adu(p_job_id uuid, p_graph_post_id text default null)
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
  v_job public.adu_posting_jobs%rowtype;
  v_marked boolean := false;
begin
  select *
  into v_job
  from public.adu_posting_jobs
  where adu_posting_jobs.job_id = p_job_id
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
    update public.reels
    set graph_post_id = coalesce(p_graph_post_id, graph_post_id)
    where id = v_job.reel_internal_id;

    update public.adu_posting_jobs
    set
      status = 'published',
      published_at = now(),
      publish_started_at = null,
      graph_post_id = coalesce(p_graph_post_id, graph_post_id),
      last_error_code = null,
      last_error_message = null,
      updated_at = now()
    where adu_posting_jobs.job_id = p_job_id;

    return query select p_job_id, false, true;
    return;
  end if;

  update public.adu_posting_jobs
  set
    status = 'published',
    published_at = now(),
    publish_started_at = null,
    graph_post_id = coalesce(p_graph_post_id, graph_post_id),
    updated_at = now()
  where adu_posting_jobs.job_id = p_job_id;

  return query select p_job_id, true, false;
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
  return query
  with active_pages as (
    select
      p.id,
      coalesce(p.posts_per_day, 0) * 4 as buffer_target
    from public.pages p
    where p.status = 'active'
      and coalesce(p.posts_per_day, 0) > 0
  ),
  page_buffer as (
    select ap.id as page_id, ap.buffer_target
    from active_pages ap
    where (
      select count(*)::int
      from public.reels r
      where r.page_id = ap.id and r.status = 'downloaded'
    ) < ap.buffer_target
  ),
  locked as (
    select r.id
    from page_buffer pb
    join public.reels r on r.page_id = pb.page_id
    where r.status = 'pending'
      and r.download_retries < 3
    order by r.id asc
    limit greatest(1, p_limit)
    for update skip locked
  )
  update public.reels r
  set download_retries = r.download_retries + 1
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
    download_retries = 0
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
  set status = case when download_retries >= 3 then 'download_failed'::public.reel_status_enum else status end
  where id = p_reel_id;
end;
$$;

create or replace function public.skip_adu_reel(p_reel_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.reels r
    join public.pages p on p.id = r.page_id
    where r.id = p_reel_id
      and r.status = 'downloaded'
      and (p.agency_id = auth.uid() or public.get_my_role() = 'super_admin')
  ) then
    raise exception 'forbidden';
  end if;

  update public.reels
  set status = 'failed'
  where id = p_reel_id and status = 'downloaded';
end;
$$;

grant execute on function public.skip_adu_reel(bigint) to authenticated;
