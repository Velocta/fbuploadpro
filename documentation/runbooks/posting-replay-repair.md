# Posting Replay and Repair Runbook

This runbook covers **legacy Posting V2** (`posting_jobs_v2`) and **ADU buffer posting** (`adu_posting_jobs`).

---

## ADU Auto Download/Upload (`adu_posting_jobs`)

### Jobs not picked by publish-processor

`claim_publish_jobs_adu` only claims jobs when **all** of these are true:

| Check | Requirement |
|-------|-------------|
| Job | `status = pending_publish`, `publish_retries <= 5` |
| Page | `status = active`, `sync_status = synced` |
| Agency | `users.is_active_override = true` |
| System | `system_settings.posting_v2_intake_paused = false` |

**Diagnose blocked jobs:**

```sql
select
  j.job_id,
  j.status,
  j.publish_retries,
  j.publish_started_at,
  j.updated_at,
  p.page_name,
  p.status as page_status,
  p.sync_status,
  u.is_active_override,
  s.posting_v2_intake_paused,
  case
    when j.status = 'pending_publish'
      and j.publish_retries <= 5
      and p.status = 'active'
      and p.sync_status = 'synced'
      and u.is_active_override = true
      and s.posting_v2_intake_paused = false
    then 'claimable'
    else 'blocked'
  end as claim_state
from public.adu_posting_jobs j
join public.pages p on p.id = j.page_id
join public.users u on u.id = j.agency_id
cross join public.system_settings s
where s.id = 1
  and j.status in ('pending_publish', 'publishing')
order by j.updated_at desc
limit 100;
```

**Common fixes:**

1. **Page marked `completed` while job still pending** — reactivate:

```sql
update public.pages p
set status = 'active', updated_at = now()
where p.status = 'completed'
  and exists (
    select 1
    from public.adu_posting_jobs aj
    where aj.page_id = p.id
      and aj.status in ('pending_publish', 'publishing')
  );
```

2. **Jobs stuck in `publishing`** — reset stale (or wait 5 min for worker cron):

```sql
select public.reset_stale_publish_jobs_adu(300, 1000);
```

3. **Intake paused** — `update system_settings set posting_v2_intake_paused = false where id = 1;`

4. **Workers / migrations** — deploy publisher → publish-processor → scheduler; apply migrations through `20260606120000_adu_posting_claim_guard.sql`.

### Identify failing jobs

```sql
select
  job_id,
  status,
  publish_retries,
  graph_post_id,
  last_error_code,
  last_error_message,
  updated_at
from public.adu_posting_jobs
where status in ('failed_to_publish', 'integrity_error', 'publishing', 'pending_publish')
order by updated_at desc
limit 200;
```

### Integrity verification (single job)

Valid outcomes after a successful publish:
- `job.status = published`
- `reel.status = posted`
- `usage_count` is **0** (posted without charge when balance was insufficient) or **1** (normal deduction)

```sql
with j as (
  select job_id, reel_internal_id, status, graph_post_id
  from public.adu_posting_jobs
  where job_id = :job_id
)
select
  j.job_id,
  j.status as job_status,
  j.graph_post_id,
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

### Finalize-only replay (Meta already published)

When `graph_post_id` is set but finalize failed or job is stuck in `pending_publish` / `publishing`:

1. Confirm the video exists on Meta using `graph_post_id`.
2. Ensure job is claimable (`pending_publish` or reset from `publishing`).
3. Run finalize once:

```sql
select * from public.finalize_posting_job_adu(:job_id, :graph_post_id);
```

The publish processor will also pick up jobs with `graph_post_id` and skip Meta upload (finalize-only path).

### Safe replay (publish path)

Only when Meta was **not** published (`graph_post_id` is null), job is `failed_to_publish`, and reel is `downloaded`:

```sql
update public.adu_posting_jobs
set
  status = 'pending_publish',
  publish_retries = 0,
  last_error_code = null,
  last_error_message = null,
  publish_started_at = null,
  updated_at = now()
where job_id = :job_id
  and status = 'failed_to_publish'
  and graph_post_id is null;

update public.reels
set status = 'downloaded'
where id = :reel_internal_id
  and status = 'processing';
```

### Release stuck `publishing` job

```sql
select public.release_publish_job_adu(
  :job_id,
  'manual_release',
  'operator reset'
);
```

### Integrity error repair

- If job is `integrity_error` but reel is `posted`: verify usage count (0 or 1), delete orphaned R2 object if `media_object_key` still set, then mark job `published` manually only after human review.
- If duplicate usage is detected (`usage_count > 1`), pause intake and compensate manually after approval.
- Keep `posting_v2_intake_paused = true` while multiple integrity incidents are unresolved.

### Deploy order after schema changes

1. Apply migration in Supabase
2. Deploy `fbuploadpro-adu-1-publisher`
3. Deploy `fbuploadpro-adu-2-publish-processor`
4. Deploy `fbuploadpro-adu-3-scheduler`

---

## Legacy Posting V2 (`posting_jobs_v2`)

### Identify failing jobs

```sql
select job_id, status, download_retries, publish_retries, last_error_code, last_error_message, updated_at
from public.posting_jobs_v2
where status in ('failed_to_download', 'failed_to_publish', 'integrity_error')
order by updated_at desc
limit 200;
```

### Integrity verification (single job)

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

### Safe replay (download path)

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

### Safe replay (publish path)

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

### Integrity error repair

- If job published but reel not posted: run `finalize_posting_job_v2(:job_id)` once and re-verify.
- If duplicate usage transaction is detected, stop intake and execute manual compensation after human approval.
- Keep `posting_v2_intake_paused = true` while multiple integrity incidents are unresolved.
