# Feature Specification: Media Library View Modes, Resumable Upload Controls, Aspect Ratio/Caption Filters & Custom Video Frame Thumbnail Picker

**Feature Branch**: `feat/030-media-library-view-upload-filters`  
**Created**: 2026-10-11  
**Status**: Approved  

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Grid View (Default) vs. High-Density Compact Table View Toggle (Priority: P1)

An operator opens the Media Library, which renders in **Grid View** by default (`viewMode = 'grid'`, displaying visual thumbnail cards with `300ms` hover video preview). In the explorer toolbar, the operator can toggle between **Grid View** (`data-testid="view-mode-grid-btn"`) and **Compact Table View** (`data-testid="view-mode-table-btn"`), and their preference is remembered in `localStorage` (`fbuploadpro:media-view-mode`) across reloads. In **Compact Table View** (`data-testid="media-table-view"`), assets are displayed as high-density spreadsheet-style rows showing a selection checkbox (supporting `Shift + Click` range selection), mini thumbnail preview button, filename (with optional clickable folder path in global search), click-to-edit inline caption cell (`data-testid="table-inline-caption-<id>"`) that turns into an input when clicked and saves on `Enter` or `blur`, aspect ratio (`9:16`, `16:9`, `1:1`), duration, file size, and row actions (Preview, Move, Delete).

**Why this priority**: Operators curating 50–500 videos need a high-density table view to scan metadata and edit captions rapidly without scrolling through tall visual cards, while preserving Grid View as the default visual experience.

**Independent Test**: Open the Media Library and verify it defaults to Grid View; click the Compact Table View toggle button, verify rows render with mini thumbnails, metadata columns, and click-to-edit caption cells, edit a caption inline in the table, and verify `localStorage` persists the selected view mode across mounts.

**Acceptance Scenarios**:

1. **Given** an operator visits `/media` for the first time with no saved `localStorage` preference, **When** the Media Library renders, **Then** **Grid View** (`data-testid="media-grid"`) is active by default.
2. **Given** the Media Library toolbar, **When** the operator clicks the **Compact Table View** button (`data-testid="view-mode-table-btn"`), **Then** the view switches to `data-testid="media-table-view"` and persists `'table'` to `localStorage.getItem('fbuploadpro:media-view-mode')`.
3. **Given** an asset row in Compact Table View, **When** the operator clicks the caption cell (`data-testid="table-inline-caption-<id>"`), types a new caption, and presses `Enter` or blurs, **Then** `onUpdateCaption` is invoked and the updated caption is displayed.

---

### User Story 2 - Resumable Upload Queue: Pause & Resume, Retry Failed Files & Tab-Close Protection (Priority: P1)

During a multi-file or PC folder upload in the Media Library, the single unified Windows Copy-style progress banner (`UploadQueueBanner`) provides **Pause** (`data-testid="pause-upload-btn"`) and **Resume** (`data-testid="resume-upload-btn"`) controls alongside **Cancel**. When the operator clicks **Pause**, currently transferring in-flight file(s) finish cleanly and the worker pool halts before starting the next queued file (`status === 'paused'`). Clicking **Resume** continues uploading from the next remaining file in the queue (`status === 'uploading'`). If any files fail during a batch upload (`failedFiles > 0`), the banner retains the failed `QueuedUploadEntry` items and renders a **"Retry Failed (`X`)"** button (`data-testid="retry-failed-uploads-btn"`) that re-runs only those failed files into their exact target subfolders. While an upload is in `'uploading'` or `'paused'` status, a `window` `beforeunload` handler warns the operator before accidentally closing or refreshing the browser tab.

**Why this priority**: Large folder uploads (hundreds of videos) require pause/resume control, targeted retry of transient network failures, and protection against accidental tab closure.

**Independent Test**: Start a multi-file upload batch, click **Pause** and verify status transitions to `'paused'` and halts remaining queued items after the active transfer finishes, click **Resume** to complete the remaining items, simulate 1 failed file and click **Retry Failed (1)** to verify only that failed file is re-uploaded, and verify `beforeunload` prevents silent tab closure while `'uploading'` or `'paused'`.

**Acceptance Scenarios**:

1. **Given** an upload batch is actively transferring (`status === 'uploading'`), **When** the operator clicks **Pause** (`data-testid="pause-upload-btn"`), **Then** the banner status becomes `'paused'` (`Upload paused`), in-flight transfers complete, and no new files start until **Resume** (`data-testid="resume-upload-btn"`) is clicked.
2. **Given** an upload batch is paused (`status === 'paused'`), **When** the operator clicks **Resume** (`data-testid="resume-upload-btn"`), **Then** the queue resumes from the next unuploaded file without re-uploading completed files.
3. **Given** a batch upload finishes with 2 failed files (`failedFiles === 2`), **When** the operator clicks **"Retry Failed (2)"** (`data-testid="retry-failed-uploads-btn"`), **Then** only the 2 failed `QueuedUploadEntry` items are re-queued into their respective target subfolders.
4. **Given** `uploadState.status` is `'uploading'` or `'paused'`, **When** a browser `beforeunload` event fires on `window`, **Then** `event.preventDefault()` is called and `event.returnValue` is set to warn the user.

---

### User Story 3 - Aspect Ratio (`9:16`, `16:9`, `1:1`) & Caption Status (`Has Caption`, `Missing Caption`) Filters (Priority: P1)

In the Media Library toolbar, alongside the existing Media Type (`All`, `Videos`, `Images`), Search, and Sort controls, the operator can filter assets by **Aspect Ratio** (`data-testid="media-aspect-ratio-select"`: `All ratios`, `9:16 Vertical`, `16:9 Landscape`, `1:1 Square`) and **Caption Status** (`data-testid="media-caption-status-select"`: `All captions`, `Has caption`, `Missing caption`). Both the backend (`GET /api/tenant/[subdomain]/media` via `MediaListQuerySchema`) and client-side filter helper (`filterAndSortMediaItems`) enforce these filters.

**Why this priority**: Operators scheduling Facebook Reels (`9:16`) vs. Feed posts (`16:9` / `1:1`) or auditing assets before scheduling need to isolate specific aspect ratios or find assets that are missing captions.

**Independent Test**: Select `9:16 Vertical` in the Aspect Ratio filter and `Missing caption` in the Caption Status filter; verify only `9:16` assets with empty/null captions are returned by the API and rendered in the explorer.

**Acceptance Scenarios**:

1. **Given** the explorer toolbar, **When** the operator selects `9:16` in `data-testid="media-aspect-ratio-select"`, **Then** `GET /api/tenant/[subdomain]/media` includes `aspectRatio=9:16` and only items with `aspectRatio === '9:16'` are displayed.
2. **Given** the explorer toolbar, **When** the operator selects `Missing caption` (`empty_caption`) in `data-testid="media-caption-status-select"`, **Then** `GET /api/tenant/[subdomain]/media` includes `captionStatus=empty_caption` and only items where `captionText` is `null` or whitespace-only are displayed.
3. **Given** the explorer toolbar, **When** the operator selects `Has caption` (`has_caption`) in `data-testid="media-caption-status-select"`, **Then** only items with non-empty `captionText` are displayed.

---

### User Story 4 - Custom Video Frame Thumbnail Picker in Preview Modal ("Set Current Frame as Thumbnail") (Priority: P1)

When an operator opens a video in the Media Preview Modal (`MediaPreviewModal`), they can scrub or pause the `<video>` player at any frame and click **"Set Current Frame as Thumbnail"** (`data-testid="set-video-frame-thumbnail-btn"`). The modal captures the current frame from the `<video>` element onto a `<canvas>` (`640px` max dimension, `image/webp` format), uploads the new thumbnail via presigned upload URL (`POST /api/tenant/[subdomain]/media/upload-url`, with automatic data-URL fallback in offline/mock test mode), and persists the updated `thumbnailKey` and `thumbnailUrl` via `PATCH /api/tenant/[subdomain]/media/[mediaId]`. Both the preview modal and the media card / table row immediately reflect the new thumbnail.

**Why this priority**: Auto-extracted thumbnails at `1.0s` can capture a fade-in or blurred frame; operators need 1-click control to pick an attractive video frame as the asset's thumbnail.

**Independent Test**: Open a video in `MediaPreviewModal`, click **"Set Current Frame as Thumbnail"**, verify the frame capture helper extracts a WebP frame and calls `onUpdateThumbnail(item.id, ...)`, and verify `PATCH /api/tenant/[subdomain]/media/[mediaId]` updates `thumbnailKey` and `thumbnailUrl` in PostgreSQL (and deletes the old R2 thumbnail key if replaced).

**Acceptance Scenarios**:

1. **Given** `MediaPreviewModal` is open for a video (`item.mediaType === 'video'`), **When** the modal renders, **Then** a **"Set Current Frame as Thumbnail"** button (`data-testid="set-video-frame-thumbnail-btn"`) is visible below/alongside the video player (and is not rendered for static image items).
2. **Given** the operator pauses/scrubs the video and clicks **"Set Current Frame as Thumbnail"**, **When** frame capture completes, **Then** the captured WebP frame is uploaded and persisted via `PATCH /api/tenant/[subdomain]/media/[mediaId]`, updating `item.thumbnailUrl` in the explorer state and displaying a confirmation message.

---

## Clarifications

### Session 2026-10-11

- Q: When a user clicks "Pause" during a batch upload in the Media Library, how should currently transferring files be handled? → A: Finish the currently transferring file(s) cleanly and pause the queue before starting the next file, resuming seamlessly from the next file.
- Q: In Compact Table View, how should inline caption editing work across rows? → A: Click-to-edit text cell that turns into an input when clicked and saves on `Enter` or `blur`.
- Q: Should the Grid View (default) vs. Compact Table View toggle preference be remembered across reloads? → A: Default to **Grid View** and remember the user's toggle preference in `localStorage` across page reloads.

---

## Edge Cases

- **Cross-Origin `<video>` Canvas Taint Fallback**: When capturing a frame from a `<video>` element (`crossOrigin="anonymous"`), if the browser throws a security/taint error or headless environment lacks canvas bitmap decoding, the frame capture helper gracefully falls back so the UI never crashes and surfaces a clear status message.
- **Old R2 Thumbnail Cleanup on Thumbnail Update**: When `PATCH /api/tenant/[subdomain]/media/[mediaId]` updates `thumbnail_key` to a new R2 object key, if the media item previously had a different non-null `thumbnail_key`, the server deletes the old `thumbnail_key` from R2 so no orphaned thumbnails accumulate.
- **Pause Pressed While Last In-Flight File Is Finishing**: If the user clicks **Pause** while the very last file in the batch is already in-flight and finishes transferring, the batch transitions cleanly to `'completed'` rather than getting stuck in `'paused'` with 0 remaining files.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `MediaListQuerySchema` in `packages/contracts/src/domain/media.ts` MUST accept optional `aspectRatio: z.enum(['9:16', '16:9', '1:1']).optional()` and `captionStatus: z.enum(['has_caption', 'empty_caption']).optional()`.
- **FR-002**: `UpdateMediaItemRequestSchema` in `packages/contracts/src/domain/media.ts` MUST accept optional `thumbnailKey: z.string().min(1).max(500).nullable().optional()` and `thumbnailUrl: z.string().min(1).nullable().optional()`.
- **FR-003**: `GET /api/tenant/[subdomain]/media` (`apps/web/src/app/api/tenant/[subdomain]/media/route.ts`) MUST filter by `aspect_ratio = $N` when `aspectRatio` is provided, by `caption_text IS NOT NULL AND BTRIM(caption_text) <> ''` when `captionStatus === 'has_caption'`, and by `(caption_text IS NULL OR BTRIM(caption_text) = '')` when `captionStatus === 'empty_caption'`.
- **FR-004**: `PATCH /api/tenant/[subdomain]/media/[mediaId]` (`apps/web/src/app/api/tenant/[subdomain]/media/[mediaId]/route.ts`) MUST support updating `thumbnail_key` and `thumbnail_url` (deleting any replaced `thumbnail_key` from Cloudflare R2 via `getStorageService()`).
- **FR-005**: `MediaLibraryExplorer` MUST default to **Grid View** (`'grid'`) and provide toolbar toggle buttons (`data-testid="view-mode-grid-btn"` and `data-testid="view-mode-table-btn"`), persisting the selected mode in `localStorage` (`fbuploadpro:media-view-mode`).
- **FR-006**: When `viewMode === 'table'`, `MediaLibraryExplorer` MUST render a high-density Compact Table View (`data-testid="media-table-view"`) where each row (`data-testid="media-row-<id>"`) includes a selection checkbox, mini thumbnail preview trigger, filename (and clickable folder path badge during global search), click-to-edit inline caption cell (`data-testid="table-inline-caption-<id>"`) that turns into an input when clicked and saves on `Enter` or `blur`, aspect ratio, duration, file size, and row actions (Preview, Move, Delete).
- **FR-007**: `UploadBatchState` and `UploadQueueBanner` (`apps/web/src/components/media/upload-queue-banner.tsx`) MUST support `status: 'idle' | 'uploading' | 'paused' | 'completed' | 'cancelled'`, cooperative **Pause** (`data-testid="pause-upload-btn"`) and **Resume** (`data-testid="resume-upload-btn"`) controls that allow in-flight transfers to complete before pausing worker dispatch, and a **"Retry Failed (`X`)"** button (`data-testid="retry-failed-uploads-btn"`) that re-runs only failed `QueuedUploadEntry` items into their target subfolders.
- **FR-008**: `MediaLibraryExplorer` MUST attach a `window` `beforeunload` listener whenever `uploadState.status === 'uploading' || uploadState.status === 'paused'` to prevent accidental tab closure or refresh during an active or paused upload batch.
- **FR-009**: `MediaLibraryExplorer` MUST render Aspect Ratio (`data-testid="media-aspect-ratio-select"`) and Caption Status (`data-testid="media-caption-status-select"`) filter controls in the toolbar and apply them in both `refreshLibraryData` / `handleLoadMoreMedia` and `filterAndSortMediaItems`.
- **FR-010**: `MediaPreviewModal` (`apps/web/src/components/media/media-preview-modal.tsx`) MUST render a **"Set Current Frame as Thumbnail"** button (`data-testid="set-video-frame-thumbnail-btn"`) for video items, capturing the current `<video>` frame onto a `<canvas>` (`640px` max dimension, WebP format), uploading/updating the thumbnail via `onUpdateThumbnail`, and updating the asset's `thumbnailUrl`.

## Success Criteria *(mandatory)*

- **SC-001**: Operators can toggle between Grid View (default) and Compact Table View (with `localStorage` persistence and click-to-edit inline caption cells in table rows).
- **SC-002**: Multi-file and folder uploads can be paused, resumed seamlessly from the next queued file, retried specifically for failed files, and guarded against accidental tab closure via `beforeunload`.
- **SC-003**: Aspect Ratio (`9:16`, `16:9`, `1:1`) and Caption Status (`has_caption`, `empty_caption`) filters work end-to-end across both API routes and client-side explorer state.
- **SC-004**: Operators can capture any video frame in `MediaPreviewModal` and persist it as the asset's thumbnail via `PATCH /api/tenant/[subdomain]/media/[mediaId]`.
- **SC-005**: `pnpm turbo run build lint typecheck test` passes 100% with 0 errors.
