-- Move pipeline observability to Cloudflare; remove DB pipeline event objects
-- Date: 2026-04-30

drop view if exists public.pipeline_job_latest_status;
drop view if exists public.pipeline_service_runs_hourly;
drop view if exists public.pipeline_error_summary_hourly;
drop table if exists public.pipeline_events;
