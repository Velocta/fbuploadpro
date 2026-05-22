# Posting Deploy Runbook (ADU)

## Pre-deploy checklist

- Confirm `database/production_schema.sql` includes `posting_jobs_v2` and V2 RPCs.
- Cloudflare account has R2 bucket `fbuploadprov2-v2-posting-media`.
- Worker service bindings match names in each `wrangler.toml` under `backend_v3/services/facebook/auto-download-upload/posting/`.
- Set `posting_v2_intake_paused = true` before deploying workers.

## Deploy

From repo root, with env vars set:

```bash
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export INTERNAL_JOB_DISPATCH_TOKEN=...
# optional: export RESIDENTIAL_PROXY=...

./backend_v3/services/facebook/auto-download-upload/posting/deploy.sh
```

**Order (script):** downloader-service → reel-geter → publisher → download-processor → publish-processor → scheduler.

## Post-deploy (intake paused)

- Scheduler logs: `claim_due_reels_and_create_jobs_v2` without errors.
- Download/publish processors complete cron ticks.
- Downloader `GET /health` → `{ ok: true }`.
- `posting_jobs_v2` queryable.

## Controlled bring-up

1. Keep `posting_v2_intake_paused = true`.
2. Run one synthetic job (`posting-test-injection.md`).
3. Confirm: `download_pending` → … → `published`, reel `posted`, one usage `token_transactions` row.
4. Set `posting_v2_intake_paused = false`.
5. Observe job status distribution and worker logs for 30+ minutes (`posting-observability.md`).
