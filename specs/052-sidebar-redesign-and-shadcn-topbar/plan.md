# Technical Plan: Spec 052 Sidebar Redesign & Canonical Shadcn Topbar

## 1. Architectural Overview
This plan defines the architectural modifications required to resolve navigation latency, consolidate workspace & settings controls into the footer, anchor corporate branding at the top, and eliminate mobile/desktop layout shift using shadcn/ui primitives.

```
+-----------------------------------------------------------------------------------------+
|                                    SidebarProvider                                      |
|                                                                                         |
|  +---------------------------+  +----------------------------------------------------+  |
|  |     WorkspaceSidebar      |  |                    SidebarInset                    |  |
|  |                           |  |                                                    |  |
|  | [Header: FBUploadPro]     |  | [Header: <SidebarTrigger> | Divider | Breadcrumb]  |  |
|  | - Brand Mark + Wordmark   |  | - 44px height, hairline bottom border              |  |
|  | - Tooltip on collapsed    |  | - Visible on desktop, tablet, and mobile           |  |
|  |                           |  | - ZERO left margin shift or padding hack           |  |
|  | [Content: Nav Items]      |  |                                                    |  |
|  | - Home (0ms optimistic)   |  |                                                    |  |
|  | - Media Library (0ms)     |  |                                                    |  |
|  | - Downloader (0ms)        |  | [Page Content / {children}]                        |  |
|  | - Separator               |  | - Full width canvas                                |  |
|  | - Platform (Facebook etc) |  |                                                    |  |
|  |                           |  |                                                    |  |
|  | [Footer: Option A Card]   |  |                                                    |  |
|  | - Monogram + WS + User    |  |                                                    |  |
|  | - Upward Popover Menu:    |  |                                                    |  |
|  |   * User Profile Header   |  |                                                    |  |
|  |   * Workspace Switcher    |  |                                                    |  |
|  |   * Settings link         |  |                                                    |  |
|  |   * Dark / Light mode     |  |                                                    |  |
|  |   * Sign out              |  |                                                    |  |
|  +---------------------------+  +----------------------------------------------------+  |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Component Design & Changes

### A. `apps/web/src/app/globals.css`
- Delete `.workspace-mobile-gutter { padding-left: 56px !important; }`.
- Ensure standard fluid canvas sizing for mobile and desktop views.

### B. `apps/web/src/app/tenant/[subdomain]/layout.tsx`
- Remove `<MobileNavTrigger />` and the legacy `<header className="desktop-only" ...>` block.
- Replace with the canonical shadcn topbar inside `<SidebarInset>`:
  - `<header className="flex h-11 shrink-0 items-center gap-2 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]">`
  - `<SidebarTrigger className="-ml-1" />`
  - Subtle divider line
  - `<WorkspaceBreadcrumb subdomain={subdomain} />`
- Render `{children}` flush below the header.

### C. `apps/web/src/components/workspace/workspace-breadcrumb.tsx` (New Component)
- Pure client component reading `usePathname()`:
  - Decomposes pathname into segment trail.
  - Generates human-friendly labels (e.g., `acme` -> `Home`, `media` -> `Media Library`, `downloader` -> `Downloader`, `facebook` / `accounts` -> `Facebook` / `Accounts`, `pages` -> `Facebook` / `Pages`, `settings` -> `Settings`).
  - Renders accessible `<nav aria-label="Breadcrumb">` with chevrons and active page indicator.
  - Low cognitive complexity (<= 8).

### D. `apps/web/src/components/workspace/workspace-sidebar.tsx`
1. **0ms Optimistic Path State**:
   - `const [optimisticPathname, setOptimisticPathname] = useState<string | null>(null);`
   - Active path computation: `const activePath = optimisticPathname ?? pathname;`
   - Reset on pathname effect: `useEffect(() => setOptimisticPathname(null), [pathname]);`
   - `handleNavigate(href)` synchronously sets optimistic state, closes mobile drawer if applicable, and calls `router.push(href)`.
   - `onMouseEnter` calls `router.prefetch(href)` to pre-warm next page chunks.
2. **Top Section (`SidebarHeader`)**:
   - Brand logo mark with gold geometric polygon (`#fad734`), wordmark "FBUploadPro" and subtitle "Studio".
   - Links to `/tenant/{subdomain}`.
   - Gracefully renders icon-only when collapsed.
3. **Middle Section (`SidebarContent`)**:
   - Exact preserved structure and ordering:
     - Primary: `Home`, `Media Library`, `Downloader`.
     - `SidebarSeparator`.
     - Collapsible `Platform`: `Facebook` (`Accounts`, `Pages`), followed by upcoming platforms (`Instagram`, `Threads`, `X (Twitter)`, `TikTok`, `YouTube`).
4. **Bottom Section (`SidebarFooter`)**:
   - Implements **Option A Unified Studio Card** via `WorkspaceStudioFooter` or unified switcher/footer component.
   - Combines workspace switcher, user menu, theme toggle, settings link, and sign out into a single trigger and upward popover.
   - Keeps all previous `data-testid` attributes (`workspace-switcher-trigger`, `workspace-user-menu-trigger`, `workspace-switcher-dropdown`, `create-workspace-button`, `theme-toggle-button`, `logout-button`).

### E. Cognitive Complexity Compliance
- Split helpers into pure functions outside components:
  - `computeBreadcrumbs(pathname: string, subdomain: string)`
  - `getMonogram(name: string)`
  - `getInitials(name: string)`
  - `resolveActiveWorkspace(workspaces: WorkspaceItem[], currentSubdomain: string)`
- Guaranteed complexity <= 15 for SonarQube quality gate.
