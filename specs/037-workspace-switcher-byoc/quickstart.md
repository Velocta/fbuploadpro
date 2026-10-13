# Quickstart: Spec 037 - Workspace Switcher, Dedicated Settings Hub & Strict BYOC Facebook Credentials

## 1. Prerequisites
- Node.js >= 20.0.0
- `pnpm` >= 9.0.0
- Valid environment variables:
  - `SESSION_SECRET`
  - `TOKEN_ENCRYPTION_KEY` or `FB_ENCRYPTION_MASTER_KEY`

## 2. Verifying Workspace Switcher & Settings
1. Start the web application:
   ```bash
   pnpm --filter @fbuploadpro/web dev
   ```
2. Navigate to your workspace Home page: `http://localhost:3000/tenant/[subdomain]`.
3. Locate the **Workspace Switcher** in the `SidebarHeader` (top of sidebar).
4. Click on the workspace button:
   - Notice the popover opens with the active workspace checkmarked.
   - Click "+ Create Workspace" to open the creation modal.
   - Enter a workspace name (e.g., "Agency Beta") and slug ("agency-beta").
   - Click "Create Workspace" and verify immediate redirection.
5. In the switcher popover or sidebar, click **Workspace Settings**:
   - You land on `/tenant/[subdomain]/settings`.
   - Verify the three tabs: `General`, `BYOC Facebook App`, `Audit Logs`.
6. Navigate to `BYOC Facebook App`:
   - Enter your Meta App ID and App Secret.
   - Click the eye icon to test toggling masked/plaintext visibility.
   - Click "Save Credentials".
   - Click "Test App Connection" to verify diagnostics against Meta Graph API.
   - Use the 1-click copy buttons to copy OAuth Redirect URI and Webhook Callback URL.

## 3. Automated Verification Commands
```bash
# Contract schemas & domain logic
pnpm --filter @fbuploadpro/contracts test

# UI & integration tests
pnpm --filter @fbuploadpro/web test tests/ui/workspace-switcher.test.tsx
pnpm --filter @fbuploadpro/web test tests/ui/byoc-settings.test.tsx

# Full monorepo quality gate
pnpm turbo run build lint typecheck test
```
