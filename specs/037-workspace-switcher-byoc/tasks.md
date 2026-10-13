# Tasks: Spec 037 - Workspace Switcher, Dedicated Settings Hub & Strict BYOC Facebook Credentials

## Status Summary
- **Total Tasks**: 16
- **Completed**: 16
- **Pending**: 0

---

## Phase 1: Substrate & Domain Contracts (Foundation)

- [x] **Task 1.1: Database Migration for Workspaces & BYOC Credentials**
  - Create `supabase/migrations/20261013110000_workspace_byoc_credentials.sql`.
  - Create `workspaces` table (`id`, `owner_id`, `name`, `subdomain`, `created_at`, `updated_at`).
  - Add automatic backfill from `users` table (`INSERT INTO workspaces ... SELECT ... FROM users`).
  - Create `workspace_byoc_credentials` table with AES-encrypted secret column and uniqueness constraints.
  - Verification: `pnpm --filter @fbuploadpro/database test tests/supabase-migrations.test.ts`.

- [x] **Task 1.2: Domain Contracts & Zod Schemas**
  - Create `packages/contracts/src/domain/workspace.ts` with `WorkspaceItemSchema`, `CreateWorkspaceRequestSchema`, `SwitchWorkspaceRequestSchema`, `BYOCCredentialsViewSchema`, `SaveBYOCCredentialsRequestSchema`, `TestBYOCResponseSchema`.
  - Export from `packages/contracts/src/index.ts`.
  - Add unit tests in `packages/contracts/tests/workspace.test.ts`.
  - Verification: `pnpm --filter @fbuploadpro/contracts test tests/workspace.test.ts`.

---

## Phase 2: User Story 1 (P1) - Workspace Switcher & Multi-Workspace Lifecycle

- [x] **Task 2.1: Workspaces List & Create API Endpoints**
  - Create `apps/web/src/app/api/workspaces/route.ts` supporting `GET` (list owned workspaces) and `POST` (create workspace with unique subdomain validation).
  - Create `apps/web/src/app/api/workspaces/switch/route.ts` supporting `POST` (verify ownership, re-issue `fbup_session` cookie for chosen workspace).
  - Add error handling and audit logging.

- [x] **Task 2.2: Create Workspace Modal Component**
  - Create `apps/web/src/components/workspace/create-workspace-modal.tsx`.
  - Fields: Workspace Name, Subdomain slug with live sanitization and URL preview.
  - Follow theme standards from `apps/web/src/lib/theme.ts`.

- [x] **Task 2.3: Workspace Switcher Header Component**
  - Create `apps/web/src/components/workspace/workspace-switcher.tsx`.
  - Implement canonical shadcn `TeamSwitcher` pattern: `SidebarMenuButton size="lg"`, monogram avatar, active workspace name, subdomain subtitle, `ChevronsUpDown` toggle.
  - Render unclipped popover with workspaces list, active checkmark, "+ Create Workspace" trigger, and "Workspace Settings" link.

- [x] **Task 2.4: Integrate Workspace Switcher into Workspace Sidebar**
  - Update `apps/web/src/components/workspace/workspace-sidebar.tsx` to use `WorkspaceSwitcher` in `SidebarHeader`.
  - Add dedicated "Settings" navigation button in `SidebarContent`.

- [x] **Task 2.5: Link Settings in User Menu**
  - Update `apps/web/src/components/workspace/workspace-user-menu.tsx` to include "Workspace Settings" menu item pointing to `/tenant/[subdomain]/settings`.

---

## Phase 3: User Story 2 (P2) - Dedicated Settings Hub & Sub-Navigation

- [x] **Task 3.1: Settings Hub Page & Tab Shell**
  - Create `apps/web/src/app/tenant/[subdomain]/settings/page.tsx`.
  - Create sub-navigation tabs: `General`, `BYOC Facebook App`, `Audit Logs`.
  - Handle URL query tab state (`?tab=general`, `?tab=byoc`, `?tab=audit`).

- [x] **Task 3.2: General Settings Tab View**
  - Create `apps/web/src/components/settings/general-settings-view.tsx`.
  - Surface workspace name (editable), subdomain slug (read-only), creation timestamp, owner email.

- [x] **Task 3.3: Audit Logs Tab View**
  - Create `apps/web/src/components/settings/audit-logs-view.tsx`.
  - Surface recent workspace events, configuration changes, and security timestamps.

---

## Phase 4: User Story 3 (P3) - Strict BYOC Facebook App Settings & Diagnostics

- [x] **Task 4.1: BYOC Settings Backend Endpoints**
  - Create `apps/web/src/app/api/tenant/[subdomain]/settings/byoc/route.ts`:
    - `GET`: Returns `{ fbAppId, hasSecret, webhookVerifyToken, status, lastTestedAt }`. Never leaks raw secret.
    - `PUT`: Encrypts secret via `encryptToken` (AES-256-GCM), saves to `workspace_byoc_credentials`.
  - Create `apps/web/src/app/api/tenant/[subdomain]/settings/byoc/test/route.ts`:
    - Tests App ID and App Secret against Meta Graph API `https://graph.facebook.com/v26.0/{appId}`.
    - Updates status to `valid` or `invalid`.

- [x] **Task 4.2: BYOC Settings Control Panel Component**
  - Create `apps/web/src/components/settings/byoc-settings-view.tsx`.
  - App ID input, masked App Secret input with eye toggle, Webhook Verify Token input.
  - Status indicator using unboxed 6px luminous dot (`STATUS_SIGNALS`).
  - "Save Credentials" and "Test App Connection" buttons.
  - 1-click copy helpers for OAuth Redirect URI and Webhook Callback URL.
  - Required Meta permissions checklist.

---

## Phase 5: User Story 4 (P3) - Dynamic OAuth Credential Binding

- [x] **Task 5.1: Dynamic BYOC Resolution in OAuth Initiate Route**
  - Update `apps/web/src/app/api/auth/facebook/route.ts` to look up the workspace's BYOC credentials.
  - If no credentials or status is invalid, redirect back to `/tenant/[subdomain]/settings?tab=byoc&error=credentials_required`.
  - If valid, use workspace's `fb_app_id` and encode `workspaceId` in signed state.

- [x] **Task 5.2: Dynamic Decryption in OAuth Callback Route**
  - Update `apps/web/src/app/api/auth/facebook/callback/route.ts` to query `workspace_byoc_credentials` for the workspace.
  - Decrypt `encrypted_fb_app_secret` via `decryptToken`.
  - Perform code-to-token and short-to-long token exchange using workspace's credentials.

---

## Phase 6: Automated Testing & Quality Gates

- [x] **Task 6.1: Workspace Switcher UI & Integration Tests**
  - Create `apps/web/tests/ui/workspace-switcher.test.tsx`.
  - Test popover toggle, workspace list rendering, create modal open/close, and switch action.

- [x] **Task 6.2: BYOC Settings UI & Diagnostics Tests**
  - Create `apps/web/tests/ui/byoc-settings.test.tsx`.
  - Test credential loading, secret masking toggle, save action, and test connection diagnostic feedback.

- [x] **Task 6.3: Full Monorepo Quality Gate**
  - Run `pnpm turbo run build lint typecheck test`.
  - Verify 0 lint warnings, 0 type errors, 100% test pass rate.
