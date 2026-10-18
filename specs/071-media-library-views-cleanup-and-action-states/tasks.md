# Tasks: Media Library Sidebar Cleanup & Double-Click Action State Hardening

**Input**: Design documents from `specs/071-media-library-views-cleanup-and-action-states/`  
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`

---

## Phase 1: Sidebar Rail Removal & Full-Width Layout (User Story 1 - Priority: P1)

- [x] T001 [US1] Remove `<aside data-testid="media-views-rail">` and delete the `MediaViewsRail` component from `apps/web/src/components/media/media-library-explorer.tsx`.
- [x] T002 [US1] Remove the flex split wrapper (`data-testid="media-explorer-body"`) so the main explorer canvas occupies 100% full width directly beneath the context breadcrumb row.
- [x] T003 [US1] Clean up `activeSmartView` state and its references in `media-library-explorer.tsx`, ensuring local toolbar filters (Type, Ratio, Captions) and folder navigation operate smoothly.

---

## Phase 2: Action States & Double-Click Protection on Folder Operations (User Story 2 - Priority: P1)

- [x] T004 [US2] Update `apps/web/src/components/media/new-folder-modal.tsx` to disable Cancel button, folder name input, and destination dropdown while `isSubmitting` is true; guard `handleSubmit` against rapid multi-clicks.
- [x] T005 [US2] Add `isRenamingFolder` state to `apps/web/src/components/media/media-library-explorer.tsx`; update Rename Folder dialog to show "Saving...", disable "Save" and "Cancel" buttons, disable input, and guard `handleRenameFolder` against double clicks.
- [x] T006 [US2] Add `isDeletingFolder` state to `apps/web/src/components/media/media-library-explorer.tsx`; update Delete Folder dialog to show "Deleting...", disable "Delete" and "Cancel" buttons, and guard `handleDeleteFolder` against double clicks.
- [x] T007 [US2] Add `isMoving` state to `apps/web/src/components/media/media-library-explorer.tsx`; update Move dialog to show "Moving...", disable "Move" and "Cancel" buttons, disable destination select, and guard `handleReparent` and `handleBatchMoveSubmit` against double clicks.

---

## Phase 3: Action States & Double-Click Protection on Asset & Batch Operations (User Story 3 - Priority: P1)

- [x] T008 [US3] Add `isBatchDeleting` and `isBatchCaptioning` states to `apps/web/src/components/media/media-library-explorer.tsx`; pass `isBusy={isBatchDeleting || isBatchCaptioning || isMoving}` to `BatchActionBar` and guard `handleBatchDelete`.
- [x] T009 [US3] Update `apps/web/src/components/media/batch-set-caption-modal.tsx` to disable Cancel button, textarea, and mode radios while `isSubmitting` is true; guard `handleSubmit` against double clicks.
- [x] T010 [US3] Update `apps/web/src/components/media/media-preview-modal.tsx` to add `isDeleting` state, display "Deleting..." on the delete button, and disable Cancel, Delete, and Save buttons plus text inputs whenever `isSaving` or `isDeleting` is active.
- [x] T011 [US3] Add `isStartingImport` guard in `apps/web/src/components/media/media-import-modal.tsx` to prevent rapid clicks on "Start import (n)" before transition to the progress view.
- [x] T012 [US3] Add `deletingAssetId` tracking and guard in `media-library-explorer.tsx` to protect single asset deletion against rapid clicks.

---

## Phase 4: Test Suite Synchronization & Documentation (Cross-Cutting)

- [x] T013 Update `apps/web/tests/ui/media-library-explorer.test.tsx` to remove tests expecting `media-views-rail` / "VIEWS" and add test assertions for double-click disabled states and loading labels.
- [x] T014 Update `docs/foundational-knowledge.md` to document the full-width layout and double-click protection across all Media Library actions.
