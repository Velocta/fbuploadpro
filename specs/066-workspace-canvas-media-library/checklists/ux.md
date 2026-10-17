# UX & Aesthetic Quality Checklist: Workspace Canvas Media Library

**Purpose**: Validate user experience, anti-slop craft, and theme compliance
**Created**: 2026-10-17
**Feature**: [spec.md](../spec.md)

## Visual Craft & Anti-Slop Discipline

- [ ] Zero nested card boxes: page boundaries exist only as structural 1px hairlines (`#1f242d`).
- [ ] No embedded forms or clusters of 4 action buttons on grid tiles.
- [ ] Thumbnails dominate 80%+ of tile surface with 8px radius (`RADII.md`).
- [ ] Active tile selection state uses crisp Gold outline (`#fad734`) with zero layout shift.
- [ ] Zero capsule pill badges; corner metadata tags use rectangular `RADII.xs` micro-chips.
- [ ] Status indicators use authentic 6px luminous dots with micro-halos (`STATUS_SIGNALS`).

## Interaction Ergonomics & Flow

- [ ] Video hover previews initiate after 300ms debounce and loop cleanly without audio.
- [ ] Single-click on tile opens right Inspector panel; double-click or preview button opens full modal.
- [ ] Left Folder Rail collapsible to maximize canvas real estate on narrower screens.
- [ ] Drag-and-drop media cards directly onto Left Rail folders with gold hover targets.
- [ ] Smart collections (*All Media*, *Videos*, *Images*, *Uncaptioned*) provide instant 1-click filtering.
- [ ] Inspector provides live character counter and non-destructive caption updates.
