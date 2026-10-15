# Feature Specification: Multi-Platform Sidebar Sections & Placeholder Workspaces

**Feature Branch**: `feat/047-platform-sidebar-sections`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: "hey now i want instagram,threads,X(twitter),tiktok,youtube sidebar sections like facebook and a accounts sub section below everyone of them leave them empty for now and add space holder text saying being tested not available for public use in the sidebar implement using SDD"

## Clarifications

### Session 2026-10-15
- Q: How should clicking the new 'Accounts' sub-items behave while these platforms are in testing? → A: Navigate to dedicated placeholder routes (e.g. /tenant/[subdomain]/[platform]/accounts) showing an empty state view with the placeholder notice.
- Q: What should be the default expanded/collapsed state for the new platform sections in the sidebar? → A: Keep the 5 new platform sections collapsed by default to maintain a clean, compact sidebar, while keeping Facebook open.


## User Scenarios & Testing *(mandatory)*

### User Story 1 - Multi-Platform Collapsible Sidebar Sections (Priority: P1)

As a workspace team member, I want to see dedicated sections in the workspace sidebar for Instagram, Threads, X (Twitter), TikTok, and YouTube in addition to Facebook under the Platform group, so that I can see the expanded multi-platform publishing suite supported by the application.

**Why this priority**: Establishes the core navigational structure and visual presence of all major social media platforms in the primary workspace shell, aligning with the platform expansion roadmap.

**Independent Test**: Can be fully tested by opening any workspace view and verifying that the sidebar displays Instagram, Threads, X (Twitter), TikTok, and YouTube collapsible platform menus with respective brand-accurate iconography below Facebook.

**Acceptance Scenarios**:

1. **Given** a user is logged into their workspace (`/tenant/[subdomain]`), **When** viewing the sidebar under the "Platform" section label, **Then** five new platform groups are displayed below Facebook: Instagram, Threads, X (Twitter), TikTok, and YouTube.
2. **Given** the workspace sidebar loads, **When** inspected initially, **Then** Facebook remains open (`defaultOpen={true}`) while the five new platform sections are collapsed by default (`defaultOpen={false}`) to preserve vertical hierarchy and clean scanning.
3. **Given** any of the collapsed platform sections, **When** the user clicks the platform trigger button, **Then** the collapsible menu expands smoothly with its chevron rotating 90 degrees, revealing its sub-menu.

---

### User Story 2 - Platform Accounts Sub-Item & In-Sidebar Status Note (Priority: P1)

As a workspace team member, I want each upcoming platform section to feature an "Accounts" sub-item accompanied by clear in-sidebar placeholder text stating that the integration is currently being tested and not available for public use, so that I understand its current readiness without confusion.

**Why this priority**: Prevents user confusion about feature readiness by explicitly setting clear expectations directly within the sidebar navigation.

**Independent Test**: Can be fully tested by expanding any of the five new platform sections in the sidebar and verifying the presence of the "Accounts" sub-button and the placeholder note "Being tested — not available for public use".

**Acceptance Scenarios**:

1. **Given** an expanded platform menu (Instagram, Threads, X (Twitter), TikTok, or YouTube), **When** viewing the sub-menu items, **Then** an "Accounts" sub-menu item is rendered.
2. **Given** an expanded platform sub-menu, **When** viewing below or alongside the Accounts sub-item, **Then** a clean, muted helper note is rendered with the exact message: "Being tested — not available for public use".
3. **Given** the sidebar is collapsed into icon-only mode (`collapsible="icon"`), **When** hovering over any of the new platform icons, **Then** a tooltip appears displaying the platform name and testing status note.

---

### User Story 3 - Dedicated Placeholder Accounts Route & Empty State View (Priority: P2)

As a workspace team member, I want clicking the "Accounts" sub-item for an upcoming platform to navigate to a dedicated workspace route (`/tenant/[subdomain]/[platform]/accounts`) that renders a professional placeholder empty state view, so that the URL is shareable and the application does not trigger 404 errors.

**Why this priority**: Fulfills the explicit user confirmation that sub-items should navigate to dedicated placeholder routes showing an empty state view with the placeholder notice.

**Independent Test**: Can be fully tested by clicking "Accounts" under Instagram, Threads, X (Twitter), TikTok, or YouTube and verifying that the browser navigates to `/tenant/[subdomain]/[platform]/accounts` and displays a centered empty state card with the testing notice and link back to Home.

**Acceptance Scenarios**:

1. **Given** the user clicks "Accounts" under Instagram, **When** navigation executes, **Then** the URL updates to `/tenant/[subdomain]/instagram/accounts` and the Instagram sidebar item marks its active state.
2. **Given** the user navigates directly to `/tenant/[subdomain]/[platform]/accounts` (where `platform` is `instagram`, `threads`, `twitter` or `x`, `tiktok`, or `youtube`), **When** the page renders, **Then** a polished, empty state view is displayed explaining that the platform account integration is actively undergoing testing and will be released for public use once testing completes.
3. **Given** the placeholder route is displayed, **When** the user clicks "Return to Overview" or "Go to Home", **Then** the application navigates back to `/tenant/[subdomain]`.

---

### Edge Cases

- **Sidebar Collapsed into Icon Mode**: When the user collapses the sidebar into icon rail mode (`state === 'collapsed'`), clicking a platform icon navigates directly to that platform's accounts placeholder route, matching the behavior of the Facebook icon button.
- **Direct Deep-Linking**: When a user accesses `/tenant/[subdomain]/[platform]/accounts` directly via URL or bookmark, the sidebar automatically highlights that platform and sub-item as active.
- **Mobile Drawer Navigation**: In mobile view (`isMobile === true`), clicking any platform Accounts sub-item closes the mobile sidebar drawer after triggering navigation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render collapsible sidebar entries for Facebook, Instagram, Threads, X (Twitter), TikTok, and YouTube in `WorkspaceSidebar` under the "Platform" section.
- **FR-002**: System MUST use 24x24 stroke-based SVG icons matching the design tokens (`currentColor`, 16x16 rendered size) for Instagram, Threads, X (Twitter), TikTok, and YouTube.
- **FR-003**: System MUST provide an "Accounts" sub-menu item within each platform's collapsible content.
- **FR-004**: System MUST display the in-sidebar placeholder text "Being tested — not available for public use" inside each upcoming platform's expanded sub-menu.
- **FR-005**: System MUST configure the five new platform menus to be collapsed by default (`defaultOpen={false}`), while keeping Facebook expanded by default (`defaultOpen={true}`).
- **FR-006**: System MUST create dedicated placeholder routes at `/tenant/[subdomain]/[platform]/accounts` (for `instagram`, `threads`, `x`, `tiktok`, `youtube`) rendering a clean empty state card with the testing notice.
- **FR-007**: System MUST highlight the respective platform trigger and sub-button with active styling (`isActive={true}` and `aria-current="page"`) when viewing that platform's placeholder route.

### Key Entities

- **PlatformIdentifier**: Enumerated string literal representing supported social channels: `'facebook' | 'instagram' | 'threads' | 'x' | 'tiktok' | 'youtube'`.
- **PlatformNavigationConfig**: Configuration object defining platform title, route segment, icon component, default expanded state, and availability status flag (`active | testing`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the requested platforms (Instagram, Threads, X (Twitter), TikTok, YouTube) are rendered in the sidebar with collapsible triggers and Accounts sub-items.
- **SC-002**: 100% of upcoming platform sub-menus display the exact placeholder text "Being tested — not available for public use".
- **SC-003**: 0% broken links (404s) when clicking any platform Accounts sub-item in the sidebar.
- **SC-004**: All sidebar items and placeholder pages pass WCAG 2.1 AA accessibility standards and adhere strictly to `apps/web/src/lib/theme.ts` tokens with 0 ad-hoc hex codes or capsule badges.

## Assumptions

- Route paths for the new platforms follow the canonical tenant pattern: `/tenant/[subdomain]/[platform]/accounts`.
- The slug for "X (Twitter)" route path is `x` (with `/tenant/[subdomain]/x/accounts`), while the user-visible label is "X (Twitter)".
- Accounts pages for upcoming platforms currently require no backend database tables, RPCs, or OAuth connections since they are in pre-release placeholder testing mode.
- Existing Facebook Accounts (`/tenant/[subdomain]/accounts`) and Pages (`/tenant/[subdomain]/pages`) remain completely intact with zero regressions.
