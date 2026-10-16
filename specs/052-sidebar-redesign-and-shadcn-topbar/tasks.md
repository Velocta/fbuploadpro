# Tasks: Spec 052 Sidebar Redesign & Canonical Shadcn Topbar

## Phase 1: CSS & Layout Infrastructure
- [x] **T1.1**: Purge `.workspace-mobile-gutter { padding-left: 56px !important; }` from `apps/web/src/app/globals.css`.
- [x] **T1.2**: Create `apps/web/src/components/workspace/workspace-breadcrumb.tsx` with pure helper `computeBreadcrumbs` (complexity <= 8).
- [x] **T1.3**: Update `apps/web/src/app/tenant/[subdomain]/layout.tsx` with canonical shadcn topbar (`<header>`, `<SidebarTrigger />`, divider, `<WorkspaceBreadcrumb />`) and remove `MobileNavTrigger` and `workspace-mobile-gutter`.

## Phase 2: Navigation Zero-Latency & Top Branding
- [x] **T2.1**: Implement `optimisticPathname` and prefetching in `apps/web/src/components/workspace/workspace-sidebar.tsx` for 0ms active state transitions.
- [x] **T2.2**: Implement FBUploadPro Logo & Branding header in `SidebarHeader` of `workspace-sidebar.tsx`.

## Phase 3: Option A Unified Studio Footer
- [x] **T3.1**: Implement Option A unified studio footer in `apps/web/src/components/workspace/workspace-studio-footer.tsx`, consolidating Workspace selection, User profile, Settings, Theme toggle, and Sign out into an upward-opening popover menu.
- [x] **T3.2**: Integrate Option A studio footer into `SidebarFooter` of `workspace-sidebar.tsx` with full testid backward compatibility.

## Phase 4: Verification & Documentation
- [x] **T4.1**: Update and expand tests in `apps/web/tests/ui/workspace-sidebar.test.tsx` and `workspace-breadcrumb.test.tsx`.
- [x] **T4.2**: Update roadmap and architectural documentation in `docs/foundational-knowledge.md`.
- [ ] **T4.3**: Commit, push branch, open PR, and monitor remote CI and SonarQube quality gates.
