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

## Edge Cases

- **Circular Folder Move Prevention**: Attempting to move a folder into itself (`parentId = folderId`) or into any of its own descendants must be rejected with HTTP 400 (`INVALID_FOLDER_HIERARCHY`).
- **Duplicate Sibling Folder Name during PC Folder Upload**: If a subfolder in an uploaded PC directory already exists inside the target parent folder, the uploader reuses the existing subfolder rather than failing with 409.
- **Unsupported Files in PC Folder Drop**: Hidden system files (e.g., `.DS_Store`, `Thumbs.db`) or unsupported MIME types inside a dropped PC folder are automatically skipped with a non-blocking summary notice while valid videos/images continue uploading.
- **Large Video Thumbnail Fallback**: If client-side `<video>` frame extraction times out or fails on an unusual codec, upload confirmation still succeeds with `thumbnailKey: null, thumbnailUrl: null` and renders a clean video placeholder icon on the card.

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

## Success Criteria *(mandatory)*

- **SC-001**: Operators can create, nest, rename, move, and cascade-delete folders at any depth with 100% multi-tenant isolation and R2 storage cleanup.
- **SC-002**: Every uploaded video and image defaults its caption to the extension-stripped filename and supports both inline card editing and Preview Modal editing.
- **SC-003**: Multi-file and PC folder uploads queue cleanly with bounded concurrency and a single unified Windows Copy-style progress bar.
- **SC-004**: `pnpm turbo run build lint typecheck test` passes 100% with 0 errors.
