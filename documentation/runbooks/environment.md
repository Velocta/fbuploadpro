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
| `R2_ACCOUNT_ID` | Cloudflare account ID for R2 |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key |
| `R2_USER_MEDIA_BUCKET` | Bucket name (default: `fbuploadpro-user-media`) |
| `R2_ADU_BUFFER_BUCKET` | ADU pre-download buffer (default: `fbuploadpro-adu-buffer`) |
| `USER_MEDIA_PUBLIC_BASE_URL` | HTTPS origin for Facebook `file_url` fetches |

Production validates required vars in `webapp/src/lib/config/env.ts`. Integration-heavy API routes use Node.js runtime on Vercel.

## ADU buffer downloader (VPS)

Path: `backend_v3/services/facebook/auto-download-upload/downloader/`

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Claim/update reels |
| `R2_ACCOUNT_ID` | Yes | R2 S3 endpoint |
| `R2_ACCESS_KEY_ID` | Yes | R2 credentials |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 credentials |
| `R2_ADU_BUFFER_BUCKET` | Yes | Default `fbuploadpro-adu-buffer` |
| `ADU_DOWNLOADER_IDLE_WAIT_SECONDS` | No | Sleep when no in-flight work and claim empty (default 60) |
| `ADU_DOWNLOADER_CONCURRENCY` | No | Max parallel downloads (default 30); claim limit = free slots |
| `ADU_DOWNLOADER_STALE_MINUTES` | No | Reset stuck `processing` reels to `pending` (default 40) |
| `ADU_DOWNLOADER_ATTEMPT_RETRIES` | No | In-process download attempts per claim (default 4); separate from DB `download_retries` |
| `ADU_ARIA2_MAX_CONNECTION` | No | aria2 `-x` per file (default 4) |
| `ADU_ARIA2_SPLIT` | No | aria2 `-s` per file (default 4) |
| `ADU_R2_UPLOAD_CHUNK_BYTES` | No | R2 upload read chunk size (default 8388608); avoids loading whole file into RAM |
| `RESIDENTIAL_PROXY` | No | YouTube yt-dlp downloads only |
| `DATACENTER_PROXY` | No | Instagram/TikTok/Facebook metadata URL resolution only (aria2 CDN fetch is direct) |
| `IMPERSONATE_TARGET` | No | Optional yt-dlp impersonate |

## ADU Posting workers (`backend_v3/services/facebook/auto-download-upload/posting/*`)

Shared across scheduler, publish-processor, publisher:

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

**Publisher:**

| Variable | Purpose |
|----------|---------|
| `POSTING_MEDIA_UPLOAD_MODE` | `stream` (default) or `hosted` |
| `POSTING_MEDIA_PUBLIC_BASE_URL` | Public origin for hosted mode |
| `INTEGRITY_PAUSE_THRESHOLD` / `INTEGRITY_WINDOW_SECONDS` | Auto-pause intake on integrity errors |

## InApp Schedule processor (`backend_v3/services/facebook/inapp-schedule/posting/processor-worker`)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for claim RPC and token deduction |
| `USER_MEDIA_PUBLIC_BASE_URL` | HTTPS origin for `file_url` (Facebook fetches media) |

Cloudflare bindings: R2 `fbuploadpro-user-media`. Cron: every minute.

## Analytics (`backend_v3/services/facebook/auto-download-upload/analytics/followers-metrics-cron-worker`)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for RPC `bulk_update_page_metrics` |

Wrangler name: `fbuploadpro-fb-adu-analytics`. Cron: every 2 minutes.

## Reels scraper (`backend_v3/services/facebook/auto-download-upload/scraping/reels-scraper`)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Scraper DB access |
| `BROWSER_USER_DATA_DIR` | Persistent Puppeteer profile |
| `MAX_REELS_PER_PLATFORM` | Cap per sync run |
| `SKIP_STARTUP_LOGINS` | Skip interactive login prompts when `true` |
| `YTDLP_BIN` | yt-dlp binary for TikTok ID discovery (default `yt-dlp`) |
| `YTDLP_TIMEOUT_MS` | yt-dlp subprocess timeout ms (default `600000`) |

Runs on VPS (not Wrangler). Requires **yt-dlp** on PATH (or `python3 -m yt_dlp`). TikTok `pending` jobs use yt-dlp flat-playlist discovery (same flags as `main-scraper`); failures queue `browser_pending` for Puppeteer. YouTube/Instagram/Facebook use browser only on `pending`. Stuck `processing` rows (>1h) are reset to `browser_pending` via `reset_stuck_pages` cron. Use PM2 or similar for process supervision.
