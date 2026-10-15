# Quickstart Validation Guide: Multi-Platform Sidebar Sections

## Automated Verification

### 1. Run Workspace Sidebar Unit Tests
```bash
pnpm --filter @fbuploadpro/web test tests/ui/workspace-sidebar.test.tsx
```
**Expected Outcome**: All assertions pass, validating that Facebook, Instagram, Threads, X (Twitter), TikTok, and YouTube render with their respective icons, collapsible triggers, Accounts sub-items, and the placeholder note.

### 2. Run Platform Placeholder Pages Unit Tests
```bash
pnpm --filter @fbuploadpro/web test tests/ui/platform-placeholder-accounts.test.tsx
```
**Expected Outcome**: Validates that navigating to `/tenant/[subdomain]/[platform]/accounts` renders the clean empty state with the testing notice and return button.

## Manual Visual Verification Scenarios

1. **Sidebar Rendering**:
   - Open any workspace (`http://localhost:3000/tenant/acme`).
   - Check the sidebar under the "Platform" section.
   - Confirm Facebook is expanded.
   - Confirm Instagram, Threads, X (Twitter), TikTok, and YouTube are listed with sharp stroke icons.
   - Click each platform: verify it expands smoothly and shows "Accounts" with the subtext "Being tested — not available for public use".

2. **Navigation Flow**:
   - Click "Accounts" under Instagram.
   - Verify URL transitions to `/tenant/acme/instagram/accounts`.
   - Verify the page displays the "{Platform} Accounts" empty state card with testing notice.
   - Verify Instagram in the sidebar remains active with primary color bar indicator.
   - Click "Return to Overview" and verify navigation back to `/tenant/acme`.
