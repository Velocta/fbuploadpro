# Implementation Tasks: Media Library Functional Fixes

**Feature Branch**: `fix/069-media-library-functional-fixes`  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup & Foundational

- [x] T001 Initialize branch and feature workspace artifacts for Spec 069.

---

## Phase 2: User Story 1 - Robust Media Import Execution & Explicit Cancellation Guard (Priority: P1) 🎯 MVP

**Goal**: Fix the direct-to-R2 upload parameters, confirm call, concurrency pump, and cancellation state machine in `MediaImportModal`.

- [x] T002 [US1] Fix presigned upload response property mapping in `apps/web/src/components/media/media-import-modal.tsx`: map `mediaUploadUrl`, `mediaKey`, `publicMediaUrl`, `thumbnailUploadUrl`, `thumbnailKey`, `publicThumbnailUrl`.
- [x] T003 [US1] Fix confirmation payload in `apps/web/src/components/media/media-import-modal.tsx` to send valid `storageKey` and `url` to `/api/tenant/[subdomain]/media/confirm`.
- [x] T004 [US1] Add explicit user cancellation guard (`cancelInitiatedByUser: boolean`) so the batch NEVER enters `canceled` without user interaction, and if uploads fail, render `Import failed — 0 of N uploaded` instead of `Import canceled — nothing was uploaded`.
- [x] T005 [US1] Add transition source logging in `apps/web/src/components/media/media-import-modal.tsx` (`[upload-engine] Transition to complete`).

---

## Phase 3: User Story 2 - Existing Storage Media Resolution & Query Limit Alignment (Priority: P2)

**Goal**: Restore media library listing for existing files (including `velocta-avatar.png`) by aligning query limit schemas.

- [x] T006 [US2] Update `MediaListQuerySchema` in `packages/contracts/src/domain/media.ts` to allow `limit: z.coerce.number().int().min(1).max(1000).default(50)`.
- [x] T007 [US2] Verify `MediaLibraryExplorer` in `apps/web/src/components/media/media-library-explorer.tsx` properly populates `mediaItems` and renders root items without filter blocking.

---

## Phase 4: User Story 3 - Interactive Toolbar Dropdowns with Keyboard & Click Support (Priority: P3)

**Goal**: Fix dropdown menus in `MediaLibraryExplorer` so option clicks are not swallowed by document `pointerdown` listeners and keyboard selection works.

- [x] T008 [US3] Add container refs (`ratioDropdownRef`, `captionDropdownRef`, `sortDropdownRef`) and update outside-click listener in `apps/web/src/components/media/media-library-explorer.tsx` to check container containment before closing.
- [x] T009 [US3] Ensure option button clicks dispatch properly, update respective filter/sort state (`aspectRatioFilter`, `captionStatusFilter`, `sortOption`), update trigger labels, and support keyboard Enter/Space/Escape navigation.

---

## Phase 5: User Story 4 - Hairline Toolbar Group Dividers (Priority: P4)

**Goal**: Render 1px vertical hairline dividers separating toolbar groups per approved design.

- [x] T010 [US4] Add 1px vertical hairline dividers (`role="separator"`, `aria-orientation="vertical"`, `var(--border-subtle)`) between Search, Media-type tabs, Dropdowns, and View toggle in `apps/web/src/components/media/media-library-explorer.tsx`.

---

## Phase 6: Polish & Documentation

- [x] T011 Update UI test suites in `apps/web/tests/ui/media-library-explorer.test.tsx` to verify dropdown option selection, toolbar dividers, and import modal upload completion.
- [x] T012 Update `docs/foundational-knowledge.md` with Spec 069 architectural and remediation details.
