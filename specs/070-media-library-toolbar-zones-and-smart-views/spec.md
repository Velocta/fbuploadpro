# Feature Specification: Media Library Three-Zone Toolbar & Rail Smart Views

**Feature Branch**: `fix/069-media-library-functional-fixes` (PR #601)  
**Created**: 2026-10-18  
**Status**: Ready  
**Input**: Rebuild Media Library toolbar into 3 distinct zones separated by vertical dividers, rename root to "Library", eliminate type tabs in favor of labeled Type dropdown, add navigation scope anchor tag, add "N filters · Clear", support smart views rail ("VIEWS" with "Everything" and "Needs caption"), and library-wide search with folder path attribution. Zero theme, color, font, or global CSS changes.

---

## User Scenarios & Testing

### User Story 1 - Three-Zone Toolbar with Scope Anchor & Labeled Dropdowns (Priority: P1) 🎯 MVP

As an operator in the Media Library, I want the toolbar to clearly separate library-wide search (Zone 1), local scoped filters (Zone 2), and sort/view controls (Zone 3) with visible labels and active underlines, so I always know whether an action is global or scoped to the current view.

**Why this priority**: Ambiguity between global search, folder scope, and filter dropdowns causes operator confusion and lost assets. Zone separation establishes unmistakable hierarchy.

**Independent Test**:
1. Open `/tenant/[subdomain]/media`. Observe Zone 1 (search with placeholder `"Search files and captions…"`), Divider 1, Zone 2 (`"In: Library"`, `"Type: All"`, `"Ratio: All"`, `"Captions: All"`), Divider 2, Zone 3 (`"Sort: Newest"`, grid/table bare toggle icons).
2. Click `"Ratio: All"` -> select `"1:1 Square"`. The trigger displays `"Ratio: 1:1"` with `"1:1"` underlined with the active accent underline (`2px solid ${PALETTE.primary}`).
3. Immediately after the dropdowns, `"1 filter · Clear"` appears.
4. Click `"Clear"`. All three filters reset to `"All"`, the underline disappears, and `"1 filter · Clear"` is hidden.

---

### User Story 2 - Root Renaming & Rail Smart Views (Priority: P2)

As an operator organizing content, I want the root location called "Library" and a dedicated rail containing cross-folder smart views ("Everything" and "Needs caption"), so I can quickly access uncaptioned media or browse my whole repository without folder hierarchy restrictions.

**Why this priority**: "All Media" was confusingly perceived as a filter instead of a place. Rail smart views give content managers immediate access to uncaptioned backlog without manual searching.

**Independent Test**:
1. In the breadcrumb, observe the root reads `"Library"` (e.g. `"Library"` at root, `"Library / asdf / sdafd"` in subfolders).
2. Open "+ New Folder" modal. Verify "PLACE INSIDE" default selector displays `"Library"`.
3. In the navigation rail, observe section `"VIEWS"` containing exactly two items: `"Everything"` and `"Needs caption"`.
4. Click `"Needs caption"`.
   - The scope tag in Zone 2 updates to `"In: Needs caption"`.
   - The grid displays only assets with empty captions across the entire library.
   - Setting `"Type: Videos"` in Zone 2 filters the smart view to uncaptioned videos.
5. Click `"Everything"`. The scope tag updates to `"In: Everything"`, and all library assets are displayed.
6. Click `"Library"`. The scope tag updates to `"In: Library"`, and root folders and root items are displayed.

---

### User Story 3 - Library-Wide Global Search with Folder Path Attribution (Priority: P3)

As an operator searching for assets, when I enter a search query from any folder or smart view, search must execute library-wide across all files and captions, attributing each result with its folder location (e.g. `"in asdf / sdafd"` or `"in Library"`).

**Why this priority**: Operators should never have to manually guess which nested folder an asset was saved in to find it.

**Independent Test**:
1. Navigate into folder `"asdf"`. Observe scope tag reads `"In: asdf"`.
2. Type a query into the Zone 1 search input (e.g. `"velocta"`).
3. The scope updates to library-wide (`"In: Library"`).
4. The grid returns matching assets from root and other subfolders.
5. Each search card and table row displays its folder path (e.g. `"in Library"` or `"in asdf / sdafd"`). Clicking the path navigates directly to that folder.
6. Clearing search restores the view to the current folder.

---

## Edge Cases

- **Empty Smart Views**: When "Needs caption" has 0 uncaptioned files, render a clean empty state: `"All files have captions"` with subtext `"Upload new files or organize existing folders."`.
- **Keyboard Navigation**: All labeled dropdowns (`Type`, `Ratio`, `Captions`, `Sort`) support Enter, Space, Escape, and ArrowDown navigation with outside click containment.
- **Combined Filter & Smart View**: Local filters (`Type`, `Ratio`, `Captions`) and sort apply cleanly within smart views (e.g. "Needs caption" + "Ratio: 9:16").
- **Preserved Filter Settings on Navigation**: Navigating between folders or smart views preserves local filter settings (`Type`, `Ratio`, `Captions`, `Sort`).
- **Responsive Stacking**: On narrow viewports (<768px), the toolbar wraps gracefully while maintaining the 3-zone visual order.
