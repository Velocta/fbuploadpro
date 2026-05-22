# Pipeline Cutover Runbook

This runbook covers staged rollout of the queue/container/DO posting pipeline.

## Scope

- Scheduler queue producer: `backend/services/posting/posting-scheduler-worker`
- Download queue consumer + container runtime: `backend/services/media/downloader-queue-worker`
- Publisher callback + DO lock: `backend/services/posting/posting-orchestrator-worker`
- DB schema: `database/migrations/20260421_posting_pipeline_jobs_and_events.sql`

## 0) Preconditions

- Branch is pushed and reviewed.
- `database/production_schema.sql` matches migration.
- Cloudflare queues exist: `fbuploadprov2-prod-posting-download-jobs`.
- Worker secrets are prepared:
  - scheduler: `SUPABASE_SERVICE_ROLE_KEY`, optional `SCHEDULER_TEST_API_KEY`
  - downloader worker: `PUBLISH_CALLBACK_TOKEN`
  - orchestrator: `SUPABASE_SERVICE_ROLE_KEY`, `PUBLISH_CALLBACK_TOKEN`
- `PUBLISH_CALLBACK_TOKEN` value is identical in downloader and orchestrator.

## 1) Staging Deploy Order

Run from each service directory:

```bash
npm install
npm run deploy
```

Deploy in this order:

1. `backend/services/posting/posting-orchestrator-worker`
2. `backend/services/media/downloader-queue-worker`
3. `backend/services/posting/posting-scheduler-worker`

Then apply the DB migration in staging.

## 2) Staging Validation (Scheduler-Off)

- Keep scheduler DB-driven behavior disabled for validation window.
- Inject jobs using:
  - `documentation/runbooks/pipeline-test-injection.md`
- Validate with:
  - `documentation/runbooks/pipeline-observability.md`

Required pass criteria:

- `job_enqueued`, `download_succeeded`, `publish_succeeded` observed.
- No duplicate publish for same `job_id`.
- `state_conflict` behaves as expected on duplicate callback.
- `lease_expired_requeued` appears for forced stale-job scenario.
- Terminal failures produce both:
  - `job_failed_terminal`
  - `dead_lettered`

## 3) Controlled Staging Soak

Keep staging running for at least 24h with repeated injections:

- Happy path
- Invalid payload
- Download exhausted retry
- Invalid Facebook token
- Duplicate callback replay

Watch:

- retry volume trend
- terminal failure rate
- download/publish p95 latency

## 4) Production Cutover

1. Apply migration in production.
2. Deploy in same order as staging:
   1) orchestrator, 2) downloader-queue-worker, 3) scheduler.
3. Run manual injection on production test-only page/account first.
4. Enable normal scheduler operation.
5. Monitor dashboards for 60 minutes.

## 5) Rollback

If cutover regresses:

1. Pause scheduler trigger.
2. Stop downloader-queue-worker deploy target.
3. Revert scheduler/orchestrator workers to previous revision.
4. Keep migration in place (non-destructive rollback at app layer only).
5. Clear or drain queue after root-cause review.

## 6) Exit Criteria

- No unexplained `failed_terminal` spikes for 24h.
- Retry rates stable and within expected range.
- No duplicate posting incidents.
- Dashboard + alert signal quality is acceptable for on-call use.
