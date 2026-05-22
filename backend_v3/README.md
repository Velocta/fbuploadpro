# Backend V3

All backend services for FBUploadPro live under `backend_v3/`. Each service is independently deployable, owns its own Supabase client in `src/db/`, and must not import code from `webapp/` or other services.

## Directory layout

```
backend_v3/
├── services/
│   ├── posting/           # Cloudflare Workers: reel download + Facebook publish
│   ├── analytics/         # Followers metrics cron (Cloudflare Worker)
│   └── scraper/           # VPS Puppeteer reel ingestion
└── tests/                 # Downloader integration tests
```

## Services

### Posting (`services/posting/`)

End-to-end pipeline: schedule due pages → download source video → publish to Facebook Reels.

| Worker | Wrangler name | Trigger |
|--------|---------------|---------|
| `scheduler-worker` | `fbuploadprov2-v2-posting-scheduler` | Cron every minute |
| `download-processor-worker` | `fbuploadprov2-v2-download-processor` | Cron every minute |
| `reel-geter-worker` | `fbuploadprov2-v2-reel-geter` | HTTP (internal dispatch) |
| `downloader-service` | `fbuploadprov2-v2-downloader-service` | HTTP + Container (yt-dlp) |
| `publish-processor-worker` | `fbuploadprov2-v2-publish-processor` | Cron every minute |
| `publisher-worker` | `fbuploadprov2-v2-publisher` | HTTP (internal dispatch) |

**Database:** `posting_jobs_v2`, RPCs `claim_due_reels_and_create_jobs_v2`, `claim_download_jobs_v2`, `claim_publish_jobs_v2`, `finalize_posting_job_v2`, etc.

**Deploy:** `services/posting/deploy-posting.sh` (requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_JOB_DISPATCH_TOKEN`, Wrangler auth).

### Analytics (`services/analytics/followers-metrics-cron-worker/`)

Refreshes Facebook page `fan_count` and profile images every 2 minutes via Graph API; bulk-updates via `bulk_update_page_metrics` RPC.

**Deploy:** `cd services/analytics/followers-metrics-cron-worker && npm install && npx wrangler deploy`

### Scraper (`services/scraper/reels-scraper/`)

Long-running VPS daemon (Puppeteer). Claims pending pages via `get_next_pending_page`, scrapes reel IDs, upserts into `reels`.

**Run:** `cd services/scraper/reels-scraper && npm install && npm start` (not Cloudflare).

## Shared requirements

- **Supabase:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service role for pipeline/scraper)
- **Schema:** [`database/production_schema.sql`](../database/production_schema.sql)
- **Docs:** [`documentation/runbooks/`](../documentation/runbooks/)

## Deploy order (production)

1. Posting workers (`deploy-posting.sh`)
2. Followers metrics cron
3. Scraper (VPS, manual)

Webapp deploys separately from `webapp/` (Vercel).
