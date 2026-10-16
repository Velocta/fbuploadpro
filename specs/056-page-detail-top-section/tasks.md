# Implementation Tasks: Facebook Page Detail Top Section & Action Buttons Redesign

**Branch**: `feat/056-page-detail-top-section` | **Spec**: [specs/056-page-detail-top-section/spec.md](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/pull_latest_main/specs/056-page-detail-top-section/spec.md)

---

## Phase 1: User Story 1 — Page Identity & Situational Header (Priority: P1)

**Goal**: Redesign the top identity area of `DedicatedPageHeader` with the 44x44px avatar (1.5px status ring), quiet back link, page title, and situational subtitle using 12px vertical hairline dividers without any bullet point dots (`•`).

- [x] T001 [US1] Update `apps/web/src/components/pages/dedicated/page-header.tsx` with a quiet `← Facebook Pages` back link routing to `/tenant/${subdomain}/pages`.
- [x] T002 [US1] Update Page Avatar dimensions to 44x44px with a 1.5px status ring border reflecting active (`#10b981`), paused (`#fad734`), or attention (`#ef4444`) state.
- [x] T003 [US1] Refactor situational subtitle in `apps/web/src/components/pages/dedicated/page-header.tsx` to render the unboxed 6px luminous dot with micro-halo, status label, parent account name, and follower count separated strictly by 12px vertical hairline dividers (`<span aria-hidden="true" style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-subtle)', flexShrink: 0 }} />`), with ZERO bullet point dots (`•`).

---

## Phase 2: User Story 2 — Uniform Action Button Cluster (Priority: P1)

**Goal**: Implement the 34px uniform height action buttons on the right side of `DedicatedPageHeader`.

- [x] T004 [US2] Refactor "Pause / Resume Automation" button in `apps/web/src/components/pages/dedicated/page-header.tsx` to 34px height with pause icon `⏸` when active and amber play icon `▶` when paused.
- [x] T005 [US2] Update "+ Queue Post" button in `apps/web/src/components/pages/dedicated/page-header.tsx` to 34px height with signature `#fad734` yellow, dark text, and subtle hover elevation.
- [x] T006 [US2] Implement the `···` More Options icon button (34x34px) with dropdown containing Sync Page Data, Copy Page ID, Open on Facebook, and Disconnect Page with outside-click closing.

---

## Phase 3: User Story 3 — Flat Typographic Tab Navigation (Priority: P2)

**Goal**: Modernize the tab bar in `apps/web/src/app/tenant/[subdomain]/pages/[pageId]/page.tsx` to use flat typographic tabs with a 2px solid `#fad734` bottom border for the active tab and quiet count chip for Queued items.

- [x] T007 [US3] Update tab bar in `apps/web/src/app/tenant/[subdomain]/pages/[pageId]/page.tsx` to use flat typographic tabs with `border-bottom: 2px solid #fad734` for active tab and `2px solid transparent` for inactive tabs.
- [x] T008 [US3] Add quiet numeric count chip for queued posts count in the Queue tab without capsule pill badges.

---

## Phase 4: User Story 4 & Polish — Checkpoint Banner & Test Verification (Priority: P2)

**Goal**: Refine the checkpoint warning banner and verify automated test coverage.

- [x] T009 [US4] Ensure checkpoint alert banner in `page-header.tsx` matches pitch-black dark mode styling with high-contrast amber accents and clear non-technical copy.
- [x] T010 Update or expand automated UI tests in `apps/web/tests/ui/` to verify:
  - Avatar 1.5px status ring border
  - Absence of bullet point dots (`•`) and presence of hairline dividers
  - 34px action button heights and labels (`Pause Automation`, `Resume Automation`, `+ Queue Post`)
  - Dropdown menu interactions
- [x] T011 Update foundational knowledge or relevant docs under `docs/` reflecting the redesigned page detail header.
