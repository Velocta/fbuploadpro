# Implementation Tasks: Add Page Dialog Redesign & Dark Mode Midnight Slate Canvas (Spec 051)

**Feature Directory**: `specs/051-add-page-modal-and-dark-canvas`  
**Status**: Ready for Implementation  

---

## Task Breakdown

- [x] **T001 [P1]**: Calibrate dark mode surfaces in `apps/web/src/lib/theme.ts` (Option A: Midnight Slate canvas `#0a0c10`, panels `#12151c`, subtle `#181c26`, hover `#1f2430`, active `#272d3d`, border-hairline `#222735`, border-strong `#2d3444`) and `apps/web/src/app/globals.css`.
- [x] **T002 [P1]**: Refactor `AddPageModal` in `apps/web/src/components/pages/add-page-modal.tsx`:
  - Implement Direction 1 (Linear / Raycast flow) with integrated header breadcrumb and back button.
  - Eliminate redundant boxed inner account bar in Step 2.
  - Implement frameless row rhythm for account selection and discovered pages with soft hover fills and zero nested boxes.
  - Add compact ghost search filter for discovered pages.
  - Implement dynamic confirmation button label (`Import 1 Page`, `Import {N} Pages`, `Add Selected Pages`, `Adding Pages...`).
  - Preserve all existing props, helper functions (`getActiveAccounts`, `getSelectablePageIds`, `toggleSelectAllPages`), and `data-testid` attributes.
- [x] **T003 [P1]**: Update and expand unit tests in `apps/web/tests/ui/pages.test.tsx` to verify the redesigned AddPageModal flow, dynamic button copy, and filter search.
- [x] **T004 [P1]**: Synchronize `docs/foundational-knowledge.md` to document the calibrated dark mode surfaces and redesigned Add Page modal architecture.
