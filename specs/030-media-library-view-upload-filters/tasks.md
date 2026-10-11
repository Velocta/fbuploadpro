# Tasks: Spec 030 — Media Library View Modes, Resumable Upload Controls, Aspect Ratio/Caption Filters & Custom Video Frame Thumbnail Picker

**Input**: Design documents from `/specs/030-media-library-view-upload-filters/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/media-filters-thumbnail-api.md](./contracts/media-filters-thumbnail-api.md)

## Phase 1: Domain Contracts (`backend-engineer`)

- [x] T001 [US3] [US4] Update `packages/contracts/src/domain/media.ts` to add optional `aspectRatio: z.enum(['9:16', '16:9', '1:1']).optional()` and `captionStatus: z.enum(['has_caption', 'empty_caption']).optional()` to `MediaListQuerySchema`, and add optional `thumbnailKey: z.string().min(1).max(500).nullable().optional()` and `thumbnailUrl: z.string().min(1).nullable().optional()` to `UpdateMediaItemRequestSchema`.
- [x] T002 [US3] [US4] Update `packages/contracts/tests/media-contracts.test.ts` to test `aspectRatio` and `captionStatus` in `MediaListQuerySchema` and `thumbnailKey`/`thumbnailUrl` in `UpdateMediaItemRequestSchema`, then build `@fbuploadpro/contracts`.

## Phase 2: Backend API Routes (`backend-engineer`)

- [x] T003 [US3] Update `apps/web/src/app/api/tenant/[subdomain]/media/route.ts` to parse `aspectRatio` and `captionStatus` from search params and apply SQL `WHERE` conditions (`aspect_ratio = $N`, `caption_text IS NOT NULL AND BTRIM(caption_text) <> ''` for `'has_caption'`, and `(caption_text IS NULL OR BTRIM(caption_text) = '')` for `'empty_caption'`).
- [x] T004 [US4] Update `apps/web/src/app/api/tenant/[subdomain]/media/[mediaId]/route.ts` (`handleUpdateMedia`) to accept optional `storageService?: IStorageService` (defaulting to `getStorageService()`), support updating `thumbnail_key` and `thumbnail_url`, and delete any superseded non-null `thumbnail_key` from Cloudflare R2 when replaced.
- [x] T005 [US3] [US4] Update `apps/web/tests/api/media-list-filter.test.ts` and `apps/web/tests/api/media-patch.test.ts` to verify filtering by `aspectRatio` (`9:16`, `16:9`, `1:1`) and `captionStatus` (`has_caption`, `empty_caption`), and updating `thumbnailKey`/`thumbnailUrl` via `PATCH /api/tenant/[subdomain]/media/[mediaId]` with R2 cleanup of the old thumbnail key.

## Phase 3: Frontend — Resumable Upload Controls, View Modes, Filters & Custom Video Frame Thumbnail Picker (`frontend-engineer`)

- [x] T006 [P] [US2] Update `apps/web/src/components/media/upload-queue-banner.tsx` to support `status: 'idle' | 'uploading' | 'paused' | 'completed' | 'cancelled'`, `failedEntries: QueuedUploadEntry[]`, cooperative `isPaused?: () => boolean` / `waitIfPaused?: () => Promise<void>` in `runBoundedUploadQueue` and `executeBoundedUploadBatch` (finishing in-flight transfers before halting further worker dispatch), and render **Pause** (`data-testid="pause-upload-btn"`), **Resume** (`data-testid="resume-upload-btn"`), and **"Retry Failed (`X`)"** (`data-testid="retry-failed-uploads-btn"`) buttons in `UploadQueueBanner`.
- [x] T007 [P] [US4] Update `apps/web/src/components/media/media-preview-modal.tsx` to export `captureVideoFrameAsWebp(videoEl: HTMLVideoElement)` (`640px` max dimension `<canvas>` WebP frame extractor with safe fallback) and render the **"Set Current Frame as Thumbnail"** button (`data-testid="set-video-frame-thumbnail-btn"`) on video items, calling `onUpdateThumbnail(item.id, frameResult)`.
- [x] T008 [US1] [US2] [US3] [US4] Update `apps/web/src/components/media/media-library-explorer.tsx` (and extract a modular `apps/web/src/components/media/media-table-row.tsx` component to keep cognitive complexity clean) to implement:
  - **Grid View (default `'grid'`) vs. Compact Table View (`'table'`)** toggle buttons (`data-testid="view-mode-grid-btn"` and `data-testid="view-mode-table-btn"`) persisted in `localStorage` (`MEDIA_VIEW_MODE_STORAGE_KEY = 'fbuploadpro:media-view-mode'`).
  - **Compact Table View** (`data-testid="media-table-view"`) rendering `MediaTableRow` (`data-testid="media-row-${item.id}"`) with checkbox (`Shift + Click` range support), mini thumbnail preview, filename (and clickable folder path during global search), click-to-edit inline caption cell (`data-testid="table-inline-caption-${item.id}"`) that turns into an input when clicked and saves on `Enter` or `blur`, aspect ratio, duration, file size, and row actions.
  - **Aspect Ratio (`data-testid="media-aspect-ratio-select"`) & Caption Status (`data-testid="media-caption-status-select"`)** toolbar filters wired into `refreshLibraryData`, `handleLoadMoreMedia`, and `filterAndSortMediaItems`.
  - **Upload Pause, Resume, Retry Failed & `beforeunload` Guard** wired into `MediaLibraryExplorer`.
  - **Custom Video Frame Thumbnail Update handler (`handleUpdateVideoThumbnail`)** uploading the captured WebP frame (via `/api/tenant/${subdomain}/media/upload-url` + `PUT` or dataUrl fallback) and persisting via `PATCH /api/tenant/${subdomain}/media/${mediaId}`.

## Phase 4: Integration Tests, Documentation Sync & Quality Gate Convergence (`qa-engineer`)

- [x] T009 [US1] [US2] [US3] [US4] Expand `apps/web/tests/ui/media-library-explorer.test.tsx` to test Grid (default) vs. Compact Table View toggle (`localStorage` persistence and click-to-edit table inline caption editing), Upload Pause/Resume/Retry Failed buttons & `beforeunload` protection, Aspect Ratio & Caption Status filtering, and the **"Set Current Frame as Thumbnail"** control in `MediaPreviewModal`.
- [x] T010 Update `docs/foundational-knowledge.md` to document Spec 030 (Grid vs. Compact Table View Toggle, Resumable Upload Controls & Tab-Close Guard, Aspect Ratio/Caption Status Filters, and Custom Video Frame Thumbnail Picker) in the same Pull Request.
- [x] T011 Run full Turborepo quality gate `pnpm turbo run build lint typecheck test` and verify 100% pass rate with 0 errors.
