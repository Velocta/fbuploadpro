# Requirements Checklist: Spec 037 - Workspace Switcher, Dedicated Settings Hub & Strict BYOC Facebook Credentials

## Quality & Governance Checklist

- [ ] **Multi-Workspace Data Substrate**
  - [ ] Migration `20261013110000_workspace_byoc_credentials.sql` creates `workspaces` table with `id`, `owner_id`, `name`, `subdomain`, timestamps.
  - [ ] Migration backfills existing `users` into `workspaces` with matching `subdomain`.
  - [ ] Migration creates `workspace_byoc_credentials` table with compound foreign key and uniqueness constraint on `workspace_id`.
  - [ ] Migration has rollback safety and clean indexes.

- [ ] **Domain Contracts (`@fbuploadpro/contracts`)**
  - [ ] `WorkspaceItemSchema`, `CreateWorkspaceRequestSchema`, `SwitchWorkspaceRequestSchema`.
  - [ ] `BYOCCredentialsViewSchema`, `SaveBYOCCredentialsRequestSchema`, `TestBYOCResponseSchema`.
  - [ ] Proper barrel exports in `packages/contracts/src/index.ts`.

- [ ] **Workspace Switcher & Multi-Workspace Navigation**
  - [ ] `WorkspaceSwitcher` component placed in `SidebarHeader` conforming to shadcn `TeamSwitcher` pattern.
  - [ ] Monogram avatar, active workspace name, subdomain subtitle, `ChevronsUpDown` toggle.
  - [ ] Popover dropdown showing all owned workspaces with active checkmark.
  - [ ] `POST /api/workspaces/switch` issues updated `fbup_session` cookie for active workspace.
  - [ ] `CreateWorkspaceModal` validates name and subdomain slug with live preview.
  - [ ] `POST /api/workspaces` validates unique subdomain and provisions initial workspace.

- [ ] **Dedicated Settings Hub**
  - [ ] Dedicated route `/tenant/[subdomain]/settings` with sub-navigation tabs (`General`, `BYOC Facebook App`, `Audit Logs`).
  - [ ] Accessible from `WorkspaceSidebar` content navigation.
  - [ ] Accessible from `WorkspaceSwitcher` popover menu.
  - [ ] Accessible from `WorkspaceUserMenu` footer dropdown.
  - [ ] `General` tab displays workspace name, subdomain, creation date, owner.
  - [ ] `Audit Logs` tab displays workspace event history.

- [ ] **Strict BYOC Facebook App Control Center**
  - [ ] `BYOC Facebook App` tab in Settings Hub.
  - [ ] Input fields for App ID, masked App Secret (`••••••••`) with show/hide toggle, and Webhook Verify Token.
  - [ ] Raw secret encrypted at rest with AES-256-GCM (`encryptToken`).
  - [ ] Zero secret leakage: `GET` API returns `hasSecret: boolean` instead of raw secret.
  - [ ] 1-click copy helpers for OAuth Redirect URI and Webhook Callback URL.
  - [ ] Clear Meta Graph API permissions guide (`pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `business_management`).
  - [ ] "Test App Connection" diagnostic button querying Meta Graph API v26.0.
  - [ ] Status indicator using unboxed 6px luminous dot with micro-halos (`STATUS_SIGNALS`).

- [ ] **Dynamic OAuth Credential Resolution**
  - [ ] `/api/auth/facebook` dynamically queries workspace BYOC credentials.
  - [ ] Redirects with error if BYOC credentials are not configured.
  - [ ] `/api/auth/facebook/callback` decrypts workspace App Secret and performs token exchange using workspace credentials.

- [ ] **Engineering & Design System Standards**
  - [ ] Strictly references `apps/web/src/lib/theme.ts`. Zero ad-hoc colors or borders.
  - [ ] Never modifies `DESIGN.md`.
  - [ ] SonarQube compliance: `Readonly<Props>`, zero nested ternaries, cognitive complexity <= 15.
  - [ ] UX Writing: Zero developer jargon, professional human tone, zero fake status badges.
  - [ ] 100% tests pass on `pnpm turbo run build lint typecheck test`.
