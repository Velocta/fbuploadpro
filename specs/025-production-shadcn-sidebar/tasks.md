# Tasks: 025 Production Shadcn Sidebar Rebuild

**Input**: Design documents from `/specs/025-production-shadcn-sidebar/`

---

## Phase 1: Foundational CSS & Shadcn Sidebar Primitives (`apps/web`)

- [x] **T001** [P] [US1] Add shadcn sidebar structural & state CSS rules in `apps/web/src/app/globals.css` consuming canonical CSS custom properties (`--bg-panel`, `--bg-hover`, `--bg-active`, `--text-main`, `--text-sub`, `--text-dim`, `--border-subtle`, `--primary`).
- [x] **T002** [US1] Rebuild `apps/web/src/components/ui/sidebar.tsx` and update exports in `apps/web/src/components/ui/index.ts` with two-layer fixed+gap desktop layout, unclipped tooltips/popovers, `SidebarInput`, `SidebarMenuSkeleton`, `Collapsible` (`Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`), `SidebarTrigger` (`PanelLeft` icon), and `SidebarRail`.

## Phase 2: Workspace Sidebar, User Menu & Trigger Integration (`apps/web`)

- [x] **T003** [US2] Rebuild `apps/web/src/components/workspace/workspace-sidebar.tsx` using shadcn `TeamSwitcher` header (`SidebarMenuButton size="lg"` with `ChevronsUpDown`), "Home" `SidebarMenuButton`, `SidebarSeparator`, and `Collapsible` "Facebook" parent item with rotating `ChevronRight` and nested `SidebarMenuSub > SidebarMenuSubItem > SidebarMenuSubButton` for "Accounts".
- [x] **T004** [US3] Rebuild `apps/web/src/components/workspace/workspace-user-menu.tsx` using shadcn `NavUser` pattern (`SidebarMenu > SidebarMenuItem > SidebarMenuButton size="lg"` with `32px` rounded-lg avatar, two-line text, `ChevronsUpDown`, and unclipped right-anchored floating dropdown menu on desktop / top-anchored on mobile).
- [x] **T005** [US4] Update `apps/web/src/components/workspace/mobile-nav-trigger.tsx` and `apps/web/src/app/tenant/[subdomain]/layout.tsx` so the standard shadcn `SidebarTrigger` (`PanelLeft` icon) is available on both desktop and mobile viewports without adding a heavy top bar.

## Phase 3: Automated Tests & Quality Gate Verification

- [x] **T006** [US1, US2, US3, US4] Update and expand unit test suites in `apps/web/tests/ui/sidebar.test.tsx`, `apps/web/tests/ui/workspace-sidebar.test.tsx`, `apps/web/tests/ui/workspace-user-menu.test.tsx`, and `apps/web/tests/ui/mobile-nav-trigger.test.tsx` to verify two-layer structure, `Collapsible` `SidebarMenuSub`, `size="lg"` header/footer triggers, unclipped popovers, and desktop/mobile trigger visibility.
- [x] **T007** Run full monorepo quality gate (`pnpm turbo run build lint typecheck test`) and verify 100% pass rate with zero errors or warnings.
