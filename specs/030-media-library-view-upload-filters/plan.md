# Implementation Plan: Spec 030 — Media Library View Modes, Resumable Upload Controls, Aspect Ratio/Caption Filters & Custom Video Frame Thumbnail Picker

**Branch**: `feat/030-media-library-view-upload-filters` | **Date**: 2026-10-11 | **Spec**: [spec.md](./spec.md)

## Summary

Deliver the next 4 major capabilities for the FBUploadPro Media Library:
1. **Domain Contracts (`@fbuploadpro/contracts` — `packages/contracts/src/domain/media.ts`)**:
   - Extend `MediaListQuerySchema` with optional `aspectRatio: z.enum(['9:16', '16:9', '1:1']).optional()` and `captionStatus: z.enum(['has_caption', 'empty_caption']).optional()`.
   - Extend `UpdateMediaItemRequestSchema` with optional `thumbnailKey: z.string().min(1).max(500).nullable().optional()` and `thumbnailUrl: z.string().min(1).nullable().optional()`.
2. **Backend API Routes (`apps/web/src/app/api/tenant/[subdomain]/media/**`)**:
   - `media/route.ts`: Parse `aspectRatio` and `captionStatus` from search params and apply SQL `WHERE` conditions (`aspect_ratio = $N`, `caption_text IS NOT NULL AND BTRIM(caption_text) <> ''`, or `(caption_text IS NULL OR BTRIM(caption_text) = '')`).
   - `media/[mediaId]/route.ts`: Allow `PATCH` (`handleUpdateMedia`) to update `thumbnail_key` and `thumbnail_url`. When a media item's `thumbnail_key` is replaced with a new key (or set to `null`) and the previous `thumbnail_key` was non-null and different, delete the superseded `thumbnail_key` from Cloudflare R2 via `getStorageService()`.
3. **Resumable Upload Queue: Pause, Resume, Retry Failed & Tab-Close Guard (`apps/web/src/components/media/upload-queue-banner.tsx`)**:
   - Extend `UploadBatchState.status` to `'idle' | 'uploading' | 'paused' | 'completed' | 'cancelled'` and include `failedEntries?: QueuedUploadEntry[]`.
   - In `executeBoundedUploadBatch` (and `runBoundedUploadQueue`), accept `waitIfPaused?: () => Promise<void>` (or `isPaused?: () => boolean` with a resume promise/waiter) so that when the user clicks **Pause** (`data-testid="pause-upload-btn"`), currently transferring files finish cleanly while workers wait before pulling the next queued item until **Resume** (`data-testid="resume-upload-btn"`) is clicked.
   - Track failed `QueuedUploadEntry` items in `failedEntries` and render a **"Retry Failed (`X`)"** button (`data-testid="retry-failed-uploads-btn"`) in `UploadQueueBanner` when `state.failedFiles > 0 && state.status !== 'uploading'`.
   - In `MediaLibraryExplorer`, register a `window` `beforeunload` listener whenever `uploadState.status === 'uploading' || uploadState.status === 'paused'`.
4. **Grid View (Default) vs. Compact Table View Toggle & Aspect Ratio / Caption Status Filters (`apps/web/src/components/media/media-library-explorer.tsx`)**:
   - Add `viewMode` state (`'grid' | 'table'`, defaulting to `'grid'` and persisted to `localStorage` under `MEDIA_VIEW_MODE_STORAGE_KEY = 'fbuploadpro:media-view-mode'`).
   - Render toolbar toggle buttons (`data-testid="view-mode-grid-btn"` and `data-testid="view-mode-table-btn"`).
   - Add `aspectRatioFilter` (`'all' | '9:16' | '16:9' | '1:1'`) and `captionStatusFilter` (`'all' | 'has_caption' | 'empty_caption'`) in the toolbar (`data-testid="media-aspect-ratio-select"` and `data-testid="media-caption-status-select"`), wiring them into `refreshLibraryData`, `handleLoadMoreMedia`, and `filterAndSortMediaItems`.
   - Create a dedicated `MediaTableRow` (or `MediaCompactTable`) component rendering `data-testid="media-table-view"` and `data-testid="media-row-${item.id}"` with selection checkbox (`Shift + Click` range support), mini thumbnail preview, filename, click-to-edit inline caption cell (`data-testid="table-inline-caption-${item.id}"`) that turns into an input when clicked and saves on `Enter` or `blur`, aspect ratio, duration, file size, and row actions.
5. **Custom Video Frame Thumbnail Picker (`apps/web/src/components/media/media-preview-modal.tsx`)**:
   - Export helper `captureVideoFrameAsWebp(videoElement: HTMLVideoElement): Promise<{ blob: Blob | null; dataUrl: string }>` that draws the current `<video>` frame onto a `640px`-max `<canvas>` and encodes `image/webp`.
   - In `MediaPreviewModal`, render **"Set Current Frame as Thumbnail"** (`data-testid="set-video-frame-thumbnail-btn"`) when `item.mediaType === 'video'`. Clicking it captures the current frame, uploads it (via presigned URL from `/api/tenant/${subdomain}/media/upload-url` or dataUrl fallback in mock/offline mode), and calls `onUpdateThumbnail(item.id, { thumbnailKey, thumbnailUrl })` which sends `PATCH /api/tenant/${subdomain}/media/${item.id}` and updates the item's thumbnail across the explorer.

## Constitution Check

- **Principle I (SDD & TDD)**: Full Spec Kit artifacts created before code changes.
- **Principle III (Multi-Tenant Isolation)**: All `GET` and `PATCH` queries strictly enforce `user_id = session.userId`.
- **Principle VIII & IX (Theme Token Authority & Professional UX Copy)**: Strictly uses `@web/lib/theme` (`THEME`, `PALETTE`, `RADII`, `SPACING`, `TYPOGRAPHY`, `COMPONENT_STYLES`); zero changes to `DESIGN.md`; zero hardcoded hex literals; zero capsule pill badges; zero decorative status dots.
- **Principle XXIII (Spec 030 Architecture)**: Grid (default) / Compact Table view toggle with `localStorage` persistence, cooperative Pause/Resume + Retry Failed + `beforeunload` guard, Aspect Ratio & Caption Status filters, and Custom Video Frame Thumbnail Picker.
