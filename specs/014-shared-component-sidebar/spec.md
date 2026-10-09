# Feature Specification: Shared Shadcn-Compatible Sidebar Component

**Feature Branch**: `feat/014-shared-component-sidebar`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User prompt: "I want to create a shared component sidebar https://ui.shadcn.com/docs/components/base/sidebar I want this sidebar plan it properly using speckit read your agents file and build it and then show me the mock in showroom"

---

## 1. Executive Summary

This feature delivers a production-grade, composable, shared **Sidebar** component suite inspired by the [Shadcn UI Sidebar specification](https://ui.shadcn.com/docs/components/base/sidebar), fully engineered to conform to FBUploadPro's architectural rules and strict design system tokens (`apps/web/src/lib/theme.ts`).

The sidebar provides:
- Flexible layout variants (`sidebar`, `floating`, `inset`) and collapse behaviors (`icon`, `offcanvas`, `none`).
- Responsive multi-device support: smooth icon rail minimization on desktop screens and an accessible slide-over sheet drawer with backdrop overlay on mobile viewports.
- Keyboard navigation (global shortcut `Cmd+B` / `Ctrl+B`) and seamless cookie persistence (`sidebar_state`) with client fallback to prevent layout shifts.
- Rich composable building blocks: `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupAction`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuSub`, `SidebarRail`, `SidebarTrigger`, and `SidebarInset`.
- Complete adherence to `DESIGN.md` and `.agents/rules/theme-standards.md`: dark/light surface tokens, 1px neutral hairline dividers, unboxed 6px luminous status dots, zero capsule pill badges, and accessible tooltips.
- An interactive UI showroom showcase in `apps/showroom` demonstrating an authentic FBUploadPro workspace navigation tree with live switching between expanded and icon modes.

---

## 2. Clarifications

### Session 2026-10-09
- Q: How should the sidebar handle collapsed states and responsive mobile behavior? → A: Full Shadcn spec: Collapses to an icon rail on desktop, slides out as an off-canvas drawer with backdrop on mobile, and supports keyboard shortcut (Cmd/Ctrl+B).
- Q: How should sidebar expanded/collapsed state be persisted across page navigations and reloads? → A: Cookie persistence (`sidebar_state`) with client fallback to prevent SSR layout shifts in Next.js 16 App Router.
- Q: What navigation hierarchy and variants would you like showcased in the UI showroom? → A: Complete FBUploadPro Workspace mock: Workspace/Account header switcher, categorized navigation groups (Core Publishing, Assets, Analytics, Settings), unboxed status indicator, and user account footer.

---

## 3. User Scenarios & Testing *(mandatory)*

### User Story 1 - Desktop Layout & Responsive Collapsing (Priority: P1) 🎯 MVP

As an application user on desktop or laptop displays, I want the sidebar to provide effortless primary navigation with the ability to collapse into a streamlined icon rail, so that I can maximize horizontal workspace for dense tables, media grids, and publishing workflows while retaining quick one-click navigation.

**Why this priority**: Foundational interaction model. Without reliable responsive layout toggling, collapsed rail states, and state propagation, child navigation items cannot function cleanly.

**Independent Test**:
- Render the `Sidebar` within `SidebarProvider` on desktop viewport (>768px).
- Click `SidebarTrigger` or press `Cmd+B` / `Ctrl+B`.
- Verify the sidebar smoothly transitions between 256px expanded width and 48px icon rail width.
- Verify that cookie `sidebar_state` updates to preserve user preference across page refreshes.

**Acceptance Scenarios**:
1. **Given** a user viewing an application page on desktop (>768px), **When** the page loads, **Then** the sidebar displays in its expanded state (or persisted cookie state) showing icons and text labels.
2. **Given** the sidebar in expanded state, **When** the user clicks `SidebarTrigger` or presses `Cmd+B` / `Ctrl+B`, **Then** the sidebar collapses into an icon rail (48px wide) hiding text labels and revealing tooltip hover cues.
3. **Given** the sidebar in collapsed icon rail state, **When** the user clicks `SidebarTrigger` again or clicks the interactive `SidebarRail`, **Then** the sidebar smoothly expands back to full width (256px).
4. **Given** the sidebar toggle is activated, **When** state changes, **Then** a cookie `sidebar_state` (`expanded` | `collapsed`) is written to preserve preference across reloads without layout shifts.

---

### User Story 2 - Mobile Drawer Navigation with Backdrop (Priority: P2)

As a mobile user accessing FBUploadPro on phone or small tablet displays, I want the sidebar to stow off-canvas and slide out as an accessible overlay sheet drawer when triggered, so that the mobile screen remains uncluttered while navigation remains readily available.

**Why this priority**: Ensures 100% responsive parity across small viewports without breaking layout flow or clipping content.

**Independent Test**:
- Resize viewport to mobile width (<768px).
- Click `SidebarTrigger`.
- Verify mobile sheet drawer slides in over a darkened backdrop.
- Click backdrop overlay or press `Escape` key and verify drawer closes.

**Acceptance Scenarios**:
1. **Given** a viewport width under 768px, **When** the page renders, **Then** the sidebar is hidden off-screen and the mobile trigger button is visible.
2. **Given** mobile viewport, **When** the user clicks the trigger, **Then** the sidebar slides into view as an overlay drawer with an ambient darkened backdrop (`rgba(0,0,0,0.6)`).
3. **Given** the open mobile drawer, **When** the user taps the backdrop, presses `Escape`, or selects a navigation link, **Then** the drawer smoothly transitions closed.
4. **Given** the mobile drawer open state, **When** open, **Then** scrolling on background content is prevented (`overflow: hidden` on body).

---

### User Story 3 - Composable Menu Hierarchy, Submenus, & Actions (Priority: P3)

As a frontend developer and product creator, I want a rich set of modular sidebar primitives (Headers, Groups, Menus, Submenus, Action Buttons, and Inset Content) so that complex navigation hierarchies (such as workspace switchers, multi-level routes, and item action triggers) can be assembled declaratively.

**Why this priority**: Required to support real-world application navigation requirements including nested routes, group headers, and contextual action buttons.

**Independent Test**:
- Assemble a sidebar with `SidebarHeader`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuSub`, and `SidebarFooter`.
- Verify active states, nested submenu indentation, item action clicks, and tooltip rendering in collapsed mode.

**Acceptance Scenarios**:
1. **Given** a `SidebarMenuButton` with `isActive={true}`, **When** rendered, **Then** it receives active visual styling (subtle gold accent border/indicator and high-contrast text) consistent with `THEME`.
2. **Given** a `SidebarMenuItem` containing a `SidebarMenuSub`, **When** expanded, **Then** nested sub-items render with 1px hairline guide lines and indented typography.
3. **Given** a `SidebarMenuButton` with a `tooltip` prop in collapsed rail mode, **When** hovered by pointer or focused via keyboard, **Then** a non-intrusive tooltip appears displaying the item label.
4. **Given** a `SidebarGroup` with `SidebarGroupAction`, **When** the action icon is clicked, **Then** its associated event handler fires without toggling navigation.

---

### User Story 4 - UI Showroom Interactive Verification Harness (Priority: P4)

As a developer and stakeholder, I want to interactively inspect all states of the sidebar component in `apps/showroom` on port 3001, so that visual fidelity, theme compliance, responsiveness, and interaction mechanics can be evaluated before merging.

**Why this priority**: Enforces the pre-merge UI showroom rule, giving stakeholders an interactive environment to test both light and dark modes, variants, and mobile drawer transitions.

**Independent Test**:
- Open the showroom page at `/` (or `/sidebar`).
- Interactively toggle desktop collapse, mobile drawer, variants (standard vs. inset), and verify zero styling regressions or hardcoded color leaks.

**Acceptance Scenarios**:
1. **Given** the showroom running on port 3001, **When** visiting the sidebar preview, **Then** a full FBUploadPro workspace layout is displayed with authentic navigation sections (Publishing, Assets, Analytics, Settings).
2. **Given** interactive controls in the showroom, **When** switching theme modes (dark vs. light), **Then** all surfaces, borders, and active highlights cleanly adapt using `apps/web/src/lib/theme.ts` tokens.
3. **Given** the showroom page, **When** the collapse toggle is activated, **Then** the sidebar animates smoothly between expanded and collapsed icon states.

---

### Edge Cases

- **Fast successive toggle clicks**: Debounced/event-driven state toggling ensures animation states do not desync.
- **SSR Hydration mismatch**: Cookie-based initial state (`defaultOpen`) guarantees that server-rendered HTML matches client DOM on first paint, eliminating flash of expanded/collapsed layout shifts.
- **Window resize across mobile breakpoint**: Dynamic resize listener updates `isMobile` state; if mobile drawer was open when resizing to desktop, mobile drawer closes gracefully.
- **Nested interactive elements**: Clicks on `SidebarMenuAction` (e.g. triple-dot more menu) call `stopPropagation()` to avoid triggering parent button navigations.
- **Accessibility & Focus management**: Focus trapped or released properly when mobile sheet opens and closes; `aria-expanded` reflects sidebar state on triggers.

---

## 4. Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide `SidebarProvider` context managing `state` (`expanded` | `collapsed`), `open`, `setOpen`, `openMobile`, `setOpenMobile`, `isMobile`, and `toggleSidebar`.
- **FR-002**: System MUST persist sidebar open/collapsed state in a `sidebar_state` cookie (`expanded` | `collapsed`) with 7-day expiration and localStorage fallback.
- **FR-003**: System MUST bind global keyboard shortcut `Cmd+B` (Mac) and `Ctrl+B` (Windows/Linux) to toggle sidebar state.
- **FR-004**: System MUST provide `Sidebar` component accepting `side` (`left` | `right`), `variant` (`sidebar` | `floating` | `inset`), and `collapsible` (`icon` | `offcanvas` | `none`).
- **FR-005**: When `collapsible="icon"`, `Sidebar` MUST collapse from standard width (256px) to compact icon strip (48px) on desktop viewports.
- **FR-006**: On mobile viewports (<768px), `Sidebar` MUST render as a slide-over off-canvas drawer with backdrop overlay (`rgba(0,0,0,0.6)`).
- **FR-007**: System MUST provide structural primitives: `SidebarHeader`, `SidebarContent`, `SidebarFooter`, and `SidebarInset`.
- **FR-008**: System MUST provide group primitives: `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupAction`, and `SidebarGroupContent`.
- **FR-009**: System MUST provide menu primitives: `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuAction`, and `SidebarMenuBadge`.
- **FR-010**: `SidebarMenuButton` MUST accept `isActive`, `variant`, `size` (`sm` | `md` | `lg`), and `tooltip`. In collapsed icon mode, hovering MUST display the tooltip.
- **FR-011**: System MUST provide sub-menu primitives: `SidebarMenuSub`, `SidebarMenuSubItem`, and `SidebarMenuSubButton` with nested hierarchical indentation.
- **FR-012**: System MUST provide `SidebarRail` edge toggle bar and `SidebarTrigger` button.
- **FR-013**: System MUST export all sidebar primitives from `@fbuploadpro/web` UI barrel (`apps/web/src/components/ui/index.ts`).
- **FR-014**: All sidebar components MUST strictly reference visual styling tokens from `apps/web/src/lib/theme.ts` or CSS variables. ZERO ad-hoc hex literals, ZERO arbitrary border widths, and ZERO capsule pill badges.
- **FR-015**: Showroom harness in `apps/showroom` MUST present an interactive mock workspace with authentic navigation and theme switching.

---

## 5. Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% component responsiveness: smooth transition animations (<200ms) with zero layout overflow or horizontal scrolling on viewports from 320px to 2560px.
- **SC-002**: Zero layout flash during SSR: sidebar hydration respects `sidebar_state` cookie without visual layout shifts (CLS < 0.05).
- **SC-003**: 100% automated test coverage for core interactions: unit/integration test suite covering provider context, toggle trigger, shortcut, collapse mode, and mobile drawer.
- **SC-004**: 100% theme compliance: 0 hardcoded hex color literals outside `theme.ts`, verified by code audit and quality gate.
- **SC-005**: Showroom harness runs cleanly on port 3001 showcasing all states.

---

## 6. Assumptions

- **React 19 & Next.js 16**: Built using React 19 forward-compatible hooks and Next.js 16 App Router standards.
- **No external heavy UI dependencies**: Implemented using clean native React primitives and CSS transitions without requiring bloated third-party runtime bundles, preserving edge and browser performance.
- **Icons**: Employs clean inline SVG icons consistent with existing Spec 008 components (`apps/web/src/components/ui/`).
- **Cookie access**: In browser runtime, `document.cookie` is used for client updates; `SidebarProvider` accepts initial `defaultOpen` prop derived from server cookies where available.
