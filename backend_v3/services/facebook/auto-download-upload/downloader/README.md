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

## PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
```
