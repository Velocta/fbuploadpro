# Implementation Tasks: Workspace Canvas Media Library

**Branch**: `feat/066-workspace-canvas-media-library` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup & Foundational

**Purpose**: Establish core component primitives and smart collection utilities.

- [x] T001 [P] Create smart collection filtering utilities in `apps/web/src/components/media/smart-collections.ts`
- [x] T002 [P] Update exports in `apps/web/src/components/media/index.ts` to export upcoming `MediaAssetTile`, `MediaFolderRail`, and `MediaInspectorPanel`

---

## Phase 2: User Story 1 - Fluid Borderless Media Grid & Anti-Box Aesthetics (Priority: P1) 🎯 MVP

**Goal**: Transform media assets from heavy, nested cards into clean, visual-first thumbnail tiles with hover previews and zero inline forms.

**Independent Test**: Render grid of media assets; verify thumbnails dominate tile area, video hover preview plays after 300ms, and zero inline caption textareas or 4-button action rows are rendered on tile faces.

- [x] T003 [US1] Create `apps/web/src/components/media/media-asset-tile.tsx` with rounded thumbnail (`RADII.md`), 300ms video hover preview, multi-select checkbox, rectangular duration/ratio chips (`RADII.xs`), and clean title/size typography.
- [x] T004 [US1] Refactor `apps/web/src/components/media/media-asset-card.tsx` to act as an ergonomic adapter wrapping `MediaAssetTile` for backward compatibility.

---

## Phase 3: User Story 2 - Right-Side Creative Studio Inspector Panel (Priority: P1)

**Goal**: Provide a focused slide-over studio pane for rich video scrubbers, direct caption editing, Facebook eligibility indicators, and one-click scheduling.

**Independent Test**: Click any asset in the grid; verify Inspector panel slides open on the right, displays video scrubber/image preview, allows editing captions with a live counter and save button, and triggers scheduling.

- [x] T005 [US2] Create `apps/web/src/components/media/media-inspector-panel.tsx` with interactive player, direct caption editor, character counter, Facebook format eligibility dots (`STATUS_SIGNALS`), and Schedule / Move / Delete actions.

---

## Phase 4: User Story 3 - Left Folder Rail & Smart Collections (Priority: P2)

**Goal**: Move folder hierarchy from screen-hogging card grids above media assets into an ergonomic left rail with smart collections and drag-and-drop targets.

**Independent Test**: Click smart collections (*All Media*, *Videos*, *Images*, *Uncaptioned*) to filter assets instantly; drag a media tile onto a folder in the rail to move it.

- [x] T006 [US3] Create `apps/web/src/components/media/media-folder-rail.tsx` supporting smart collections with dynamic counts, collapsible folder tree, new folder creation, `···` folder actions, and HTML5 dragover/drop targets.

---

## Phase 5: User Story 4 - Seamless Top Chrome & 3-Pane Orchestration (Priority: P2)

**Goal**: Assemble the 3-pane Workspace Canvas in `media-library-explorer.tsx`, eliminating outer boxed containers, boxed breadcrumb panels, and boxed filter bars.

**Independent Test**: Navigate into nested folders; verify typographic breadcrumbs sit flush in the top bar without panel boxes, search and filters update the fluid stage live, and left rail toggles collapse smoothly.

- [x] T007 [US4] Refactor `apps/web/src/components/media/media-library-explorer.tsx` into the 3-pane Workspace Canvas layout connecting `MediaFolderRail`, fluid stage, and `MediaInspectorPanel`.

---

## Phase 6: User Story 5 - Multi-Asset Selection & Batch Studio (Priority: P3)

**Goal**: Adapt batch actions into the Inspector panel and floating dock when multiple assets are selected.

**Independent Test**: Select multiple assets with checkboxes or Shift+Click; verify Inspector transitions into Batch Mode showing selected count, batch move, batch caption, and batch delete triggers.

- [x] T008 [US5] Integrate Batch Mode in `MediaInspectorPanel` for multi-selected assets, supporting bulk move, bulk caption append, and bulk delete.

---

## Phase 7: Polish, Automated Tests & Documentation

**Purpose**: End-to-end verification and documentation synchronization in the same PR.

- [x] T009 Update automated UI test suite in `apps/web/tests/ui/media-library-explorer.test.tsx` to verify 3-pane layout, smart collections, tile hover preview, and inspector panel interactions.
- [x] T010 Synchronize `docs/foundational-knowledge.md` reflecting the new Workspace Canvas Media Library architecture.

---

## Dependencies & Execution Order

1. **Phase 1 (Setup)**: T001, T002.
2. **Phase 2 (US1 Media Tiles)**: T003, T004.
3. **Phase 3 (US2 Inspector)**: T005.
4. **Phase 4 (US3 Folder Rail)**: T006.
5. **Phase 5 (US4 3-Pane Orchestrator)**: T007.
6. **Phase 6 (US5 Batch Mode)**: T008.
7. **Phase 7 (Tests & Docs)**: T009, T010.
