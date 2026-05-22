# Backend Services

This directory contains independently deployable workers/services.

## Service Domains

- `services/posting/posting-scheduler-worker/`: scheduled poller that triggers post orchestration.
- `services/posting/posting-orchestrator-worker/`: receives publish callback payloads, publishes to Facebook, and finalizes posting state.
- `services/media/media-downloader-api/`: media download API consumed by posting orchestrator.
- `services/media/downloader-queue-worker/`: consumes `fbuploadprov2-prod-posting-download-jobs`, runs Cloudflare Container-backed downloads, and callbacks publisher worker.
- `services/analytics/followers-metrics-cron-worker/`: periodic page metrics refresh from Facebook.
- `services/legacy/instagram-scraper-legacy/`: legacy scraper job.

## Dependency Map

- `posting-scheduler-worker` (`fbuploadprov2-prod-posting-01-scheduler`) -> queue `fbuploadprov2-prod-posting-download-jobs`
- `downloader-queue-worker` (`fbuploadprov2-prod-posting-02-downloader`) consumes `fbuploadprov2-prod-posting-download-jobs` -> `media-downloader-api` (HTTP `/download`)
- `downloader-queue-worker` -> `posting-orchestrator-worker` (`/publish-callback` with shared token)
- `followers-metrics-cron-worker` -> Facebook Graph API
- All services -> Supabase PostgreSQL (service-owned DB clients; shared schema in `database/`)

## What Each Service Does

- `posting-scheduler-worker`: finds due pages and fan-outs publish requests.
- `posting-orchestrator-worker`: handles publish callbacks, publishes to Facebook, and marks status.
- `media-downloader-api`: fetches media binaries/metadata for publish pipeline consumption.
- `downloader-queue-worker`: orchestrates download stage and forwards media to publisher callback endpoint.
- `followers-metrics-cron-worker`: periodically updates page metrics (fan count/image/status).
- `instagram-scraper-legacy`: older daemon workflow kept for backward compatibility.

## Structure Convention

For worker services, use:

- `src/index.*` for runtime entrypoint
- `src/db/*` for Supabase client/repositories
- `src/integrations/*` for external APIs
- `src/domain/*` for orchestration logic

Each service keeps its own DB entrypoint and does not import runtime internals from other services.
