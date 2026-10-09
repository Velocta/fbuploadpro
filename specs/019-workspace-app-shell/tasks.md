# Implementation Tasks: 019 Workspace Pure Sidebar-Only App Shell

**Feature ID**: `019-workspace-app-shell`  
**Date**: 2026-10-09  

---

## Phase 1: Primitives & Separator Component (Phase 1)

- [X] T001 [P1] Implement `SidebarSeparator` in `apps/web/src/components/ui/sidebar.tsx` and export from `apps/web/src/components/ui/index.ts`
- [X] T002 [P1] Add unit tests for `SidebarSeparator` in `apps/web/tests/ui/sidebar.test.tsx`

---

## Phase 2: User Story 2 - Navigation Structure (Priority: P1)

- [X] T003 [P1] [US2] Implement `WorkspaceSidebar` in `apps/web/src/components/workspace/workspace-sidebar.tsx` with Workspace Header, Home item, Separator line, and Facebook group heading with Accounts sub-item
- [X] T004 [P1] [US2] Add unit tests for `WorkspaceSidebar` navigation structure in `apps/web/tests/ui/workspace-sidebar.test.tsx`

---

## Phase 3: User Story 3 - Bottom User Profile Card & Popover Menu (Priority: P1)

- [X] T005 [P1] [US3] Implement `WorkspaceUserMenu` in `apps/web/src/components/workspace/workspace-user-menu.tsx` with user name, email, chevron-up (`^`) trigger button, popover card, theme toggle, and Sign Out action
- [X] T006 [P1] [US3] Add unit tests for `WorkspaceUserMenu` and popover toggle in `apps/web/tests/ui/workspace-user-menu.test.tsx`

---

## Phase 4: User Story 4 - Mobile Access & Floating Trigger (Priority: P2)

- [X] T007 [P2] [US4] Implement `MobileNavTrigger` in `apps/web/src/components/workspace/mobile-nav-trigger.tsx` with fixed floating positioning on viewports <768px
- [X] T008 [P2] [US4] Add unit tests for `MobileNavTrigger` in `apps/web/tests/ui/mobile-nav-trigger.test.tsx`

---

## Phase 5: User Story 1 - Headerless Desktop Canvas & Layout Integration (Priority: P1)

- [X] T009 [P1] [US1] Update `apps/web/src/app/tenant/[subdomain]/layout.tsx` to wrap tenant pages with `SidebarProvider`, mount `WorkspaceSidebar`, `MobileNavTrigger`, and wrap `{children}` in full-height `SidebarInset`
- [X] T010 [P1] [US1] Update workspace layout integration tests in `apps/web/tests/dashboard.test.ts`

---

## Phase 6: Verification & Quality Gates

- [X] T011 Run full quality gate `pnpm turbo run build lint typecheck test` to assert 100% clean builds, zero lint errors, and all tests passing
