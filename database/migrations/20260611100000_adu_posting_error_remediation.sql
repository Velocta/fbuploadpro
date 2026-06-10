-- ADU posting error remediation: page statuses, publish_error job status, transient retries, RPC updates.

-- 1. Page status enum values
alter type public.profile_status_enum add value if not exists 'fb_rate_limited';
alter type public.profile_status_enum add value if not exists 'page_not_accessible';

-- 2. Rate-limit cooldown on pages
alter table public.pages
  add column if not exists rate_limited_until timestamptz;

-- 3. Job columns for transient network backoff
alter table public.adu_posting_jobs
  add column if not exists next_publish_attempt_at timestamptz,
  add column if not exists publish_transient_retries int not null default 0;

-- 4. Allow publish_error terminal status
alter table public.adu_posting_jobs drop constraint if exists adu_posting_jobs_status_check;
alter table public.adu_posting_jobs add constraint adu_posting_jobs_status_check
  check (status in (
    'pending_publish',
    'publishing',
    'published',
    'failed_to_publish',
    'publish_error',
    'integrity_error'
  ));

-- 5. Indexes
create index if not exists idx_adu_posting_jobs_pending_attempt
  on public.adu_posting_jobs (status, next_publish_attempt_at)
  where status = 'pending_publish';

drop index if exists public.ux_adu_posting_jobs_active_page_reel;
create unique index ux_adu_posting_jobs_active_page_reel
  on public.adu_posting_jobs (page_id, reel_internal_id)
  where status not in ('published', 'failed_to_publish', 'publish_error');

-- 6. Cascade: do not overwrite fb_rate_limited / page_not_accessible on sibling pages
create or replace function public.cascade_page_invalid_token_to_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'invalid_token'
     and old.status is distinct from 'invalid_token'
     and new.facebook_account_id is not null then
    update public.facebook_accounts
    set status = 'invalid_token', updated_at = now()
    where id = new.facebook_account_id;

    update public.pages
    set status = 'invalid_token', updated_at = now()
    where facebook_account_id = new.facebook_account_id
      and id <> new.id
      and status not in (
        'fb_verification_required',
        'completed',
        'invalid_token',
        'fb_rate_limited',
        'page_not_accessible'
      );
  end if;

  return new;
end;
$$;

-- 7. Auto-resume pages after rate-limit cooldown (scheduler calls each tick)
create or replace function public.resume_rate_limited_pages()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int := 0;
begin
  update public.pages
  set
    status = 'active',
    rate_limited_until = null,
    updated_at = now()
  where status = 'fb_rate_limited'
    and rate_limited_until is not null
    and rate_limited_until <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.resume_rate_limited_pages() to service_role;

-- 8. Claim: backoff filter, publish_error on exhausted retries
create or replace function public.claim_publish_jobs_adu(p_limit int default 100)
returns setof public.adu_posting_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  with exhausted_publish as (
    update public.adu_posting_jobs j
    set
      status = 'publish_error',
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
  ),
  exhausted_transient as (
    update public.adu_posting_jobs j
    set
      status = 'publish_error',
      publish_started_at = null,
      last_error_code = coalesce(j.last_error_code, 'publish_transient_retries_exhausted'),
      last_error_message = coalesce(
        nullif(trim(j.last_error_message), ''),
        'Maximum transient network retries exceeded'
      ),
      updated_at = now()
    where j.status = 'pending_publish'
      and j.publish_transient_retries > 11
      and j.publish_retries <= 5
    returning j.reel_internal_id
  ),
  exhausted_reels as (
    select reel_internal_id from exhausted_publish
    union
    select reel_internal_id from exhausted_transient
  )
  update public.reels r
  set status = 'downloaded'
  from exhausted_reels e
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
      and j.publish_transient_retries <= 11
      and (j.next_publish_attempt_at is null or j.next_publish_attempt_at <= now())
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

-- 9. Finalize: idempotent when reel already posted; allow pending_publish finalize-only
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
  v_reel_status public.reel_status_enum;
  v_marked boolean := false;
  v_graph_id text;
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

  if v_job.status not in ('publishing', 'pending_publish') then
    raise exception 'job_not_ready_to_finalize';
  end if;

  select r.status
  into v_reel_status
  from public.reels r
  where r.id = v_job.reel_internal_id;

  v_graph_id := coalesce(nullif(trim(p_graph_post_id), ''), v_job.graph_post_id);

  if v_reel_status = 'posted' then
    update public.reels
    set
      graph_post_id = coalesce(v_graph_id, graph_post_id),
      media_object_key = null,
      media_size_bytes = null,
      media_content_type = null,
      media_sha256 = null
    where id = v_job.reel_internal_id;

    update public.adu_posting_jobs
    set
      status = 'published',
      published_at = coalesce(published_at, now()),
      publish_started_at = null,
      graph_post_id = coalesce(v_graph_id, graph_post_id),
      last_error_code = null,
      last_error_message = null,
      updated_at = now()
    where adu_posting_jobs.job_id = p_job_id;

    return query select p_job_id, true, false;
    return;
  end if;

  select public.mark_reel_posted_with_token(v_job.reel_internal_id)
    into v_marked;

  if v_marked then
    update public.reels
    set
      graph_post_id = coalesce(v_graph_id, graph_post_id),
      media_object_key = null,
      media_size_bytes = null,
      media_content_type = null,
      media_sha256 = null
    where id = v_job.reel_internal_id;

    update public.adu_posting_jobs
    set
      status = 'published',
      published_at = now(),
      publish_started_at = null,
      graph_post_id = coalesce(v_graph_id, graph_post_id),
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
    graph_post_id = coalesce(v_graph_id, graph_post_id),
    updated_at = now()
  where adu_posting_jobs.job_id = p_job_id;

  return query select p_job_id, true, false;
end;
$$;

-- 10. Record graph id: allow pending_publish finalize-only path
create or replace function public.record_adu_publish_graph_id(
  p_job_id uuid,
  p_graph_post_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.adu_posting_jobs%rowtype;
begin
  if nullif(trim(p_graph_post_id), '') is null then
    raise exception 'graph_post_id_required';
  end if;

  select *
  into v_job
  from public.adu_posting_jobs
  where job_id = p_job_id
  for update;

  if not found then
    raise exception 'posting_job_not_found';
  end if;

  if v_job.status = 'published' then
    return true;
  end if;

  if v_job.status not in ('publishing', 'pending_publish') then
    raise exception 'job_not_publishing';
  end if;

  if v_job.graph_post_id is not null and v_job.graph_post_id <> p_graph_post_id then
    raise exception 'graph_post_id_mismatch';
  end if;

  update public.adu_posting_jobs
  set
    graph_post_id = coalesce(graph_post_id, p_graph_post_id),
    updated_at = now()
  where job_id = p_job_id;

  return true;
end;
$$;

-- 11. bulk_update_page_metrics allowlist
create or replace function public.bulk_update_page_metrics(p_updates jsonb)
returns integer as $$
declare
  v_updated_count integer := 0;
begin
  if p_updates is null or jsonb_typeof(p_updates) <> 'array' or jsonb_array_length(p_updates) = 0 then
    return 0;
  end if;

  with payload as (
    select
      case
        when coalesce(item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (item->>'id')::uuid
        else null
      end as id,
      case
        when coalesce(item->>'followers_gained', '') ~ '^-?[0-9]+$'
        then (item->>'followers_gained')::bigint
        else null
      end as followers_gained,
      nullif(item->>'fb_page_image', '') as fb_page_image,
      case
        when coalesce(item->>'status', '') in (
          'active',
          'inactive',
          'fb_verification_required',
          'invalid_token',
          'invalid_username',
          'completed',
          '2fa_required_on_BM',
          'check_developer_app',
          'account_suspended',
          'creator_suspended',
          'fb_rate_limited',
          'page_not_accessible'
        )
        then (item->>'status')::public.profile_status_enum
        else null
      end as status,
      case
        when lower(coalesce(item->>'is_followers_updated', '')) in ('true', 'false')
        then (item->>'is_followers_updated')::boolean
        else null
      end as is_followers_updated
    from jsonb_array_elements(p_updates) as item
    where item ? 'id'
  )
  update public.pages p
  set
    followers_gained = coalesce(payload.followers_gained, p.followers_gained),
    fb_page_image = coalesce(payload.fb_page_image, p.fb_page_image),
    status = coalesce(payload.status, p.status),
    is_followers_updated = coalesce(payload.is_followers_updated, p.is_followers_updated),
    updated_at = now()
  from payload
  where p.id = payload.id
    and payload.id is not null;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$ language plpgsql security definer set search_path = public;
