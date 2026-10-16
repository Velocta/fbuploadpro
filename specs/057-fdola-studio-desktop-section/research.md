# Research & Architecture Decisions: Fdola Studio Desktop-Only Section

**Feature**: `specs/057-fdola-studio-desktop-section`  
**Date**: 2026-10-16  

## Context & Objectives

The user requested adding a new navigation section positioned directly below "Downloader" named "Fdola Studio" to house desktop-exclusive features.
In standard web browsers, accessing this section must display an informative desktop gate explaining why native execution is needed and how to launch or download the desktop app shell. When running inside the desktop client (Tauri v2), it must seamlessly present the native Fdola Studio workstation with live capability indicators and foundational tool module cards.

## Key Architectural Decisions

### 1. Navigation Placement & Hierarchy
- **Location**: In `WorkspaceSidebar` (`apps/web/src/components/workspace/workspace-sidebar.tsx`), the primary top navigation group currently contains:
  1. Home (`/tenant/[subdomain]`)
  2. Media Library (`/tenant/[subdomain]/media`)
  3. Downloader (`/tenant/[subdomain]/downloader`)
- **New Ordering**:
  1. Home
  2. Media Library
  3. Downloader
  4. Fdola Studio (`/tenant/[subdomain]/fdola-studio`)
  - Followed by `SidebarSeparator`
  - Followed by `Platform` (Facebook, Instagram, Threads, X, TikTok, YouTube)
- **Breadcrumbs**: In `computeBreadcrumbs()` (`apps/web/src/components/workspace/workspace-breadcrumb.tsx`), the route `fdola-studio` resolves to label `'Fdola Studio'`.

### 2. Runtime Environment Detection & Hydration Safety
- In `@fbuploadpro/contracts`, `isDesktopApp()` checks for `window.__TAURI__`, `window.__TAURI_INTERNALS__`, or `navigator.userAgent.includes('FBUploadProDesktop')`.
- On server-side rendering (SSR), `window` is undefined. To avoid React 19 hydration mismatch warnings:
  - The component `FdolaStudioView` uses `useEffect` to detect the client environment after initial mount.
  - While mounting, a lightweight neutral loading skeleton or deterministic layout renders without jarring layout shift.
  - Supports an explicit `forceDesktop` prop to enable deterministic testing in unit test runners (e.g., `renderToStaticMarkup` or JSDOM without Tauri globals).

### 3. Web Browser Desktop Gate View
- When `isDesktop === false`, the page renders `FdolaStudioGate`:
  - Centered midnight-slate container adhering to `DESIGN.md`.
  - Iconography: Native studio monitor/film slate mark.
  - Headline: "Fdola Studio (Desktop Exclusive)"
  - Status Notice: "Requires FBUploadPro Desktop Application"
  - Descriptive summary: Highlights native capabilities (direct local filesystem access, GPU-accelerated video processing, zero upload bottleneck for batch preparation).
  - Actions:
    - Primary: "Launch Desktop Shell" (attempts opening `fbuploadpro://tenant/${subdomain}/fdola-studio`).
    - Secondary: "Download Desktop App" (navigates or provides download instructions).
    - Tertiary / Back: "Return to Overview" (routes back to `/tenant/${subdomain}`).

### 4. Native Desktop Studio Workspace Shell
- When `isDesktop === true`, the page renders `FdolaStudioWorkspace`:
  - Studio Header: Title "Fdola Studio", subtitle "Native High-Performance Media Workstation".
  - Capability Badges / Status Signals:
    - Unboxed luminous green status signal: "Desktop Environment Active"
    - Unboxed luminous cyan status signal: "Local Filesystem Ready"
  - Tool Scaffolding Grid:
    - **Local Directory Watcher**: Automates ingestion from local disk folders directly into publishing pipelines without browser file upload limits.
    - **Batch Transcoding Pipeline**: Hardware-accelerated local video re-encoding and thumbnail generation.
    - **Media Preparation Workstation**: Offline sequencing, aspect ratio framing (9:16 reels vs 16:9), and local metadata tagging.

### 5. Theme Token & Anti-Slop Enforcement
- Strictly imports `THEME`, `PALETTE`, `SPACING`, `RADII`, `TYPOGRAPHY` from `@/lib/theme`.
- Zero raw hex colors (no `#ffffff`, `#000000` literals).
- Zero capsule pill badges; status dots use `STATUS_SIGNALS` unboxed 6px luminous dots with micro-halos.
- Professional UX writing: zero technical plumbing leaks or internal database terminology.
