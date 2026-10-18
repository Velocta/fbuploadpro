# Research & Technical Decisions: Media Library Redesign

## 1. Architectural Decisions

### D1: Elimination of "Box-in-Box" Nested Panels
- **Problem**: Previously, `MediaLibraryExplorer` wrapped cards inside bordered panels with rounded corners, and cards themselves had borders, creating visually cluttered "box within box" nesting.
- **Decision**: Eradicate all outer container card boxes. The page background (`var(--bg-canvas)`) serves as the base. Subfolders render as clean list rows separated by hairline dividers (`var(--border-subtle)`). Asset grid items render as rounded thumbnail tiles with metadata text directly beneath them on the canvas background.
- **Token Alignment**: Hairlines use `1px solid var(--border-subtle)` (`HAIRLINE.subtle`). Radii use `RADII.xs` (4px) or `RADII.md` (8px for thumbnails).

### D2: 2-Step Import Staging & 3-Concurrency Worker Engine
- **Problem**: `UploadQueueBanner` immediately uploaded files without review, had confusing concurrency, and lacked pre-upload duplicate resolution in a dedicated modal.
- **Decision**: Replace `UploadQueueBanner` with `MediaImportModal`.
  - **Step 1 (Staging)**: Shows rows with type icon, name, formatted size, destination selector, validation flags (unsupported types, >500MB, 0-byte files), and SHA-256 duplicate detection with "Skip" / "Upload anyway" per row and "Skip all duplicates" bulk action.
  - **Step 2 (Progress)**: A bounded queue worker limits concurrent XHR/fetch PUT uploads to exactly 3. Queued items show `queued · #n` and can be canceled. Active items show progress bar, percentage, and pause/resume/cancel. Completed items show checkmarks.
  - **Minimize Mode**: "Keep working" minimizes the popup while uploads run in background with leave-page protection.

### D3: Leave-Page Protection Strategy
- **Problem**: Users navigating away or closing the tab during large uploads lose in-flight and queued files without warning.
- **Decision**:
  - **Browser Tab / Window Level**: Hook `window.addEventListener('beforeunload', handler)` when active uploads exist. The handler sets `event.returnValue = ''` to trigger the browser's native leave confirmation.
  - **In-App Next.js Navigation**: Intercept link clicks (e.g. clicking sidebar links or workspace switcher) while uploads are active. Instead of routing, open `LeavePageGuardDialog` displaying the furthest-along file's percentage, offering "Stay on this page" (default/primary) and "Leave anyway".

### D4: Dropdown Click Reliability Fix
- **Problem**: Filter dropdowns (Aspect ratio, Caption status, Sort) intermittently ignored mouse clicks while responding to keyboard events.
- **Investigation**: Custom dropdown components or Radix popovers often fail if `onPointerDown` vs `onClick` event listeners conflict with blur/focusout handlers on container elements, or if `event.preventDefault()` in drag-and-drop parent containers swallows pointer events.
- **Remediation**: Use clean Radix / Headless dropdown triggers or explicit `onPointerDown` stop-propagation handlers, ensuring the menu toggle fires consistently on both touch and mouse click.

### D5: Live Search Debouncing & Empty State Flash Prevention
- **Problem**: Search count label lagged behind the grid during live filtering; clearing search briefly flashed the empty state.
- **Remediation**: Synchronize the filtered item count directly with the active derived state (`useMemo` over debounced query). Ensure clearing the search query immediately resets the search filter state to avoid stale intermediate renders.

### D6: Broken Thumbnail Fallback
- **Problem**: Image/video thumbnails with invalid URLs or failed generation showed a broken image icon.
- **Remediation**: Implement `onError` handler on `<img />` that sets an error state and renders a clean fallback `<FileVideo />` or `<FileImage />` icon with subtle background tint.
