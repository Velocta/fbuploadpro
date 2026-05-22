# Posting V2 Replay and Repair Runbook

## Identify Failing Jobs

```sql
select job_id, status, download_retries, publish_retries, last_error_code, last_error_message, updated_at
from public.posting_jobs_v2
where status in ('failed_to_download', 'failed_to_publish', 'integrity_error')
order by updated_at desc
limit 200;
```

## Integrity Verification (Single Job)

```sql
with j as (
  select job_id, reel_internal_id, status
  from public.posting_jobs_v2
  where job_id = :job_id
)
select
  j.job_id,
  j.status as job_status,
  r.status as reel_status,
  (
    select count(*)
    from public.token_transactions tt
    where tt.reel_id = j.reel_internal_id
      and tt.type = 'usage'
  ) as usage_count
from j
left join public.reels r on r.id = j.reel_internal_id;
```

## Safe Replay (Download Path)

Only replay if job status is `failed_to_download` and reel status is `processing`:

```sql
update public.posting_jobs_v2
set
  status = 'download_pending',
  download_retries = 0,
  last_error_code = null,
  last_error_message = null,
  download_started_at = null,
  updated_at = now()
where job_id = :job_id
  and status = 'failed_to_download';
```

## Safe Replay (Publish Path)

Only replay if job status is `failed_to_publish` and media object still exists:

```sql
update public.posting_jobs_v2
set
  status = 'pending_publish',
  publish_retries = 0,
  last_error_code = null,
  last_error_message = null,
  publish_started_at = null,
  updated_at = now()
where job_id = :job_id
  and status = 'failed_to_publish';
```

## Integrity Error Repair

- If job published but reel not posted: run `finalize_posting_job_v2(:job_id)` once and re-verify.
- If duplicate usage transaction is detected, stop intake and execute manual compensation after human approval.
- Keep `posting_v2_intake_paused = true` while multiple integrity incidents are unresolved.
