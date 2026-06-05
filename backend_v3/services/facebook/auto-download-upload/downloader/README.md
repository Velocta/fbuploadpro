# ADU buffer downloader (VPS)

Pre-downloads reels into R2 (`fbuploadpro-adu-buffer`) so the posting scheduler can publish without a download phase.

## Requirements

- Python 3.11+
- `yt-dlp`, `ffmpeg`, `aria2c` on PATH
- Supabase service role + R2 S3 API credentials

## Setup

```bash
cd backend_v3/services/facebook/auto-download-upload/downloader
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill values
```

Apply the ADU buffer migration (`20260605120000_adu_buffer_claim_improvements.sql`) before running the worker.

## Run

```bash
python worker.py
```

The worker keeps a **persistent thread pool** at `ADU_DOWNLOADER_CONCURRENCY`. Each loop iteration:

1. **`reset_stale_adu_reel_downloads`** — reels in `processing` longer than `ADU_DOWNLOADER_STALE_MINUTES` (default 40) return to `pending`
2. **`claim_adu_buffer_downloads(free_slots)`** — one RPC per top-up, where `free_slots = concurrency − in-flight downloads`
3. Sleep **60 seconds** only when nothing is in flight and claim returned zero rows

### Claim rules (Postgres RPC)

- Pages must be **`status = active`**, **`sync_status = synced`**, and `posts_per_day > 0` (aligned with the posting scheduler)
- Buffer target per page: **`posts_per_day × 4`**, counting reels in **`downloaded`** or **`processing`**
- Claimed reels move to **`processing`** with `download_claimed_at = now()`
- Failed downloads reset to **`pending`** (or **`download_failed`** after 3 claims)

**Defaults (tuned for ~8 GB RAM VPS, 30 parallel reels):**

| Setting | Default | Purpose |
|---------|---------|---------|
| `ADU_DOWNLOADER_CONCURRENCY` | 30 | Max parallel reel jobs |
| `ADU_DOWNLOADER_STALE_MINUTES` | 40 | Stuck `processing` → `pending` |
| `ADU_ARIA2_MAX_CONNECTION` / `ADU_ARIA2_SPLIT` | 4 | aria2 connections per file |
| `ADU_R2_UPLOAD_CHUNK_BYTES` | 8 MiB | Stream uploads; ~8 MB RAM per upload |

Each claimed reel gets up to **4** in-process download attempts before `mark_adu_reel_download_failed`; that is separate from the DB `download_retries` column (max **3** claims before `download_failed`).

### Proxies (optional)

| Variable | Platforms | Used for |
|----------|-----------|----------|
| `RESIDENTIAL_PROXY` | YouTube | Full yt-dlp download |
| `DATACENTER_PROXY` | Instagram | yt-dlp metadata / URL resolution only; CDN fetch via aria2 is direct |
| `DATACENTER_PROXY` | TikTok, Facebook | Full yt-dlp download |

If a proxy env var is unset, that step runs without a proxy. Only Instagram uses metadata + aria2; TikTok and Facebook always download through yt-dlp (Facebook may use generic extractor fallback).

**Capacity notes:** Parallel jobs need disk under `/tmp` for temp files (often 30–100 MB each while downloading). If RAM is tight, lower concurrency or chunk size.

## PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
```
