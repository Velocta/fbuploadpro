# Implementation Tasks: Spec 067 Media Library Redesign

**Branch**: `feat/067-media-library-redesign` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Phase 1: Setup & Foundational

**Purpose**: Project setup and foundational types

- [x] T001 Define client-side upload queue interfaces and batch caption types in `apps/web/src/components/media/media-types.ts`
- [x] T002 Verify clean imports and remove residual Downloader imports in `apps/web/src/components/media/`

---

## Phase 2: User Story 1 (Priority: P1) 🎯 MVP — Borderless Canvas, Flat Toolbar & Date-Enriched Asset Views

**Goal**: Transform Media Library into an unboxed, distraction-free canvas with live debounced search, plain text tabs/filters, bare view toggles, and asset tiles/table rows with visible upload dates and merged metrics.

**Independent Test**: Load `/media`. Verify header with quiet New Folder and single Upload Files button. Verify toolbar has no input box outline, tabs/dropdowns are flat and careted, and cards/table rows display upload dates and caption status with zero Schedule buttons or Facebook badges.

- [x] T003 [US1] Redesign header in `apps/web/src/components/media/media-library-explorer.tsx` with title "Media Library", subtext, quiet "New Folder" link, and single "Upload Files" button (delete "Upload Folder" button)
- [x] T004 [US1] Redesign toolbar in `apps/web/src/components/media/media-library-explorer.tsx`: flat borderless magnifier search with ~250ms debounce, plain text media tabs ("All / Videos / Images") with active underline, plain text dropdown buttons with carets for Aspect Ratio, Caption Status, and Sort, and bare icon grid/table toggle
- [x] T005 [US1] Implement slim context row in `apps/web/src/components/media/media-library-explorer.tsx` with clickable breadcrumbs trail (drop targets) and "Select all" toggle
- [x] T006 [US1] Redesign `apps/web/src/components/media/media-asset-card.tsx` into borderless rounded thumbnail tile with metadata underneath on canvas background (name, `size · formatted uploadDate`, caption status), hover top-left checkbox, bottom-right aspect ratio badge, hover Preview button and overflow menu (Move, Delete), 300ms hover video loop preview, and remove Schedule CTA and Facebook format badges
- [x] T007 [US1] Redesign `apps/web/src/components/media/media-table-row.tsx` to remove outer panel, add sticky header and hairline dividers, merge Details (`ratio · duration`), add Upload Date column, and remove Schedule CTA and Facebook format badges

**Checkpoint**: User Story 1 complete — core visual browsing experience is clean, borderless, and date-enriched.

---

## Phase 3: User Story 2 (Priority: P1) — Staged Import Flow with 3-Concurrency Engine & Leave-Page Protection

**Goal**: Provide a 2-step Import Media popup with file validation, SHA-256 duplicate detection, 3-concurrency worker engine, pause/resume/cancel, and leave-page protection.

**Independent Test**: Click "Upload Files" or drag files into page. Verify staging popup with validation flags and duplicate resolution. Start import and verify strict 3-concurrency cap. Attempt navigation during upload to verify warning dialog.

- [x] T008 [US2] Create `apps/web/src/components/media/media-import-modal.tsx` with Step 1 staging view (file rows, type icons, size, per-row remove, destination folder selector, "+ Add more", validation for 0-byte/>500MB/format)
- [x] T009 [US2] Implement SHA-256 duplicate detection in `apps/web/src/components/media/media-import-modal.tsx` with "possible duplicate" warning, per-row "Skip" / "Upload anyway", and "Skip all duplicates" bulk action
- [x] T010 [US2] Implement Step 2 upload progress mode in `apps/web/src/components/media/media-import-modal.tsx` with strict 3-concurrency worker queue, per-file pause/resume/cancel, overall progress %, and completed checkmarks
- [x] T011 [US2] Implement completion screen and minimize ("Keep working") mode in `apps/web/src/components/media/media-import-modal.tsx`
- [x] T012 [US2] Implement leave-page protection in `apps/web/src/components/media/leave-page-guard-dialog.tsx` and integrate `beforeunload` event handler and in-app navigation guard into `MediaLibraryExplorer`
- [x] T013 [US2] Wire file picker and drag-and-drop on `MediaLibraryExplorer` to open `MediaImportModal` and retire `UploadQueueBanner`

**Checkpoint**: User Story 2 complete — robust, bounded import flow protects user files and prevents accidental data loss.

---

## Phase 4: User Story 3 (Priority: P2) — Subfolder Row List Hierarchy & New Folder Dialog

**Goal**: Display subfolders as compact list rows with counts, hover actions, and drop targets, accompanied by an inline-validated New Folder modal.

**Independent Test**: View folder containing subfolders. Verify rows show "X subfolder(s) · Y files" with hover actions. Click "+ New Folder" and verify autofocused dialog with duplicate name validation.

- [x] T014 [US3] Redesign subfolder section in `apps/web/src/components/media/media-library-explorer.tsx` into rows ("FOLDERS (n)", folder icon, "n subfolders · n files", hover-revealed Rename/Move/Delete, drop target)
- [x] T015 [US3] Create `apps/web/src/components/media/new-folder-modal.tsx` with centered dialog, autofocused name input, parent folder selector, and inline duplicate name validation
- [x] T016 [US3] Wire "+ New Folder" triggers in header and folder rail to open `new-folder-modal.tsx`

**Checkpoint**: User Story 3 complete — subfolders are compact and folders are fast to create and organize.

---

## Phase 5: User Story 4 (Priority: P2) — Floating Batch Action Pill & Caption Modal

**Goal**: Implement floating bottom-center batch action pill with equal visual hierarchy and dedicated Replace vs. Append caption modal.

**Independent Test**: Select 2+ assets. Verify floating pill appears bottom-center. Open Set Caption modal, toggle Replace/Append, verify character counter, and apply to all selected items.

- [x] T017 [US4] Redesign `apps/web/src/components/media/batch-action-bar.tsx` to floating bottom-center pill ("n selected · Move · Set caption · Delete · Clear") without highlighted primary button
- [x] T018 [US4] Create `apps/web/src/components/media/batch-set-caption-modal.tsx` supporting Replace vs. Append modes, character counter, and toast confirmation
- [x] T019 [US4] Wire batch actions in `MediaLibraryExplorer` (Move, Set Caption, Delete, Clear)

**Checkpoint**: User Story 4 complete — bulk content staging and captioning works smoothly.

---

## Phase 6: User Story 5 (Priority: P3) — Two-Column Media Preview Studio Modal

**Goal**: Build a centered two-column preview modal with media player, frame capture, full metadata readout, and inline editable file name and caption.

**Independent Test**: Click Preview on an asset. Verify left column has player and "Capture frame"; right column has metadata rows and editable fields; footer has red "Delete asset" and "Save changes".

- [x] T020 [US5] Redesign `apps/web/src/components/media/media-preview-modal.tsx` into two-column layout: Left (player/scrubber or full image + "Capture frame"), Right (metadata label/value rows + editable Name and Caption with character counter), Footer (red text "Delete asset" on left, Cancel + Save changes on right, no Schedule or tags)

**Checkpoint**: User Story 5 complete — individual asset inspection is comprehensive and easy to edit.

---

## Phase 7: User Story 6 (Priority: P3) — Downloader UI Separation & Bug Remediations

**Goal**: Purge all Downloader UI from `/media`, fix dropdown click swallowing, synchronize live search count without empty-state flashing, and handle broken thumbnail fallbacks.

**Independent Test**: Verify zero downloader buttons or links. Click filter dropdowns with mouse. Search live and verify instant count sync. Test broken thumbnail fallback.

- [x] T021 [US6] Ensure complete removal of any Downloader UI traces from `MediaLibraryExplorer` and all media components
- [x] T022 [US6] Fix dropdown click event swallowing on Aspect Ratio, Caption Status, and Sort menus
- [x] T023 [US6] Fix live search debounce count lag and empty-state flashing on search clear
- [x] T024 [US6] Fix broken-image thumbnail placeholder by adding clean fallback to type icon on `onError`

**Checkpoint**: User Story 6 complete — clean separation from Downloader and zero interaction glitches.

---

## Phase 8: Polish & Documentation

**Purpose**: Documentation synchronization and SDD compliance

- [x] T025 [P] Update `docs/foundational-knowledge.md` to document the redesigned Media Library architecture and import flow
- [x] T026 Update quality checklists and verify consistency across all spec artifacts
