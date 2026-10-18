# Quality & Requirements Checklist: Media Library Toolbar Zones & Smart Views

This checklist validates the quality and functional requirements for Spec 070.

## Functional Requirements
- [x] Breadcrumb root reads "Library" instead of "All Media".
- [x] "+ New Folder" modal's "PLACE INSIDE" default reads "Library".
- [x] "All / Videos / Images" tabs are completely removed from the toolbar.
- [x] Zone 1 (GLOBAL, left): Search field only with placeholder "Search files and captions…".
- [x] Zone 1 divider: Vertical divider line between Zone 1 and Zone 2.
- [x] Zone 2 (LOCAL, middle): Scope tag "In: {location}" is the first element.
  - [x] Reads "In: Library" at root.
  - [x] Reads "In: Everything" on the Everything smart view.
  - [x] Reads "In: Needs caption" on the Needs caption smart view.
  - [x] Reads "In: {folderName}" inside a folder.
  - [x] Updates with navigation.
- [x] Zone 2: Three labeled dropdowns: "Type: All", "Ratio: All", "Captions: All".
  - [x] Labels ("Type", "Ratio", "Captions") are always visible.
  - [x] Current value follows the label.
  - [x] Type options: All, Videos, Images.
  - [x] Ratio options: All, 9:16, 16:9, 1:1, 4:5.
  - [x] Captions options: All, Has caption, Missing caption.
- [x] Zone 2: Non-default filter values get active accent underline treatment (`2px solid ${PALETTE.primary}`).
- [x] Zone 2: Dynamic "N filters · Clear" appears when any local filter is non-default, and clicking it resets all 3 to All.
- [x] Zone 2 divider: Vertical divider line between Zone 2 and Zone 3.
- [x] Zone 3 (SORT + VIEW, right): Labeled sort dropdown "Sort: {value}" (Newest, Oldest, Name A–Z, Largest) followed by bare grid/table icons.
- [x] Rail: Section header is "VIEWS" (renamed from "COLLECTIONS").
- [x] Rail: Contains exactly two smart views: "Everything" and "Needs caption".
- [x] Rail: Videos and Images collections removed.
- [x] Rail: "All Media" collection name is removed; root folder is "Library".
- [x] Scope rules: Local filters and Sort apply to the current view (folder or smart view).
- [x] Scope rules: Search is always library-wide across all files and captions.
- [x] Scope rules: Every search result displays its folder path (e.g. "in asdf / sdafd" or "in Library").
- [x] Scope rules: Switching folders or smart views preserves local filter settings.

## Design & Accessibility Requirements
- [x] Zero changes to `DESIGN.md`, theme tokens (`apps/web/src/lib/theme.ts`), global CSS, colors, or fonts.
- [x] Vertical dividers use semantic `<hr aria-orientation="vertical" ...>` with unique `data-testid` attributes.
- [x] Dropdowns support outside click containment, keyboard navigation (Escape, ArrowDown, Enter), and correct ARIA states (`aria-expanded`, `aria-haspopup`).
- [x] No nested ternary expressions (SonarQube S3358 compliance).
- [x] No non-standard or deprecated HTML semantics (SonarQube S6819 compliance).
