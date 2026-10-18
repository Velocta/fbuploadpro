# Implementation Plan: Media Library Toolbar Zones & Smart Views

**Branch**: `fix/069-media-library-functional-fixes` (PR #601) | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Rebuild Media Library toolbar into 3 distinct zones separated by vertical dividers, rename root to "Library", eliminate type tabs in favor of labeled Type dropdown, add navigation scope anchor tag, add "N filters · Clear", support smart views rail ("VIEWS" with "Everything" and "Needs caption"), and library-wide search with folder path attribution. Zero theme, color, font, or global CSS changes.

---

## Technical Context

**Language/Version**: TypeScript 5.7+ / Next.js 16 (App Router) / React 19  
**Target Components**:
- `apps/web/src/components/media/media-library-explorer.tsx` (Toolbar, Smart Views Rail, Scope Tag, Filter/Sort State)
- `apps/web/src/components/media/new-folder-modal.tsx` ("Library" placeholder & select option)
- `apps/web/src/components/media/media-import-modal.tsx` ("Library" select option)
- `apps/web/src/components/media/media-asset-card.tsx` & `media-table-row.tsx` (Folder path attribution)
- `apps/web/tests/ui/media-library-explorer.test.tsx` (Test suites)
**Constraints**:
- Single unified agent execution.
- No modifications to `DESIGN.md`, theme tokens, colors, fonts, or global CSS.
- Single combined PR (#601).

---

## Phased Execution

### Phase 1: Setup & Foundational Model
- Define `MediaSmartViewKey` (`'everything' | 'needs_caption'`).
- Define `MediaActiveView` (`{ type: 'folder', folderId: string | null } | { type: 'smart', view: MediaSmartViewKey }`).
- Define labeled options and short display values for Type, Ratio, Captions, and Sort.

### Phase 2: Root Renaming to "Library"
- Update `formatFolderAncestryPath` default fallback to `"Library"`.
- Update breadcrumb root button label to `"Library"`.
- Update `new-folder-modal.tsx` default parent folder option to `"Library"`.
- Update `media-import-modal.tsx` and move destination options to `"Library"`.

### Phase 3: Left Navigation Rail & Smart Views
- Implement navigation rail with:
  - Header with collapse button or unboxed sidebar.
  - Section `VIEWS` with exactly `"Everything"` and `"Needs caption"`.
  - Section `FOLDERS` with `"Library"` root and folder tree.
- Decouple smart view selection from folder selection.
- Update file filtering to resolve cross-folder smart views ("Everything" & "Needs caption").

### Phase 4: Three-Zone Toolbar
- **Zone 1 (GLOBAL)**:
  - Library-wide search input with placeholder `"Search files and captions…"`.
- **Divider 1**: `<hr aria-orientation="vertical" ...>`
- **Zone 2 (LOCAL)**:
  - Scope anchor tag (`"In: Library"`, `"In: Everything"`, `"In: Needs caption"`, `"In: asdf"`).
  - Labeled `Type: All` dropdown (`All`, `Videos`, `Images`).
  - Labeled `Ratio: All` dropdown (`All`, `9:16`, `16:9`, `1:1`, `4:5`).
  - Labeled `Captions: All` dropdown (`All`, `Has caption`, `Missing caption`).
  - Active underline treatment on non-default filter values (`2px solid ${PALETTE.primary}`).
  - Dynamic `"N filters · Clear"` action button resetting all three filters.
- **Divider 2**: `<hr aria-orientation="vertical" ...>`
- **Zone 3 (SORT & VIEW)**:
  - Labeled `Sort: Newest` dropdown.
  - Bare grid and table view toggle icons.

### Phase 5: Search & Folder Path Attribution
- Search executes library-wide across all files and captions.
- Entering a search query resets scope tag to `"In: Library"`.
- Display folder path attribution on each result (e.g. `"in asdf / sdafd"` or `"in Library"`).

### Phase 6: Testing & Documentation
- Update UI tests in `media-library-explorer.test.tsx` verifying:
  - 3-zone toolbar rendering and dividers.
  - Scope tag updates on navigation.
  - Type dropdown filtering.
  - Active value underline and "N filters · Clear".
  - Rail VIEWS ("Everything" and "Needs caption").
  - Breadcrumb root "Library".
- Append Section 35 to `docs/foundational-knowledge.md`.
