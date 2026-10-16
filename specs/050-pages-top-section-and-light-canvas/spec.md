# Feature Specification: Pages Top Section Redesign & Light Mode Canvas Contrast (Spec 050)

**Branch**: `feat/050-pages-top-section-and-light-canvas`  
**Status**: In Progress  
**Category**: Frontend UX & Design Craft  
**Scope**: 
- `apps/web/src/lib/theme.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/tenant/[subdomain]/pages/page.tsx`
- `apps/web/tests/ui/pages.test.tsx`
- `docs/foundational-knowledge.md`

---

## 1. Problem Statement
1. **Light Mode Canvas Blending**: In `theme.ts` and `globals.css`, both `--bg-canvas` and `--bg-panel` were defined as `#ffffff`. Consequently, white cards (`#ffffff`) rested on an identical pure white background, resulting in a completely flat, washed-out appearance with zero surface separation.
2. **Pages Top Section Visual Clutter**:
   - The top header used generic, static boilerplate copy ("Track follower growth and open any page...") that offered zero situational awareness.
   - The "Add Page" button was a solid yellow block dominating the screen.
   - The search and filter controls only rendered when `pages.length > 4`, causing sudden layout jumps when a user added their 5th page.
   - Search input was a bulky bordered text box; filter tabs were trapped in an outdated gray `<fieldset>` container; and the account filter was an unstyled native HTML `<select>`.

The user requested:
- **Option A for Light Mode**: Set `--bg-canvas` to `#f6f8fa` (clean neutral light canvas) while keeping `--bg-panel` at `#ffffff`, enabling white cards to cleanly pop off the duller canvas with crisp contrast and natural depth.
- **Direction 2: The Ultra-Smooth Split Horizon**:
  - Live situational subtitle reflecting operational state.
  - Ghost search input with inset icon and subtle focus glow.
  - Pure typographic flat status tabs with 2px bottom accent on active (zero pill containers, zero gray boxes).
  - Smart account filter (automatically hidden when only 1 account exists).
  - Compact, refined "Add Page" action button.
  - Single 1px hairline divider framing the page cards below.

---

## 2. User Stories & Acceptance Criteria

### User Story 1: Light Mode Canvas Contrast (P1)
**As a** user operating in light mode,  
**I want** the base canvas surface to be slightly duller (`#f6f8fa`) than the white card panels (`#ffffff`),  
**So that** cards, modals, and control surfaces have clear contrast, depth, and tactile separation.

- **Acceptance Criteria**:
  - `LIGHT_THEME.surfaces.canvas` in `apps/web/src/lib/theme.ts` is set to `#f6f8fa`.
  - `[data-theme="light"], .light` in `apps/web/src/app/globals.css` defines `--bg-canvas: #f6f8fa;`.
  - Dark mode surfaces remain intact (`#000000` canvas, `#0c0d10` panel).
  - All automated theme cleanliness and contrast tests pass.

### User Story 2: Smooth Split Horizon Header & Situational Subtitle (P1)
**As a** media operator,  
**I want** the top header to give me instant situational status without filler text or visual clutter,  
**So that** I know the operational health of my pages at a glance.

- **Acceptance Criteria**:
  - Renders title `Facebook Pages` with `data-testid="pages-page-title"`.
  - Dynamic subtitle displays situational status:
    - When filtered/searched: `Showing {filteredCount} of {totalCount} pages`
    - When 1+ pages need attention: `{totalCount} connected pages · {attentionCount} require reconnecting` (with rose styling for attention text)
    - When all healthy: `{totalCount} connected pages · All operational`
  - Compact "Add Page" button (`data-testid="header-add-page-btn"`):
    - Height: 34px, 13px semi-bold typography, crisp 1px border, smooth 1px hover lift.

### User Story 3: Ghost Search & Typographic Filter Tabs (P1)
**As an** operator managing multiple pages,  
**I want** frictionless, uncluttered search and filtering tools that are always available,  
**So that** I can locate and filter pages effortlessly without visual noise.

- **Acceptance Criteria**:
  - Search input:
    - Transparent background, inset 13px search icon SVG, quiet placeholder `Filter by name or category...`.
    - Focus adds a subtle hairline highlight.
    - Quick `Esc` key / `×` button clears query when text is present.
    - Preserves `data-testid="pages-search-input"`.
  - Status filter tabs:
    - Preserves testids: `pages-filter-all`, `pages-filter-active`, `pages-filter-needs-attention`, `pages-filter-paused`.
    - Pure flat text triggers with 2px bottom accent on the active tab.
    - Zero boxed `<fieldset>` styling, zero pill badges.
    - Only `Needs Attention` displays an inline count `(N)` when count `> 0`.
  - Smart account filter:
    - Preserves `data-testid="pages-account-filter"`.
    - Understated trigger selector.
    - Automatically omitted from the DOM when `accountOptions.length <= 1`.
  - Seamless 1px bottom hairline (`border-bottom: 1px solid var(--border-subtle)`) cleanly framing the grid.

### User Story 4: Backward Compatibility & Test Suite Integrity (P1)
**As an** engineer maintaining the test suite,  
**I want** all existing page management behavioral tests to pass cleanly,  
**So that** no functionality or keyboard accessibility is broken.

- **Acceptance Criteria**:
  - Filter functions (`filterPagesList`, `sortPagesAttentionFirst`) preserve all filtering logic.
  - Empty state (`PagesEmptyState`) and filter-empty state (`data-testid="pages-filter-empty"`) continue to function cleanly.
  - Unit tests in `apps/web/tests/ui/pages.test.tsx` updated to cover the new situational subtitle and smart account filter visibility.

---

## 3. Non-Functional Requirements
- **Theme Conformance**: Strictly use tokens from `@/lib/theme` (`THEME.default`, `PALETTE`, `RADII`, `SPACING`, `TYPOGRAPHY`).
- **No Pill Badges**: Zero capsule pill badges or decorative noise.
- **Zero Local Checks**: Validation performed via remote GitHub Actions CI upon PR creation.
