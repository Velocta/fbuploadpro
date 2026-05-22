# Pipeline Observability Runbook

Use this runbook to inspect posting pipeline health using Cloudflare Worker logs/observability.

## Required Context

- Events are written only for `mode='prod'`.
- Scheduler, downloader stage, and publisher stage emit structured JSON logs in Cloudflare.
- Use `job_id` and `trace_id` for drill-down in observability queries.

## 1) Runs by Service (last 24h)

```sql
select
  service,
  count(*) as events
from public.pipeline_events
where created_at >= now() - interval '24 hours'
group by service
order by events desc;
```

## 2) Success / Retry / Terminal by Service

```sql
select
  service,
  status,
  count(*) as total
from public.pipeline_events
where created_at >= now() - interval '24 hours'
  and status in ('success', 'retry', 'failed_terminal')
group by service, status
order by service, status;
```

## 3) Top Error Codes (last 24h)

```sql
select
  error_code,
  count(*) as total
from public.pipeline_events
where created_at >= now() - interval '24 hours'
  and error_code is not null
group by error_code
order by total desc;
```

## 4) Retry Trend (hourly)

```sql
select
  date_trunc('hour', created_at) as hour_bucket,
  service,
  count(*) as retries
from public.pipeline_events
where created_at >= now() - interval '24 hours'
  and status = 'retry'
group by hour_bucket, service
order by hour_bucket desc, service;
```

## 5) Download / Publish Latency

```sql
select
  event_type,
  percentile_cont(0.95) within group (order by duration_ms) as p95_ms,
  percentile_cont(0.99) within group (order by duration_ms) as p99_ms
from public.pipeline_events
where created_at >= now() - interval '24 hours'
  and event_type in ('download_succeeded', 'publish_succeeded')
  and duration_ms is not null
group by event_type;
```

## 6) Terminal Failures for Investigation

```sql
select
  created_at,
  service,
  job_id,
  trace_id,
  error_code,
  error_message
from public.pipeline_events
where created_at >= now() - interval '24 hours'
  and status = 'failed_terminal'
order by created_at desc
limit 200;
```

## 7) Job Trace Drill-Down

```sql
select
  created_at,
  service,
  event_type,
  status,
  error_code,
  error_message,
  duration_ms
from public.pipeline_events
where job_id = :job_id
order by created_at asc;
```

## 8) Transitional State Backlog Age (anti-stuck)

```sql
select
  status,
  count(*) as total,
  min(updated_at) as oldest_updated_at,
  max(updated_at) as newest_updated_at
from public.posting_jobs
where status in ('queued_for_download', 'downloading', 'download_ready', 'retry_scheduled', 'publishing')
group by status
order by total desc;
```

## 9) Retry Attempt Distribution (download stage)

```sql
select
  attempt_download,
  count(*) as jobs
from public.posting_jobs
where status in ('queued_for_download', 'downloading', 'retry_scheduled', 'download_ready', 'failed_terminal', 'posted')
group by attempt_download
order by attempt_download;
```

## Alert Baselines (initial)

- `job_failed_terminal` count > 10 in 5 minutes.
- `job_retry_scheduled` rate doubles vs previous 1 hour baseline.
- `download_succeeded` p95 > 120000 ms (2 min).
- `publish_succeeded` p95 > 180000 ms (3 min).
