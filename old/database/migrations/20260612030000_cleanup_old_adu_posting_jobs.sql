create or replace function public.cleanup_old_adu_posting_jobs()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted int;
begin
  with deleted as (
    delete from public.adu_posting_jobs
    where created_at < now() - interval '7 days'
      and status in ('published', 'failed_to_publish', 'publish_error', 'integrity_error')
    returning job_id
  )
  select count(*)::int into v_deleted from deleted;
  return coalesce(v_deleted, 0);
end;
$$;

revoke all on function public.cleanup_old_adu_posting_jobs() from public;
grant execute on function public.cleanup_old_adu_posting_jobs() to service_role;

-- Schedule the job to run daily at 4:00 AM
select cron.schedule(
  'cleanup-adu-posting-jobs',
  '0 4 * * *',
  'select public.cleanup_old_adu_posting_jobs()'
);
