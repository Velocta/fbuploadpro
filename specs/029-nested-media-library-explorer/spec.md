# Feature Specification: Nested Media Library, Recursive Folder Explorer, High-Volume Ingestion & Direct Caption Editing

**Feature Branch**: `feat/029-nested-media-library-explorer`  
**Created**: 2026-10-10  
**Status**: Approved  

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Top-Level Navigation & Google Drive-Style Nested Folder Explorer (Priority: P1)

An operator opens their workspace and clicks **Media Library** directly below **Home** in the primary sidebar group. They land on the Media Library Explorer view (`/media`, internally `/tenant/[subdomain]/media`). At the top is a Breadcrumb Path Bar (`All Media`). Below the toolbar is a Subfolders section showing clickable folder cards, followed by the Media Assets grid showing videos and images in the currently open directory. The operator can create unlimited nested folders and subfolders inside whichever folder is currently open, rename or move folders, and delete a folder with a safety confirmation dialog that permanently deletes the folder, all nested subfolders, and all videos/images inside them from both Cloudflare R2 and the database.

**Why this priority**: Core organizational hierarchy and workspace entry point required before uploading or managing any assets.

**Independent Test**: Navigate to `/media` from the sidebar, create a root folder `"Campaign A"`, open `"Campaign A"`, create a subfolder `"Reels"`, verify the breadcrumb trail shows `All Media > Campaign A > Reels`, and verify deleting `"Campaign A"` permanently deletes `"Reels"` and any assets inside it after confirmation.

**Acceptance Scenarios**:

1. **Given** an authenticated operator in their workspace, **When** they inspect the primary sidebar group, **Then** "Media Library" (`/media`) appears directly below "Home" and above the separator.
2. **Given** the operator is viewing any folder level (`parentId = null` at root or `parentId = <uuid>` inside a folder), **When** they click "New Folder" and submit a name, **Then** the new subfolder is created inside the currently open folder and appears in the Subfolders section.
3. **Given** two different parent folders `"Campaign A"` and `"Campaign B"`, **When** the operator creates a subfolder named `"Reels"` inside both `"Campaign A"` and `"Campaign B"`, **Then** both succeed because folder name uniqueness is scoped to the sibling level (`(user_id, parent_id, LOWER(name))`).
4. **Given** a folder containing nested subfolders and media items, **When** the operator clicks "Delete Folder" and confirms in the modal dialog (which displays the exact count of subfolders and files to be removed), **Then** the folder, all descendant subfolders, and all descendant media items are permanently deleted from Cloudflare R2 and PostgreSQL.

---

### User Story 2 - Direct Per-Asset Caption Editing (Inline & Preview Modal) (Priority: P1)

Every video and image has a single direct caption (`captionText`) that defaults on upload to the filename with its extension stripped (e.g., `My Viral Reel.mp4` $\rightarrow$ `My Viral Reel`). The operator can click the caption directly on any media card in the grid to edit it inline (saving on blur or `Enter`), or click the media thumbnail to open the Media Preview Modal (which plays the video or displays the high-resolution image, shows duration/aspect ratio/size metadata, and provides a multi-line caption editor).

**Why this priority**: Captions are essential for publishing videos and images to Facebook Pages, and users need frictionless inline and modal editing.

**Independent Test**: Upload `Summer Promo.mp4`, verify its card immediately displays `"Summer Promo"` as the caption, edit it inline on the card to `"Summer Promo 🔥"`, reload and verify persistence, then open the Preview Modal and update the caption with multi-line copy.

**Acceptance Scenarios**:

1. **Given** a newly uploaded file `Viral_Clip_01.mp4`, **When** upload confirmation completes without an explicit caption, **Then** `captionText` is automatically populated as `"Viral_Clip_01"`.
2. **Given** a media card in the explorer grid, **When** the operator clicks the inline caption field, edits the text, and presses `Enter` or blurs, **Then** `PATCH /api/tenant/[subdomain]/media/[mediaId]` updates `captionText` immediately with optimistic UI feedback.
3. **Given** a media card in the explorer grid, **When** the operator clicks the thumbnail preview, **Then** a Media Preview Modal opens with an HTML5 `<video>` player (or high-resolution `<img>`), technical details (file size, aspect ratio, duration), and a multi-line caption textarea with Save and Delete actions.

---

### User Story 3 - High-Volume Multi-File & PC Folder Upload with Unified Windows-Style Progress Bar (Priority: P1)

An operator clicks **Upload Files**, **Upload Folder**, or drags and drops hundreds or thousands of videos/images (or an entire PC folder tree containing nested subfolders) directly onto the currently open folder in the Media Library. If a PC folder tree is selected or dropped, the system automatically creates the matching nested subfolder structure inside the currently open folder first, then uploads each file into its corresponding subfolder using a bounded concurrency queue (3 concurrent uploads). During the entire batch upload, a **single unified Windows Copy-style progress bar** displays overall percentage, completed/total file count (e.g., `Uploading 42 of 350 files...`), and total bytes transferred vs. total batch bytes—never rendering individual per-file progress bars.

**Why this priority**: Operators frequently ingest large batches of creative assets and pre-organized PC folders; per-file progress bars or unbounded parallel uploads would freeze the browser.

**Independent Test**: Select a PC folder containing 2 subfolders and multiple video/image files, verify the subfolders are created inside the active folder, verify a single unified progress banner tracks overall batch progress (`files completed / total files` and `bytes transferred / total bytes`), and verify all assets appear in their respective subfolders upon completion.

**Acceptance Scenarios**:

1. **Given** the operator is inside folder `"Q4 Campaigns"`, **When** they upload multiple files via the file picker or drag-and-drop, **Then** all uploaded files are placed inside `"Q4 Campaigns"` (`folderId = currentFolderId`).
2. **Given** the operator selects or drops a PC directory ` ShortsBatch/Week1/clip1.mp4` and `ShortsBatch/Week2/clip2.jpg`, **When** the upload starts inside `"Q4 Campaigns"`, **Then** the system creates `"ShortsBatch"` under `"Q4 Campaigns"`, creates `"Week1"` and `"Week2"` under `"ShortsBatch"`, and uploads `clip1.mp4` and `clip2.jpg` into their respective subfolders.
3. **Given** a batch upload of 1 to 1,000+ files is in progress, **When** the upload queue is active, **Then** the UI renders **exactly one unified Windows Copy-style progress banner** showing overall `%`, `X of Y files`, `transferred MB / total MB`, and the current file name, processing at most 3 files concurrently.

---

### User Story 4 - Batch Selection Bar, Search/Filter/Sort & Drag-and-Drop Organization (Priority: P2)

An operator can filter the current view by media type (**All**, **Videos**, **Images**), search by filename or caption text, and sort by **Newest**, **Oldest**, **Name (A–Z)**, or **File Size**. They can select multiple media items using card checkboxes (or "Select All") to reveal a floating Batch Action Bar supporting **Bulk Move to Folder**, **Bulk Set Caption**, and **Bulk Delete**. They can also drag media cards or folder cards and drop them onto any subfolder card or breadcrumb path item to move them immediately.

**Why this priority**: Streamlines day-to-day organization of large media libraries.

**Independent Test**: Select 3 media items, use the Batch Action Bar to set a shared caption on all 3, move them into a subfolder, and verify search/filter/sort controls update the grid accurately.

**Acceptance Scenarios**:

1. **Given** multiple media items are checked in the grid, **When** the Batch Action Bar appears, **Then** the operator can move all selected items to a target folder, apply a caption to all selected items, or delete all selected items in one action.
2. **Given** media items and subfolders in the explorer, **When** the operator drags a media card (or selected group of cards) and drops it onto a subfolder card or a parent folder in the breadcrumb bar, **Then** the items are moved into that target folder.
3. **Given** the Search & Filter bar, **When** the operator types a search query, toggles `All` / `Videos` / `Images`, or changes the sort order (`Newest`, `Oldest`, `Name`, `Size`), **Then** the displayed items update accordingly.

---

### User Story 5 - Global Search Across All Nested Folders & Infinite Scroll Pagination (Priority: P1)

When an operator enters a search query in the Media Library toolbar, the explorer searches globally across all folders and nested subfolders rather than restricting results to the currently open folder. Both matching folders (at any nesting depth) and matching media items across the entire library are displayed, and each media card shows a clickable folder path link (e.g., `Campaign A / Reels`) so the operator can jump straight to that item's folder. When any directory or global search result contains more than 100 items, the grid automatically loads the next page via infinite scroll (`IntersectionObserver`) and provides an explicit **"Load more (`Showing X of Y`)"** fallback button.

**Why this priority**: Essential for finding assets nested deep in folder hierarchies and browsing folders containing hundreds or thousands of videos.

**Independent Test**: Enter a search term while at `All Media`, verify matching subfolders and media items inside nested folders appear with clickable folder path links on each media card, click the folder path on a card to jump directly into that folder, and verify folders with >100 items paginate via infinite scroll and the "Load more" button.

**Acceptance Scenarios**:

1. **Given** an operator has media items inside nested subfolders (`Campaign A / Reels / viral.mp4`) and is currently at `All Media`, **When** they type `"viral"` into the search input, **Then** `GET /api/tenant/[subdomain]/media` is queried without a `folderId` restriction, returning matching items across all folders alongside matching folders, and each media card displays a clickable folder path (`Campaign A / Reels`) that navigates into that folder when clicked.
2. **Given** a folder or search result with `total > items.length` (e.g., 250 items where the first 100 are loaded), **When** the operator scrolls near the bottom of the grid or clicks the **"Load more (Showing 100 of 250)"** button, **Then** the next page (`offset = 100, limit = 100`) is fetched and appended cleanly without resetting existing items or selections.

---

### User Story 6 - URL Folder Sync (`?folder=<id>`), `Shift + Click` Range Selection, Keyboard Shortcuts & Hover Video Preview (Priority: P1)

Navigating into or out of folders synchronizes the active folder with `?folder=<folderId>` in the browser URL (`history.pushState` / `popstate` listener), enabling native browser Back/Forward navigation, page refreshes that preserve the open folder, and bookmarkable folder links. In the media grid, operators can hold `Shift` while clicking a card checkbox to select a contiguous range of media items, press `Escape` to clear the active selection, and press `ArrowLeft` / `ArrowRight` inside the Media Preview Modal to step through the previous or next item in the current view. Hovering over a video card's thumbnail surface for `300ms` plays a muted inline `<video>` preview loop right inside the card.

**Why this priority**: Delivers desktop-grade file explorer ergonomics for high-speed media curation.

**Independent Test**: Open a folder and verify `?folder=<id>` updates in the URL and survives page refresh / browser Back; `Shift + Click` two cards to select the range between them; press `Escape` to clear selection; hover a video card for `300ms` to verify inline muted `<video>` playback; open the Preview Modal and press `ArrowRight` / `ArrowLeft` to cycle items.

**Acceptance Scenarios**:

1. **Given** the operator clicks a subfolder `"Reels"` (`id = folder-reels`), **When** the view transitions into `"Reels"`, **Then** the browser URL updates to `?folder=folder-reels` (and removes `?folder` when returning to `All Media`), and pressing the browser Back button navigates back to the parent folder.
2. **Given** 10 media cards in the grid where item #2 was last toggled, **When** the operator holds `Shift` and clicks the checkbox on item #6, **Then** items #2 through #6 are all selected.
3. **Given** items are selected and no modal is open, **When** the operator presses `Escape`, **Then** the selection is cleared.
4. **Given** the Media Preview Modal is open for item #2, **When** the operator presses `ArrowRight` (or clicks Next) or `ArrowLeft` (or clicks Previous), **Then** the modal switches to item #3 or item #1 in the active list.
5. **Given** a video card in the grid, **When** the operator hovers over its thumbnail area for `300ms`, **Then** a muted inline `<video>` element plays inside the card thumbnail surface and stops/unmounts when the pointer leaves.

---

### User Story 7 - Pre-Upload Duplicate File Detection Modal (Priority: P1)

When an operator selects or drops files or a PC folder to upload, the explorer inspects the queued files against existing assets in the resolved target folder(s) (matching case-insensitive `name` and exact `fileSize`). If one or more duplicate files are detected, the explorer presents a **Duplicate Files Detected** modal listing the duplicate count and sample filenames, offering two actions: **Skip duplicates** (which uploads only the non-duplicate files and reports the skipped duplicate count) or **Upload all anyway** (which proceeds with uploading all selected files).

**Why this priority**: Prevents accidental re-uploading of large video batches that were already partially or fully uploaded into a folder.

**Independent Test**: Attempt to upload a batch of 3 files where 1 file matches an existing item's `name` and `fileSize` in the current folder; verify the Duplicate Files Detected modal appears with **"Skip duplicates"** and **"Upload all anyway"** buttons, and verify clicking **"Skip duplicates"** uploads only the 2 new files.

**Acceptance Scenarios**:

1. **Given** a folder already contains `clip1.mp4` (`1048576` bytes), **When** the operator selects `clip1.mp4` (`1048576` bytes) and `clip2.mp4` (`2097152` bytes) for upload into that folder, **Then** a confirmation modal (`data-testid="duplicate-upload-modal"`) appears stating that 1 duplicate file was detected and offering **Skip duplicates** and **Upload all anyway**.
2. **Given** the Duplicate Files Detected modal is open, **When** the operator clicks **Skip duplicates**, **Then** `clip1.mp4` is skipped (incrementing `skippedFiles`) and only `clip2.mp4` is uploaded.
3. **Given** the Duplicate Files Detected modal is open, **When** the operator clicks **Upload all anyway**, **Then** both `clip1.mp4` and `clip2.mp4` are uploaded.

---

## Clarifications

### Session 2026-10-10

- Q: How should duplicate file detection behave when uploading files or a folder into the Media Library? → A: Prompt with a modal offering **"Skip duplicates"** or **"Upload all anyway"** when duplicates (matching file name and size in the target folder) are detected.
- Q: When searching in the Media Library (Global Search across all nested folders), how should results be presented? → A: Show both matching subfolders and matching media across all folders, plus a clickable folder path on each media card to jump to its folder.
- Q: How should pagination behave when a folder or search result contains more than 100 media items? → A: Automatic infinite scroll when reaching the bottom of the page (with a manual **"Load more"** fallback button).
- Q: How should these 6 improvements be shipped relative to open PR #343? → A: Add these 6 improvements directly into the currently open Spec 029 / PR #343 branch (`feat/029-nested-media-library-explorer`).

---

## Edge Cases

- **Circular Folder Move Prevention**: Attempting to move a folder into itself (`parentId = folderId`) or into any of its own descendants must be rejected with HTTP 400 (`INVALID_FOLDER_HIERARCHY`).
- **Duplicate Sibling Folder Name during PC Folder Upload**: If a subfolder in an uploaded PC directory already exists inside the target parent folder, the uploader reuses the existing subfolder rather than failing with 409.
- **Unsupported Files in PC Folder Drop**: Hidden system files (e.g., `.DS_Store`, `Thumbs.db`) or unsupported MIME types inside a dropped PC folder are automatically skipped with a non-blocking summary notice while valid videos/images continue uploading.
- **Large Video Thumbnail Fallback**: If client-side `<video>` frame extraction times out or fails on an unusual codec, upload confirmation still succeeds with `thumbnailKey: null, thumbnailUrl: null` and renders a clean video placeholder icon on the card.
- **All Files Are Duplicates**: If every file in a selected batch is a duplicate and the user clicks **Skip duplicates**, the upload modal closes cleanly with a feedback message indicating all duplicate files were skipped without starting an empty upload queue.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `media_folders` MUST include `parent_id UUID NULL` with composite foreign key `(user_id, parent_id) REFERENCES media_folders(user_id, id) ON DELETE CASCADE`, `CHECK (id <> parent_id)`, and sibling-scoped case-insensitive name uniqueness (`uq_media_folders_root_name` and `uq_media_folders_child_name`).
- **FR-002**: `GET /api/tenant/[subdomain]/media/folders` MUST return all folders for the user including `parentId`, `itemCount`, and `subfolderCount` so the explorer can render current subfolders, breadcrumbs, and folder move pickers instantaneously.
- **FR-003**: `POST /api/tenant/[subdomain]/media/folders` and `PATCH /api/tenant/[subdomain]/media/folders/[folderId]` MUST accept optional `parentId: string | null`, verifying parent ownership and preventing circular ancestry cycles.
- **FR-004**: `DELETE /api/tenant/[subdomain]/media/folders/[folderId]` MUST recursively identify the target folder and all descendant subfolders (`WITH RECURSIVE`), delete all primary media keys and thumbnail keys of media items in those folders from Cloudflare R2, and delete the media items and folders from PostgreSQL, returning `{ success: true, deletedFolderId, deletedSubfoldersCount, deletedItemsCount }`.
- **FR-005**: `GET /api/tenant/[subdomain]/media` MUST support `sortBy` (`created_at`, `name`, `file_size`) and `sortOrder` (`asc`, `desc`) in addition to `folderId`, `mediaType`, `search`, `limit`, and `offset`.
- **FR-006**: `POST /api/tenant/[subdomain]/media/batch` MUST support atomic batch operations on an array of `mediaIds` (`action: 'move' | 'delete' | 'caption'`), enforcing strict `user_id` ownership and R2 object cleanup on batch delete.
- **FR-007**: `apps/web/src/components/workspace/workspace-sidebar.tsx` MUST include a top-level "Media Library" navigation item (`/media`) in the primary top `SidebarGroup` directly below "Home".
- **FR-008**: `/tenant/[subdomain]/media` MUST render the Google Drive-style Media Library Explorer conforming strictly to `apps/web/src/lib/theme.ts` and `DESIGN.md` (zero hardcoded hex colors, zero capsule pill badges, zero decorative status dots).
- **FR-009**: When `searchQuery` is non-empty, the explorer MUST perform a global search across all folders (omitting `folderId` from `GET /api/tenant/[subdomain]/media` and matching folders across the entire folder list), rendering a clickable folder path badge (`data-testid="media-folder-path-<id>"`) on each media card so clicking it navigates into that item's folder and clears the search filter.
- **FR-010**: The explorer MUST track `totalMediaCount` from `GET /api/tenant/[subdomain]/media` and support loading additional pages (`offset`, `limit = 100`) via both an automatic `IntersectionObserver` sentinel at the bottom of the grid and an explicit **"Load more (`Showing X of Y`)"** button (`data-testid="load-more-media-btn"`).
- **FR-011**: The explorer MUST synchronize `currentFolderId` with the `?folder=<folderId>` URL query parameter on initial mount, folder navigation (`history.pushState`), and browser Back/Forward events (`window.addEventListener('popstate', ...)`).
- **FR-012**: Media cards MUST support `Shift + Click` range selection across `displayedMediaItems`, `Escape` key to clear selection when no modal is open, and `ArrowLeft` / `ArrowRight` keyboard navigation (plus Previous/Next buttons) inside `MediaPreviewModal`.
- **FR-013**: `MediaAssetCard` for video items (`mediaType === 'video'`) MUST start a `300ms` hover timer on `onMouseEnter` over the thumbnail surface and render a muted inline `<video>` preview (`data-testid="hover-video-preview-<id>"`) while hovered, cleaning up on `onMouseLeave`.
- **FR-014**: Before starting an upload batch, the explorer MUST detect duplicate files (matching case-insensitive `name` and exact `fileSize` in the target folder) and, when duplicates exist, open a confirmation modal (`data-testid="duplicate-upload-modal"`) allowing the user to **Skip duplicates** (`data-testid="skip-duplicates-btn"`) or **Upload all anyway** (`data-testid="upload-all-anyway-btn"`).

## Success Criteria *(mandatory)*

- **SC-001**: Operators can create, nest, rename, move, and cascade-delete folders at any depth with 100% multi-tenant isolation and R2 storage cleanup.
- **SC-002**: Every uploaded video and image defaults its caption to the extension-stripped filename and supports both inline card editing and Preview Modal editing.
- **SC-003**: Multi-file and PC folder uploads queue cleanly with bounded concurrency and a single unified Windows Copy-style progress bar.
- **SC-004**: Global search finds folders and media items across all nested levels with clickable folder path navigation, and directories with 100+ items paginate via infinite scroll and Load More.
- **SC-005**: URL `?folder=<id>` sync, `Shift + Click` range selection, keyboard shortcuts (`Escape`, `ArrowLeft`, `ArrowRight`), 300ms hover video preview, and pre-upload duplicate detection modal all pass automated UI and integration tests.
- **SC-006**: `pnpm turbo run build lint typecheck test` passes 100% with 0 errors.

