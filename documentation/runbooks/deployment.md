# Deployment Runbook

## Pre-Deploy

- Confirm `database/migrations/` includes intended DB changes.
- Confirm `database/production_schema.sql` matches migration head.
- Verify environment variables/secrets are configured for target environment.

## Recommended Order

1. Deploy backend dependencies first (`downloader`) if interfaces changed.
2. Deploy workers (`posting publisher`, `posting downloader`, `posting scheduler`, `followers cron`).
3. Deploy `webapp` (Vercel preview first, then production promote).
4. Run DB migration if release depends on DB schema change and deployment ordering requires it.

Use release notes to choose exact ordering when API contracts change.

## Post-Deploy Smoke Checks

- `webapp` auth works for both agency and super-admin.
- `webapp` API v1 endpoints respond correctly (`/api/v1/agency/...`, `/api/v1/admin/...`).
- `downloader-queue-worker` can download and callback publisher for one test reel.
- `posting-01-scheduler` can enqueue `fbuploadprov2-prod-posting-download-jobs`.
- `pipeline_events` receives `job_enqueued`, `download_succeeded`, and `publish_succeeded` for a test job.
- No new RLS/policy errors in logs.

## Manual Test Injection

- For scheduler-off testing, use `runbooks/pipeline-test-injection.md`.
- Keep scheduler DB reads disabled and inject synthetic jobs via `POST /enqueue-test-job`.

## Cutover Sequence

- Use `runbooks/pipeline-cutover.md` for full staging -> production rollout and rollback sequence.
