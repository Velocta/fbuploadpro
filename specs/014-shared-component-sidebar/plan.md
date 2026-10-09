# Implementation Plan: Shared Shadcn-Compatible Sidebar Component

**Branch**: `feat/014-shared-component-sidebar` | **Date**: 2026-10-09 | **Spec**: [specs/014-shared-component-sidebar/spec.md](spec.md)

---

## 1. Summary

This plan details the implementation of a modular, accessible, Shadcn-compatible Sidebar component suite in `@fbuploadpro/web` (`apps/web/src/components/ui/sidebar.tsx`), fully integrated with canonical theme tokens (`apps/web/src/lib/theme.ts`) and tested in the UI Showroom (`apps/showroom`).

Key capabilities:
1. `SidebarProvider` managing expanded/collapsed state, mobile sheet visibility, `isMobile` media query, `sidebar_state` cookie persistence, and `Cmd+B` / `Ctrl+B` keyboard toggle.
2. `Sidebar` supporting collapsible icon rail (`48px` width) on desktop and slide-over overlay drawer on mobile viewports.
3. Full primitive ecosystem: Header, Content, Footer, Inset, Groups, Menus, Actions, Badges, Submenus, Rail, and Trigger.
4. UI Showroom interactive mock in `apps/showroom` showcasing an authentic FBUploadPro navigation hierarchy with theme switching.

---

## 2. Technical Context & Constitution Compliance

- **Framework**: Next.js 16 (App Router) + React 19 (`apps/web`). Event-driven state updates, zero `set-state-in-effect`.
- **Theme Authority**: `apps/web/src/lib/theme.ts` & `apps/web/src/app/globals.css`. Strict adherence to 8-color palette, 1px neutral hairlines (`#1f242d`), unboxed 6px luminous dots (`STATUS_SIGNALS`), and zero capsule pills.
- **Showroom Isolation**: Showroom previews reside strictly in `apps/showroom` (zero mock code inside `apps/web`).
- **Testing**: Vitest + React Testing Library (`apps/web/tests/ui/sidebar.test.tsx`).
- **Quality Gate**: `pnpm turbo run build lint typecheck test` must pass 100% with zero errors.

---

## 3. Architecture & File Structure

```text
apps/web/
├── src/
│   ├── components/
│   │   └── ui/
│   │       ├── sidebar.tsx             # Complete Shadcn-compatible Sidebar suite
│   │       └── index.ts                # Barrel export for all sidebar primitives
│   └── lib/
│       └── theme.ts                    # Canonical theme tokens & style presets
└── tests/
    └── ui/
        └── sidebar.test.tsx            # Unit & interaction tests for sidebar suite

apps/showroom/
└── src/
    └── app/
        ├── page.tsx                    # Updated showroom home with navigation to /sidebar
        └── sidebar/
            └── page.tsx                # Interactive FBUploadPro workspace showcase
```

---

## 4. Component Hierarchy & API Design

### A. Context & Provider (`SidebarProvider`)
```tsx
interface SidebarContextValue {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean | ((value: boolean) => boolean)) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean | ((value: boolean) => boolean)) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
}

interface SidebarProviderProps {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}
```
- Cookie persistence: writes `sidebar_state=expanded|collapsed; path=/; max-age=604800; SameSite=Lax`.
- Keyboard listener: `keydown` for `(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b'`.
- Responsive breakpoint: `768px`.

### B. Shell & Layout (`Sidebar`, `SidebarInset`)
```tsx
interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'left' | 'right';
  variant?: 'sidebar' | 'floating' | 'inset';
  collapsible?: 'offcanvas' | 'icon' | 'none';
}
```
- Desktop: `collapsible="icon"` shifts width from `256px` to `48px` (`transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1)`).
- Mobile: Off-canvas drawer sliding from screen edge with backdrop overlay (`rgba(0, 0, 0, 0.6)`).

### C. Sections & Groups
- `SidebarHeader`: Pinned top container.
- `SidebarContent`: Flex-1 scrollable viewport with subtle hairline styling.
- `SidebarFooter`: Pinned bottom container.
- `SidebarGroup`: Semantic navigation grouping.
- `SidebarGroupLabel`: Section title; hidden in icon rail mode.
- `SidebarGroupAction`: Action icon on group label.
- `SidebarGroupContent`: Container for menus.

### D. Menus, Actions, & Badges
- `SidebarMenu`: Semantic `<ul>`.
- `SidebarMenuItem`: Semantic `<li>`.
- `SidebarMenuButton`: Interactive item button.
  - Supports `isActive`, `size` (`sm` | `md` | `lg`), `tooltip`.
  - In collapsed icon mode, integrates with `Tooltip` from Spec 008.
- `SidebarMenuAction`: Action button inside an item.
- `SidebarMenuBadge`: Subdued metadata badge (NO capsule pills; crisp geometric counter).
- `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton`: Nested child links with 1px hairline guide line.
- `SidebarRail`: Interactive hover border enabling one-click expansion.
- `SidebarTrigger`: Toggle button calling `toggleSidebar()`.

---

## 5. UI Showroom Implementation

Create `apps/showroom/src/app/sidebar/page.tsx`:
- Authentic FBUploadPro Workspace Layout:
  - Header: Team Workspace switcher ("Vinsmoke Media" with unboxed 6px luminous operational dot).
  - Group 1 (Publishing): Dashboard, Facebook Pages, Media Library, Queue / Schedule.
  - Group 2 (Analytics): Performance Insights, Audience Reports.
  - Group 3 (Settings): Page Connections, API Tokens, Preferences.
  - Footer: User profile card ("Alex Vinsmoke", Account Settings, Sign Out).
- Interactive Showroom Controls:
  - Toggle desktop/mobile preview.
  - Toggle standard vs. inset variant.
  - Dark / Light theme mode switcher.

---

## 6. Testing Strategy

1. **Context & State Transitions**:
   - `SidebarProvider` mounts with `defaultOpen={true}`.
   - `toggleSidebar()` flips state to `collapsed`.
   - Cookie is updated with `sidebar_state=collapsed`.
2. **Keyboard Shortcut**:
   - Firing `keydown` event with `metaKey: true, key: 'b'` triggers state toggle.
3. **Responsive Mobile Mode**:
   - Window width < 768px triggers mobile mode.
   - `toggleSidebar()` sets `openMobile: true`.
   - Backdrop click closes mobile drawer.
4. **Theme & Token Compliance**:
   - Visual inspection and snapshot verification that only `apps/web/src/lib/theme.ts` tokens are utilized.
