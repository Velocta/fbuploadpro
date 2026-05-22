-- Posting pipeline observability: add attempt field and aggregate views
-- Date: 2026-04-22

alter table if exists public.pipeline_events
  add column if not exists attempt int;

create or replace view public.pipeline_error_summary_hourly as
select
  date_trunc('hour', created_at) as hour_bucket,
  service,
  coalesce(error_code, 'none') as error_code,
  count(*)::bigint as total
from public.pipeline_events
group by 1, 2, 3;

create or replace view public.pipeline_service_runs_hourly as
select
  date_trunc('hour', created_at) as hour_bucket,
  service,
  coalesce(status, 'unknown') as status,
  count(*)::bigint as total
from public.pipeline_events
group by 1, 2, 3;

create or replace view public.pipeline_job_latest_status as
with ranked as (
  select
    job_id,
    trace_id,
    service,
    event_type,
    status,
    error_code,
    error_message,
    attempt,
    page_id,
    reel_internal_id,
    created_at,
    row_number() over (partition by job_id order by created_at desc, id desc) as rn
  from public.pipeline_events
  where job_id is not null
)
select
  job_id,
  trace_id,
  service,
  event_type,
  status,
  error_code,
  error_message,
  attempt,
  page_id,
  reel_internal_id,
  created_at
from ranked
where rn = 1;
