# Feature Specification: Fdola Studio Desktop-Only Section & Native Shell Scaffolding

**Feature Branch**: `feat/057-fdola-studio-desktop-section`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "now i want you to create a new section below downloader and we will implement a desktop only feature there name it Fdola studio"

## Clarifications

### Session 2026-10-16
- Q: What core capability should we implement in Fdola Studio for this phase? → A: Lay the foundational Fdola Studio workspace, desktop detection gate (with desktop download/launch prompt in web browser), and native tool scaffolding.
- Q: How should Fdola Studio appear and behave when accessed in a standard web browser? → A: Display a dedicated desktop gate banner explaining Fdola Studio features and providing desktop app download/launch guidance.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sidebar Navigation & Breadcrumb Integration (Priority: P1)

As a workspace team member, I want to see a new navigation section named "Fdola Studio" located directly below "Downloader" in the primary sidebar group, so that I can easily discover and navigate to the dedicated studio workspace.

**Why this priority**: Establishes the primary navigation entry point, route structure, and breadcrumb hierarchy within the workspace shell.

**Independent Test**: Can be fully tested by opening the workspace sidebar, verifying that "Fdola Studio" renders directly below "Downloader" in the top group above the separator, and confirming clicking it navigates to `/tenant/[subdomain]/fdola-studio` with correct active highlighting and breadcrumb updates.

**Acceptance Scenarios**:

1. **Given** a user is logged into their workspace (`/tenant/[subdomain]`), **When** viewing the sidebar primary navigation group, **Then** "Fdola Studio" is rendered directly below "Downloader" and above the `SidebarSeparator`.
2. **Given** the workspace sidebar is collapsed into icon-only mode (`collapsible="icon"`), **When** hovering over the Fdola Studio icon, **Then** a tooltip displaying "Fdola Studio" appears.
3. **Given** the user navigates to `/tenant/[subdomain]/fdola-studio`, **When** the page loads, **Then** the sidebar item is marked as active and the workspace topbar breadcrumb displays `Home > Fdola Studio`.

---

### User Story 2 - Web Browser Desktop-Only Gate View (Priority: P1)

As a workspace user accessing the platform from a standard web browser, I want to see a clear, focused desktop gate interface when visiting Fdola Studio informing me that this feature is only available on desktop and prompting me to download the desktop app (without premature download links), so that expectations are properly set.

**Why this priority**: Guarantees a clean, unconfusing user experience in web browsers without broken UI, cryptic errors, or premature/unsupported links.

**Independent Test**: Can be fully tested in a browser environment (`isDesktopApp() === false`) by navigating to `/tenant/[subdomain]/fdola-studio` and verifying that the centered desktop gate card displays the exact message "This feature is only available on desktop. Please download the desktop app." with zero download links and zero action buttons.

**Acceptance Scenarios**:

1. **Given** a user accesses `/tenant/[subdomain]/fdola-studio` from a standard web browser, **When** the page renders, **Then** a centered Midnight Slate card is displayed.
2. **Given** the desktop gate card, **When** inspected, **Then** it cleanly states "This feature is only available on desktop. Please download the desktop app." with zero buttons, download links, or external URLs.

---

### User Story 3 - Empty Fdola Studio Workspace for Desktop App (Priority: P1)

As a user running the FBUploadPro Desktop application, I want to access an empty Fdola Studio workspace placeholder, so that the desktop route exists and is ready for future desktop features.

**Why this priority**: Provides the dedicated desktop-exclusive workspace destination when running inside the desktop shell.

**Independent Test**: Can be fully tested in desktop mode (`isDesktopApp() === true` or forced preview) by navigating to `/tenant/[subdomain]/fdola-studio` and verifying that the desktop workspace placeholder renders.

**Acceptance Scenarios**:

1. **Given** the application is running inside the desktop shell (`isDesktopApp() === true`), **When** navigating to `/tenant/[subdomain]/fdola-studio`, **Then** the empty Fdola Studio desktop workspace placeholder is rendered instead of the web gate card.
2. **Given** the desktop workspace placeholder, **When** inspected, **Then** it cleanly displays the Fdola Studio title and desktop workspace placeholder container.

---

### Edge Cases

- **Hydration Mismatch Prevention**: What happens during server-side rendering or before client hydration completes? The system must default to a neutral skeleton or deterministic initial render to eliminate layout shifts or hydration errors.
- **Deep Links & Mobile Viewports**: What happens if a user accesses the URL on a mobile device or narrow viewport? The gate interface must remain fully responsive, wrapping smoothly without horizontal scrolling.
- **Direct Route Refresh**: What happens when a user reloads `/tenant/[subdomain]/fdola-studio` directly? The session and layout guard must preserve tenant context and render the correct state based on runtime environment detection.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Workspace sidebar MUST display "Fdola Studio" directly below "Downloader" in the primary navigation group.
- **FR-002**: Workspace breadcrumb resolver MUST map `/tenant/[subdomain]/fdola-studio` to `Fdola Studio`.
- **FR-003**: The route `/tenant/[subdomain]/fdola-studio` MUST check runtime execution environment using `isDesktopApp()`.
- **FR-004**: If `isDesktopApp()` returns false, the application MUST render the web desktop gate card with the notice "This feature is only available on desktop. Please download the desktop app." with zero download links and zero buttons.
- **FR-005**: If `isDesktopApp()` returns true, the application MUST render the empty Fdola Studio desktop workspace placeholder.
- **FR-006**: All UI components MUST strictly consume design tokens from `@/lib/theme` and adhere to pitch-black / midnight-slate styling with zero ad-hoc colors or capsule pill badges.

### Key Entities

- **Studio Environment Context**: Represents the runtime environment state (`isDesktop`, `isMac`, platform details).
- **Studio Tool Module**: Represents a modular capability within Fdola Studio (e.g., Local Directory Watcher, Batch Media Pipeline, Hardware Acceleration).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sidebar ordering strictly maintains `Home` -> `Media Library` -> `Downloader` -> `Fdola Studio` -> `Separator` -> `Platform`.
- **SC-002**: 100% of navigations to `/tenant/[subdomain]/fdola-studio` load cleanly in under 50ms with zero console errors or hydration mismatches.
- **SC-003**: In browser mode, 100% of users see the desktop gate view without broken UI or missing navigation links.
- **SC-004**: All new UI components achieve 100% test coverage with automated unit and integration tests.

## Assumptions

- The desktop app shell runs Tauri v2 and sets `window.__TAURI__`, `window.__TAURI_INTERNALS__`, or user agent `FBUploadProDesktop/0.1.0`.
- The desktop gate view in web browsers provides deep-link opening (`fbuploadpro://`) and download instructions.
- Design tokens and layout rules strictly follow `DESIGN.md` via `apps/web/src/lib/theme.ts`.
