# Spec 052: Workspace Sidebar Redesign, Unified Studio Footer & Zero-Shift Shadcn Topbar

## 1. Executive Summary
This specification addresses three critical UX and visual layout problems in the FBUploadPro workspace navigation interface:
1. **Selection Latency (0ms Responsive Feedback)**: Clicking any sidebar navigation link previously exhibited visible latency (stuck state) due to asynchronous Next.js route transitions. Spec 052 introduces synchronous optimistic path state and hover route prefetching for immediate, instantaneous visual feedback.
2. **Information Architecture Rebalance (Option A Unified Footer & Dedicated Top Branding)**:
   - The top section (`SidebarHeader`) is transformed into a dedicated brand anchor showcasing the FBUploadPro geometric gold mark and typography.
   - The bottom section (`SidebarFooter`) implements **Option A**, consolidating Workspace switching, User profile identity, and Platform Settings into a single unified Studio card with an upward popover menu.
   - The middle section (`SidebarContent`) preserves 100% of the loved hierarchical collapsible platform structure (Facebook -> Accounts, Pages, upcoming platforms, Media Library, Downloader).
3. **Elimination of Mobile & Desktop Layout Shift (Canonical Shadcn Topbar)**:
   - Eliminates the legacy mobile `padding-left: 56px !important` CSS hack that indented mobile pages into an awkward blank gutter.
   - Removes the floating `MobileNavTrigger` and the desktop-only 48px empty bar.
   - Implements the canonical shadcn/ui `SidebarInset` top header with `<SidebarTrigger />`, vertical separator, and dynamic `WorkspaceBreadcrumb`, ensuring seamless zero-shift alignment across mobile, tablet, and collapsed desktop screens.

---

## 2. User Stories & Acceptance Criteria

### User Story 1: Zero-Latency Navigation Feedback (P1)
**As a** creator managing multi-channel workflows,  
**I want** the sidebar menu items to highlight immediately upon clicking,  
**So that** the interface feels exceptionally fast, fluid, and responsive without feeling frozen or stuck.

- **Acceptance Criteria**:
  - Clicking any navigation item (`Home`, `Media Library`, `Downloader`, `Accounts`, `Pages`, `Upcoming Platforms`) updates the active highlight in **0ms** via synchronous optimistic state.
  - Hovering over navigation items invokes `router.prefetch(href)` to warm up the route bundle.
  - Once the Next.js `pathname` transition completes, optimistic state safely clears with zero flickering.
  - On mobile screens, clicking a navigation link closes the mobile drawer immediately while initiating navigation.

### User Story 2: Dedicated Top Brand Anchor (P1)
**As a** user operating in the workspace,  
**I want** the top of the sidebar to anchor the official FBUploadPro brand identity,  
**So that** the application has clear, polished corporate framing.

- **Acceptance Criteria**:
  - `SidebarHeader` displays the geometric gold FBUploadPro brand mark (`#fad734`) with sharp typography ("FBUploadPro" + "Studio" badge).
  - In collapsed icon mode, the branding gracefully contracts to show solely the luminous brand mark centered in the 48px rail.
  - Clicking the brand mark navigates to the tenant home (`/tenant/{subdomain}`).

### User Story 3: Preserved Platform Hierarchy & Navigation Integrity (P1)
**As a** user navigating social accounts and tools,  
**I want** the middle navigation section to keep the exact current structure, collapsible categories, and platforms,  
**So that** my workflow muscle memory is fully honored.

- **Acceptance Criteria**:
  - Order is strictly maintained: `Home` -> `Media Library` -> `Downloader` -> `SidebarSeparator` -> `Platform` (`Facebook` collapsible -> `Accounts`, `Pages`) -> Upcoming platforms (`Instagram`, `Threads`, `X (Twitter)`, `TikTok`, `YouTube`).
  - Upcoming platforms maintain their "Being tested — not available for public use" note.

### User Story 4: Option A Unified Studio Footer (Workspace + Settings + User) (P1)
**As a** workspace member,  
**I want** a consolidated Studio footer card combining workspace switching, account identity, and settings,  
**So that** secondary management controls are compactly grouped together at the bottom without cluttering primary platform tools.

- **Acceptance Criteria**:
  - In expanded state, `SidebarFooter` presents an interactive card with workspace monogram, workspace title, user email, and a `ChevronsUpDown` icon.
  - In collapsed state, presents the active monogram avatar with tooltip.
  - Clicking opens an upward-oriented popover containing:
    1. User profile header (Name, email, avatar).
    2. Workspaces list with active indicator and "+ Create Workspace" trigger.
    3. Settings navigation button (`/tenant/{subdomain}/settings`).
    4. Dark / Light mode toggle.
    5. Sign out button with session cleanup and auth event broadcast.
  - Meets all existing testids (`workspace-switcher-trigger`, `workspace-switcher-dropdown`, `create-workspace-button`, `theme-toggle-button`, `logout-button`).

### User Story 5: Canonical Zero-Shift Shadcn Topbar (Mobile & Desktop) (P1)
**As a** mobile or desktop user,  
**I want** the sidebar toggle button to integrate into a standard top header with breadcrumbs,  
**So that** the page canvas never suffers from awkward 56px left indentation or layout shift.

- **Acceptance Criteria**:
  - `.workspace-mobile-gutter` (`padding-left: 56px !important`) is permanently removed from `globals.css`.
  - Floating `MobileNavTrigger` is removed from `layout.tsx`.
  - `SidebarInset` incorporates an integrated 44px top `<header>`:
    - Left: `<SidebarTrigger />` (accessible on both mobile and collapsed desktop).
    - Middle: Subtle vertical hairline divider.
    - Right: Dynamic `WorkspaceBreadcrumb` displaying hierarchical trail (e.g. `acme / Facebook / Pages`).
  - Canvas content renders with zero left margin gap on all screen viewports.

---

## 3. Non-Functional & Quality Requirements
- **Theme Consistency**: 100% theme token compliance from `@web/lib/theme` and `globals.css`. No hardcoded hex values or capsule pill badges. `DESIGN.md` remains strictly untouched.
- **Cognitive Complexity**: All exported and internal functions must have a cyclomatic/cognitive complexity <= 15. Helper routines must be decomposed into pure functions outside components.
- **Zero Mock Theater**: Unit tests must exercise real DOM rendering and state transitions via Vitest.
