# Environment Matrix

## Webapp (`webapp/.env.example`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/SSR anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin operations |
| `NEXT_PUBLIC_MAIN_DOMAIN` | e.g. `fbuploadpro.com` |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | e.g. `.fbuploadpro.com` |
| `MAGIC_LINK_SIGNING_SECRET` | HMAC for magic-link FB connect |

Production validates required vars in `webapp/src/lib/config/env.ts`. Integration-heavy API routes use Node.js runtime on Vercel.

## Posting workers (`backend_v3/services/posting/*/.env.example`)

Shared across scheduler, download-processor, reel-geter, publish-processor, publisher:

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Pipeline DB access (bypasses RLS) |
| `INTERNAL_JOB_DISPATCH_TOKEN` | Yes (except scheduler) | Auth for `/internal/v2/process-job` |

**Scheduler-only:**

| Variable | Purpose |
|----------|---------|
| `POSTING_V2_MODE` | `prod` or `test` (default `prod`) |

**Processors:**

| Variable | Purpose |
|----------|---------|
| `MAX_BATCH_PER_CLAIM` | Jobs per RPC claim |
| `MAX_ROWS_PER_TICK` | Max dispatches per cron tick |
| `MAX_TICK_SECONDS` | Wall-clock budget per tick |
| `BACKPRESSURE_MAX_PROCESSING` | Download processor only |

**Reel-geter:**

| Variable | Purpose |
|----------|---------|
| `DOWNLOAD_MAX_BYTES` | Max media size (default 200MB) |

**Publisher:**

| Variable | Purpose |
|----------|---------|
| `POSTING_MEDIA_UPLOAD_MODE` | `stream` (default) or `hosted` |
| `POSTING_MEDIA_PUBLIC_BASE_URL` | Public origin for hosted mode |
| `INTEGRITY_PAUSE_THRESHOLD` / `INTEGRITY_WINDOW_SECONDS` | Auto-pause intake on integrity errors |

## Downloader service (`backend_v3/services/posting/downloader-service/.env.example`)

| Variable | Purpose |
|----------|---------|
| `RESIDENTIAL_PROXY` | Required for YouTube downloads in container |

Cloudflare bindings (see each `wrangler.toml`): R2 `fbuploadprov2-v2-posting-media`, Container `DownloaderContainer`.

## Followers metrics cron (`backend_v3/services/analytics/followers-metrics-cron-worker/.env.example`)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for RPC `bulk_update_page_metrics` |

Wrangler name: `fbuploadprov2-prod-analytics-01-followers-cron`. Cron: every 2 minutes.

## Reels scraper (`backend_v3/services/scraper/reels-scraper/.env.example`)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Scraper DB access |
| `BROWSER_USER_DATA_DIR` | Persistent Puppeteer profile |
| `MAX_REELS_PER_PLATFORM` | Cap per sync run |
| `SKIP_STARTUP_LOGINS` | Skip interactive login prompts when `true` |

Runs on VPS (not Wrangler). Use PM2 or similar for process supervision.
