# Backend V3

All backend services for FBUploadPro live under `backend_v3/`. Each service is independently deployable, owns its own Supabase client in `src/db/`, and must not import code from `webapp/` or other services.

## Directory layout

```
backend_v3/
├── services/
│   ├── facebook/
│   │   ├── auto-download-upload/
│   │   │   ├── posting/          # Scheduler, download, publish pipeline
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
| ADU scheduler | `fbuploadpro-fb-adu-scheduler` |
| ADU download processor | `fbuploadpro-fb-adu-download-processor` |
| ADU reel-geter | `fbuploadpro-fb-adu-reel-geter` |
| ADU downloader | `fbuploadpro-fb-adu-downloader` |
| ADU publish processor | `fbuploadpro-fb-adu-publish-processor` |
| ADU publisher | `fbuploadpro-fb-adu-publisher` |
| ADU analytics | `fbuploadpro-fb-adu-analytics` |
| InApp schedule processor | `fbuploadpro-fb-inapp-schedule-processor` |

## Facebook Auto Download/Upload

End-to-end pipeline: schedule due pages → download source video → publish to Facebook Reels.

**Deploy:** `services/facebook/auto-download-upload/posting/deploy.sh`

**Database:** `pages`, `reels`, `posting_jobs_v2` and related RPCs.

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

Webapp deploys separately from `webapp/` (Vercel).
