# Quickstart & Verification Guide: Media Library Functional Fixes

## Verification Scenarios

### 1. Upload Execution Verification (Issue 1)
1. Open `/tenant/[subdomain]/media`.
2. Click "Upload Files" in the top header.
3. Select a PNG file (`test-image.png`).
4. Click "Start import (1)".
5. Observe:
   - Progress bar starts at 1%, climbs to 100%.
   - Title shows "Import complete — 1 of 1 uploaded".
   - Dialog "Done" button is active.
   - Click "Done", verify `test-image.png` appears at the top of the grid.
6. Select 5 files.
   - Click "Start import (5)".
   - 3 files show "uploading" concurrently.
   - 2 files show "queued · #1" and "queued · #2".
   - As active slots finish, queued files auto-start and all 5 finish with "Import complete — 5 of 5 uploaded".

### 2. Existing Media Listing Verification (Issue 2)
1. Open `/tenant/[subdomain]/media` (logged in as owner of `velocta-avatar.png`).
2. Verify `velocta-avatar.png` appears at the root level of the Media Library.
3. Verify file size renders accurately (~10.5 KB).
4. Enter "velocta" in the search box.
   - Verify `velocta-avatar.png` remains visible.
5. Enter "png" in the search box.
   - Verify `velocta-avatar.png` remains visible.

### 3. Toolbar Dropdown Option Clicks (Issue 3)
1. In the toolbar, click "All ratios".
2. Click "1:1 Square".
   - Trigger label changes to "1:1 Square".
   - Menu closes cleanly.
   - Only 1:1 square assets remain visible in the grid (including `velocta-avatar.png`).
3. Click "Newest first" sort dropdown.
4. Click "Oldest first".
   - Trigger label changes to "Oldest first".
   - Grid reorders oldest first.
5. Focus the dropdown with Tab, press ArrowDown, then Enter.
   - Selected option applies immediately.

### 4. Toolbar Group Hairline Dividers (Issue 4)
1. Inspect the toolbar layout.
2. Confirm 1px vertical hairline dividers (`role="separator"`, `aria-orientation="vertical"`, `var(--border-subtle)`) are rendered between:
   - Search input and Media-type tabs
   - Media-type tabs and Dropdown filters
   - Dropdown filters and View mode toggle
