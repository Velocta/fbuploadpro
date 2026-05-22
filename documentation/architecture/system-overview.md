# System Overview

## Repository layout

| Path | Role |
|------|------|
| `webapp/` | Next.js App Router: auth, agency/super-admin dashboards, versioned API (`/api/v1`) |
| `backend_v3/` | Cloudflare Workers (posting, analytics) + VPS scraper |
| `database/` | Supabase PostgreSQL: `production_schema.sql` (canonical), `migrations/` (forward changes) |
| `documentation/` | Architecture, runbooks, ADRs, webapp docs |

## Backend services (`backend_v3/`)

### Posting pipeline

Six Cloudflare Workers plus a container-backed downloader. Job state lives in `posting_jobs_v2`.

| Worker | Wrangler name | Trigger |
|--------|---------------|---------|
| `services/posting/scheduler-worker` | `fbuploadprov2-v2-posting-scheduler` | Cron (every minute) |
| `services/posting/download-processor-worker` | `fbuploadprov2-v2-download-processor` | Cron |
| `services/posting/reel-geter-worker` | `fbuploadprov2-v2-reel-geter` | HTTP (internal) |
| `services/posting/downloader-service` | `fbuploadprov2-v2-downloader-service` | HTTP + Container |
| `services/posting/publish-processor-worker` | `fbuploadprov2-v2-publish-processor` | Cron |
| `services/posting/publisher-worker` | `fbuploadprov2-v2-publisher` | HTTP (internal) |

**Flow:**

1. **Scheduler** — RPC `claim_due_reels_and_create_jobs_v2` creates jobs (`download_pending`) for due pages with pending reels.
2. **Download processor** — Claims jobs, dispatches to reel-geter via service binding + `INTERNAL_JOB_DISPATCH_TOKEN`.
3. **Reel-geter + downloader** — Downloads source video (yt-dlp), stores in R2 `fbuploadprov2-v2-posting-media`, sets `pending_publish`.
4. **Publish processor** — Claims publish-ready jobs, dispatches to publisher.
5. **Publisher** — Uploads to Facebook Reels (Graph API v19), RPC `finalize_posting_job_v2` (tokens + reel `posted`).

Deploy: `backend_v3/services/posting/deploy-posting.sh`

### Analytics

- `services/analytics/followers-metrics-cron-worker` — Cron every 2 minutes; Graph API fan counts; RPC `bulk_update_page_metrics`.

### Scraper (VPS)

- `services/scraper/reels-scraper` — Puppeteer daemon; RPC `get_next_pending_page`; upserts `reels` with `status = pending`.

## Webapp

- Auth and multi-tenant subdomains via `webapp/src/proxy.ts` and Supabase SSR.
- Business logic: `webapp/src/server/services`, persistence: `webapp/src/server/repositories`.
- Facebook BYOC OAuth and page tools under `webapp/src/app/api/v1`.

## Data flow (end-to-end)

```mermaid
flowchart LR
  subgraph ingest [Ingestion]
    Scraper[reels-scraper VPS]
  end
  subgraph control [Control plane]
    Webapp[webapp]
  end
  subgraph post [Posting Workers]
    Scheduler[scheduler]
    DownloadProc[download-processor]
    ReelGeter[reel-geter]
    Downloader[downloader-service]
    PublishProc[publish-processor]
    Publisher[publisher]
  end
  DB[(Supabase)]
  R2[(R2 media)]
  FB[Facebook Graph]

  Scraper --> DB
  Webapp --> DB
  Scheduler --> DB
  Scheduler --> DownloadProc
  DownloadProc --> ReelGeter
  ReelGeter --> Downloader
  Downloader --> R2
  ReelGeter --> DB
  PublishProc --> DB
  PublishProc --> Publisher
  Publisher --> R2
  Publisher --> FB
  Publisher --> DB
```

## Service boundary rules

- No direct code imports between `webapp` and `backend_v3`.
- Each backend service owns its own `src/db/` (or `db.js`) Supabase client.
- Schema changes: add one file under `database/migrations/`, then update `database/production_schema.sql`.
- Legacy v1 posting (`posting_jobs`, Cloudflare queue `fbuploadprov2-prod-posting-download-jobs`) is removed from the repo and database snapshot.
