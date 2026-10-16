# Implementation Tasks: Pages Top Section Redesign & Light Mode Canvas Contrast (Spec 050)

**Feature Directory**: `specs/050-pages-top-section-and-light-canvas`  
**Status**: Implemented & Converged  

---

## Task Breakdown

- [x] **T001 [P1]**: Update light mode canvas token in `apps/web/src/lib/theme.ts` (`LIGHT_THEME.surfaces.canvas: '#f6f8fa'`) and `apps/web/src/app/globals.css` (`--bg-canvas: #f6f8fa;`).
- [x] **T002 [P1]**: Implement Direction 2 (Split Horizon) top section and controls in `apps/web/src/app/tenant/[subdomain]/pages/page.tsx`:
  - Add live situational subtitle computation (`{totalCount} connected pages · All operational` vs `{attentionCount} require reconnecting` vs `Showing {filteredCount} of {totalCount} pages`).
  - Redesign "Add Page" button with compact 34px height, 13px typography, and refined hover physics.
  - Redesign `PagesScaleToolbar`:
    - Ghost search input with inset 14px SVG search icon, transparent background, and quick clear `×` button.
    - Pure typographic flat status tabs with 2px bottom accent on active tab (zero boxed fieldset).
    - Only display count chip for `Needs Attention (N)` when `N > 0`.
    - Smart account filter selector with clean transparent hairline styling.
    - 1px hairline bottom divider framing the grid below.
- [x] **T003 [P1]**: Update and expand unit tests in `apps/web/tests/ui/pages.test.tsx` for situational subtitle, ghost search input, and smart account filter visibility.
- [x] **T004 [P1]**: Synchronize `docs/foundational-knowledge.md` to document Spec 050 design tokens and top section architecture.
