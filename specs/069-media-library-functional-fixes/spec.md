# Feature Specification: Media Library Functional Fixes

**Feature Branch**: `fix/069-media-library-functional-fixes`  
**Created**: 2026-10-18  
**Status**: Ready  
**Input**: Fix verified issues in the Media Library (`/tenant/[subdomain]/media`, `MediaLibraryExplorer`): Issue 1 (spontaneous import cancel), Issue 2 (existing media listing failure), Issue 3 (dropdown option clicks swallowed), and Issue 4 (toolbar dividers not drawn). Strict constraint: do NOT touch theme, global CSS, colors, fonts, or type scale.

---

## User Scenarios & Testing

### User Story 1 - Robust Media Import Execution & Explicit Cancellation Guard (Priority: P1)

As an operator uploading media to FBUploadPro, when I select files and click "Start import", the system must reliably upload all items directly to Cloudflare R2 via presigned URLs and confirm them into the database, displaying "Import complete — N of N uploaded" without spontaneous cancellations.

**Why this priority**: Uploading is the primary ingestion gateway for the entire platform. If uploads spontaneously fail or cancel, operators cannot publish content.

**Independent Test**:
1. Select 1 PNG file via "Upload Files" -> "Start import (1)". Verify progress advances from 0% to 100% and finishes with "Import complete — 1 of 1 uploaded".
2. Select 5 files. Verify 3 upload concurrently, the remaining 2 are queued (`queued · #n`), and as slots free up, queued items auto-start until all 5 complete.
3. If an upload fails, it displays `failed — retry` on that specific item and NEVER transitions the entire batch to canceled unless the user explicitly clicks the per-file cancel button or "Cancel remaining".

**Acceptance Scenarios**:
1. **Given** 1 valid image selected in staging, **When** the user clicks "Start import (1)", **Then** presigned upload URLs are generated using aligned contract fields (`mediaUploadUrl`, `mediaKey`, `publicMediaUrl`), the file is PUT to R2, confirmed via `/api/tenant/[subdomain]/media/confirm`, and the modal transitions to "Import complete — 1 of 1 uploaded" and appends the asset to the library grid.
2. **Given** 5 files in progress with 3 active and 2 queued, **When** one active upload completes or fails, **Then** the next queued item immediately starts uploading.
3. **Given** a network hiccup during chunk/file PUT or confirm, **When** retries are exhausted, **Then** the item status transitions to `failed` (`failed — retry`), and the batch continues remaining files without prematurely transitioning to "Import canceled".
4. **Given** active or queued uploads, **When** no cancel button is clicked by the user, **Then** the batch status NEVER enters `canceled`. Explicit cancellation logs the transition source (`user_cancel_item` or `user_cancel_remaining`).

---

### User Story 2 - Existing Storage Media Resolution & Query Limit Alignment (Priority: P2)

As an operator opening the Media Library, I want all existing media in my workspace (including pre-existing files like `velocta-avatar.png` stored in R2 and registered in `media_items`) to be displayed in the root library view and searchable by name or caption.

**Why this priority**: Existing media library items must be discoverable and reusable. If API queries fail validation with 400 Bad Request due to query limit discrepancies, the library appears completely empty.

**Independent Test**:
Navigate to `/tenant/[subdomain]/media`. Verify that `velocta-avatar.png` is listed in the root directory with its correct size (10.5 KB / 10,505 bytes), and searching for "velocta", "velocta-avatar.png", or "png" returns the asset in the filtered grid.

**Acceptance Scenarios**:
1. **Given** `MediaListQuerySchema` and the explorer fetch call requesting up to 500 items, **When** `GET /api/tenant/[subdomain]/media?limit=500` is called, **Then** `MediaListQuerySchema` accepts `limit` up to 1000 (validating successfully instead of returning 400), returning all matching root media items.
2. **Given** root media items with `folder_id IS NULL`, **When** the explorer loads with default folder selection (`currentFolderId === null`), **Then** all unorganized root items appear on the canvas.
3. **Given** an existing file `velocta-avatar.png`, **When** the operator types "velocta" into the search bar, **Then** the debounced search filters and displays `velocta-avatar.png` with its thumbnail/icon, name, and size.

---

### User Story 3 - Interactive Toolbar Dropdowns with Keyboard & Click Support (Priority: P3)

As an operator organizing and exploring media, when I open any of the toolbar dropdowns (Aspect Ratio, Caption Status, Sort) and click an option, the option must apply immediately, update the trigger button label, and filter/sort the grid without being swallowed by outside click listeners.

**Why this priority**: Filter and sort controls are essential for operators managing large libraries of video and image assets.

**Independent Test**:
1. Click the "All ratios" dropdown trigger. Click "1:1 Square". Verify trigger label changes to "1:1 Square" and only square assets display.
2. Click the "Newest first" sort dropdown. Click "Oldest first". Verify trigger label changes to "Oldest first" and assets reorder chronologically.
3. Open dropdown and press ArrowDown + Enter. Verify focused option is selected and applied.

**Acceptance Scenarios**:
1. **Given** an open dropdown menu, **When** the user clicks an option item, **Then** the outside-click listener verifies the click target is within the dropdown container and does NOT prematurely close the menu before the selection `onClick` executes.
2. **Given** an option selection, **When** selected, **Then** the parent state updates (`aspectRatioFilter`, `captionStatusFilter`, or `sortOption`), the trigger label updates immediately, and the menu closes.
3. **Given** keyboard focus on the dropdown trigger or options, **When** pressing Escape, ArrowDown, ArrowUp, or Enter, **Then** navigation and selection operate accessibly.

---

### User Story 4 - Hairline Toolbar Group Dividers (Priority: P4)

As an operator using the Media Library, I want clear visual group separation across the toolbar items (Search | Media-type tabs | Dropdowns | View toggle) using subtle 1px hairline dividers per the approved design system.

**Why this priority**: Polishes visual hierarchy and grouping according to approved design standards without modifying theme tokens or global styles.

**Independent Test**:
Inspect the toolbar DOM and visual layout. Verify vertical 1px hairline dividers (`var(--border-subtle)`) are rendered between Search, Media-type tabs, Dropdowns, and View toggle.

**Acceptance Scenarios**:
1. **Given** the toolbar, **When** rendered, **Then** 1px vertical hairline dividers (`role="separator"`, `aria-orientation="vertical"`, `var(--border-subtle)`) separate:
   - Search input and Media-type tabs
   - Media-type tabs and Dropdown filters
   - Dropdown filters and View mode toggle

---

## Edge Cases

- **Presigned URL Expiry / Mismatched Keys**: If `/media/upload-url` returns `mediaUploadUrl` and `mediaKey`, but the client component accesses `uploadUrl` or `storageKey`, the client must fallback gracefully to the canonical `@fbuploadpro/contracts` property names.
- **Empty Batch or Zero Valid Files**: If all files in staging are skipped or fail validation, the "Start import" button remains disabled with clear validation messages (`can't upload — not a supported format`, `too large`).
- **Concurrent Slot Freeing**: If 2 active uploads finish within milliseconds of each other, the concurrency loop must safely claim distinct queued items without duplicate calls or race conditions.
- **Dropdown Double Toggles**: Clicking the trigger when the dropdown is open cleanly closes it without reopening.
- **Stale Active Upload State**: If leave-page guard triggers during navigation, canceling the modal or finishing uploads releases the guard cleanly.

---

## Requirements

### Functional Requirements

- **FR-001**: `MediaImportModal` MUST correctly map presigned URL response properties from `UploadUrlResponse` (`mediaUploadUrl`, `mediaKey`, `publicMediaUrl`, `thumbnailUploadUrl`, `thumbnailKey`, `publicThumbnailUrl`).
- **FR-002**: `MediaImportModal` MUST confirm completed uploads via `/api/tenant/[subdomain]/media/confirm` with valid `storageKey` and `url`.
- **FR-003**: `MediaImportModal` MUST only enter the `canceled` batch state upon explicit user interaction (clicking file remove during progress or "Cancel remaining"). Automatic transition to `complete` when all items are `failed` MUST display failure status (`Import failed — 0 of N uploaded`), NEVER claiming the import was canceled by user.
- **FR-004**: `MediaImportModal` MUST log state machine transitions with explicit source tags (`[upload-engine] Transition to complete: { source, completed, failed, total }`).
- **FR-005**: `MediaListQuerySchema` in `packages/contracts/src/domain/media.ts` MUST allow `limit` up to `1000` (`z.coerce.number().int().min(1).max(1000).default(50)`).
- **FR-006**: `MediaLibraryExplorer` MUST successfully fetch root media items on load and display `velocta-avatar.png` when browsing root or searching "velocta".
- **FR-007**: Toolbar dropdowns in `MediaLibraryExplorer` MUST attach outside-click detection using container ref containment (`containerRef.current?.contains(target)`) and avoid closing before `onClick` handlers dispatch.
- **FR-008**: Toolbar dropdowns MUST update their respective trigger labels and grid filter/sort criteria immediately upon option selection, and support keyboard Enter/Space selection.
- **FR-009**: The toolbar MUST render 1px vertical hairline dividers (`role="separator"`, `aria-orientation="vertical"`, `var(--border-subtle)`) between Search, Media-type tabs, Dropdowns, and View mode toggle.
- **FR-010**: All changes MUST preserve existing theme tokens, CSS variables, colors, fonts, and type scale without declaring ad-hoc styles.
