# Feature Specification: Media Library Layout, View Modes & Import Flow Redesign

**Feature Branch**: `feat/067-media-library-redesign`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Redesign the Media Library page (/tenant/[subdomain]/media, component MediaLibraryExplorer) in the FBUploadPro Studio Next.js app. This is a layout/behavior/copy redesign ONLY — do NOT touch the theme, global CSS, colors, fonts, or type scale. Global rules: no box-in-box styling, plain language copy, hover-revealed rare actions. 1. Page header: title, subtext, quiet New Folder link, single Upload Files primary button (delete Upload Folder button). 2. Toolbar: search with no input box outline and 250ms debounce, plain text All/Videos/Images tabs, plain text dropdown triggers with carets, bare icon grid/table toggle, slim context row with clickable breadcrumbs and Select all. 3. Folder rail: keep as-is with real nesting and synchronized counts. 4. Subfolders: render as rows with folder icon, name, 'n subfolders · n files', hover-revealed rename/move/delete, drop targets. 5. Asset grid: rounded thumbnail tile, metadata directly underneath (name, size · upload date, caption status), hover checkbox, aspect-ratio badge, hover preview + move/delete menu, 300ms video hover loop, no Schedule button. 6. Table view: plain table, hairline dividers, sticky header, merged Details column (ratio · duration), upload date column, no Schedule button. 7. Batch pill: floating bottom-center pill ('n selected · Move · Set caption · Delete · Clear'), Set caption modal with replace/append modes. 8. Upload flow: import-style popup with staging validation, duplicate detection, 3-concurrency worker engine with pause/resume/retry, leave-page protection (in-app dialog + beforeunload), edge cases. 9. New folder dialog: small centered dialog with autofocus, parent folder selector, inline duplicate warning. 10. Preview modal: 2-column modal (player + frame capture on left, metadata + name/caption fields on right, delete asset + save changes in footer). 11. Removals: Schedule buttons, Facebook format eligibility tags, Downloader UI traces. 12. Bug fixes: upload dates displayed, dropdown click bug fixed, search count lag fixed, broken thumbnail fallback."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean Borderless Media Canvas, Flat Toolbar, and Date-Enriched Asset Views (Priority: P1)

As a content creator managing media assets in FBUploadPro, I want a clean, unboxed, distraction-free Media Library interface with live-filtered search, view toggle, and rich metadata (including upload dates and caption status) so that I can quickly browse, evaluate, and inspect my uploaded content.

**Why this priority**: Browsing and viewing media is the core daily workflow of the Media Library. Eliminating nested "box-in-box" panels, introducing upload dates, and polishing search and filtering provides immediate, high-impact usability improvement.

**Independent Test**: Navigate to `/tenant/[subdomain]/media`. Verify the page renders without nested bordered boxes. Type in the search box to verify debounced live filtering without lag or flash. Verify asset cards and table rows render the exact upload date (`created_at`) and size. Toggle between Grid and Table views seamlessly.

**Acceptance Scenarios**:
1. **Given** the Media Library page, **When** it loads, **Then** the header displays "Media Library" with subtext "Upload, organize, and caption your media for publishing queues.", a quiet "New Folder" link, and a single "Upload Files" button (no "Upload Folder" button).
2. **Given** the toolbar, **When** viewing the controls, **Then** the search input has no box outline and filters live with ~250ms debounce, media type filters appear as plain text tabs ("All", "Videos", "Images") with active underline indicator, and filters (Aspect ratio, Caption status, Sort) appear as plain text labels with carets that reliably open menus on mouse click.
3. **Given** the asset grid, **When** media items are displayed, **Then** each item is a rounded thumbnail tile with metadata directly on the page background (file name, `size · upload date`, and caption status line), hover reveals a top-left checkbox, hover triggers a 300ms muted video loop preview, and actions reveal Preview and an overflow menu (Move, Delete) with NO Schedule CTA and NO Facebook eligibility badges.
4. **Given** the table view, **When** selected, **Then** the outer panel is removed, rows use hairline dividers and a sticky header, Ratio and Duration are merged into a "Details" column (e.g. "1:1 · 0:45"), an "Upload date" column is rendered, and no Schedule button exists.

---

### User Story 2 - Two-Step Staged Import Flow with Concurrency Cap & Leave-Page Protection (Priority: P1)

As a creator uploading batches of video and image files, I want an import-style staging popup where I can review files, detect duplicates, select destination folders, and run uploads with a 3-file concurrency cap and leave-page protection so that my uploads are reliable, transparent, and resilient to accidents.

**Why this priority**: File upload is the primary data ingestion path. A staged flow prevents unintended uploads, detects duplicates early, prevents browser starvation through concurrency bounding, and stops accidental tab closure from destroying hours of upload progress.

**Independent Test**: Click "Upload Files" or drag files into the window. Verify the "Import media" popup opens with file rows, validation warnings (unsupported types / >500MB), and duplicate flags. Click "Start import", verify exactly 3 files upload concurrently while others show "queued · #n". Attempt in-app navigation during upload to verify the warning dialog appears.

**Acceptance Scenarios**:
1. **Given** files selected via picker or drag-and-drop, **When** the staging popup opens, **Then** it shows title "Import media", rows with type icons, names, sizes, per-row remove buttons, destination folder selector defaulting to current/All Media, and flags for invalid files or duplicates with "Skip" / "Upload anyway" controls.
2. **Given** valid staged files, **When** clicking "Start import (n)", **Then** the popup transitions to progress mode, concurrency is strictly capped at 3 simultaneous uploads, queued items show position, active items show pause/resume/cancel and percentage bars, and completed items show checkmarks.
3. **Given** active uploads running, **When** the user attempts in-app navigation (e.g. clicking sidebar or brand link), **Then** navigation is intercepted and a centered modal warns "Uploads still in progress" with the furthest-along file progress, offering "Stay on this page" (primary) and "Leave anyway".
4. **Given** active uploads, **When** the browser tab close or refresh is triggered, **Then** the native `beforeunload` event prompt is armed and blocks immediate closure.
5. **Given** an upload completing, **When** confirm succeeds, **Then** the asset immediately appears at the top of the grid with its default caption, and thumbnail falls back to type icon if generation fails.

---

### User Story 3 - Subfolder Row List Hierarchy & Inline Validated Folder Creation (Priority: P2)

As a creator organizing media into folders, I want subfolders displayed as clean list rows with counts and drop targets, and a fast, inline-validated folder creation dialog so that I can organize content without UI friction.

**Why this priority**: Folder navigation and creation enables large libraries to remain structured. Converting bulky folder cards into slim rows saves vertical space and makes drop-target interactions intuitive.

**Independent Test**: Navigate into folders with subfolders. Verify subfolders render as rows with "n subfolder(s) · n files" and hover-revealed actions (Rename, Move, Delete). Drag an asset onto a folder row or breadcrumb to reparent it. Click "New Folder", enter a duplicate name, verify the inline warning prevents creation without an error popup.

**Acceptance Scenarios**:
1. **Given** a directory with subfolders, **When** viewing the subfolders section, **Then** it renders a "FOLDERS (n)" label and folder rows (folder icon, name, "X subfolder(s) · Y files") with Rename, Move, and Delete icon buttons appearing on hover only.
2. **Given** dragged assets, **When** dropped onto a folder row or breadcrumb link, **Then** the assets are moved/reparented to that target folder.
3. **Given** the "+ New Folder" action, **When** clicked, **Then** a centered dialog opens with an autofocused "FOLDER NAME" input and "PLACE INSIDE" dropdown defaulting to "All Media".
4. **Given** the folder name input, **When** empty or matching a sibling folder name, **Then** "Create folder" is disabled and an inline note ("A folder with this name already exists") appears without an alert popup.

---

### User Story 4 - Floating Batch Action Pill with Dedicated "Set Caption" Modal (Priority: P2)

As a creator managing dozens of assets simultaneously, I want a floating bottom pill when items are selected with bulk Move, Delete, and an advanced "Set Caption" modal (supporting replace and append modes) so that I can annotate and organize multiple files in one step.

**Why this priority**: Batch operations are essential for scaling library management. A clean floating pill with no highlighted primary bias and an append-capable caption modal streamlines bulk content staging.

**Independent Test**: Select 2 or more assets. Verify the floating pill appears bottom-center ("X selected · Move · Set caption · Delete · Clear"). Click "Set caption", toggle between "Replace existing captions" and "Add to the end of existing captions", type text, and apply. Verify captions update across all selected items.

**Acceptance Scenarios**:
1. **Given** 1 or more assets selected, **When** viewing the screen, **Then** a floating pill appears bottom-center formatted as "n selected · Move · Set caption · Delete · Clear" with equal visual hierarchy (no highlighted primary button).
2. **Given** the batch pill, **When** clicking "Set caption", **Then** a modal opens with title "Set caption", subtext "Applies to n files", options for "Replace existing captions" and "Add to the end of existing captions", and a text area with live character counter.
3. **Given** the batch caption modal, **When** text is entered and applied, **Then** a success toast confirms "Caption updated on n files", and empty text keeps the action button disabled.

---

### User Story 5 - Two-Column Media Preview Studio Modal with Frame Capture (Priority: P3)

As a creator inspecting video and image details, I want a spacious two-column preview modal with media playback, frame capture, comprehensive metadata (dimensions, size, duration, upload date), and editable captions so that I can inspect and refine individual assets.

**Why this priority**: Individual asset inspection provides deep validation before assets are staged into publishing queues.

**Independent Test**: Click "Preview" on an asset tile or table row. Verify the two-column modal opens. On the left: video player with scrubber / full image, plus "Capture frame" button. On the right: metadata rows (Type, Size, Aspect ratio, Duration, Upload date), editable "File name" and "Caption" fields. Verify "Delete asset" is available on the left footer, and "Save changes" saves edits cleanly.

**Acceptance Scenarios**:
1. **Given** an asset, **When** "Preview" is clicked, **Then** a centered two-column modal opens with media playback on the left and metadata + editing fields on the right.
2. **Given** a video asset, **When** playing, **Then** the timeline scrubber functions smoothly and clicking "Capture frame" extracts a WebP frame.
3. **Given** metadata fields on the right, **When** viewed, **Then** Type, Size, Aspect ratio, Duration, and Upload date are clearly displayed, and editing File name or Caption persists upon clicking "Save changes".
4. **Given** the preview modal footer, **When** viewed, **Then** it contains "Delete asset" as a red text button on the left, and "Cancel" and "Save changes" on the right, with NO Schedule CTA and NO eligibility badges.

---

### User Story 6 - Downloader UI Purge & Critical Bug Remediations (Priority: P3)

As a user navigating the Media Library, I want all legacy Downloader UI remnants completely eradicated, dropdown menus to open reliably on mouse click, search count labels to stay perfectly synchronized without layout flash, and broken image thumbnails to gracefully fall back to type icons.

**Why this priority**: Eliminates confusing domain bleed between Downloader and Media Library, and resolves irritating interaction bugs that degrade product quality.

**Independent Test**: Verify zero downloader buttons, banners, or links exist anywhere on `/media`. Open dropdown menus repeatedly with mouse clicks. Filter search terms rapidly and verify count matches grid immediately without flashing empty states. Test an asset with an invalid thumbnail URL to verify it displays the media type icon.

**Acceptance Scenarios**:
1. **Given** the `/media` library, **When** inspecting all buttons, tabs, panels, and menus, **Then** zero Downloader references or UI elements exist.
2. **Given** filter dropdowns (Aspect ratio, Caption status, Sort), **When** clicked with a mouse, **Then** menus open immediately and reliably without event listener swallowing.
3. **Given** the search input, **When** typing or clearing search terms, **Then** the filtered count updates in sync with the grid and clearing search does not flash an empty state.
4. **Given** an image or video thumbnail failing to load, **When** the error triggers, **Then** it cleanly renders the corresponding media type fallback icon.

---

### Edge Cases

- **0-byte or corrupt files**: Blocked at staging with "can't upload — empty file".
- **Files > 500 MB**: Blocked at staging with "too large — 500 MB max".
- **Unsupported MIME types**: Blocked at staging with "can't upload — not a supported format".
- **Duplicate files in same batch**: Latter duplicate flagged with "possible duplicate".
- **Duplicate file in library (SHA-256 match)**: Staged with "possible duplicate" warning; user can "Skip" or "Upload anyway", or use "Skip all duplicates".
- **Network drop during chunked upload**: Automatic retry with exponential backoff up to 3 times; if still failing, row shows "failed — retry" with Retry button while other queued uploads continue unimpeded.
- **Presigned URL expiration during long upload**: Silently requested fresh URL and resumed without user interruption.
- **Storage/quota exhaustion**: Remaining queued items flip to "not enough storage".
- **Session expiry mid-upload**: Uploads pause; prompt re-sign-in; resume seamlessly after auth.
- **Tab close / reload attempt**: Native `beforeunload` warning alerts user while uploads are active.
- **In-app navigation attempt**: Custom dialog intercepts navigation, showing furthest-along file progress.
- **Destination folder deleted while upload in progress**: Upload falls back safely to root ("All Media").
- **Batch cancel**: "Cancel remaining" aborts queued uploads; completed uploads remain intact.
- **100+ files imported**: Virtualized/scrolling list in staging popup; strict 3-file concurrency prevents browser memory or network exhaustion.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render the Media Library with zero nested bordered boxes ("box-in-box"), using spacing and single subtle divider lines.
- **FR-002**: Page header MUST display "Media Library", subtext "Upload, organize, and caption your media for publishing queues.", a quiet "New Folder" link, and a single "Upload Files" primary button. The "Upload Folder" button MUST be deleted.
- **FR-003**: Search bar MUST have no border outline and perform live filtering debounced at ~250ms, with real-time count synchronization and zero empty-state flash upon clear.
- **FR-004**: Media type filters MUST be presented as plain text tabs ("All", "Videos", "Images") with an active underline indicator.
- **FR-005**: Filter dropdowns (Aspect ratio, Caption status, Sort) MUST be plain text labels with carets that reliably open on mouse click (`onPointerDown`/`onClick`).
- **FR-006**: View toggle MUST be two bare icons (Grid and Table) with no segmented container box.
- **FR-007**: Context row below toolbar MUST display a clickable breadcrumbs path ("All Media / ...") supporting drag-and-drop asset reparenting, with "Select all" on the right.
- **FR-008**: Subfolders MUST render as rows displaying folder icon, folder name, "X subfolder(s) · Y files", and hover-revealed icon actions (Rename, Move, Delete). Rows MUST serve as drop targets for dragged assets.
- **FR-009**: Asset grid MUST render rounded thumbnail tiles with metadata directly on the page background (file name, `fileSize · formatted uploadDate`, and caption status line).
- **FR-010**: Asset tile MUST reveal a checkbox on hover (top-left), aspect ratio badge (bottom-right), 300ms muted hover video preview, and hover actions (Preview, and overflow menu with Move and Delete).
- **FR-011**: Table view MUST render a plain table with hairline row dividers, sticky header, merged "Details" column (`aspectRatio · duration`), upload date column, and action buttons (Preview, Move, Delete).
- **FR-012**: System MUST completely omit the Schedule button and Facebook format eligibility badges from all media cards, table rows, and modals.
- **FR-013**: Multi-selection of 1 or more assets MUST trigger a floating bottom-center pill: "n selected · Move · Set caption · Delete · Clear" with equal visual hierarchy.
- **FR-014**: "Set caption" batch action MUST open a dedicated modal offering "Replace existing captions" and "Add to the end of existing captions" modes with character counter and disabled submit on empty text.
- **FR-015**: "Upload Files" and drag-and-drop MUST open a two-step "Import media" popup: Step 1 staging with file validation, duplicate detection, destination folder selector, and "+ Add more"; Step 2 progress with strict 3-concurrency worker execution, per-file pause/resume/cancel, and overall progress.
- **FR-016**: Active uploads MUST engage leave-page protection: intercepting internal Next.js/in-app navigation with a warning modal, and arming the browser `beforeunload` warning.
- **FR-017**: Upload engine MUST handle edge cases including auto-retry on network drop, silent presigned URL refresh, duplicate flagging, destination folder fallback, and clean cleanup without ghost assets.
- **FR-018**: "New folder" dialog MUST open a centered modal with autofocused name input, destination folder selector, and inline duplicate name validation preventing creation without error alerts.
- **FR-019**: Preview modal MUST provide a two-column studio layout: media preview and frame capture on the left; metadata readout (Type, Size, Ratio, Duration, Upload Date) and editable Name/Caption on the right; "Delete asset" (red text) and "Save changes" in footer.
- **FR-020**: System MUST completely purge all Downloader UI elements (buttons, banners, links, tabs) from the Media Library.
- **FR-021**: Thumbnail failures MUST gracefully fall back to the appropriate media type icon.

---

### Key Entities

- **MediaItem**: Represents an uploaded video or image asset. Attributes: `id`, `name`, `file_size`, `mime_type`, `media_type`, `storage_key`, `url`, `thumbnail_url`, `duration_seconds`, `aspect_ratio`, `caption_text`, `created_at`, `folder_id`.
- **MediaFolder**: Represents an organizational container. Attributes: `id`, `name`, `parent_id`, `created_at`.
- **ImportQueueItem**: Represents an item in the staged or active upload queue. Attributes: `id`, `file`, `name`, `size`, `type`, `destinationFolderId`, `status` (`staged`, `queued`, `uploading`, `paused`, `completed`, `failed`), `progressPercent`, `isDuplicate`, `validationError`, `retryCount`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of nested bordered boxes ("box-in-box") are eradicated from the `/media` page, replaced with clean spacing and single hairline dividers.
- **SC-002**: Upload date (`created_at`) is visible on 100% of media assets across Grid view, Table view, and Preview modal.
- **SC-003**: Bulk import engine enforces strict 3-upload concurrency cap, preventing browser freeze or upload timeouts on batches of 50+ files.
- **SC-004**: 100% of accidental navigation attempts during active uploads trigger the leave-page protection modal or browser beforeunload prompt.
- **SC-005**: 0 Schedule buttons or Facebook format eligibility badges exist anywhere in the Media Library.
- **SC-006**: 0 Downloader UI components or links are rendered on `/media`.
- **SC-007**: Live search debounces at ~250ms with 0ms visual lag on the count label and 0 empty-state flashing upon clearing.
- **SC-008**: 100% of dropdown menus (Aspect ratio, Caption status, Sort) open consistently on first mouse click.

---

## Assumptions

- Uploads continue directly to Cloudflare R2 via presigned URLs as defined in the system architecture.
- The social Downloader continues to operate independently on its dedicated route (`/tenant/[subdomain]/downloader`); this specification strictly decouples the Media Library UI from Downloader UI.
- All styling adheres to existing theme tokens in `apps/web/src/lib/theme.ts` without modifying `DESIGN.md` or global CSS files.
