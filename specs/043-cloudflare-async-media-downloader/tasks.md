# Implementation Tasks: Cloudflare Asynchronous Media Downloader

**Feature**: Cloudflare Asynchronous Media Downloader  
**Branch**: `feat/043-cloudflare-async-media-downloader`  
**Status**: 100% Implemented  

---

## Phase 1: Setup & Foundational Infrastructure

**Purpose**: Database migration and shared contracts needed across apps and worker.

- [x] T001 [Foundational] Create database migration `supabase/migrations/20261017000000_media_download_jobs.sql` for `media_download_jobs` table, enums, indexes, and RLS policies.
- [x] T002 [P] [Foundational] Define `EnqueueDownloadJobSchema`, `DownloadJobResponseSchema`, `DownloadJobStatus`, and edge-safe URL validation in `packages/contracts/src/domain/downloader.ts`.
- [x] T003 [P] [Foundational] Export new schemas and contracts in `packages/contracts/src/index.ts`.
- [x] T004 [Foundational] Write unit tests for new contracts and edge SSRF validation in `packages/contracts/tests/downloader-contracts.test.ts`.

---

## Phase 2: User Story 1 (P1) - Cloudflare Edge Ingestion Engine

**Goal**: Asynchronously enqueue and stream media from remote URLs directly into Cloudflare R2.

- [x] T005 [US1] Create edge streaming downloader service `apps/worker/src/services/downloader-engine.ts` with `TransformStream` byte counting and direct `env.MEDIA_BUCKET.put()`.
- [x] T006 [US1] Implement `POST /api/media/download/enqueue` endpoint in `apps/worker/src/index.ts` with authentication, URL validation, and background `ctx.waitUntil()` task dispatch.
- [x] T007 [US1] Implement media item registration in `media_items` and storage quota tracking in `user_storage_quotas` upon stream completion in `apps/worker`.
- [x] T008 [US1] Add unit tests for worker download enqueuing and R2 stream dispatch in `apps/worker/tests/downloader-worker.test.ts`.

---

## Phase 3: User Story 2 (P2) - Real-Time Job Progress & Polling API

**Goal**: Expose status endpoint and throttle database updates during streaming.

- [x] T009 [US2] Implement throttled progress writer in `apps/worker/src/services/downloader-engine.ts` (write to Supabase DB only every 10% progress or 3 seconds).
- [x] T010 [US2] Implement `GET /api/media/download/jobs/:id` and `GET /api/media/download/jobs` endpoints in `apps/worker/src/index.ts`.
- [x] T011 [US2] Add unit tests verifying progress throttling and status responses in `apps/worker/tests/downloader-worker.test.ts`.

---

## Phase 4: User Story 3 (P3) - Frontend Async UI & Auto-Refresh

**Goal**: Seamless, non-blocking UI in Next.js web application.

- [x] T012 [US3] Update Next.js API route `apps/web/src/app/api/tenant/[subdomain]/media/downloader/route.ts` to support enqueuing jobs to the Cloudflare Worker.
- [x] T013 [US3] Update `CloudDownloaderModal.tsx` in `apps/web/src/components/media/media-downloader.tsx` to handle async enqueueing, display active progress bar, and allow modal closing while download continues in background.
- [x] T014 [US3] Add download completion event / auto-refresh hook in `apps/web/src/components/media/media-library-explorer.tsx` so new files appear automatically.

---

## Phase 5: User Story 4 (P4) - Resilient Error Handling & Quota Safeguards

**Goal**: Clean error handling, stream aborts on limits (> 500 MB), and R2 cleanup.

- [x] T015 [US4] Enforce 500 MB hard limit (`MAX_MEDIA_DOWNLOAD_BYTES`) in stream byte counter and abort stream if exceeded, setting job status to `failed` with `FILE_TOO_LARGE`.
- [x] T016 [US4] Implement edge-safe private IP / SSRF blocking in worker, setting job status to `failed` with `UNSAFE_URL`.
- [x] T017 [US4] Add tests for error conditions, aborts, and quota limits in `apps/worker/tests/downloader-worker.test.ts` and `apps/web/tests/`.

---

## Phase 6: Polish & Documentation

**Purpose**: Documentation updates and architecture synchronization.

- [x] T018 [P] Synchronize documentation in `docs/foundational-knowledge.md` to reflect the Cloudflare asynchronous media downloader architecture.
- [x] T019 Run convergence check (`speckit-converge`) and verify all tasks are checked off.
