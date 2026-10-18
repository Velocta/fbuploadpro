# Architectural & Interaction Research: Three-Zone Toolbar & Smart Views

**Feature**: Three-Zone Toolbar & Rail Smart Views  
**Spec ID**: 070

---

## 1. Problem Statement & UX Analysis

### A. Root Ambiguity ("All Media")
- In the current UI, `"All Media"` serves both as the root folder title and as an apparent media collection filter. Operators are confused whether clicking `"All Media"` navigates to root or removes a type filter.
- Renaming the root place to `"Library"` resolves this ambiguity: "Library" is a place, while filters are actions.

### B. Redundant Type Tabs
- The `All / Videos / Images` tablist duplicated collection logic and added unnecessary vertical clutter to the toolbar.
- Replacing the tabs with a labeled `Type: All` dropdown unifies all local filter controls (`Type`, `Ratio`, `Captions`) into a consistent format.

### C. State vs. Control Dropdowns
- Triggers like `"All ratios"` or `"Newest first"` read as static status indicators rather than interactive controls.
- Explicit prefixes (`Type: All`, `Ratio: All`, `Captions: All`, `Sort: Newest`) clarify their affordance as filter and sort controls.
- Highlighting non-default values with an accent underline (`borderBottom: 2px solid ${PALETTE.primary}`) provides instant peripheral awareness of applied filters.

---

## 2. Layout Architecture: Three-Zone Toolbar

```
+------------------------------------------------------------------------------------------------------------------------------+
| Zone 1 (GLOBAL)         | | Zone 2 (LOCAL)                                                         | | Zone 3 (SORT & VIEW)  |
| [Search files...]       | | [In: Library] [Type: All v] [Ratio: 9:16 v] [Captions: All v] [1 · Clr] | | [Sort: Newest v] [#][=]|
+------------------------------------------------------------------------------------------------------------------------------+
```

### Zone 1: GLOBAL (Left)
- Magnifier icon + borderless search input.
- Placeholder: `"Search files and captions…"`.
- Behavior: Searches all files across all folders in the library regardless of active folder or smart view.
- Scope transition: Entering a search query clears the scope anchor to `"In: Library"`.

### Divider 1
- Vertical `<hr aria-orientation="vertical" ...>` divider with 16px height, `var(--border-subtle)` color.

### Zone 2: LOCAL (Middle)
- **Scope Tag**: First item in Zone 2.
  - Root: `"In: Library"`
  - Folder `asdf`: `"In: asdf"`
  - Smart View `Everything`: `"In: Everything"`
  - Smart View `Needs caption`: `"In: Needs caption"`
  - Live Search: `"In: Library"`
- **Labeled Dropdowns**:
  1. `Type`: Prefix `"Type: "` + Value (`All`, `Videos`, `Images`).
  2. `Ratio`: Prefix `"Ratio: "` + Value (`All`, `9:16`, `16:9`, `1:1`, `4:5`).
  3. `Captions`: Prefix `"Captions: "` + Value (`All`, `Has caption`, `Missing caption`).
- **Active Underline**:
  - When `mediaTypeFilter !== 'all'`, the type value has `borderBottom: 2px solid ${PALETTE.primary}`.
  - When `aspectRatioFilter !== 'all'`, the ratio value has `borderBottom: 2px solid ${PALETTE.primary}`.
  - When `captionStatusFilter !== 'all'`, the caption value has `borderBottom: 2px solid ${PALETTE.primary}`.
- **Active Filters Badge & Clear Action**:
  - `activeFilterCount = (type !== 'all' ? 1 : 0) + (ratio !== 'all' ? 1 : 0) + (captions !== 'all' ? 1 : 0)`.
  - If `activeFilterCount > 0`, renders `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} · Clear`.
  - Clicking `"Clear"` resets all three to `'all'`.

### Divider 2
- Vertical `<hr aria-orientation="vertical" ...>` divider.

### Zone 3: SORT + VIEW (Right)
- Labeled sort dropdown: Prefix `"Sort: "` + Value (`Newest`, `Oldest`, `Name A–Z`, `Largest`).
- Bare grid and table view mode toggle buttons.

---

## 3. Left Navigation Rail & Smart Views

```
+---------------------------+
| VIEWS                     |
|  (o) Everything           |
|  ( ) Needs caption (3)    |
|                           |
| FOLDERS                   |
|  [+] Library              |
|      asdf                 |
|      sdafd                |
+---------------------------+
```

- Section header: `VIEWS` (uppercase, quiet font).
- Cross-folder views:
  - `Everything`: `m => true` (all items across all folders).
  - `Needs caption`: `m => !m.captionText || m.captionText.trim().length === 0`.
- Selection updates `activeView: 'library' | 'everything' | 'needs_caption'`.
- When a smart view is active:
  - `currentFolderId` is set to `null` (or view is decoupled from folder).
  - Subfolders section is not displayed (because smart views display flat cross-folder files).
  - Scope anchor displays `"In: Everything"` or `"In: Needs caption"`.
  - Local filters (Type, Ratio, Captions) and Sort apply seamlessly within the view.
