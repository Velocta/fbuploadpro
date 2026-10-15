# Implementation Tasks: 046 Downloader and Media Library Audit Remediation

**Feature Branch**: `fix/046-media-downloader-and-library-remediation`  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Total Issues Covered**: 19 / 19 (from [`findings.md`](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/sync_latest_main_code/findings.md))

---

## Phase 1: Foundational (Database & Shared Contracts)

- [x] T001 [P] Create forward migration `supabase/migrations/20261019000000_downloader_and_library_remediation.sql` with stored procedure `public.fail_stuck_download_jobs(p_timeout_minutes)`.
- [x] T002 [P] Update `packages/contracts/src/domain/media.ts` to accept optional per-entry `folderId` in `CheckDuplicatesRequestSchema` and include `'4:5'` in `AspectRatioSchema`.
- [x] T003 [P] Add unit tests for updated contracts in `packages/contracts/tests/media-contracts.test.ts`.

---

## Phase 2: User Story 1 - Cloud Media Downloader Ingestion & Worker Resilience (Priority: P1)

- [x] T004 [US1] Remove all references to `user_storage_quotas`, `getUserStorageQuota`, and `increment_user_storage_used` in `apps/worker/src/services/downloader-engine.ts`.
- [x] T005 [US1] Add edge-compatible link resolution and Google Drive virus-scan bypass (`confirm=t`) in `apps/worker/src/services/downloader-engine.ts` and `apps/web/src/lib/media-downloader.ts`.
- [x] T006 [US1] Persist video thumbnails, extracted captions, durations, aspect ratios, and carousel `mediaIds` array in `apps/worker/src/services/downloader-engine.ts`.
- [x] T007 [US1] Replace recursive `readNextChunk()` with iterative `while(true)` in `apps/web/src/lib/media-downloader.ts` (`readResponseBytesWithLimit`).
- [x] T008 [US1] Clean up orphaned R2 objects via `storage.deleteObject` when multi-item carousel download or database insert fails in `apps/web/src/app/api/tenant/[subdomain]/media/downloader/route.ts`.
- [x] T009 [US1] Fix `handleRetryFailedEntry` in `apps/web/src/components/media/media-downloader.tsx` to preserve `entry.folderId`.
- [x] T010 [US1] Add `failStuckDownloadJobs` to edge cron in `apps/worker/src/index.ts` to transition $> 15\text{ min}$ stalled jobs to failed.
- [x] T011 [US1] Add worker downloader tests in `apps/worker/tests/downloader-engine.test.ts`.

---

## Phase 3: User Story 2 - Accurate PC Upload Metadata & Poster Frame Extraction (Priority: P1)

- [x] T012 [US2] Update `extractMediaMetadata` in `apps/web/src/components/media/upload-queue-banner.tsx` to return `width` and `height` and pass to `POST /media/confirm`.
- [x] T013 [US2] Capture WebP poster frame from `<canvas>` for uploaded videos, upload to `presigned.thumbnailUploadUrl`, and pass `thumbnailKey` in confirm payload.
- [x] T014 [US2] Explicitly detach offscreen `<video>` elements (`video.removeAttribute('src')`, `video.load()`) in `finish()` of `extractMediaMetadata`.
- [x] T015 [US2] Track `failedBytes` separately from `transferredBytes` in `UploadQueueBanner` so failed files do not falsely inflate progress.
- [x] T016 [US2] Support non-Latin / Unicode filenames in `apps/web/src/app/api/tenant/[subdomain]/media/upload-url/route.ts` using `NFKC` and `/[^\p{L}\p{N}._-]/gu`.
- [x] T017 [US2] Add unit tests for metadata extraction, thumbnail generation, and Unicode upload URLs in `apps/web/tests/api/media-upload.test.ts`.

---

## Phase 4: User Story 3 - Precise Duplicate Detection & Search/Filter Usability (Priority: P2)

- [x] T018 [US3] Update `POST /api/tenant/[subdomain]/media/check-duplicates/route.ts` to perform strict tuple matching `(LOWER(name), file_size, folder_id)` across nested batches.
- [x] T019 [US3] Wire multi-folder duplicate matching in `MediaLibraryExplorer` (`apps/web/src/components/media/media-library-explorer.tsx`).
- [x] T020 [US3] Replace permanent `hasInitialData` guard in `MediaLibraryExplorer` with `isFirstMountWithInitialData` ref to allow search, sort, and filters to query backend.
- [x] T021 [US3] Add `'4:5'` portrait option to `AspectRatioFilterKey`, `classifyAspectRatio`, and filter dropdown in `MediaLibraryExplorer`.
- [x] T022 [US3] Add `loadError` state and retry banner in `MediaLibraryExplorer` when folder fetch fails.
- [x] T023 [US3] Add unit tests for duplicate tuple checks and aspect ratio filter in `apps/web/tests/ui/media-explorer.test.tsx`.

---

## Phase 5: User Story 4 - 1-Click Publishing & Documentation Synchronization (Priority: P3)

- [x] T024 [US4] Add 1-click "Schedule / Add to Queue" action on `MediaAssetCard`, `BatchActionBar`, and `RecentDownloads` list in `MediaDownloader`.
- [x] T025 [US4] Update `docs/foundational-knowledge.md` with Spec 046 architecture and mark `findings.md` as remediated.
- [x] T026 [US4] Run `/speckit-converge` to verify 100% convergence across `spec.md`, `plan.md`, and `tasks.md`.
