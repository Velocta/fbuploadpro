-- Posting pipeline retention: keep 1 day of posting jobs and pipeline events
-- Date: 2026-04-22

create or replace function public.cleanup_posting_pipeline_history()
returns void as $$
begin
  -- Keep only the last 1 day of event history.
  delete from public.pipeline_events
  where created_at < now() - interval '1 day';

  -- Keep only the last 1 day of jobs (terminal and non-terminal).
  delete from public.posting_jobs
  where updated_at < now() - interval '1 day';
end;
$$ language plpgsql security definer;

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'cleanup-posting-pipeline-history'
  ) then
    perform cron.schedule(
      'cleanup-posting-pipeline-history',
      '5 * * * *',
      'select public.cleanup_posting_pipeline_history()'
    );
  end if;
end;
$$;
