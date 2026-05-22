-- Remove legacy V1 posting pipeline schema now replaced by posting_jobs_v2.
-- Safe to run multiple times.

do $$
declare
  v_jobid bigint;
begin
  -- Unschedule legacy cleanup cron if pg_cron is available.
  begin
    select jobid
      into v_jobid
    from cron.job
    where jobname = 'cleanup-posting-pipeline-history'
    limit 1;

    if v_jobid is not null then
      perform cron.unschedule(v_jobid);
    end if;
  exception
    when undefined_table or invalid_schema_name then
      null;
  end;
end;
$$;

drop function if exists public.cleanup_posting_pipeline_history();

drop table if exists public.posting_jobs;
