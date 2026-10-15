# Implementation Tasks: Multi-Platform Sidebar Sections & Placeholder Workspaces

**Feature**: Multi-Platform Sidebar Sections & Placeholder Workspaces  
**Branch**: `feat/047-platform-sidebar-sections`  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the shared platform navigation configuration, brand icons, and test harnesses.

- [x] T001 [P] Define platform navigation configuration and SVG brand icons in `apps/web/src/components/workspace/platform-nav-config.tsx`
- [x] T002 [P] Create initial unit test harness for platform placeholder accounts in `apps/web/tests/ui/platform-placeholder-accounts.test.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the shared placeholder view component that all upcoming platform account routes will utilize.

**⚠️ CRITICAL**: Must be implemented before individual platform routes and navigation hooks can be tested.

- [x] T003 Create reusable empty state placeholder component in `apps/web/src/components/workspace/platform-placeholder-accounts.tsx`

---

## Phase 3: User Story 1 - Multi-Platform Collapsible Sidebar Sections (Priority: P1) 🎯 MVP

**Goal**: Render Instagram, Threads, X (Twitter), TikTok, and YouTube collapsible menu items under the "Platform" section below Facebook in `WorkspaceSidebar`.

**Independent Test**: Mount `WorkspaceSidebar` and assert that Instagram, Threads, X (Twitter), TikTok, and YouTube collapsible triggers are rendered with correct stroke icons, default to collapsed state (`defaultOpen={false}`), and expand on user click.

- [x] T004 [US1] Update `apps/web/src/components/workspace/workspace-sidebar.tsx` to include collapsible menu items for Instagram, Threads, X (Twitter), TikTok, and YouTube below Facebook under Platform group
- [x] T005 [US1] Add unit test cases in `apps/web/tests/ui/workspace-sidebar.test.tsx` asserting all 5 platform sections render, default to collapsed, and expand on click

---

## Phase 4: User Story 2 - Platform Accounts Sub-Item & In-Sidebar Status Note (Priority: P1)

**Goal**: Render an "Accounts" sub-button within each expanded platform section accompanied by the in-sidebar testing notice ("Being tested — not available for public use").

**Independent Test**: Expand any of the five new platform sections and assert the presence of the "Accounts" sub-button and the exact text "Being tested — not available for public use".

- [x] T006 [US2] Update `apps/web/src/components/workspace/workspace-sidebar.tsx` to render the Accounts sub-menu button and muted in-sidebar placeholder note "Being tested — not available for public use" inside each platform's `<SidebarMenuSub>`
- [x] T007 [US2] Extend `apps/web/tests/ui/workspace-sidebar.test.tsx` to assert that each platform's sub-menu displays the Accounts sub-item and testing note

---

## Phase 5: User Story 3 - Dedicated Placeholder Accounts Route & Empty State View (Priority: P2)

**Goal**: Provide working routes at `/tenant/[subdomain]/[platform]/accounts` that display the placeholder view and highlight the corresponding sidebar items when active.

**Independent Test**: Navigate to `/tenant/acme/instagram/accounts` (and threads, x, tiktok, youtube) and verify the placeholder page renders without error, highlighting the sidebar item as active.

- [x] T008 [P] [US3] Create Instagram Accounts placeholder route in `apps/web/src/app/tenant/[subdomain]/instagram/accounts/page.tsx`
- [x] T009 [P] [US3] Create Threads Accounts placeholder route in `apps/web/src/app/tenant/[subdomain]/threads/accounts/page.tsx`
- [x] T010 [P] [US3] Create X (Twitter) Accounts placeholder route in `apps/web/src/app/tenant/[subdomain]/x/accounts/page.tsx`
- [x] T011 [P] [US3] Create TikTok Accounts placeholder route in `apps/web/src/app/tenant/[subdomain]/tiktok/accounts/page.tsx`
- [x] T012 [P] [US3] Create YouTube Accounts placeholder route in `apps/web/src/app/tenant/[subdomain]/youtube/accounts/page.tsx`
- [x] T013 [US3] Update route matching logic in `apps/web/src/components/workspace/workspace-sidebar.tsx` to highlight the corresponding platform and sub-item as active when visiting their routes
- [x] T014 [US3] Add unit tests in `apps/web/tests/ui/platform-placeholder-accounts.test.tsx` verifying navigation and rendering for all 5 platform routes

---

## Phase 6: Polish & Documentation

**Purpose**: Cross-cutting documentation and roadmap synchronization.

- [x] T015 [P] Update `docs/foundational-knowledge.md` to document the multi-platform navigation expansion and testing placeholder milestone
- [x] T016 Run quickstart validation scenarios and finalize spec artifacts
