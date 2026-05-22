# System Overview

## Components

- `webapp`: Next.js app for authentication, agency dashboard, and super-admin controls.
- `backend/services/posting/posting-scheduler-worker`: Scheduled trigger for posting workflows.
- `backend/services/posting/posting-orchestrator-worker`: Posting orchestration (download, publish, mark DB status).
- `backend/services/media/downloader-queue-worker`: Queue consumer for download stage (Cloudflare Container-backed execution).
- `backend/services/media/media-downloader-api`: Downloads media binaries from source URLs.
- `backend/services/analytics/followers-metrics-cron-worker`: Refreshes Facebook page metrics.
- `backend/services/legacy/instagram-scraper-legacy`: Legacy scraping daemon.
- `database`: Supabase PostgreSQL schema, functions, triggers, and RLS.

## Data Flow

1. Posting flow:
   - `posting-scheduler-worker` (`fbuploadprov2-prod-posting-01-scheduler`) fetches due pages and next pending reel, writes `posting_jobs` + `pipeline_events`, enqueues a job on Cloudflare Queue `fbuploadprov2-prod-posting-download-jobs`.
   - `downloader-queue-worker` (`fbuploadprov2-prod-posting-02-downloader`) consumes `fbuploadprov2-prod-posting-download-jobs`, downloads media via `media-downloader-api`, then POSTs `/publish-callback` to `posting-orchestrator-worker`.
   - `posting-orchestrator-worker` (`fbuploadprov2-prod-posting-03-publisher`) acquires per-job publish lock in Durable Object (`PostingPublishStateDO`), publishes to Facebook Graph, updates reel status (prod), and records `pipeline_events`.
2. Control flow:
   - `webapp` manages user auth, tokens, page setup, and app settings.
   - `webapp` reads/writes through Supabase with role checks and RLS.
   - `webapp` now exposes versioned API endpoints under `webapp/src/app/api/v1` and keeps business logic in `webapp/src/server/services`.

## Service Boundary Rules

- No direct code import between `webapp` and `backend`.
- No shared runtime business logic across backend services unless explicitly introduced as a dedicated shared package.
- Each service owns its own DB access entrypoint and query helpers in-service.
- Schema changes happen only in `database/migrations/`, then synced into `database/production_schema.sql`.
