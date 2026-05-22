# Posting V2 Observability and Backpressure Runbook

## Core Health Queries

```sql
select status, count(*) as total
from public.posting_jobs_v2
group by status
order by total desc;
```

```sql
select
  count(*) filter (where status='download_processing') as downloading,
  count(*) filter (where status='publishing') as publishing,
  min(updated_at) filter (where status in ('download_processing','publishing')) as oldest_in_flight
from public.posting_jobs_v2;
```

```sql
select
  date_trunc('hour', created_at) as hour_bucket,
  status,
  count(*) as total
from public.posting_jobs_v2
where created_at >= now() - interval '24 hours'
group by hour_bucket, status
order by hour_bucket desc, status;
```

## Backpressure Bands

- Healthy: queue depth `< 1000` and age `< 2m`
- Warning: queue depth `1000-10000` or age `2-10m`
- Critical: queue depth `>10000` or age `>10m`

## Actions

- Warning:
  - reduce processor claim sizes
  - watch retry growth and queue age trend
- Critical:
  - set `posting_v2_intake_paused = true`
  - keep processors draining
  - verify downloader/publisher health
  - resume intake gradually when queue age/depth trend down

## Fallback Mode

If queue telemetry is stale/unavailable:

- disable dynamic backpressure decisions
- run conservative fixed limits:
  - `MAX_BATCH_PER_CLAIM`
  - `MAX_ROWS_PER_TICK`
  - `MAX_PARALLEL_ENQUEUES`
