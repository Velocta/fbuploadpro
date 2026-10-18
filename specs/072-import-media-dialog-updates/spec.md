# Feature Specification: 072-import-media-dialog-updates

## Summary
Update the existing "Import media" dialog for the Media Library (`/tenant/[subdomain]/media`) in `apps/web/src/components/media/media-import-modal.tsx`. Rather than rewriting the working upload engine, this specification governs targeted layout, behavior, and plain-language copy improvements across staging mode, progress mode, completion states, and edge-case resilience.

---

## User Stories & Priority

### User Story 1 (P1): Target Folder Pill & Staging Header Alignment
**As a** content creator staging multiple assets,  
**I want** to clearly see how many files are selected and what folder they will be imported into,  
**So that** I can easily route the entire batch to the current folder or change it via a destination pill dropdown before starting the import.

#### Acceptance Criteria
- **Header Title**: Always displays "Import media" during staging mode.
- **Header Subtext**: Displays `"N files selected · will be added to {folder}"`. `{folder}` reflects the active destination folder name (e.g. "Library" at root, or the folder name) and updates dynamically whenever destination changes.
- **Destination Picker Pill**: Rendered on the right side of the header as a `"To: {folder}"` pill button with a folder icon.
  - Defaults to the folder the user is currently viewing (`currentFolderId` at modal open; "To: Library" when viewing root).
  - Clicking the pill opens a dropdown menu listing all existing folders and "Library".
  - Selecting a folder overrides the destination for all staged files in the batch.
  - Has default, hover, open (dropdown visible), and focus-visible states.

### User Story 2 (P1): 46px Image Thumbnail Preview & File Row Presentation
**As a** user reviewing staged files,  
**I want** to see an actual visual thumbnail for images and a clean video file-type icon for videos,  
**So that** I can visually verify my media before uploading.

#### Acceptance Criteria
- **46px Thumbnail Tile**:
  - Image files generate and display an actual 46px thumbnail preview (via client-side `URL.createObjectURL` or canvas extraction).
  - Video files display a clean video file-type icon.
  - If thumbnail extraction fails or errors, it falls back to the type icon without failing the upload.
- **File Metadata**: Displays truncated file name with ellipsis and formatted file size.
- **Per-Row Dismissal**: An "X" icon button removes the file from the batch.
  - Hovering the row makes the "X" button fully opaque.
  - Removing all files updates the button to "Start import (0)" and disables it.

### User Story 3 (P1): Staging Validation & Non-Blocking Error Flags
**As a** user staging files with mixed formats and sizes,  
**I want** invalid files to be clearly flagged on their rows without blocking the valid files,  
**So that** I can upload the valid items immediately while understanding why specific files cannot be processed.

#### Acceptance Criteria
- **Unsupported MIME type**: Flagged on row as `"can't upload — not a supported format"`.
  - Allowed: `video/mp4`, `video/quicktime`, `video/webm`, `image/jpeg`, `image/png`, `image/webp`.
- **File over 500 MB**: Flagged on row as `"too large — 500 MB max"`.
- **0-byte file**: Flagged on row as `"empty file"`.
- **Action Button Exclusion**: Flagged rows are excluded from the `"Start import (n)"` count.
- **Zero Valid Files State**: If all files are flagged or removed, the button displays `"Start import (0)"` and remains disabled.

### User Story 4 (P1): SHA-256 Duplicate Detection with Inline Keep/Skip & Batch Banner
**As a** user uploading batches that may contain files already in my library,  
**I want** possible duplicates to be detected with per-file inline "Keep" and "Skip" controls and a batch "Skip all" banner,  
**So that** I do not accidentally clutter my workspace with redundant assets.

#### Acceptance Criteria
- **Duplicate Hash Matching**: Files are checked by SHA-256 hash, name, and size against the library and intra-batch duplicates.
- **Duplicate Banner**: When 1 or more duplicates are detected, a banner appears above the file list: `"N possible duplicate(s) found"` with a `"Skip all"` button that drops all duplicate rows from the batch.
- **Per-Row Inline Actions**: Each duplicate row displays a `"possible duplicate"` tag with inline `"Keep"` and `"Skip"` (X) buttons.
- **Keep Action**: Clicking `"Keep"` clears the duplicate flag and treats the file as normal for import.

### User Story 5 (P1): Concurrency Copy Purge & Staging Footer
**As a** SaaS user,  
**I want** clean, distraction-free action controls in the staging footer,  
**So that** I don't see technical infrastructure statements like "Uploads run 3 at a time".

#### Acceptance Criteria
- **Zero Concurrency Copy**: Concurrency cap (3-at-a-time) is strictly internal runtime behavior; NO mention of concurrency limits appears anywhere in the UI.
- **Staging Footer**:
  - Left: `"+ Add more"` text button (reopens file picker and appends new files to current batch).
  - Right: `"Cancel"` quiet text button (closes dialog with nothing staged) and primary `"Start import (n)"` button (where `n` = count of valid, non-removed files; disabled when `n === 0`).
  - `"Start import (n)"` displays focus-visible ring, hover state, and brief loading state before switching to progress mode.
- **Dialog Escape / Backdrop**: Pressing Escape or clicking the backdrop cancels and closes the modal. Focus is trapped while open and restored to `"Upload Files"` on close.

### User Story 6 (P2): Progress Mode Aggregate Bar & Per-Row Upload States
**As a** user importing media,  
**I want** clear aggregate progress and granular per-file statuses,  
**So that** I can track active transfers, pause/resume/cancel individual items, or cancel all remaining queued files.

#### Acceptance Criteria
- **Progress Header**:
  - Title: `"Importing media"` during transfer, switching to `"Import complete"` when done.
  - Subtext: `"Adding to {folder}"` during upload; `"N of M added to {folder}"` on completion (where `N` excludes cancelled items).
  - Large aggregate percentage (e.g. `"62%"`) with full-width aggregate progress bar underneath.
- **Per-File Statuses**:
  - `uploading`: percentage label, thin progress bar, pause and cancel buttons.
  - `paused`: progress bar turns neutral, status displays `"paused"`, button displays `"Resume"`.
  - `queued`: status displays `"queued"`, cancel X button only.
  - `failed`: status displays `"failed — retry"` with Retry button (after 3 auto-retries with backoff). Failed files do not block the queue.
  - `done`: green checkmark icon, status displays `"uploaded to {folder}"`.
  - `cancelled`: dimmed row, status displays `"cancelled"`.
- **Progress Footer**:
  - Left: During active uploads, displays `"Leaving now will cancel the remaining uploads."`
  - When more files are queued than uploading: displays a red `"Cancel remaining"` link (which cancels queued files only, never in-flight files) followed by the leave warning.
  - Right: `"Keep working"` button (minimizes dialog to floating pill; uploads continue in background) during upload; `"Done"` primary button on completion.
  - Completion: Full progress bar, `"Import complete"`, `"N of M added to {folder}"`, clicking `"Done"` closes the dialog and refreshes library assets with default captions derived from file names.
  - If all files were cancelled: displays `"Import canceled — nothing was uploaded"` and `"Done"`.

### User Story 7 (P2): Resilient Upload Edge Cases
**As an** automated background worker,  
**I want** network disruptions, token expirations, and storage quotas to be handled gracefully,  
**So that** assets are never corrupted, ghost records are avoided, and users never lose progress.

#### Acceptance Criteria
- **Auto-Retries**: 3 attempts with exponential backoff on transient network drops; row flips to `"failed — retry"` only after 3 failed attempts.
- **Presigned Expiry**: Silently refreshed and resumed without user intervention.
- **Quota Exceeded**: In-flight uploads complete; remaining rows flip to `"not enough storage"`.
- **Folder Deletion Mid-Upload**: If destination folder is deleted during upload, fall back to `"Library"` safely; completion copy reports actual destination used.
- **Tab/Page Unload Guard**: `beforeunload` warning active while transfers are in flight; in-app navigation triggers modal guard.
