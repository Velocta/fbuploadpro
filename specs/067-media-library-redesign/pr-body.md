## Summary

This PR completes the full layout, view modes, and import flow redesign of the Media Library (`/tenant/[subdomain]/media`, component `MediaLibraryExplorer`) under **Spec 067**. This is a layout, interaction, and copy redesign operating strictly within existing theme tokens without modifying global CSS, colors, typography, or `DESIGN.md`.

---

### Core Redesign Pillars & User Stories Completed

1. **Unboxed Flat Studio Canvas & Zero "Box-in-Box" Styling (US1)**:
   - Eradicated all nested card boxes and bordered panels inside panels.
   - Header with title `"Media Library"`, subtext `"Upload, organize, and caption your media for publishing queues."`, quiet `"+ New Folder"` text link, and single primary `"Upload Files"` button (deleted redundant `"Upload Folder"` button).
   - Flat divider-separated toolbar: borderless live search input with ~250ms debounce, plain text media tabs (`All / Videos / Images`) with active underline, custom careted dropdown buttons for `Aspect Ratio`, `Caption Status`, and `Sort`, and bare icon grid/table toggles.
   - Slim context row: plain-text breadcrumbs with clickable ancestors that act as drop targets for drag-and-drop reparenting, paired with `"Select all"` toggle.

2. **Asset Grid & Table Views with Canvas Metadata (US1)**:
   - **Grid Tile**: Rounded thumbnail tile with metadata rendered directly underneath on the canvas background: file name, size · upload date (`10.3 KB · Oct 18, 2026` via `created_at`), caption status line (`"Caption added"` / `"Missing caption"`), top-left hover checkbox, bottom-right aspect ratio badge, hover Preview button and overflow menu (Move, Delete), and 300ms hover muted video preview.
   - **Table View**: Unboxed plain table with hairline row dividers and sticky header; merged Details column (`1:1 · 0:45`); dedicated Upload Date column; click-to-edit caption; and hover actions (Preview, Move, Delete).
   - **Permanent Removals**: 1-click Schedule / Add to Queue CTAs are permanently deleted from `MediaAssetCard`, `MediaTableRow`, `BatchActionBar`, and `MediaPreviewModal` (scheduling belongs strictly to the publishing queue section). Facebook format eligibility badges are permanently removed.

3. **Two-Step Staged Import Flow & 3-Concurrency Worker Engine (US2)**:
   - Replaced `UploadQueueBanner` with `MediaImportModal`.
   - **Step 1 (Staging)**: Native file picker / drag-and-drop opens staging list displaying type icon, file name, size, destination folder selector, and `"+ Add more"`. Validates unsupported types, >500MB sizes, and blocks 0-byte files with clear inline explanations.
   - **Duplicate Detection**: Intra-batch and server-side duplicate pre-screening (`POST /api/tenant/[subdomain]/media/check-duplicates`) flags possible duplicates with per-row `"Skip"` / `"Upload anyway"` toggles and `"Skip all duplicates"` bulk control.
   - **Step 2 (Execution)**: Strict 3-concurrency worker engine (`MAX_CONCURRENT_UPLOADS = 3`) with auto-advancing queue slots, per-file pause/resume/cancel/retry with exponential backoff, overall batch progress %, and completion summary.
   - **Dock Mode**: `"Keep working"` minimizes modal to bottom-right dock while uploads continue in the background.
   - **Leave-Page Protection**: In-app navigation triggers `LeavePageGuardDialog` displaying furthest-along upload progress, and native browser `beforeunload` is armed only while uploads are actively in-flight.

4. **Subfolder Row Hierarchy & New Folder Modal (US3)**:
   - Subfolders render as clean, single-level horizontal rows under `FOLDERS (n)` displaying folder icon, name, and secondary text (`"1 subfolder · 0 files"`), with hover-revealed Rename / Move / Delete actions and interactive drag-and-drop targets.
   - `NewFolderModal`: Centered modal with autofocused name field, parent folder selector defaulting to current folder or `"All Media"`, Enter-to-submit, and inline duplicate name validation.

5. **Floating Batch Action Pill & Captioning (US4)**:
   - Floating bottom-center pill when 1+ assets selected: `"n selected · Move · Set caption · Delete · Clear"` with uniform visual hierarchy.
   - `BatchSetCaptionModal`: Supports `"Replace existing captions"` and `"Add to the end of existing captions"` (appending after a newline) with character counter (`0 / 2,200`) and toast confirmation.

6. **Two-Column Studio Preview Modal (US5)**:
   - Left column: large preview (video player with scrubber and `"Capture frame"` text button, or full image).
   - Right column: metadata rows (`Type`, `Size`, `Aspect ratio`, `Duration`, `Upload date`) plus editable `"File name"` and `"Caption"` with character counter.
   - Footer: Red `"Delete asset"` on left, `"Cancel"` and `"Save changes"` on right. Zero Schedule buttons or format tags.

7. **Downloader UI Separation & Bug Remediations (US6)**:
   - Complete domain boundary separation: Zero Downloader UI or triggers in `/media`.
   - Pointer-down popover handling prevents dropdown event swallowing.
   - Instant search count synchronization with 250ms debounce and 0ms instant clear.
   - Broken image thumbnail fallback to file-type vector icon.

---

### Documentation & Governance Synchronization

- **Constitution Amended**: Version bumped to `2.35.0` with **Principle 31** (*Media Library Layout, View Modes, Staged Ingestion & Boundary Separation Governance - Spec 067*).
- **Foundational Knowledge**: Appended **Section 32** to `docs/foundational-knowledge.md` documenting the redesign architecture and staged ingestion engine.
- **Specifications & Tasks**: Complete SpecKit SDD artifacts (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `tasks.md`, checklists) under `specs/067-media-library-redesign/`.
