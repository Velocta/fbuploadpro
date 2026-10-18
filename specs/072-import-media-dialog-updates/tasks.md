# Tasks: 072-import-media-dialog-updates

## Implementation Tasks

### User Story 1 (P1): Target Folder Pill & Staging Header Alignment
- [x] Task 1.1: Replace `<select>` in staging header with `"To: {folder}"` pill button with folder icon in `apps/web/src/components/media/media-import-modal.tsx`.
- [x] Task 1.2: Add dropdown menu for destination pill to select any user folder or "Library", defaulting to `currentFolderId` or "Library".
- [x] Task 1.3: Update staging header subtext to `"N files selected · will be added to {folder}"` updating live when destination changes.

### User Story 2 (P1): 46px Thumbnail Tiles & Staging Row Presentation
- [x] Task 2.1: Implement object URL preview generator for image files with 46px thumbnail tile (`width: 46px, height: 46px, borderRadius: RADII.xs, objectFit: 'cover'`) and error fallback.
- [x] Task 2.2: Render clean 46px container with video type icon for video files.
- [x] Task 2.3: Ensure file name truncation with ellipsis, formatted file size, and per-row hover opacity transition on X button.

### User Story 3 (P1): Staging Validation & Button Count Alignment
- [x] Task 3.1: Standardize validation copy: `"empty file"` (0-byte), `"too large — 500 MB max"` (> 500 MB), `"can't upload — not a supported format"` (unsupported MIME).
- [x] Task 3.2: Filter out flagged invalid rows from the `"Start import (n)"` count and disable the button when `n === 0`.

### User Story 4 (P1): SHA-256 Duplicate Detection, Banner & Inline Actions
- [x] Task 4.1: Add duplicate banner above file list when `duplicateCount > 0`: `"N possible duplicate(s) found"` with `"Skip all"` button.
- [x] Task 4.2: Update duplicate row inline presentation: `"possible duplicate"` tag with inline `"Keep"` and `"Skip"` (X) buttons.
- [x] Task 4.3: Implement `"Keep"` handler that removes duplicate flag and includes file in the import count.

### User Story 5 (P1): Concurrency Copy Purge & Staging Footer
- [x] Task 5.1: Remove technical concurrency copy (`"Uploads run 3 at a time — the rest wait in line."`) from the staging footer.
- [x] Task 5.2: Ensure `+ Add more` reopens picker and appends to batch, and `Cancel` closes with nothing staged.
- [x] Task 5.3: Ensure Escape and backdrop click dismiss the modal when in staging mode.

### User Story 6 (P2): Progress Mode Aggregate Bar & Per-Row Upload States
- [x] Task 6.1: Update progress header: `"Importing media"`, `"Adding to {folder}"`, prominent aggregate percentage label, and full-width progress bar.
- [x] Task 6.2: Ensure per-row states match specification: `uploading` (% label, thin bar, pause/cancel), `paused` (neutral bar, `"paused"`, resume), `queued` (`"queued"`, cancel X), `failed` (`"failed — retry"`, Retry button), `completed` (green check, `"uploaded to {folder}"`), `cancelled` (dimmed, `"cancelled"`).
- [x] Task 6.3: Update progress footer: leave warning `"Leaving now will cancel the remaining uploads."`, red `"Cancel remaining"` link when more files are queued than uploading, and `"Keep working"` button.
- [x] Task 6.4: Completion state: `"Import complete"`, `"N of M added to {folder}"`, full aggregate bar, and primary `"Done"` button.

### User Story 7 (P2): Edge Case Resilience, Tests & Documentation
- [x] Task 7.1: Verify network retry (3 auto-retries with backoff), presigned URL silent refresh, and quota exceeded handling.
- [x] Task 7.2: Verify modal modularization and confirm cognitive complexity <= 15 for SonarCloud compliance.
- [x] Task 7.3: Update UI test suite in `apps/web/tests/ui/media-library-explorer.test.tsx` to verify destination pill, 46px thumbnails, duplicate banner, and copy.
- [x] Task 7.4: Synchronize architectural documentation in `docs/foundational-knowledge.md` under Section 37.
