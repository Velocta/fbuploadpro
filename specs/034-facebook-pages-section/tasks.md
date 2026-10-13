# Tasks: Spec 034 — Dedicated Facebook Pages Management Section, Follower Growth Tracking & Two-Step Page Import

**Branch**: `feat/034-facebook-pages-section` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Phase 1: Database Migration, Contracts & Backend Endpoints (`backend-engineer`)
- [x] T001 Create forward migration `supabase/migrations/20261011180000_facebook_pages_followers_tracking.sql` renaming `facebook_pages.followers_count` to `current_followers` and adding `starting_followers INT NOT NULL DEFAULT 0 CHECK (starting_followers >= 0)` (with backfill), and add symlink in `packages/database/migrations/`.
- [x] T002 Update `packages/contracts/src/domain/facebook.ts` (`FacebookPageSchema`, `FacebookPageViewSchema`, `DiscoveredPageSchema`) to include `startingFollowers`, `currentFollowers`, and signed `followersGained` (`currentFollowers - startingFollowers`), preserving backwards-compatible `followersCount` where needed, and update `packages/contracts/tests/facebook.test.ts`.
- [x] T003 Update `apps/web/src/app/api/tenant/[subdomain]/pages/route.ts`, `apps/web/src/app/api/tenant/[subdomain]/pages/import/route.ts`, `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/route.ts`, and `apps/web/src/app/api/tenant/[subdomain]/accounts/[accountId]/pages/discover/route.ts` for `current_followers`, `starting_followers`, signed `followersGained`, and soft-delete (`status = 'disconnected'`).
- [x] T004 Update `apps/worker/src/insights-sync.ts` and its tests in `apps/worker/tests/insights-sync.test.ts` to update `current_followers` on `facebook_pages`.

## Phase 2: Sidebar Navigation & Facebook Pages Frontend Views (`frontend-engineer`)
- [x] T005 Update `apps/web/src/components/workspace/workspace-sidebar.tsx` to render `Pages` directly below `Accounts` inside the collapsible `Facebook` menu, active on `/tenant/[subdomain]/pages` and `/tenant/[subdomain]/pages/[pageId]`.
- [x] T006 Build `PageCard` in `apps/web/src/components/pages/page-card.tsx` (clickable card navigating to `/tenant/[subdomain]/pages/[pageId]`, avatar with monogram fallback, page name, category, current followers, signed followers gained with negative rose handling, parent account name, and status with red attention standout).
- [x] T007 Build `PagesEmptyState` in `apps/web/src/components/pages/pages-empty-state.tsx` and two-step `AddPageModal` in `apps/web/src/components/pages/add-page-modal.tsx` (Step 1: Select Facebook Account -> Step 2: Multi-select discovered Pages with checkboxes, `Select All`, and `Already added` state).
- [x] T008 Build `/tenant/[subdomain]/pages/page.tsx` (header, `Add Page` button, attention-pinned card grid, search + status filter tabs + account filter when `> 4` pages exist) and `/tenant/[subdomain]/pages/[pageId]/page.tsx` (dedicated Page placeholder view with `Back to Pages` navigation).

## Phase 3: Comprehensive API & UI Tests & Convergence (`qa-engineer`)
- [x] T009 Update and expand `apps/web/tests/api/facebook-pages.test.ts` and `apps/web/tests/ui/workspace-sidebar.test.tsx` for `currentFollowers`, `startingFollowers`, negative/positive `followersGained`, soft-delete disconnection, and sidebar `Pages` link.
- [x] T010 Create `apps/web/tests/ui/pages.test.tsx` testing `PageCard` (positive, zero, and negative `followersGained`, red attention states, click navigation), two-step `AddPageModal`, scale filters (`> 4` pages), and the `/tenant/[subdomain]/pages/[pageId]` placeholder view.
- [x] T011 Run full Turborepo verification gate (`pnpm turbo run build lint typecheck test`) and verify 100% pass rate with 0 errors.
