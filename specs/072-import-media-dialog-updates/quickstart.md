# Quickstart: 072-import-media-dialog-updates

## Visual Verification Guide

1. **Triggering the Import Dialog**:
   - Navigate to `/tenant/acme/media`.
   - Click `"Upload Files"` primary button in the header, or drag files onto the canvas.
   - Verify modal opens with title `"Import media"` and subtext `"N files selected · will be added to Library"`.

2. **Destination Pill**:
   - Verify the `"To: Library"` pill on the right of the header.
   - Click the pill: dropdown opens displaying all folders.
   - Select a folder (e.g. `"Campaign A"`): pill changes to `"To: Campaign A"` and subtext updates to `"N files selected · will be added to Campaign A"`.

3. **Thumbnail Tile & Metadata**:
   - Check that image files display a 46px square thumbnail preview.
   - Check that video files display the video type icon in a 46px box.
   - Check that file name is truncated with ellipsis and formatted file size is shown.

4. **Validation & Exclusion**:
   - Add a 0-byte file: flagged as `"empty file"`.
   - Add a file > 500 MB: flagged as `"too large — 500 MB max"`.
   - Add an unsupported file (e.g. `.pdf`): flagged as `"can't upload — not a supported format"`.
   - Verify `"Start import (n)"` excludes flagged rows from count `n`.

5. **Duplicate Banner & Inline Controls**:
   - Duplicate files receive `"possible duplicate"` flag with inline `"Keep"` and `"Skip"` buttons.
   - If duplicates exist, banner above list displays `"N possible duplicate(s) found"` and `"Skip all"` button.

6. **Progress Mode**:
   - Click `"Start import (n)"`: modal transitions to progress mode.
   - Overall percentage and full-width progress bar are visible.
   - Only 3 files upload concurrently; others are queued.
   - Per-file Pause/Resume/Cancel work smoothly.
   - Completed files display green check and `"uploaded to {folder}"`.
   - Red `"Cancel remaining"` appears when more files are queued than uploading.
   - Completion shows `"Import complete"` and `"Done"` button.
