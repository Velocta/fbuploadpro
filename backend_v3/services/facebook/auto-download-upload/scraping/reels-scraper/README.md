# Multi-Platform Reels Scraper Service

Discovers short-form content IDs for ADU source pages and upserts them into `public.reels` (`status = pending`). Runs on a VPS as a long-lived Node process (PM2 recommended).

## Two-stage discovery

1. **yt-dlp (TikTok + YouTube only)** — `yt-dlp --flat-playlist -J "<profileUrl>"` lists IDs without a browser.
2. **Puppeteer (fallback + Instagram/Facebook)** — scrolls profile reels/shorts pages using logged-in sessions.

```text
pending ──claim──► processing
  ├─ tiktok/youtube: yt-dlp ──► synced (IDs found)
  │                 └─ fail/empty ──► browser_pending
  ├─ instagram/facebook: browser ──► synced | error
browser_pending ──claim──► processing ──► browser ──► synced | error

stuck processing (>1h, pg_cron) ──► browser_pending
```

Terminal page states: **`synced`** and **`error`**. Scheduling (`get_pages_due_posting`) still requires `synced`.

## Requirements

- Node.js 18+
- **yt-dlp** on `PATH` (same VPS as buffer-downloader is fine)
- Chromium via Puppeteer
- Supabase service role credentials

## Job polling (`index.js`)

Infinite loop:

1. Rotate platforms; call `get_next_pending_page(p_platform)` until a row is claimed (`sync_status → processing`).
2. If none, call `get_next_browser_pending_page(p_platform)` for yt-dlp fallbacks.
3. If none, sleep **60 seconds**.

Browser restarts after **500** jobs per session (`MAX_JOBS_PER_SESSION`).

## Platform behavior

| Platform | `pending` claim | `browser_pending` claim |
|----------|-----------------|-------------------------|
| TikTok | yt-dlp → `synced` or `browser_pending` | Puppeteer only |
| YouTube | yt-dlp → `synced` or `browser_pending` | Puppeteer only |
| Instagram | Puppeteer only | Puppeteer only |
| Facebook | Puppeteer only | Puppeteer only |

Profile URLs for yt-dlp match the browser scrapers (`@user` on TikTok, `/@handle/shorts` on YouTube).

## Configuration (`config.js` / `.env`)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key (bypasses RLS) |
| `BROWSER_USER_DATA_DIR` | Persistent Puppeteer profile |
| `MAX_REELS_PER_PLATFORM` | Cap per discovery run (default `1000`) |
| `SKIP_STARTUP_LOGINS` | Skip interactive login prompts when `true` |
| `YTDLP_BIN` | yt-dlp binary (default `yt-dlp`) |
| `YTDLP_TIMEOUT_MS` | Subprocess timeout (default `120000`) |

## Database RPCs

- `get_next_pending_page` — claims `sync_status = pending`
- `get_next_browser_pending_page` — claims `sync_status = browser_pending`
- `reset_stuck_pages` (cron every 15m) — `processing` → `browser_pending` when stuck >1h

## Modules

- `discovery/ytdlp.js` — spawn yt-dlp, parse JSON, extract IDs
- `discovery/profile-urls.js` — profile URL builders
- `discovery/extract-ids.js` — parse flat-playlist JSON
- `scrapers/*.js` — Puppeteer per platform

## Running locally

```bash
npm install
cp .env.example .env
npm start
```

## Tests

```bash
npm test
npm run lint
```

## Deploying

Install Chromium dependencies and **yt-dlp** on the VPS. Supervise with PM2 (`ecosystem.config.cjs` in sibling downloader if shared host).
