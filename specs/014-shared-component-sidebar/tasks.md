# Tasks: Shared Shadcn-Compatible Sidebar Component

**Input**: Design documents from `specs/014-shared-component-sidebar/`

**Prerequisites**: `spec.md`, `plan.md`, `checklists/requirements.md`

---

## Phase 1: Foundational Sidebar Architecture (Shared Infrastructure)

**Purpose**: Build context provider, responsive state management, and root sidebar container.

- [x] T001 [Foundational] Implement `SidebarProvider` context, state management, `sidebar_state` cookie persistence, `isMobile` media query, and `Cmd+B`/`Ctrl+B` keyboard shortcut in `apps/web/src/components/ui/sidebar.tsx`
- [x] T002 [Foundational] Implement core `Sidebar` component supporting desktop collapsible icon rail (`icon` mode: 256px -> 48px) and mobile overlay sheet drawer with backdrop in `apps/web/src/components/ui/sidebar.tsx`

---

## Phase 2: User Story 1 (Priority: P1) 🎯 MVP - Composable Structural & Group Primitives

**Purpose**: Build the foundational layout areas and semantic groups for page structure.

- [x] T003 [P1] [US1] Implement `SidebarHeader`, `SidebarContent`, `SidebarFooter`, and `SidebarInset` layout components in `apps/web/src/components/ui/sidebar.tsx`
- [x] T004 [P1] [US1] Implement `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupAction`, and `SidebarGroupContent` grouping primitives in `apps/web/src/components/ui/sidebar.tsx`

---

## Phase 3: User Story 2 (Priority: P2) - Navigation Menus, Badges, Submenus, & Actions

**Purpose**: Build complete interactive menu items, nested submenus, action buttons, rails, and triggers.

- [x] T005 [P2] [US2] Implement `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton` with active indicator, tooltip integration, and size variants in `apps/web/src/components/ui/sidebar.tsx`
- [x] T006 [P2] [US2] Implement `SidebarMenuAction`, `SidebarMenuBadge` (theme-compliant unboxed/subtle counter), and nested `SidebarMenuSub` hierarchy (`SidebarMenuSubItem`, `SidebarMenuSubButton`) in `apps/web/src/components/ui/sidebar.tsx`
- [x] T007 [P2] [US2] Implement `SidebarRail` interactive toggle edge and `SidebarTrigger` button in `apps/web/src/components/ui/sidebar.tsx`
- [x] T008 [P2] [US2] Export all sidebar primitives and types from barrel in `apps/web/src/components/ui/index.ts`

---

## Phase 4: User Story 3 (Priority: P3) - Automated Testing & Theme Compliance Gate

**Purpose**: Ensure rigorous automated test coverage and zero theme token violations.

- [x] T009 [P3] [US3] Implement unit and interaction tests covering `SidebarProvider`, desktop collapse toggle, keyboard shortcut, and mobile drawer in `apps/web/tests/ui/sidebar.test.tsx`
- [x] T010 [P3] [US3] Audit and verify 100% theme token compliance (`apps/web/src/lib/theme.ts`), zero hardcoded hex literals, zero capsule pills, and unboxed luminous status indicators

---

## Phase 5: User Story 4 (Priority: P4) - Showroom & Component Cleanliness

**Purpose**: Ensure showroom and sidebar remain free of mock data and placeholder clutter until user-defined content is implemented.

- [x] T011 [P4] [US4] Remove mock data and placeholder pages from `apps/showroom/src/app/sidebar/` per user directive
- [x] T012 [P4] [US4] Revert `apps/showroom/src/app/page.tsx` to clean baseline, preserving pure unpopulated sidebar primitives

---

## Phase 6: Polish & Quality Gates

**Purpose**: Ensure 100% test pass rate, strict lint/type compliance, and clean build.

- [x] T013 [QA] Execute `pnpm turbo run build lint typecheck test` and ensure all quality gates pass with zero errors
