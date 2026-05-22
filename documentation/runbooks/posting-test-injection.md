# Posting Test Injection Runbook

Use this when intake is paused and you want controlled validation.

## 1) Insert Synthetic Job

```sql
insert into public.posting_jobs_v2 (
  job_id, trace_id, mode, agency_id, page_id, reel_internal_id,
  platform, source_username, reel_id, fb_page_id, fb_page_access_token, status
)
values (
  gen_random_uuid(),
  gen_random_uuid(),
  'prod',
  :agency_id,
  :page_id,
  :reel_internal_id,
  'instagram',
  :source_username,
  :reel_id,
  :fb_page_id,
  :fb_page_access_token,
  'download_pending'
);
```

## 2) Validate State Transitions

```sql
select job_id, status, download_retries, publish_retries, updated_at
from public.posting_jobs_v2
where reel_internal_id = :reel_internal_id
order by updated_at desc;
```

Expected progression:

- `download_pending`
- `download_processing`
- `pending_publish`
- `publishing`
- `published`

## 3) Validate Final Side Effects

```sql
select status from public.reels where id = :reel_internal_id;
```

```sql
select count(*) as usage_count
from public.token_transactions
where reel_id = :reel_internal_id
  and type = 'usage';
```

Expected:

- reel status = `posted`
- usage_count = `1`
