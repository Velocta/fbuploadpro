# Posting V2 Deploy Runbook

## Pre-Deploy Checklist

- Confirm migration `database/migrations/20260507_posting_v2_pipeline.sql` exists and has been reviewed.
- Confirm `database/production_schema.sql` includes posting V2 objects.
- Ensure Cloudflare account has:
  - queues: `fbuploadprov2-v2-reel-geter-jobs`, `fbuploadprov2-v2-publisher-jobs`
  - R2 bucket: `fbuploadprov2-v2-posting-media`
- Set `posting_v2_intake_paused = true` before deploying workers.

## Deploy Order

1. Apply DB migration.
2. Deploy downloader service.
3. Deploy reel-geter worker.
4. Deploy publisher worker.
5. Deploy download-processor worker.
6. Deploy publish-processor worker.
7. Deploy scheduler worker.

Use script: `backend_v2/services/posting-v2/deploy-posting-v2.sh`.

## Immediate Post-Deploy Checks (Intake Paused)

- Scheduler logs show claim runs without DB errors.
- Download/publish processors run scheduled ticks and no fatal errors.
- Reel-geter and publisher queue consumers are active.
- Downloader `/health` responds.
- `posting_jobs_v2` table is queryable and empty/expected.

## Controlled Bring-Up

1. Keep intake paused.
2. Inject synthetic test jobs into `posting_jobs_v2` and run one end-to-end cycle.
3. Validate:
   - `download_pending -> download_processing -> pending_publish -> publishing -> published`
   - reel transitions to `posted`
   - exactly one token usage transaction per posted reel
4. Set `posting_v2_intake_paused = false`.
5. Observe metrics/queues for at least 30 minutes.
