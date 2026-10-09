# Feature Specification: 019 Workspace Pure Sidebar-Only App Shell

**Feature ID**: `019-workspace-app-shell`  
**Created**: 2026-10-09  
**Status**: Ready for Planning  
**Input**: User directives: "Pure Sidebar-Only Shell (Linear/Stripe style): All navigation, workspace switching, and profile actions live exclusively in the sidebar, giving the main content 100% full-height bleed with no top bar. For now have only home and Facebook section make Facebook heading and Accounts it's sub section and add a separate line between home and Facebook we are using shadcn sidebar it has all those features check it's documentation I also want a bottom user name and email with a ^ type of button upon clicking it should have signout button. Complete Profile & Controls: User profile (name/email), Theme switcher (Dark/Light mode), and Sign Out action. Floating Corner Button: A discreet, theme-styled button in the top-left corner visible only on mobile screens (<768px) to open the sidebar drawer."

---

## 1. Executive Summary

This specification establishes the modern, pure sidebar-only App Shell architecture for FBUploadPro's tenant workspaces (`/tenant/[subdomain]`). Following Linear and Stripe design benchmarks, the workspace eliminates distracting top horizontal header bars on desktop, dedicating 100% of vertical viewport real estate to publisher content and workflows.

The application chrome is completely unified within the collapsible shadcn-compatible sidebar:
1. **Workspace Header**: Displays workspace organization branding and subdomain identity.
2. **Primary Navigation**: Houses the initial operational items:
   - **Home** (`/tenant/[subdomain]`)
   - **Hairline Separator**: Visual boundary (`SidebarSeparator`)
   - **Facebook Section**: Section heading with collapsible/nested **Accounts** (`/tenant/[subdomain]/accounts` or modal/tab target)
3. **Bottom Profile & Control Anchor**: Displays the signed-in user's name and email, with a chevron-up (`^`) trigger button that toggles an accessible popover containing theme switching and a one-click Sign Out action.
4. **Mobile Navigation**: Features a discreet, floating theme-styled trigger button in the top-left corner visible only on small viewports (<768px) that effortlessly slides out the sidebar drawer sheet with zero layout clutter.

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1 - Headerless Desktop Canvas & Layout Integration (Priority: P1) 🎯 MVP

As an operator working in my tenant workspace on desktop, I want 100% of the viewport height available for content without an obsolete top navigation header, so that I have maximum screen real estate for publishing workflows, media assets, and data views.

**Why this priority**: Foundational layout structure. Establishes the modern Linear/Stripe design standard for the entire application.

**Independent Test**: Can be validated by loading `/tenant/[subdomain]` in a desktop viewport (>1024px), verifying that the page renders with the sidebar docked on the left, zero top header bar exists across the main content area, and the main canvas spans `100vh` with independent vertical scrolling.

**Acceptance Scenarios**:
1. **Given** an authenticated user accessing `/tenant/[subdomain]` on desktop, **When** the page renders, **Then** the sidebar is positioned on the left and the main content area occupies full remaining width and 100% viewport height with zero horizontal header above it.
2. **Given** long content on a tenant page, **When** the user scrolls, **Then** the content scrolls smoothly within the main canvas (`SidebarInset`) while the sidebar remains fixed in place.
3. **Given** dual-theme styling, **When** rendering the shell, **Then** all surfaces, borders, and typography strictly adhere to theme tokens from `apps/web/src/lib/theme.ts`.

---

### User Story 2 - Primary Navigation Structure with Home & Facebook Accounts (Priority: P1) 🎯 MVP

As an operator navigating my workspace, I want a clean, organized sidebar menu featuring Home, a clear divider line, and a Facebook section with an Accounts sub-item, so that I can quickly navigate between my workspace home and connected social accounts.

**Why this priority**: Primary navigational utility. Provides clear orientation without cognitive clutter.

**Independent Test**: Can be validated by inspecting the sidebar menu items, verifying "Home" is active on `/tenant/[subdomain]`, confirming the `SidebarSeparator` renders cleanly between sections, and verifying the "Facebook" section header displays with the "Accounts" sub-item below it.

**Acceptance Scenarios**:
1. **Given** the expanded sidebar, **When** viewing the navigation menu, **Then** "Home" is listed at the top with an appropriate icon and active state indicator.
2. **Given** the space between "Home" and "Facebook", **When** rendered, **Then** a clean 1px hairline `SidebarSeparator` divides the two sections.
3. **Given** the "Facebook" section, **When** rendered, **Then** "Facebook" appears as a section heading (`SidebarGroupLabel`), and "Accounts" appears as its child item with proper indentation.
4. **Given** clicking "Home" or "Accounts", **When** activated, **Then** the item displays the active keystone indicator on its left edge and updates route navigation.

---

### User Story 3 - Bottom User Profile Card with Chevron-Up Popover Menu (Priority: P1) 🎯 MVP

As an operator, I want to see my user name and email at the bottom of the sidebar with a `^` button that opens a menu with theme controls and a Sign Out button, so that I can easily manage my session without cluttering the main navigation.

**Why this priority**: Essential session management and user orientation.

**Independent Test**: Can be validated by inspecting the sidebar footer, asserting that the user's name and email render, clicking the `^` (chevron-up) button, verifying that the popover opens with "Sign Out" and theme switching options, and clicking "Sign Out" triggers `POST /api/auth/logout`.

**Acceptance Scenarios**:
1. **Given** an authenticated session, **When** viewing the sidebar footer, **Then** the user's display name, email, and avatar initials are displayed alongside a chevron-up (`^`) trigger button.
2. **Given** the collapsed icon-rail state (48px), **When** viewing the footer, **Then** the user avatar is centered, and clicking or hovering reveals the popover/tooltip.
3. **Given** clicking the `^` chevron button in expanded state, **When** triggered, **Then** an accessible dropdown/popover menu opens above the card containing:
   - Theme toggle (Light / Dark mode switch)
   - User account info / status
   - Sign Out action button
4. **Given** clicking "Sign Out", **When** executed, **Then** the client calls `POST /api/auth/logout`, clears the session cookie, and redirects cleanly to `/login`.
5. **Given** clicking outside the open popover, **When** detected, **Then** the menu closes smoothly without altering the active page.

---

### User Story 4 - Responsive Mobile Access via Floating Corner Trigger (Priority: P2)

As a mobile user (<768px), I want to open the sidebar via a discreet floating corner button in the top-left of the screen, so that I can easily access navigation without taking up permanent screen space with a header bar.

**Why this priority**: Seamless mobile responsiveness while adhering to the headerless design philosophy.

**Independent Test**: Can be validated on viewport widths <768px by verifying that the desktop sidebar is hidden, the floating corner button is visible in the top-left, clicking the button slides open the sidebar drawer sheet with backdrop blur, and tapping the backdrop or a link closes the drawer.

**Acceptance Scenarios**:
1. **Given** a mobile viewport (<768px), **When** loading the workspace, **Then** the sidebar is collapsed off-canvas, and a discreet, theme-styled floating button with a menu icon appears pinned to the top-left corner (`position: fixed; top: 12px; left: 12px; z-index: 30`).
2. **Given** tapping the floating button, **When** clicked, **Then** the sidebar drawer slides smoothly from the left (`transform: translateX(0)` with 200ms easing), and a dimmed backdrop overlay covers the content canvas.
3. **Given** an open mobile drawer, **When** the user taps the backdrop, presses `Escape`, or selects a navigation link, **Then** the drawer smoothly retracts off-canvas and the backdrop fades out.
4. **Given** a desktop viewport (>=768px), **When** resized, **Then** the floating corner button is completely hidden (`display: none`).

---

### User Story 5 - Collapsible Icon Rail & Keyboard Shortcut (Priority: P2)

As a power user, I want to collapse the sidebar into an icon-only rail (48px) via the rail toggle or `⌘B` / `Ctrl+B`, and have my preference remembered across sessions, so that I can adapt the interface to my workflow.

**Why this priority**: Ergonomics and space optimization for intensive data views.

**Independent Test**: Can be validated by pressing `Cmd+B` on desktop, asserting that the sidebar collapses to 48px with tooltips enabled for each item, verifying that the `sidebar_state` cookie updates to `collapsed`, and refreshing the page to confirm the state persists.

**Acceptance Scenarios**:
1. **Given** the expanded sidebar on desktop, **When** the user presses `Cmd+B` or `Ctrl+B`, **Then** the sidebar animates smoothly to the 48px collapsed icon rail.
2. **Given** the collapsed rail state, **When** hovering over menu items, **Then** rich tooltips display the item labels to the right of the rail.
3. **Given** toggling the sidebar, **When** state changes, **Then** the preference is persisted in the `sidebar_state` cookie (`max-age=7 days`) so page refreshes maintain the chosen width.

---

## 3. Technical Requirements & Design System Alignment

### Theme & Styling Token Authority (`apps/web/src/lib/theme.ts`)
- All components MUST strictly reference theme tokens from `THEME.default`, `PALETTE`, `SPACING`, `RADII`, and `TYPOGRAPHY`.
- Zero ad-hoc hex values, arbitrary borders, or custom box-shadows.
- `SidebarSeparator` must use `THEME.default.borders.hairline` (1px width).
- Active navigation item indicator must use `PALETTE.primary` (subtle gold keystone on left border).

### UX Writing Standards
- User card must display clean user name and canonical email.
- Sign Out button copy: "Sign out" (not "Log off" or technical jargon).
- Tooltips: Concise 1-word or 2-word labels ("Home", "Accounts", "Toggle sidebar (⌘B)").
- Zero decorative / simulated health status badges.

---

## 4. Success Criteria

- **SC-001**: 100% of workspace views render with zero top horizontal header on desktop, allocating 100% viewport height to the content canvas.
- **SC-002**: Sidebar renders "Home", visual separator line, and "Facebook" header with "Accounts" subsection.
- **SC-003**: User profile card renders at sidebar bottom with a functional `^` popover providing theme toggle and Sign Out action.
- **SC-004**: On mobile viewports (<768px), a discreet floating corner button provides 1-tap access to the sidebar drawer sheet.
- **SC-005**: 100% of test suites and Turborepo quality gates pass with 0 errors.
