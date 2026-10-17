# Feature Specification: Workspace Canvas Media Library

**Feature Branch**: `feat/066-workspace-canvas-media-library`
**Created**: 2026-10-17
**Status**: Draft
**Input**: User request: "Direction 1 (Recommended): Workspace Canvas — Left folder rail, clean visual grid in the center, and a slide-over Inspector panel for editing captions and inspecting media. and make it proper visually appealing not box in a box or eye sooring elements everywhere and improper or confusing UX give me full idea"

---

## 1. Executive Summary
This specification defines the complete UX and UI transformation of the FBUploadPro Media Library from a cluttered, nested "box-in-a-box" card hierarchy into a high-precision, 3-pane **Workspace Canvas**. Anchored strictly to the **Binance Precision** design system (pitch black base `#000000`, 1px hairlines `#1f242d`, gold `#fad734` brand focal points, and zero capsule pills), this architecture decouples the media explorer into:
1. **Left Folder Rail**: Collapsible tree navigation with instant smart collections (*All Media*, *Videos*, *Images*, *Uncaptioned Assets*) and drag-and-drop move targets.
2. **Fluid Media Stage**: Visual-first, borderless media grid eliminating nested cards, crowded button rows, and embedded form fields.
3. **Right Inspector Panel**: Dedicated slide-over creative studio providing large interactive media previews, high-precision caption editing, Facebook publishing eligibility signals, and one-click scheduling actions.

---

## 2. User Scenarios & Testing *(mandatory)*

### User Story 1 - Fluid Borderless Media Grid & Anti-Box Aesthetics (Priority: P1)
**As a** content creator or media manager browsing my uploaded files,  
**I want** media items displayed as clean, visual-first tiles on a seamless dark canvas without nested bordered boxes, crowded button clusters, or inline forms,  
**So that** I can scan, review, and evaluate my creative video and photo assets effortlessly without visual fatigue.

**Why this priority**: Directly resolves the core user pain point ("it's just a box in a box and I hate it"). Media files must take center stage rather than being buried inside multi-layer rectangular containers.

**Independent Test**: Can be tested by opening the Media Library on a tenant workspace with uploaded images and videos. The page renders clean thumbnail tiles with typography underneath, eliminating the 4-layer nested card borders, inline caption textareas, and 4-button action rows from every card.

**Acceptance Scenarios**:
1. **Given** a library of image and video assets, **When** viewed in Grid mode, **Then** each item renders as a clean visual tile with a rounded thumbnail (`RADII.md`), crisp 1px hairline perimeter, and title/size typography below.
2. **Given** a video asset card, **When** hovered for 300ms, **Then** a smooth, muted video preview plays inline without layout distortion or jitter.
3. **Given** an asset tile, **When** inspecting its surface, **Then** there are zero inline caption textareas, zero capsule pill badges, and zero clusters of 4 individual action buttons.
4. **Given** a user clicking an asset tile, **When** selected, **Then** a refined Gold accent highlight (`#fad734`) appears around the active tile and its full context opens in the Right Inspector Panel.

---

### User Story 2 - Right-Side Creative Studio Inspector Panel (Priority: P1)
**As a** publisher preparing content for automated scheduling,  
**I want** selecting an asset to open a dedicated right-side Inspector panel with a rich preview, video scrubber, direct caption editor, Facebook eligibility status, and publishing actions,  
**So that** I have a focused, distraction-free environment to inspect, edit captions, and schedule media without leaving the library.

**Why this priority**: Decoupling the editing and scheduling controls from the grid cards into an Inspector panel enables deep, focused asset management while keeping the grid lightweight and visually stunning.

**Independent Test**: Can be tested by clicking any asset in the grid or table. The right Inspector panel smoothly slides in or populates with the asset's playable preview, caption editor, metadata, and schedule button.

**Acceptance Scenarios**:
1. **Given** any media asset selected in the grid, **When** the Inspector panel renders, **Then** it presents an interactive media player (with scrubber for video), direct caption textarea with live character counter, technical metadata (resolution, duration, ratio, file size), and Facebook publishing eligibility indicators.
2. **Given** edited caption text in the Inspector, **When** the user clicks "Save Changes" or navigates away after editing, **Then** the caption updates via API and the updated state persists without reloading the page.
3. **Given** an asset in the Inspector, **When** clicking "Schedule Post", **Then** the user is transitioned into the page scheduling workflow with this asset pre-selected.
4. **Given** the Inspector panel is open, **When** the user clicks the close icon or presses `Escape`, **Then** the Inspector dismisses cleanly and returns full width to the media canvas.

---

### User Story 3 - Left Folder Rail & Smart Collections (Priority: P2)
**As a** social media manager organizing campaigns across multiple categories,  
**I want** a dedicated left navigation rail displaying smart collections and a nested folder tree with drag-and-drop support,  
**So that** I can rapidly filter assets, jump between subfolders, and organize content without huge folder cards pushing media assets down the screen.

**Why this priority**: Moves folder navigation from large, screen-hogging card grids above the media assets to an ergonomic, accessible left sidebar that mirrors modern OS and professional asset management tools (Figma, Linear, Drive).

**Independent Test**: Can be tested by viewing the left sidebar, clicking Smart Collections (*All Media*, *Videos*, *Images*, *Uncaptioned*), creating a new folder, and dragging an asset card directly onto a folder in the rail.

**Acceptance Scenarios**:
1. **Given** the Media Library page, **When** loaded, **Then** the left rail displays smart collections (*All Media*, *Videos*, *Images*, *Uncaptioned Assets*) with dynamic count badges, followed by the collapsible folder tree.
2. **Given** an asset tile in the central canvas, **When** dragged and dropped onto a folder in the left rail, **Then** the asset is moved to that target folder and the counts update reactively.
3. **Given** a folder in the tree, **When** hovering or clicking its action menu (`···`), **Then** contextual options for *Rename*, *Move*, and *Delete* are accessible cleanly.
4. **Given** a user on a smaller laptop or screen, **When** clicking the sidebar collapse toggle, **Then** the left rail collapses to maximize the media grid area.

---

### User Story 4 - Seamless Top Chrome & Integrated Filtering (Priority: P2)
**As a** content creator finding specific assets,  
**I want** search, aspect ratio filters, sort options, and typographic breadcrumbs integrated smoothly into the page header without boxed panel enclosures,  
**So that** the page feels open, unified, and fast to navigate.

**Why this priority**: Eliminates the boxed breadcrumb container and boxed filter bar, merging them into crisp, uncluttered page chrome.

**Independent Test**: Can be tested by navigating into nested folders, typing in the search input, filtering by ratio (9:16, 16:9, etc.), and toggling between Grid and Table views.

**Acceptance Scenarios**:
1. **Given** navigation inside a nested folder, **When** viewing the header, **Then** breadcrumbs render as clean inline typographic text (`All Media / Reels / Fitness`) with click-to-navigate links, without a surrounding boxed card panel.
2. **Given** search keywords or filter dropdown changes, **When** adjusted, **Then** the central canvas updates live with 0 layout flicker.
3. **Given** the view toggle, **When** switching to Table view, **Then** a dense, high-velocity table renders with thumbnail previews, status signals, and metadata.

---

### User Story 5 - Multi-Asset Selection & Floating Batch Operations (Priority: P3)
**As a** power user managing bulk content uploads,  
**I want** to select multiple items via checkboxes or `Shift + Click` and execute batch moves, batch captioning, or batch deletion,  
**So that** I can process dozens of videos simultaneously with minimal friction.

**Why this priority**: Maintains enterprise batch throughput while adapting batch actions to the new Inspector and canvas architecture.

**Independent Test**: Can be tested by selecting multiple assets using checkboxes and `Shift + Click`. The Inspector or floating batch dock surfaces bulk actions (Batch Move, Batch Caption, Batch Delete).

**Acceptance Scenarios**:
1. **Given** multiple assets selected, **When** 2 or more items are active, **Then** the Inspector displays a bulk summary (*"X assets selected (Y MB)"*) with batch move, batch caption, and batch delete triggers.
2. **Given** a batch action performed, **When** the operation finishes, **Then** selections clear or update appropriately with clear feedback.

---

### Edge Cases
- **No Assets in Current Folder / Filter**: Clean, unboxed empty state with intuitive "Upload Files" or "Upload Folder" buttons and drag-and-drop prompt.
- **Extra Long File Names & Captions**: Single-line truncation with native title tooltips on the grid; full multiline view and wrapping inside the Inspector panel.
- **Very Deep Folder Nesting**: Breadcrumbs truncate intelligently with ellipsis (`All Media / ... / Summer26`) on narrower viewports.
- **Mobile & Narrow Viewports (< 768px)**: Left rail collapses to a sliding drawer; Right Inspector converts to a full-height bottom slide-over sheet.
- **Uncaptioned Filter**: Directly filters assets where `captionText` is null, undefined, or empty, allowing publishers to clear their captioning backlog efficiently.
- **Zero Raw Tokens / No Ad-Hoc Styling**: All colors, hairlines, spacing, radii, and typography MUST reference `@web/lib/theme` or CSS variables (`globals.css`).

---

## 3. Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: The Media Library (`apps/web/src/components/media/media-library-explorer.tsx`) MUST be restructured into a 3-pane responsive layout: Left Folder Rail, Center Fluid Stage, and Right Inspector Panel.
- **FR-002**: Left Folder Rail MUST provide Smart Collections:
  - *All Media* (all assets across current context)
  - *Videos* (all video assets)
  - *Images* (all image assets)
  - *Uncaptioned* (all assets missing custom captions)
- **FR-003**: Left Folder Rail MUST display the interactive folder hierarchy with folder creation, drag-and-drop dropzones for media movement, and contextual `···` actions (Rename, Move, Delete).
- **FR-004**: Center Fluid Stage MUST replace the boxed card container layout with clean, borderless media tiles.
- **FR-005**: Individual media tiles MUST NOT render embedded caption textareas, inline save buttons, or clusters of 4 action buttons on the card face.
- **FR-006**: Hovering a video asset tile for 300ms MUST initiate muted inline preview playback.
- **FR-007**: Right Inspector Panel MUST render when an asset is selected, displaying:
  - Full playable preview (video scrubber for video, zoomable view for photo)
  - Direct caption editor with character count and save button
  - One-click "Schedule Post" action
  - Secondary actions: Move to Folder, Download, Delete
  - Facebook publishing format eligibility status (Reels, Feed, Stories) using official unboxed luminous dots
  - Technical metadata (dimensions, aspect ratio, duration, size, creation date, folder ancestry)
- **FR-008**: Multi-selection via checkboxes and `Shift + Click` MUST be supported, updating the Inspector into a Batch Studio with bulk move, bulk caption, and bulk deletion actions.
- **FR-009**: Top header MUST integrate breadcrumb path navigation, search input, ratio filter, sort dropdown, and view switcher as seamless page chrome without an enclosing panel box.
- **FR-010**: Existing file upload capabilities (Windows copy-style queue banner, multi-file and folder upload, duplicate detection) MUST remain 100% operational.
- **FR-011**: All existing automated test coverage for media isolation, folders, batch actions, and uploads MUST remain green or be updated to test the new clean components.

### Non-Functional & Design Requirements
- **NFR-001**: **Binance Precision Compliance**: Strictly adhere to `DESIGN.md` and `apps/web/src/lib/theme.ts`. Surface base `#000000` in dark mode, panel surfaces `#0c0d10`, 1px hairlines `#1f242d`, and gold `#fad734` focal points.
- **NFR-002**: **Abolition of Box-in-a-Box**: No nested bordered containers. No card-in-a-card designs.
- **NFR-003**: **Zero Capsule Pill Badges**: All metadata readouts must use rectangular `RADII.xs` (4px) micro-tags or unboxed status dots.
- **NFR-004**: **Accessibility**: Full keyboard navigability (`Arrow` keys, `Enter` to select, `Escape` to close Inspector). Contrast ratios meeting WCAG AAA (14.86:1 for Gold buttons, 21:1 for white text on black).

---

## 4. Key Entities & Component Structure
- **`MediaLibraryExplorer`**: Main orchestrator component managing 3-pane layout, active selections, active folder, smart collection filter, and drag-and-drop.
- **`MediaFolderRail`**: Left sidebar component managing folder tree, smart collection tabs, new folder creation, and folder drop targets.
- **`MediaAssetTile`**: Clean, visual-first thumbnail card with hover preview, selection checkbox, duration/ratio corner readout, and minimal title/size footer.
- **`MediaInspectorPanel`**: Right slide-over studio component with media player, caption editor, metadata readouts, eligibility signals, and primary actions.
- **`UploadQueueBanner`**: Unified non-intrusive upload progress banner for ongoing multi-file transfers.
- **`BatchActionBar` / `BatchInspector`**: Bulk operations engine when 2+ items are selected.

---

## 5. Success Criteria *(mandatory)*

### Measurable Outcomes
- **SC-001**: 100% elimination of nested boxed containers and card-in-card elements in the Media Library.
- **SC-002**: Asset cards in Grid view reduce visual noise by removing inline textareas and 4-button action rows, giving visual media thumbnail 80%+ of card surface area.
- **SC-003**: Clicking any asset opens the Inspector panel with full preview, caption editing, and one-click scheduling in under 100ms.
- **SC-004**: Content creators can filter by "Uncaptioned" with one click to locate and complete drafts.
- **SC-005**: All existing media test suites pass with 100% success and zero regressions.

---

## 6. Assumptions
- The backend API endpoints (`/api/tenant/[subdomain]/media`, `/folders`, `/batch`, etc.) already provide the necessary data and contracts; this specification is a frontend architectural and UX/UI redesign within `apps/web`.
- The user's screen resolution on desktop is typically 1280px+ where a 3-pane layout thrives, with clean collapsible fallbacks for smaller screens.
