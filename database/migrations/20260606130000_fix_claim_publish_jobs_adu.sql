-- Fix claim_publish_jobs_adu: PostgreSQL forbids referencing the UPDATE target
-- alias (j) inside JOIN ON clauses of the FROM list ("invalid reference to
-- FROM-clause entry for table j"). Pull page tokens into the locked CTE instead.

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
    and r.status = 'processing';

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

grant execute on function public.claim_publish_jobs_adu(int) to service_role;
