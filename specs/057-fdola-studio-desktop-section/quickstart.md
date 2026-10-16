# Quickstart & Verification Guide: Fdola Studio

**Feature**: `specs/057-fdola-studio-desktop-section`  
**Date**: 2026-10-16  

## Verification Scenarios

### Scenario 1: Sidebar Order & Breadcrumb Resolution
1. Open any workspace route (`/tenant/acme`).
2. Verify primary sidebar items appear in strict order:
   - `Home`
   - `Media Library`
   - `Downloader`
   - `Fdola Studio`
   - `SidebarSeparator`
   - `Platform`
3. Click "Fdola Studio".
4. Verify URL changes to `/tenant/acme/fdola-studio`.
5. Verify topbar breadcrumb displays `Home > Fdola Studio`.

### Scenario 2: Standard Web Browser Gate View
1. Navigate to `/tenant/acme/fdola-studio` in Chrome / Firefox / Safari.
2. Confirm the centered desktop gate card is rendered with test ID `fdola-studio-gate`.
3. Confirm informative copy explains high-performance desktop features (local filesystem access, hardware acceleration, offline batch tools).
4. Verify "Return to Overview" routes back to `/tenant/acme`.

### Scenario 3: Desktop Shell Workspace Mode
1. Run application inside desktop shell (or with `forceDesktop={true}`).
2. Verify native studio view is rendered with test ID `fdola-studio-workspace`.
3. Verify unboxed status indicators for desktop runtime and filesystem readiness.
4. Verify tool module cards for Local Directory Ingest, Batch Processing Pipeline, and Offline Preparation Workstation render with clean midnight-slate styling.

## Automated Test Command
Run test suites covering sidebar, breadcrumb, and Fdola Studio components:
```bash
pnpm --filter @fbuploadpro/web test tests/ui/workspace-sidebar.test.tsx tests/ui/workspace-breadcrumb.test.tsx tests/ui/fdola-studio.test.tsx
```
