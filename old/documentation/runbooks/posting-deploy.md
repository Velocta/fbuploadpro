# Posting Deploy Runbook (ADU)

## Pre-deploy checklist

- Confirm `database/production_schema.sql` includes `adu_posting_jobs`, buffer columns on `reels`, and ADU RPCs.
- Apply migration `database/migrations/20260523120000_adu_buffer_pipeline.sql` to Supabase.
- Cloudflare account has R2 bucket `fbuploadpro-adu-buffer`.
- VPS has `yt-dlp`, `ffmpeg`, `aria2c`, and Python deps for `downloader/`.

## Deploy Cloudflare workers

From repo root, with env vars set:

```bash
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export INTERNAL_JOB_DISPATCH_TOKEN=...

./backend_v3/services/facebook/auto-download-upload/posting/deploy.sh
```

**Order (script):** publisher → publish-processor → scheduler.

## Deploy VPS buffer downloader

See `backend_v3/services/facebook/auto-download-upload/downloader/README.md` (PM2 + `.env`).

## Post-deploy verification

- Downloader logs: `claim_ok` / `download_ok` events.
- Scheduler logs: `create_due_adu_posting_jobs` without errors.
- Publish processor completes cron ticks; publisher receives internal jobs.
- `adu_posting_jobs` and `reels.status = downloaded` rows appear for active pages.

## Controlled bring-up

1. Optionally keep `posting_v2_intake_paused = true` on `system_settings` (scheduler respects pause).
2. Confirm buffer downloader fills `downloaded` reels for a test page.
3. Run one publish cycle; confirm job `published`, reel `posted`, usage in `token_transactions`.
4. Observe worker logs for 30+ minutes (`posting-observability.md`).
