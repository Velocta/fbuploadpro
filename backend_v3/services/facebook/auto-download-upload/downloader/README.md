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

## Run

```bash
python worker.py
```

The worker claims batches in a tight loop and only sleeps **60 seconds** when no reels are available.

**Defaults (tuned for ~8 GB RAM VPS, 30 parallel reels):**

| Setting | Default | Purpose |
|---------|---------|---------|
| `ADU_DOWNLOADER_CONCURRENCY` | 30 | Parallel reel jobs |
| `ADU_DOWNLOADER_CLAIM_BATCH` | 30 | Reels claimed per tick (match concurrency) |
| `ADU_ARIA2_MAX_CONNECTION` / `ADU_ARIA2_SPLIT` | 4 | aria2 connections per file (not 16) |
| `ADU_R2_UPLOAD_CHUNK_BYTES` | 8 MiB | Stream uploads; ~8 MB RAM per upload, not full file |

Each claimed reel gets up to **4** in-process download attempts before `mark_adu_reel_download_failed`; that is separate from the DB `download_retries` column (still max **3** claims before `download_failed`).

**Capacity notes:** 30 jobs still need disk under `/tmp` for temp files (often 30–100 MB each while downloading). Ensure adequate free space on the temp volume. If RAM is tight, lower concurrency or chunk size; if downloads are slow, try `ADU_ARIA2_MAX_CONNECTION=6` (watch connection limits).

## PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
```
