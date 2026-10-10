# Implementation Plan: 025 Production Shadcn Sidebar Rebuild

**Branch**: `feat/025-production-shadcn-sidebar` | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)

---

## 1. Technical Context & Architecture

### Target Files
1. `apps/web/src/app/globals.css`:
   - Add dedicated shadcn-compatible sidebar CSS rules and state selectors (`[data-slot="sidebar"]`, `[data-slot="sidebar-gap"]`, `[data-slot="sidebar-container"]`, `[data-slot="sidebar-menu-button"]`, `[data-slot="sidebar-rail"]`, etc.) consuming the canonical theme CSS variables (`--bg-panel`, `--bg-hover`, `--bg-active`, `--text-main`, `--text-sub`, `--text-dim`, `--border-subtle`, `--primary`).
2. `apps/web/src/components/ui/sidebar.tsx` & `apps/web/src/components/ui/index.ts`:
   - Rebuild the sidebar component suite to match `https://ui.shadcn.com/docs/components/base/sidebar`:
     - `SidebarProvider`: Manages `state` (`expanded` | `collapsed`), `open`, `setOpen`, `openMobile`, `setOpenMobile`, `isMobile`, `toggleSidebar`, sets `--sidebar-width: 256px` (`16rem`) and `--sidebar-width-icon: 48px` (`3rem`) on `data-slot="sidebar-wrapper"`.
     - `Sidebar`: Two-layer desktop structure (`data-slot="sidebar-gap"` normal-flow width spacer + `data-slot="sidebar-container"` fixed full-height container + `data-sidebar="sidebar"` inner flex column) and mobile sheet drawer (`data-mobile="true"`). Crucially, `overflow: visible` on the container when collapsed or for popovers so tooltips, `SidebarRail`, and user dropdowns are never clipped.
     - `SidebarHeader` & `SidebarFooter`: `padding: 8px` (`SPACING.sm`), `gap: 8px` (`SPACING.sm`), flex column.
     - `SidebarContent`: `flex: 1`, `min-height: 0`, `overflow-y: auto` when expanded, `overflow: visible` when `collapsible="icon"` is collapsed so hover tooltips and popovers are never clipped by scroll containers.
     - `SidebarGroup`, `SidebarGroupLabel` (smoothly hides on icon collapse without rendering duplicate separator lines), `SidebarGroupAction`, `SidebarGroupContent`.
     - `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton` (`size`: `'default' | 'sm' | 'md' | 'lg'`, `variant`: `'default' | 'outline'`, `isActive`, `tooltip`, supports direct icon + `<span>` children as well as `leftIcon`/`rightIcon` props for backward compatibility; collapses cleanly to `32px × 32px` square in icon mode with `padding: 0` for `size="lg"`).
     - `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuSkeleton`, `SidebarInput`.
     - `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton` (`mx-3.5 px-2.5 py-0.5 border-l` nested tree structure, hidden in collapsed icon mode).
     - `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`: Accessible disclosure primitives with `data-state="open" | "closed"` for collapsible sidebar groups and nested submenus.
     - `SidebarRail`: `16px` wide interactive hit area (`-right-4`) along the sidebar edge with a `2px` centered hover line and `w-resize` / `e-resize` cursor.
     - `SidebarTrigger`: `28px`/`32px` ghost icon button rendering the canonical `PanelLeft` icon (`rect` + vertical divider path).
3. `apps/web/src/components/workspace/workspace-sidebar.tsx`:
   - `SidebarHeader`: `SidebarMenu > SidebarMenuItem > SidebarMenuButton size="lg"` (`TeamSwitcher` pattern) with `32px × 32px` (`RADII.md`) gold brand monogram, 2-line truncated workspace title (`{subdomain}` + `FBUploadPro`), and `ChevronsUpDown` icon.
   - `SidebarContent`:
     - `SidebarGroup` containing `SidebarMenu > SidebarMenuItem > SidebarMenuButton` for **Home** (`/tenant/[subdomain]`).
     - `SidebarSeparator` (`mx-2`).
     - `SidebarGroup` containing `SidebarMenu > Collapsible (defaultOpen) > SidebarMenuItem`:
       - `CollapsibleTrigger` wrapping `SidebarMenuButton` with Facebook icon, `<span>Facebook</span>`, and rotating `ChevronRight` (`transform: rotate(90deg)` when open).
       - `CollapsibleContent` wrapping `SidebarMenuSub > SidebarMenuSubItem > SidebarMenuSubButton` for **Accounts** (`/tenant/[subdomain]/accounts`).
   - `SidebarFooter`: `WorkspaceUserMenu` (`NavUser` pattern).
   - `SidebarRail`: Interactive edge rail.
4. `apps/web/src/components/workspace/workspace-user-menu.tsx`:
   - Built with `SidebarMenu > SidebarMenuItem > SidebarMenuButton size="lg"` (`data-testid="workspace-user-caret"`).
   - Contains `32px × 32px` (`RADII.md`) avatar (`data-testid="workspace-user-avatar"`), 2-line truncated user name and email, and `ChevronsUpDown` icon (`size-4 ml-auto`).
   - Clicking anywhere on the button toggles the floating dropdown menu (`data-testid="workspace-user-popover"`), positioned to the right of the sidebar on desktop (`left: calc(100% + 8px); bottom: 0; width: 240px`) and above the footer on mobile (`bottom: calc(100% + 8px); left: 0; right: 0`), with identity header, theme toggle (`Dark` / `Light`), and `Sign out`.
5. `apps/web/src/components/workspace/mobile-nav-trigger.tsx` & `apps/web/src/app/tenant/[subdomain]/layout.tsx`:
   - Render the shadcn `SidebarTrigger` (`PanelLeft` icon button) cleanly in the workspace so both desktop and mobile users have a visible 1-click toggle button in addition to `SidebarRail` and `Cmd/Ctrl+B`.

---

## 2. Constitution Check

- **Principle I (SDD & TDD)**: Spec 025 artifacts (`spec.md`, `plan.md`, `checklists/`, `tasks.md`) created before code changes; unit tests updated/expanded in `apps/web/tests/ui/`.
- **Principle V (Atomic PRs)**: Focused frontend changes in `apps/web` with `constitution.md` and `docs/foundational-knowledge.md` included in the same PR.
- **Principle 8 (Theme Token Authority & `DESIGN.md` Immutability)**: `DESIGN.md` is untouched. All colors, borders, radii, spacing, and shadows reference `apps/web/src/lib/theme.ts` and `apps/web/src/app/globals.css`.
- **Principle 13 (Production Shadcn Sidebar Architecture)**: 100% compliance with two-layer fixed+gap layout, `Collapsible` `SidebarMenuSub`, `TeamSwitcher`/`NavUser` `size="lg"` pattern, and desktop+mobile `SidebarTrigger`.
