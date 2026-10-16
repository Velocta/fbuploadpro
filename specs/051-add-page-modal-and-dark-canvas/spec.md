# Feature Specification: Add Page Dialog Redesign & Dark Mode Midnight Slate Canvas (Spec 051)

**Branch**: `feat/051-add-page-modal-and-dark-canvas`  
**Status**: In Progress  
**Category**: Frontend UX & Design Craft  
**Scope**: 
- `apps/web/src/lib/theme.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/components/pages/add-page-modal.tsx`
- `apps/web/tests/ui/pages.test.tsx`
- `docs/foundational-knowledge.md`

---

## 1. Problem Statement & Motivation
1. **Dark Mode Canvas Void**: In `theme.ts` and `globals.css`, `--bg-canvas` was defined as pure pitch black (`#000000`) and `--bg-panel` as `#0c0d10`. The pitch black background created an "awkward void"—harsh 21:1 contrast against white typography causing halation/eye strain, zero optical depth, and cards virtually blending into the canvas.
2. **Add Page Dialog Visual Clutter**:
   - The current `AddPageModal` suffered from "box-in-a-box" syndrome: each account and each page row was wrapped in a heavy, nested bordered box (`var(--bg-subtle)` + hairline border).
   - In Step 2, a redundant boxed bar displayed `Account: Sarah Connor [Change account]`, taking up unnecessary vertical rhythm and disconnecting account switching from the header.
   - Page checkboxes used loud, high-contrast borders around entire cards when selected, creating a chaotic checkerboard.
   - Static button copy ("Add Selected Pages") lacked real-time tactile intent (`Import 2 Pages`).

The user requested:
- **Dark Mode Option A (Midnight Slate)**: Update canvas to `#0a0c10` (soft midnight slate), panels/cards to `#12151c` (distinct elevation), subtle wells to `#181c26`, and hairline borders to `#222735`.
- **Direction 1 (Linear / Raycast Streamlined Flow)**:
  - Header continuity with seamless breadcrumb / back button (`← Select Facebook Pages to Add` with contextual subtitle `{account.displayName} · {count} pages available`).
  - Frameless, edge-to-edge row rhythm with whisper-quiet hover tints and zero nested inner boxes.
  - Built-in minimal search filter for discovered pages.
  - Tactile custom check affordances and quiet whisper text for already imported pages.
  - Dynamic confirmation button (`Import {N} Pages`).

---

## 2. User Stories & Acceptance Criteria

### User Story 1: Dark Mode Canvas & Surface Calibration (P1)
**As an** operator working in dark mode,  
**I want** the dark canvas to be a refined midnight slate (`#0a0c10`) with elevated panel surfaces (`#12151c`),  
**So that** the application has natural optical depth, reduced eye strain, and cards float gracefully above the background.

- **Acceptance Criteria**:
  - `DARK_THEME.surfaces.canvas` in `apps/web/src/lib/theme.ts` is `#0a0c10`.
  - `DARK_THEME.surfaces.panel` is `#12151c`.
  - `DARK_THEME.surfaces.subtle` is `#181c26`.
  - `DARK_THEME.surfaces.hover` is `#1f2430`.
  - `DARK_THEME.surfaces.active` is `#272d3d`.
  - `DARK_THEME.borders.hairline` is `#222735` and `border-strong` is `#2d3444`.
  - Root CSS variables in `apps/web/src/app/globals.css` match the calibrated tokens.
  - Light mode surfaces (`#f6f8fa` canvas, `#ffffff` panels) remain unaffected.

### User Story 2: Linear / Raycast Header Breadcrumb Continuity (P1)
**As a** media manager adding Facebook pages,  
**I want** seamless header continuity with an integrated back button and contextual account subtitle,  
**So that** I don't see redundant inner banners or lose context when switching between accounts and pages.

- **Acceptance Criteria**:
  - Step 1 renders Title: `Select a Facebook Account` with subtitle: `Choose which connected Facebook account you want to import pages from.`
  - Step 2 renders Title: `Select Facebook Pages to Add` with integrated `←` back button (`data-testid="change-account-btn"`) and contextual subtitle: `{account.displayName} · {N} pages found`.
  - Clicking the back arrow smoothly transitions back to Step 1 without resetting modal state.
  - Redundant boxed inner account bar is completely eliminated.

### User Story 3: Frameless Row Rhythm & Tactile Selection (P1)
**As an** operator scanning dozens of pages,  
**I want** an airy, frameless list with clear visual hierarchy and minimal selection affordances,  
**So that** I can pick pages quickly without navigating visual clutter.

- **Acceptance Criteria**:
  - Account list and page list remove heavy individual box containers; items are organized with frameless row rhythm, subtle hairlines, and soft hover fills.
  - Discovered pages include minimal search input (`Filter pages...`) to instantly find pages by name or category.
  - Select All button (`data-testid="select-all-pages-btn"`) clearly indicates active selection state.
  - Checkboxes use clean, modern styling without thick bright blue outlines around the entire row.
  - Already imported pages retain `data-testid="already-added-{id}"` and text `Already added`, remaining disabled and quietly muted.

### User Story 4: Dynamic Action Intent & Behavioral Continuity (P1)
**As an** operator finishing page import,  
**I want** the primary button to confirm the exact number of pages being added,  
**So that** I have immediate confidence before triggering the import.

- **Acceptance Criteria**:
  - Primary button (`data-testid="confirm-add-pages-btn"`) displays:
    - `Import 1 Page` when 1 page is selected.
    - `Import {N} Pages` when multiple pages are selected.
    - `Add Selected Pages` when 0 pages are selected (disabled).
    - `Adding Pages...` while submitting.
  - All existing API endpoints (`/api/tenant/{subdomain}/accounts/{accountId}/pages/discover`, `/api/tenant/{subdomain}/pages/import`), props, and testids are 100% preserved.

---

## 3. Non-Functional Requirements
- **Theme Enforcement**: Strictly use tokens from `@/lib/theme` (`THEME.default`, `PALETTE`, `RADII`, `SPACING`, `TYPOGRAPHY`).
- **No Pill Badges**: Zero capsule pill badges or decorative tags.
- **Zero Local Checks**: Validation performed via remote GitHub Actions CI upon PR creation.
