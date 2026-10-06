# Backend V3

All backend services for FBUploadPro live under `backend_v3/`. Each service is independently deployable, owns its own Supabase client in `src/db/`, and must not import code from `webapp/` or other services.

## Directory layout

```
backend_v3/
├── services/
│   ├── facebook/
│   │   ├── auto-download-upload/
│   │   │   ├── posting/          # CF scheduler + publish pipeline
│   │   │   ├── downloader/       # VPS buffer downloader (yt-dlp → R2)
│   │   │   ├── analytics/        # Followers metrics cron
│   │   │   └── scraping/         # VPS reels scraper
│   │   └── inapp-schedule/
│   │       └── posting/          # In-app scheduled publish processor
│   ├── youtube/
│   └── instagram/
└── tests/
```

## Cloudflare worker names

| Worker | Wrangler name |
|--------|----------------|
| ADU publisher (deploy 1) | `fbuploadpro-adu-1-publisher` |
| ADU publish processor (deploy 2) | `fbuploadpro-adu-2-publish-processor` |
| ADU scheduler (deploy 3) | `fbuploadpro-adu-3-scheduler` |
| ADU buffer downloader (VPS) | PM2 `fbuploadpro-adu-downloader` |
| ADU analytics | `fbuploadpro-fb-adu-analytics` |
| InApp schedule processor | `fbuploadpro-fb-inapp-schedule-processor` |

## Facebook Auto Download/Upload

End-to-end pipeline: VPS pre-downloads reels to R2 (`fbuploadpro-adu-buffer`) → CF scheduler creates `adu_posting_jobs` → publish to Facebook Reels.

**Deploy CF workers:** `services/facebook/auto-download-upload/posting/deploy.sh`

**Deploy VPS downloader:** `services/facebook/auto-download-upload/downloader/README.md`

**Database:** `pages`, `reels`, `adu_posting_jobs` and RPCs (`create_due_adu_posting_jobs`, `claim_adu_buffer_downloads`, …).

## Facebook InApp Schedule

Cron worker claims due rows from `facebook_inapp_schedule_posts` via `claim_due_facebook_inapp_schedule_posts`, publishes to Graph, deducts tokens, deletes R2 media.

**Path:** `services/facebook/inapp-schedule/posting/processor-worker/`

**Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `USER_MEDIA_PUBLIC_BASE_URL` (HTTPS origin Facebook can fetch for `file_url`).

## Analytics

`services/facebook/auto-download-upload/analytics/followers-metrics-cron-worker/` — deploy via `analytics/deploy.sh`.

## Scraper

`services/facebook/auto-download-upload/scraping/reels-scraper/` — VPS Puppeteer daemon.

## Shared requirements

- **Supabase:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **Schema:** [`database/production_schema.sql`](../database/production_schema.sql)

Webapp is located separately under `webapp/`.
