# Implementation Tasks: Media Library Toolbar Zones & Rail Smart Views

**Feature Branch**: `fix/069-media-library-functional-fixes` (PR #601)  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Task List

### Phase 1: Foundational Models & Root Renaming (P2)
- [x] **T001**: Rename root folder references in `apps/web/src/components/media/media-library-explorer.tsx` from "All Media" to "Library" (breadcrumb root button, `formatFolderAncestryPath` default fallback).
- [x] **T002**: Update `new-folder-modal.tsx` and `media-import-modal.tsx` to display "Library" instead of "All Media" as the root destination.

### Phase 2: Rail Smart Views ("VIEWS": "Everything" & "Needs caption") (P2)
- [x] **T003**: Implement/update the Left Navigation Rail in `media-library-explorer.tsx`:
  - Rename rail section header to "VIEWS".
  - Provide exactly two cross-folder smart views: "Everything" and "Needs caption".
  - Remove "Videos" and "Images" collections from the rail.
  - Provide "FOLDERS" section with root "Library" navigation and child folder tree.
- [x] **T004**: Add state management for `activeSmartView: 'everything' | 'needs_caption' | null` alongside `currentFolderId: string | null`, with navigation actions clearing the opposing selection appropriately while preserving local filter settings.

### Phase 3: Three-Zone Toolbar & Scope Anchor (P1)
- [x] **T005**: Eradicate the `All / Videos / Images` tablist from `media-library-explorer.tsx`.
- [x] **T006**: Build Zone 1 (GLOBAL, left):
  - Search input with placeholder `"Search files and captions…"`.
  - Divider 1: `<hr data-testid="media-toolbar-divider-1" aria-orientation="vertical" ... />`.
- [x] **T007**: Build Zone 2 (LOCAL, middle):
  - Dynamic Scope Anchor Tag (`data-testid="media-scope-tag"`): `"In: Library"`, `"In: Everything"`, `"In: Needs caption"`, or `"In: {folderName}"`. When searching, simplify to `"In: Library"`.
  - Three labeled dropdowns with always-visible labels:
    - `"Type: {value}"` (`All`, `Videos`, `Images`).
    - `"Ratio: {value}"` (`All`, `9:16`, `16:9`, `1:1`, `4:5`).
    - `"Captions: {value}"` (`All`, `Has caption`, `Missing caption`).
  - Active filter treatment: non-default values receive accent underline (`borderBottom: 2px solid ${PALETTE.primary}`).
  - Dynamic Clear action: If any local filter is active, display `<button data-testid="clear-filters-btn">{count} {count === 1 ? 'filter' : 'filters'} · Clear</button>`.
  - Divider 2: `<hr data-testid="media-toolbar-divider-2" aria-orientation="vertical" ... />`.
- [x] **T008**: Build Zone 3 (SORT + VIEW, right):
  - Labeled Sort dropdown: `"Sort: {value}"` (`Newest`, `Oldest`, `Name A–Z`, `Largest`).
  - Bare grid and table view toggle icon buttons.

### Phase 4: Library-Wide Search & Folder Path Attribution (P3)
- [x] **T009**: Update `filterAndSortMediaItems` in `media-library-explorer.tsx`:
  - When search query is non-empty, search library-wide across all files and captions regardless of current folder or smart view.
  - When no search query, filter items by `currentFolderId` (if no smart view) OR by smart view criteria (`everything`: all items; `needs_caption`: `!item.captionText || item.captionText.trim().length === 0`).
  - Apply local filters (`mediaTypeFilter`, `aspectRatioFilter`, `captionStatusFilter`) and `sortOption` to the resolved view.
- [x] **T010**: Render folder path attribution on search results (e.g. `"in asdf / sdafd"` or `"in Library"`) in `media-asset-card.tsx` / `media-table-row.tsx` or inline within `media-library-explorer.tsx` with direct navigation click handler.

### Phase 5: Verification Tests & Documentation (P1, P2, P3)
- [x] **T011**: Update UI test suite in `apps/web/tests/ui/media-library-explorer.test.tsx` to assert:
  - Three-zone toolbar layout, vertical dividers, and removal of type tabs.
  - Scope tag updates across root, folders, and smart views.
  - Labeled Type dropdown filtering, active accent underline, and "N filters · Clear".
  - Rail VIEWS ("Everything" and "Needs caption").
  - Breadcrumb and modal root naming ("Library").
  - Library-wide search with folder path attribution.
- [x] **T012**: Append Section 35 to `docs/foundational-knowledge.md` documenting the Three-Zone Toolbar architecture, Rail Smart Views, and Scope rules.
