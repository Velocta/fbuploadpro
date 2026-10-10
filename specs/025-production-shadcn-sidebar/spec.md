# Feature Specification: 025 Production Shadcn Sidebar Rebuild

**Feature Branch**: `feat/025-production-shadcn-sidebar`  
**Created**: 2026-10-10  
**Status**: Approved  
**Input**: User request: "https://ui.shadcn.com/docs/components/base/sidebar i wanted a proper production grade sidebar and AI built me a slop please check and build properly i want this shadcn sidebar build using SDD and read your agents.md file for rules"

---

## 1. Executive Summary

This specification remediates all structural, visual, and behavioral flaws in the previous sidebar implementation and delivers a true **production-grade Shadcn UI Sidebar** (`https://ui.shadcn.com/docs/components/base/sidebar`) tailored to FBUploadPro's theme tokens (`apps/web/src/lib/theme.ts` and `apps/web/src/app/globals.css`).

### Root Cause Audit of Previous Implementation Flaws
1. **Fatal `overflow: hidden` Clipping**: The previous `<Sidebar>` rendered a single `<aside style={{ overflow: 'hidden' }}>`, which clipped tooltips in collapsed icon mode (`48px`), clipped the `WorkspaceUserMenu` popover (`left: 52px`), and clipped the `SidebarRail`.
2. **Missing Shadcn Two-Layer Fixed + Gap Architecture**: Official `shadcn/ui` renders a normal-flow `data-slot="sidebar-gap"` spacer div alongside a `fixed inset-y-0 z-10 h-svh` `data-slot="sidebar-container"` holding `data-sidebar="sidebar"`.
3. **Broken Dual-Theme Reactivity**: Previous components bound inline styles to static `THEME.default` (Dark Mode hexes) instead of reactive CSS custom properties (`var(--bg-panel)`, `var(--text-main)`, `var(--border-subtle)`, etc.), causing the sidebar to remain pitch black when the user toggled Light Mode.
4. **Non-Standard Geometry & Header/Footer Slop**:
   - `SidebarHeader` and `SidebarFooter` had full-bleed borders and arbitrary padding instead of shadcn's `p-2 gap-2` layout where `48px` icon rail minus `2 × 8px` padding leaves an exact `32px × 32px` (`size-8`) square for collapsed buttons.
   - `SidebarGroupLabel` turned into a duplicate `1px` line when collapsed instead of smoothly collapsing with `-mt-8 opacity-0`.
   - `WorkspaceSidebar` did not use `SidebarMenu > SidebarMenuItem > SidebarMenuButton (size="lg")` for the workspace header or user footer, and only a tiny `24px` caret icon was clickable in the footer.
5. **Missing Collapsible `SidebarMenuSub` Hierarchy & Primitives**:
   - "Facebook -> Accounts" did not use shadcn's `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent` + `SidebarMenuSub` hierarchy with a rotating `ChevronRight`.
   - `SidebarInput`, `SidebarMenuSkeleton`, and `Collapsible` primitives were missing.
   - `SidebarTrigger` (`PanelLeft` icon button) was completely absent on desktop viewports.

---

## 2. Clarifications (Pre-Flight Interview `/grill-me` — 2026-10-10)

- **Q1: Navigation Hierarchy Structure**:
  - **Decision**: Use the authentic shadcn `Collapsible` `SidebarMenuSub` pattern: "Home" top item, `SidebarSeparator`, and a collapsible "Facebook" parent item with rotating `ChevronRight` that expands into a nested `SidebarMenuSub` with "Accounts".
- **Q2: Workspace Header & Footer User Menu Composition**:
  - **Decision**: Match shadcn's `TeamSwitcher` & `NavUser` pattern: wrap both header and footer in `SidebarMenu > SidebarMenuItem > SidebarMenuButton (size="lg")` with `32px` (`size-8`) `rounded-lg` icon/avatar, two-line text (`truncate font-semibold` + `truncate text-xs`), and `ChevronsUpDown` trigger opening an unclipped floating dropdown menu.
- **Q3: Desktop Collapse Trigger Placement**:
  - **Decision**: Render the standard shadcn `SidebarTrigger` (`PanelLeft` icon button) on both desktop and mobile alongside the interactive `SidebarRail` edge and `Cmd/Ctrl+B` shortcut.

---

## 3. User Scenarios & Acceptance Criteria

### User Story 1 - Authentic Shadcn Sidebar Layout, Icon Collapse & Unclipped Overlays (Priority: P1) 🎯 MVP

As an operator on desktop, I want the sidebar to use the exact shadcn two-layer fixed container + flow gap architecture with `SidebarTrigger` (`PanelLeft`), `SidebarRail`, and `Cmd/Ctrl+B`, collapsing cleanly from `256px` (`16rem`) to a `48px` (`3rem`) icon rail where buttons become `32px × 32px` squares and tooltips/dropdowns are never clipped.

**Acceptance Scenarios**:
1. **Given** an expanded desktop sidebar (`256px`), **When** toggled via `SidebarTrigger`, `SidebarRail`, or `Cmd/Ctrl+B`, **Then** both `data-slot="sidebar-gap"` and `data-slot="sidebar-container"` transition smoothly (`200ms ease-linear`) to `48px` (`3rem`).
2. **Given** the collapsed `48px` icon rail, **When** hovering over any `SidebarMenuButton` with a `tooltip`, **Then** the tooltip renders to the right of the sidebar completely unclipped.
3. **Given** the `SidebarHeader` and `SidebarFooter` in collapsed `48px` mode, **When** rendered with `SidebarMenuButton size="lg"`, **Then** the button collapses to an exact `32px × 32px` square (`padding: 0`) centered inside the `8px` padded container.

---

### User Story 2 - Collapsible `SidebarMenuSub` Navigation for Home & Facebook -> Accounts (Priority: P1) 🎯 MVP

As an operator navigating my workspace, I want "Home" as a top menu item, a `SidebarSeparator`, and "Facebook" as a collapsible menu item with a rotating `ChevronRight` that reveals "Accounts" inside `SidebarMenuSub`.

**Acceptance Scenarios**:
1. **Given** `WorkspaceSidebar`, **When** rendered, **Then** "Home" renders inside `SidebarGroup > SidebarMenu > SidebarMenuItem > SidebarMenuButton`, followed by `SidebarSeparator`.
2. **Given** the "Facebook" section, **When** rendered, **Then** it uses `Collapsible` (default open) wrapping `SidebarMenuItem`, with `CollapsibleTrigger` rendering a `SidebarMenuButton` containing the Facebook icon, `"Facebook"` label, and a `ChevronRight` icon that rotates `90deg` when open.
3. **Given** the open "Facebook" collapsible item, **When** expanded, **Then** `CollapsibleContent` renders `SidebarMenuSub > SidebarMenuSubItem > SidebarMenuSubButton` for `"Accounts"` with a `1px` left border guide (`border-subtle`).

---

### User Story 3 - Shadcn `TeamSwitcher` Header & `NavUser` Footer with Unclipped Floating Dropdown (Priority: P1) 🎯 MVP

As an operator, I want the workspace header and bottom user profile to use `SidebarMenu > SidebarMenuItem > SidebarMenuButton size="lg"` with a `32px` (`size-8`) rounded square badge/avatar, 2-line truncated text, and `ChevronsUpDown` icon, where clicking anywhere on the user button opens an unclipped floating dropdown menu.

**Acceptance Scenarios**:
1. **Given** `SidebarHeader` in `WorkspaceSidebar`, **When** rendered, **Then** it renders `SidebarMenu > SidebarMenuItem > SidebarMenuButton size="lg"` with a `32px × 32px` (`RADII.md`) gold brand square, two-line workspace title (`{subdomain}` + `FBUploadPro`), and `ChevronsUpDown` icon.
2. **Given** `SidebarFooter` in `WorkspaceUserMenu`, **When** rendered, **Then** the entire user profile row is a single `SidebarMenuButton size="lg"` (`data-testid="workspace-user-caret"`) with a `32px × 32px` rounded avatar (`data-testid="workspace-user-avatar"`), two-line name/email, and `ChevronsUpDown` icon.
3. **Given** clicking the user profile button in either expanded or collapsed desktop mode, **When** opened, **Then** the dropdown popover (`data-testid="workspace-user-popover"`) anchors cleanly to the right side of the sidebar (`left: calc(100% + 8px)`, `bottom: 0`, `min-width: 224px`) without being clipped by any parent overflow container.
4. **Given** clicking the Theme toggle (`data-testid="workspace-theme-toggle"`) inside the user menu, **When** switched between Dark and Light mode, **Then** the entire sidebar, borders, hover states, and canvas immediately update via CSS custom properties.

---

### User Story 4 - Desktop & Mobile `SidebarTrigger` + Responsive Sheet Drawer (Priority: P2)

As a user on both desktop and mobile viewports, I want a clean `SidebarTrigger` (`PanelLeft` icon button) accessible in the workspace layout alongside the mobile slide-over sheet drawer.

**Acceptance Scenarios**:
1. **Given** desktop or mobile viewport, **When** viewing the workspace, **Then** `SidebarTrigger` (`PanelLeft` icon) is visible and toggles the sidebar (`open` on desktop, `openMobile` sheet drawer on `<768px`).
2. **Given** mobile viewport (`<768px`), **When** `openMobile` is true, **Then** the sidebar slides out as a `288px` (`18rem`) sheet drawer over a blurred backdrop and closes automatically on link navigation, backdrop click, or `Escape`.

---

## 4. Functional Requirements

- **FR-001**: Implement full shadcn primitive export parity in `apps/web/src/components/ui/sidebar.tsx`: `SidebarProvider`, `Sidebar`, `SidebarTrigger`, `SidebarRail`, `SidebarInset`, `SidebarInput`, `SidebarHeader`, `SidebarFooter`, `SidebarSeparator`, `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupAction`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuSkeleton`, `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton`, `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`, and `useSidebar`.
- **FR-002**: Bind all sidebar surfaces, text, and borders to reactive CSS custom properties (`var(--bg-panel)`, `var(--bg-canvas)`, `var(--bg-subtle)`, `var(--bg-hover)`, `var(--bg-active)`, `var(--text-main)`, `var(--text-sub)`, `var(--text-dim)`, `var(--border-subtle)`, `var(--border-strong)`) defined in `globals.css` and `theme.ts`.
- **FR-003**: Support `render` / `asChild` composition or polymorphic rendering on `SidebarMenuButton`, `SidebarMenuSubButton`, `SidebarGroupLabel`, `SidebarGroupAction`, and `SidebarMenuAction`, while retaining backward compatibility with existing props (`leftIcon`, `rightIcon`, `tooltip`).
- **FR-004**: Ensure zero overflow clipping on tooltips, `SidebarRail`, and `WorkspaceUserMenu` dropdown popovers in both expanded (`256px`) and collapsed (`48px`) states.
