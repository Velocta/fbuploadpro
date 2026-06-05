# Multi-Platform Reels Scraper Service

Discovers short-form content IDs for ADU source pages and upserts them into `public.reels` (`status = pending`). Runs on a VPS as a long-lived Node process (PM2 recommended).

## Two-stage discovery

1. **yt-dlp (TikTok only)** — flat-playlist extract with `--playlist-items` (same as `main-scraper/scrapers/tiktok-ytdlp.js`).
2. **Puppeteer (YouTube + Instagram/Facebook, and TikTok fallback)** — scrolls profile pages using logged-in sessions.

```text
pending ──claim──► processing
  ├─ tiktok: yt-dlp ──► synced (IDs found)
  │          └─ fail/empty ──► browser_pending
  ├─ youtube/instagram/facebook: browser ──► synced | error
browser_pending ──claim──► processing ──► browser ──► synced | error

stuck processing (>1h, pg_cron) ──► browser_pending
```

Terminal page states: **`synced`** and **`error`**. Scheduling (`get_pages_due_posting`) still requires `synced`.

## Requirements

- Node.js 18+
- **yt-dlp** on `PATH` (or `python3 -m yt_dlp` fallback)
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
| YouTube | Puppeteer only | Puppeteer only |
| Instagram | Puppeteer only | Puppeteer only |
| Facebook | Puppeteer only | Puppeteer only |

TikTok yt-dlp profile URL: `https://www.tiktok.com/@{handle}` (leading `@` stripped).

## Configuration (`config.js` / `.env`)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key (bypasses RLS) |
| `BROWSER_USER_DATA_DIR` | Persistent Puppeteer profile |
| `BROWSER_USER_AGENT` | Puppeteer User-Agent |
| `MAX_REELS_PER_PLATFORM` | Cap per discovery run (default `1000`) |
| `SKIP_STARTUP_LOGINS` | Skip interactive login prompts when `true` |
| `YTDLP_BIN` | yt-dlp binary (default `yt-dlp`) |
| `YTDLP_TIMEOUT_MS` | Subprocess timeout (default `600000`) |

## Database RPCs

- `get_next_pending_page` — claims `sync_status = pending`
- `get_next_browser_pending_page` — claims `sync_status = browser_pending`
- `reset_stuck_pages` (cron every 15m) — `processing` → `browser_pending` when stuck >1h

## Modules

- `discovery/ytdlp.js` — TikTok yt-dlp discovery (`execFile`, JSON parse)
- `discovery/ytdlp-args.js` — argv builder (aligned with main-scraper)
- `discovery/profile-urls.js` — TikTok profile URL + platform gate
- `discovery/extract-ids.js` — shared JSON ID helpers (tests)
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
