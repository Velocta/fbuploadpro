# Quickstart & Verification Guide: Spec 067 Media Library Redesign

## Verification Workflow

### 1. Visual Verification & Borderless Canvas
- Open `/tenant/[subdomain]/media` in browser.
- Verify page header:
  - Title: "Media Library"
  - Subtext: "Upload, organize, and caption your media for publishing queues."
  - Right: quiet text link "New Folder", single primary button "Upload Files". No "Upload Folder" button.
- Verify Toolbar:
  - Magnifier icon + "Search by file name or caption…", no outline border.
  - Plain text tabs: "All", "Videos", "Images" with active underline indicator.
  - Dropdowns: Aspect ratio, Caption status, Sort trigger cleanly on mouse click.
  - Bare grid and table view toggle icons.
  - Breadcrumbs context row with clickable ancestors and "Select all" toggle.

### 2. Subfolder Rows
- Check subfolders rendering as rows with folder icon, name, "X subfolder(s) · Y files", and hover-revealed icon actions (Rename, Move, Delete).
- Verify dragging a media card onto a folder row moves the asset into that folder.

### 3. Grid View Tiles
- Check media cards: rounded thumbnail tile with file name, `size · upload date` (e.g. `10.3 KB · Oct 18, 2026`), and caption status line directly beneath on the page canvas.
- Hover reveals top-left checkbox, bottom-right aspect ratio badge, hover video loop preview (300ms), and hover Preview button + overflow menu (Move, Delete).
- Verify NO Schedule buttons or Facebook format eligibility badges appear.

### 4. Table View
- Switch to Table view.
- Verify table has no outer panel box, uses hairline dividers, sticky header, merged "Details" column (`ratio · duration`), and upload date column.
- Verify NO Schedule button appears.

### 5. Floating Batch Pill & Caption Modal
- Select 2+ assets.
- Verify floating bottom-center pill: "X selected · Move · Set caption · Delete · Clear".
- Click "Set caption":
  - Title: "Set caption", subtext: "Applies to X files".
  - Toggle between "Replace existing captions" and "Add to the end of existing captions".
  - Character counter updates; empty text keeps submit disabled.
  - Submit shows toast "Caption updated on X files".

### 6. Two-Step Import Media Flow
- Click "Upload Files" or drag files into window.
- Step 1 (Staging popup):
  - Rows with type icon, name, size, X button to remove, "+ Add more".
  - Destination folder dropdown.
  - Validation: 0-byte or >500MB flagged with inline message and excluded from count.
  - Duplicate detection: flags matches with "Skip" / "Upload anyway" and "Skip all duplicates".
- Step 2 (Progress):
  - Click "Start import (n)".
  - Verify strict 3-concurrency cap: exactly 3 active uploads while others show "queued · #n".
  - Pause/resume/cancel on active rows; per-file % and overall progress.
  - Finish summary: "Import complete — X of Y uploaded" and Done button.
- Leave-page protection:
  - Attempt in-app navigation while upload runs: custom warning modal appears.
  - Attempt tab close: browser `beforeunload` warning triggers.

### 7. New Folder Dialog
- Click "+ New Folder".
- Verify small centered dialog with autofocused "FOLDER NAME" and "PLACE INSIDE" dropdown defaulting to All Media.
- Enter duplicate name: verify inline note "A folder with this name already exists" disables button without alert popup.
