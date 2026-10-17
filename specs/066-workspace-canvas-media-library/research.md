# Research & Architecture Decisions: Workspace Canvas Media Library

**Feature**: `066-workspace-canvas-media-library`  
**Date**: 2026-10-17  
**Scope**: Frontend UI & UX Architecture (`apps/web`)

---

## 1. Spatial Architecture & 3-Pane Responsive Layout

### Context & Challenge
The legacy media library rendered all subfolders, media assets, search bars, breadcrumbs, and batch bars in a single vertical stack of nested bordered cards. Asset cards each contained embedded caption textareas and clusters of 4 action buttons, causing extreme visual noise and layout boxiness.

### Decision
Implement a responsive 3-pane layout inspired by Figma, Linear, and macOS Finder:
1. **Left Folder Rail (`MediaFolderRail`)**:
   - Fixed 250px width (collapsible to 0px or icon rail).
   - Hosts smart collections (*All Media*, *Videos*, *Images*, *Uncaptioned*) and full folder tree.
   - Folders serve as drag-and-drop targets for instant file organization.
2. **Center Media Stage**:
   - Fluid `flex: 1` stage with `min-width: 0` to prevent horizontal overflow.
   - Responsive auto-fill grid: `gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))'`.
   - Clean typographic breadcrumb path in top chrome (`All Media / Reels / Fitness`) with zero box wrappers.
3. **Right Inspector Panel (`MediaInspectorPanel`)**:
   - 360px wide slide-over / docked studio pane.
   - Houses rich video scrubber / high-res preview, direct caption editor, Facebook eligibility checks, and primary schedule/move/delete actions.

### Alternatives Evaluated
- **Modal-only Inspection**: Rejected because opening and closing a modal for every asset disrupts workflow when reviewing and editing captions across dozens of files.
- **Accordion Card Expanders**: Rejected because expanding cards inline pushes neighboring tiles around and creates jarring layout shifts.

---

## 2. Card Simplification & Anti-Box Aesthetics

### Context & Challenge
`MediaAssetCard` suffered from "box inside a box":
- Card outer border + card shadow
- Inner thumbnail border
- Inner badge pill boxes
- Inner caption editor box with textarea border and save button
- Inner row of 4 bordered action buttons

### Decision
Extract and streamline the card into a visual-first `MediaAssetTile`:
- **80%+ Surface is the Media Thumbnail**: Frameless or single hairline perimeter (`#1f242d`).
- **Overlay Layer**: Checkbox in top-left (visible on hover, or permanently if selected), duration and ratio in bottom-right in subtle rectangular chips (`RADII.xs`).
- **Footer Layer**: Asset name with ellipsis truncation and tabular formatted file size (`14.2 MB`).
- **Active State**: Selected tile gains a clean Gold border highlight (`#fad734`) with zero layout shift.
- **Inline Editing Removal**: All caption textareas, char counts, and 4-button action rows are removed from the tile face and centralized in the Inspector.

---

## 3. Smart Collections Implementation

### Context & Challenge
Users need to quickly identify media drafts that are missing captions before scheduling.

### Decision
Implement client-side reactive smart collections directly over the existing API dataset without requiring new backend endpoints:
```typescript
export type SmartCollectionKey = 'all' | 'video' | 'image' | 'uncaptioned';

export function filterMediaByCollection(
  items: MediaItemResponse[],
  collection: SmartCollectionKey
): MediaItemResponse[] {
  switch (collection) {
    case 'video':
      return items.filter((item) => item.mediaType === 'video');
    case 'image':
      return items.filter((item) => item.mediaType === 'image');
    case 'uncaptioned':
      return items.filter(
        (item) => !item.captionText || item.captionText.trim().length === 0
      );
    case 'all':
    default:
      return items;
  }
}
```

---

## 4. Drag-and-Drop Ergonomics

### Context & Challenge
Moving assets between folders required clicking "Move", opening a modal, selecting a folder from a list, and confirming.

### Decision
Support direct drag-and-drop:
- Media tiles are draggable with `dataTransfer.setData('application/x-fbuploadpro-media', JSON.stringify({ mediaId }))`.
- Left rail folder items implement `onDragOver` (highlighting with Gold border `#fad734`) and `onDrop` (triggering `onMoveMedia(mediaId, folder.id)`).
- Modal move remains available via `···` context menu and Inspector panel for accessibility and keyboard users.

---

## 5. Design System & Theme Alignment

### Principles
- **Theme Source of Truth**: All tokens from `apps/web/src/lib/theme.ts`.
- **Colors**: Canvas `#000000`, Panel `#0c0d10`, Hairlines `#1f242d`, Primary Gold `#fad734`, Text `#ffffff`.
- **Typography**: Inter/Geist fonts with `TYPOGRAPHY.tabularNums` for metrics and file sizes.
- **Status Signals**: Real status dots using `STATUS_SIGNALS` or 6px luminous dots for Facebook publishing format eligibility.
