# Environment Matrix

## Webapp (`webapp/.env.example`)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_MAIN_DOMAIN`
- `NEXT_PUBLIC_COOKIE_DOMAIN`
- `MAGIC_LINK_SIGNING_SECRET`

Webapp runtime notes:
- Production validates required env vars at startup (`webapp/src/lib/config/env.ts`).
- Supabase-heavy and integration-heavy API routes should run on Node.js runtime in Vercel.

## Posting Scheduler Worker (`backend/services/posting/posting-scheduler-worker/.env.example`)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Cloudflare Queue producer binding: `POSTING_QUEUE` (queue name `fbuploadprov2-prod-posting-download-jobs`, see `wrangler.toml`)
- Optional: `ENVIRONMENT` (e.g. `staging`, `prod`) for `pipeline_events.env_name`
- Optional: `SCHEDULER_TEST_API_KEY` to secure `/enqueue-test-job` (send as `x-test-api-key` header)

## Posting Orchestrator Worker (`backend/services/posting/posting-orchestrator-worker/.env.example`)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLISH_CALLBACK_TOKEN` (shared secret for internal downloader->publisher callback auth)
- Durable Object binding: `POSTING_PUBLISH_STATE_DO` (class `PostingPublishStateDO`) for idempotent publish locks
- Optional: `ENVIRONMENT` for `pipeline_events.env_name`
- Optional: `TEST_ENABLE_EXTERNAL_PUBLISH=true` to allow Facebook publish when `mode=test` (default skips publish in test)

## Downloader Queue Worker (`backend/services/media/downloader-queue-worker/.env.example`)

- Cloudflare Container binding: `POSTING_DOWNLOAD_CONTAINER` (class `PostingDownloadContainer`, image from `media-downloader-api/Dockerfile`)
- `PUBLISH_CALLBACK_TOKEN` (must match posting orchestrator secret)
- Cloudflare Queue consumer on queue `fbuploadprov2-prod-posting-download-jobs`
- Service binding: `PUBLISHER` -> `fbuploadprov2-prod-posting-03-publisher`

## Media Downloader API (`backend/services/media/media-downloader-api/.env.example`)

- `DATACENTER_PROXY`
- `RESIDENTIAL_PROXY`
- `PORT`

## Legacy Instagram Scraper (`backend/services/legacy/instagram-scraper-legacy/.env.example`)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INSTAGRAM_USERNAME`
- `INSTAGRAM_PASSWORD`
