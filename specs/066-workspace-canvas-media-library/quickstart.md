# Quickstart & Verification Guide: Workspace Canvas Media Library

**Feature**: `066-workspace-canvas-media-library`  
**Date**: 2026-10-17  
**Scope**: Manual & Automated Verification Workflows

---

## 1. Quick Manual Verification Scenarios

### Scenario 1: Clean Visual Media Grid (Anti-Box Check)
1. Navigate to `/tenant/[subdomain]/media`.
2. Observe the page layout:
   - Left side: 250px sleek folder rail with *All Media*, *Videos*, *Images*, and *Uncaptioned* smart collections.
   - Center: Fluid media stage with clean thumbnail tiles.
   - Verify that individual tiles do **NOT** have embedded caption textareas or rows of 4 action buttons.
   - Verify that the breadcrumb path sits flush at the top without a boxed container.

### Scenario 2: Right-Side Inspector & Live Caption Editing
1. Single-click any asset tile in the central grid.
2. Verify:
   - Tile receives an active Gold border highlight (`#fad734`).
   - Right Inspector panel smoothly opens displaying full media player, technical metadata, and Facebook format eligibility indicators.
3. Type a new caption in the Inspector textarea and click "Save Changes".
4. Refresh or navigate away and back: verify the new caption persists.

### Scenario 3: Smart Collection Filtering (Uncaptioned Drafts)
1. In the Left Folder Rail, click **Uncaptioned**.
2. Verify that only assets without captions are displayed in the center stage.
3. Click an uncaptioned asset, add a caption in the Inspector, and save.
4. Verify the item smoothly clears from the uncaptioned list.

### Scenario 4: Drag and Drop Organization
1. Drag a media tile from the center grid onto any folder in the Left Rail.
2. Drop the asset: verify the card is moved to the target folder and folder item counts update reactively.

### Scenario 5: Multi-Select Batch Operations
1. Check checkboxes on 3 media items (or `Shift + Click`).
2. Verify the Inspector switches to Batch Mode: showing selected count and batch action triggers (Move, Caption, Delete).

---

## 2. Automated Testing Suite

Automated UI tests located in `apps/web/tests/ui/media-library-explorer.test.tsx` and unit tests in `apps/web/tests/unit/`:
- Verify 3-pane rendering and rail toggle.
- Verify tile hover preview playback.
- Verify inspector panel opens on tile click and updates captions.
- Verify smart collection filtering.
- Verify drag-and-drop move triggers.
