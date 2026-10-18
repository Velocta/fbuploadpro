# Implementation Plan: 072-import-media-dialog-updates

## Technical Architecture Overview
This plan specifies the in-place updates to `apps/web/src/components/media/media-import-modal.tsx` and its interactions with `apps/web/src/components/media/media-library-explorer.tsx`. The goal is targeted alignment of layout, behavior, and UX copy without disturbing the core upload pipeline (XHR uploads to R2, presigning, thumbnail generation, concurrency limit of 3, and confirm API).

---

## Architecture Components

### 1. Staging Mode Layout & Components
- **Destination Pill Selector**:
  - Replace the inline `<select>` element in the staging header with a dedicated `"To: {folderName}"` pill button with a folder SVG icon on the right side of the header.
  - State: `isDestinationDropdownOpen: boolean`.
  - Dropdown container: Absolute positioned panel styled with theme tokens (`RADII.xs`, `var(--bg-panel)`, `var(--border-subtle)`), listing "Library" and all user folders.
  - Selecting an option updates `selectedFolderId` and closes the dropdown.
  - Updates subtext: `"N files selected · will be added to {folderName}"`.
- **Thumbnail Preview Rendering**:
  - For image files: create an object URL (`URL.createObjectURL(file)`) and cache it per item (or generate an in-memory thumbnail) so it renders as a 46px square image thumbnail tile (`width: 46px, height: 46px, objectFit: 'cover', borderRadius: RADII.xs`).
  - For video files: render the primary video SVG icon in a 46px container (`width: 46px, height: 46px, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-subtle)'`).
  - Fall back to the SVG icon if the image `onError` fires.
- **Duplicate Banner**:
  - When `duplicateCount > 0`, render a banner above the file list:
    ```tsx
    <div style={{ ... }}>
      <span>{duplicateCount} possible duplicate{duplicateCount === 1 ? '' : 's'} found</span>
      <button onClick={handleSkipAllDuplicates}>Skip all</button>
    </div>
    ```
  - Per duplicate row: inline `"possible duplicate"` tag with `"Keep"` button and `"Skip"` (X) button.
  - Clicking `"Keep"` sets `duplicateResolution: 'keep'` and `isDuplicate: false`.
- **Validation Copy & Behavior**:
  - `file.size === 0` -> `"empty file"`
  - `file.size > MAX_FILE_SIZE_BYTES` -> `"too large — 500 MB max"`
  - Unsupported MIME -> `"can't upload — not a supported format"`
  - Allowed MIME: `video/mp4`, `video/quicktime`, `video/webm`, `image/jpeg`, `image/png`, `image/webp`.
  - Exclude all flagged items from `validStagedCount`.
  - Remove all mentions of concurrency in copy (e.g. remove `"Uploads run 3 at a time — the rest wait in line."`).

### 2. Progress Mode Layout & Elements
- **Aggregate Progress Bar & Header**:
  - Title: `"Importing media"` (or `"Import complete"` when all done).
  - Subtext: `"Adding to {folderName}"` during transfer; `"N of M added to {folderName}"` upon completion (excluding cancelled files).
  - Prominent percentage label: e.g. `<div style={{ fontSize: '1.75rem', fontWeight: TYPOGRAPHY.weights.bold }}>{overallPercent}%</div>`.
  - Full-width progress track underneath with `height: 6px` and fill width `${overallPercent}%`.
- **Per-Row Progress States**:
  - `uploading`: percentage text, thin progress bar, Pause button, Cancel button.
  - `paused`: neutral progress bar, `"paused"` status, Resume button.
  - `queued`: `"queued"` status, Cancel (X) button.
  - `failed`: `"failed — retry"` with Retry button.
  - `completed`: green checkmark, `"uploaded to {folderName}"`.
  - `cancelled`: dimmed row, `"cancelled"` status.
- **Progress Footer Controls**:
  - Left: Contextual leave warning `"Leaving now will cancel the remaining uploads."`
  - When `queuedCount > uploadingCount`: prepend a red `"Cancel remaining"` link.
  - Right: `"Keep working"` button during uploads; `"Done"` primary button on completion.
  - Cancelled batch: `"Import canceled — nothing was uploaded"` + `"Done"`.

---

## Clean Architecture & Complexity Control
To ensure strict adherence to SonarCloud rules (`typescript:S3776` - cognitive complexity <= 15 per function), `media-import-modal.tsx` will be partitioned into focused subcomponents:
1. `ImportStagingHeader`: renders title, subtext with destination name, and destination pill dropdown.
2. `ImportStagingRow`: renders 46px thumbnail, truncated file name, size, validation/duplicate flags, and per-row actions.
3. `ImportStagingFooter`: renders "+ Add more", duplicate skip banner/trigger, Cancel, and "Start import (n)".
4. `ImportProgressHeader`: renders title, subtext, aggregate percentage, and aggregate progress bar.
5. `ImportProgressRow`: renders progress row with upload/pause/queued/failed/done states.
6. `ImportProgressFooter`: renders leave warning, "Cancel remaining", "Keep working", and "Done".
