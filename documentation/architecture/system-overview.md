# System Overview

## Repository layout

| Path | Role |
|------|------|
| `webapp/` | Next.js App Router: auth, agency/super-admin dashboards, versioned API (`/api/v1`) |
| `backend_v3/` | Cloudflare Workers (posting, scheduling, analytics) + VPS scraper |
| `database/` | Supabase PostgreSQL: `production_schema.sql` (canonical), `migrations/` (forward changes) |
| `documentation/` | Architecture, runbooks, ADRs, webapp docs |

## Backend services (`backend_v3/`)

Backend layout follows the convention: `services/{platform}/{feature}/{type}/{worker}/`

### Facebook — Auto Download/Upload (buffer + publish)

VPS buffer downloader pre-fills R2; three Cloudflare Workers handle scheduling and publish. Job state lives in `adu_posting_jobs`.

| Component | Location | Trigger |
|-----------|----------|---------|
| Buffer downloader | `services/facebook/auto-download-upload/downloader/` | VPS PM2 loop |
| Scheduler | `posting/scheduler-worker` | `fbuploadpro-fb-adu-scheduler` cron |
| Publish processor | `posting/publish-processor-worker` | Cron |
| Publisher | `posting/publisher-worker` | HTTP (internal) |

**Flow:**

1. **Scraper** — Inserts `reels` as `pending` (metadata only).
2. **Buffer downloader** — For active pages below `posts_per_day × 4` downloaded reels, claims `pending` reels, yt-dlp download → R2 `fbuploadpro-adu-buffer` → `reels.status = downloaded`.
3. **Scheduler** — RPC `create_due_adu_posting_jobs` picks `downloaded` reels, creates `adu_posting_jobs` as `pending_publish`.
4. **Publish processor** — RPC `claim_publish_jobs_adu`, dispatches to publisher.
5. **Publisher** — Reads R2 buffer object, publishes to Facebook Reels, RPC `finalize_posting_job_adu`.

Deploy workers: `posting/deploy.sh`. Deploy downloader: `downloader/README.md`.

### Facebook — InApp Schedule

| Worker | Wrangler name | Trigger |
|--------|---------------|---------|
| `services/facebook/inapp-schedule/posting/processor-worker` | `fbuploadpro-fb-inapp-schedule-processor` | Cron (every minute) |

**Flow:**

1. Cron fires → RPC `claim_due_facebook_inapp_schedule_posts` claims up to 10 pending posts (atomic `FOR UPDATE SKIP LOCKED`).
2. For each post: generate signed R2 download URL → publish to Facebook Graph via `file_url` → post first comment if specified.
3. On success: deduct tokens, delete R2 object, mark `published`.
4. On failure: retry (up to 3 attempts with 5-minute backoff), then mark `failed`.

### Facebook — Analytics

- `services/facebook/auto-download-upload/analytics/followers-metrics-cron-worker` — Cron every 2 minutes; Graph API fan counts; RPC `bulk_update_page_metrics`.

### Facebook — Scraper (VPS)

- `services/facebook/auto-download-upload/scraping/reels-scraper` — Puppeteer daemon; RPC `get_next_pending_page`; upserts `reels` with `status = pending`.

## Webapp

- Auth and multi-tenant subdomains via `webapp/src/proxy.ts` and Supabase SSR.
- Sidebar navigation organized by platform (Facebook, YouTube, Instagram) + Settings.
- Business logic: `webapp/src/server/services`, persistence: `webapp/src/server/repositories`.
- Facebook features: Direct Post, Direct Schedule (native FB), InApp Schedule (our queue), Bulk Delete, Auto Download/Upload.
- R2 media uploads via presigned URLs (`webapp/src/lib/r2/user-media.ts`).
- Token cost lookup via `token_cost_rules` table; deduction after successful publish.

## Data flow (end-to-end)

```mermaid
flowchart LR
  subgraph ingest [Ingestion]
    Scraper[reels-scraper VPS]
  end
  subgraph control [Control plane]
    Webapp[webapp]
  end
  subgraph adu [ADU Pipeline]
    BufferDL[buffer-downloader VPS]
    Scheduler[scheduler]
    PublishProc[publish-processor]
    Publisher[publisher]
  end
  subgraph inapp [InApp Schedule]
    InappProcessor[inapp-schedule-processor]
  end
  DB[(Supabase)]
  R2[(R2 media)]
  FB[Facebook Graph]

  Scraper --> DB
  Webapp --> DB
  Webapp --> R2
  BufferDL --> R2
  BufferDL --> DB
  Scheduler --> DB
  Scheduler --> PublishProc
  PublishProc --> DB
  PublishProc --> Publisher
  Publisher --> R2
  Publisher --> FB
  Publisher --> DB
  InappProcessor --> DB
  InappProcessor --> R2
  InappProcessor --> FB
```

## Service boundary rules

- No direct code imports between `webapp` and `backend_v3`.
- Each backend service owns its own `src/db/` (or `db.js`) Supabase client.
- Schema changes: add one file under `database/migrations/`, then update `database/production_schema.sql`.
- Legacy v1 posting (`posting_jobs`, Cloudflare queue `fbuploadprov2-prod-posting-download-jobs`) is removed from the repo and database snapshot.
