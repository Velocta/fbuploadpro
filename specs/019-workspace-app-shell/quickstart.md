# Quickstart & Verification Guide: 019 Workspace Pure Sidebar-Only App Shell

**Feature ID**: `019-workspace-app-shell`  
**Date**: 2026-10-09  

---

## 1. Quick Verification Steps

### Scenario 1: Desktop Shell Rendering & Headerless Canvas
1. Start the development server (`pnpm dev` or visit tenant workspace).
2. Open `http://testuser.localhost:3000/tenant/testuser` on desktop (>=1024px width).
3. **Verify**:
   - The collapsible sidebar is mounted on the left side of the screen.
   - Zero horizontal header bar appears at the top of the content area.
   - The content canvas spans 100vh with independent vertical scrolling.

### Scenario 2: Navigation Hierarchy & Separator
1. Inspect the sidebar menu:
   - "Home" item at top with home icon.
   - 1px hairline horizontal separator line directly under "Home".
   - "Facebook" uppercase group heading.
   - "Accounts" sub-item indented under the "Facebook" section.
2. Click "Home": verify active state highlight bar on left border.

### Scenario 3: Bottom User Profile Card & Popover Menu
1. Scroll or view the bottom of the sidebar.
2. Verify user avatar initials, user name, and email are rendered.
3. Click the `^` (chevron-up) button:
   - Verify popover opens smoothly above the user card.
   - Verify "Theme Switcher" and "Sign Out" actions are visible.
4. Click outside the popover: verify it closes.
5. Click "Sign Out": verify session is terminated and user is redirected to `/login`.

### Scenario 4: Mobile Responsive Drawer
1. Resize browser viewport to mobile width (<768px).
2. Verify desktop sidebar is hidden off-canvas.
3. Verify floating menu button is visible in top-left corner (`top: 12px; left: 12px`).
4. Tap the floating button:
   - Verify sidebar drawer slides in from the left.
   - Verify dimmed backdrop overlay covers the content area.
5. Tap the backdrop: verify drawer slides shut.
