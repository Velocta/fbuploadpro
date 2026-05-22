# FBUploadPro2

Multi-service SaaS for scraping short-form content, scheduling Facebook publishing, and managing agency operations.

## Repository Layout

- `webapp/`: Next.js application (auth, dashboards, agency workflows, super-admin workflows).
- `backend/`: Independent backend services and workers.
  - `services/posting/posting-scheduler-worker/`: Scheduler worker that triggers posting jobs.
  - `services/posting/posting-orchestrator-worker/`: Posting pipeline worker (download + Facebook publish + DB updates).
  - `services/media/media-downloader-api/`: Media download service used by posting orchestrator.
  - `services/media/downloader-queue-worker/`: Download stage queue worker that forwards media to publish callback.
  - `services/analytics/followers-metrics-cron-worker/`: Periodic Facebook page metrics refresh worker.
  - `services/legacy/instagram-scraper-legacy/`: Legacy scraper job.
- `database/`: Canonical SQL source of truth.
  - `migrations/`: Incremental schema/policy changes.
  - `production_schema.sql`: Snapshot schema representing migration head.
- `documentation/`: Architecture, database governance, ADRs, and runbooks.

## Architecture Principles

- Services are deployable independently and must not import each other's internal code.
- Database schema/policies are managed only through `database/migrations/`.
- Every service owns its own database access entrypoint in its own folder.
- Web and backend layers communicate through explicit HTTP contracts and explicit DB queries.

## Database Workflow

1. Add exactly one migration file to `database/migrations/` per DB change.
2. Keep migrations idempotent where practical.
3. Update `database/production_schema.sql` to match the final schema state.
4. Include RLS policy changes in both migration and snapshot.
5. Do not include data seeding in standard migrations unless explicitly requested.

See `documentation/database/migration-workflow.md` for full workflow and release order.

## Service Boundaries

- `webapp/` may call Supabase and backend HTTP services, but does not import backend runtime code.
- Backend services may use shared database schema and HTTP APIs, but do not import webapp code.
- Service-specific docs stay within service folders or shared architecture docs under `documentation/`.
