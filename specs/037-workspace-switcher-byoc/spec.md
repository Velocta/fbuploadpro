# Spec 037: Workspace Switcher, Dedicated Settings Hub & Strict BYOC Facebook Credentials

## 1. Executive Summary & Vision
This specification defines the multi-workspace experience, a dedicated settings control plane, and strict Bring Your Own Credentials (BYOC) Facebook App management:
1. **Workspace Switcher in SidebarHeader**: Implements the canonical shadcn `TeamSwitcher` pattern at the top of the sidebar. Displays the active workspace monogram, name, subdomain slug, and `ChevronsUpDown` toggle. Clicking opens a dropdown with user-owned workspaces, active checkmark, a "Create Workspace" modal action, and direct "Workspace Settings" link.
2. **Dedicated Settings Hub**: A dedicated layout under `/tenant/[subdomain]/settings` featuring secondary navigation tabs:
   - **General**: Workspace name, subdomain slug, creation date, owner details.
   - **BYOC Facebook App**: Bring Your Own Credentials control panel for Facebook App ID, encrypted App Secret, Webhook Verify Token, copy helpers, setup instructions, and Test Connection button.
   - **Audit Logs**: Configuration change and access audit log.
3. **Strict BYOC (Bring Your Own Credentials)**: Each workspace manages its own Facebook App credentials. Secrets are encrypted using AES-256-GCM with `FB_ENCRYPTION_MASTER_KEY` / `TOKEN_ENCRYPTION_KEY`, masked in the UI (`••••••••`), and never returned in plaintext to the browser.
4. **OAuth Dynamic BYOC Binding**: The Facebook OAuth connection flow (`/api/auth/facebook` and `/api/auth/facebook/callback`) dynamically resolves the initiating workspace's App ID and decrypted App Secret, enforcing that each workspace publishes under its own Meta Developer Application.

---

## 2. User Stories & Acceptance Criteria

### User Story 1 (P1): Workspace Switcher & Multi-Workspace Management
As a creator managing multiple brands or client accounts,  
I want to switch between my workspaces directly from the top of the sidebar and create new workspaces on demand,  
So that I can keep assets, publishing queues, and credentials completely isolated per brand without logging in and out.

- **Scenario 1.1: Active Workspace Presentation**
  - **Given** an authenticated user is on their workspace,
  - **When** the sidebar renders,
  - **Then** the `SidebarHeader` displays a `SidebarMenuButton` (`size="lg"`) with a 32px rounded monogram avatar (derived from workspace name/subdomain), the workspace name, the subdomain slug, and a `ChevronsUpDown` icon on the right.

- **Scenario 1.2: Workspace Switcher Popover Menu**
  - **Given** the user clicks the workspace header button,
  - **When** the menu opens,
  - **Then** an unclipped floating popover menu renders showing:
    1. A "Workspaces" header label.
    2. A list of all workspaces owned by the user (`workspaces.owner_id = user.id`), with monogram, name, subdomain, and a checkmark next to the active workspace.
    3. A separator line.
    4. A "Create Workspace" button with a `Plus` icon.
    5. A "Workspace Settings" link with a `Settings` icon.

- **Scenario 1.3: Workspace Switching Action**
  - **Given** the user has multiple workspaces,
  - **When** the user clicks an inactive workspace in the dropdown,
  - **Then** the client invokes `POST /api/workspaces/switch` with the selected `subdomain`, which updates the user's `fbup_session` cookie to the new workspace subdomain and redirects the user to the target workspace root.

- **Scenario 1.4: Create Workspace Modal & Auto-Generated Subdomain**
  - **Given** the user clicks "Create Workspace",
  - **When** the modal opens,
  - **Then** the user is prompted only for the **Workspace Name** (subdomain input is omitted to eliminate manual slug fatigue).
  - **When** the form is submitted,
  - **Then** the backend automatically creates a unique workspace subdomain by directly concatenating the user's primary/main workspace base subdomain with a 4-letter random lowercase alphabetical string (`[main-subdomain][4-random-letters]`, e.g. `acmexyza`), creates the record in `workspaces`, issues an updated session cookie, and navigates to the new workspace.

---

### User Story 2 (P2): Dedicated Settings Hub & Sub-Navigation
As an operator,  
I want a dedicated, structured Settings Hub accessible from the sidebar, workspace switcher, and user menu,  
So that I can configure workspace parameters and integrations in a clean, focused control center.

- **Scenario 2.1: Settings Hub Layout & Navigation**
  - **Given** the user navigates to `/tenant/[subdomain]/settings`,
  - **When** the page renders,
  - **Then** it presents a dedicated Settings layout with sub-navigation tabs:
    - `General` (default tab)
    - `BYOC Facebook App`
    - `Audit Logs`
  - **And** the workspace sidebar highlights the "Settings" navigation button.

- **Scenario 2.2: General Settings Tab**
  - **Given** the user is on the `General` settings tab,
  - **When** viewing the tab,
  - **Then** it displays workspace details: Name (editable), Subdomain slug (read-only), Created date, and Owner email.

- **Scenario 2.3: Access from Multiple Entry Points**
  - **Given** any authenticated workspace view,
  - **When** the user clicks:
    1. The "Settings" button in `WorkspaceSidebar` content,
    2. The "Workspace Settings" item in `WorkspaceSwitcher` dropdown, or
    3. The "Settings" item in `WorkspaceUserMenu` footer dropdown,
  - **Then** the user is navigated directly to `/tenant/[subdomain]/settings`.

---

### User Story 3 (P3): Strict BYOC (Bring Your Own Credentials) Facebook App Settings
As a workspace owner,  
I want to configure my own Facebook App ID and App Secret for each workspace,  
So that my publishing operations use my dedicated Meta App quotas and branding without sharing platform-wide credentials.

- **Scenario 3.1: BYOC Configuration Panel**
  - **Given** the user is on `/tenant/[subdomain]/settings` under the `BYOC Facebook App` tab,
  - **When** the tab loads,
  - **Then** it surfaces:
    - Facebook App ID input field.
    - Facebook App Secret input field, masked as password (`••••••••`) with a show/hide eye toggle.
    - Optional Webhook Verify Token input field.
    - Live connection status dot (`STATUS_SIGNALS.online` if verified, `STATUS_SIGNALS.warning` if unverified, `STATUS_SIGNALS.offline` if invalid).
    - "Save Credentials" button and "Test App Connection" diagnostic button.

- **Scenario 3.2: AES-256-GCM Encryption at Rest & Zero Plaintext Leaks**
  - **Given** the user saves a new App Secret,
  - **When** the payload is submitted to `PUT /api/tenant/[subdomain]/settings/byoc`,
  - **Then** the server encrypts the secret using AES-256-GCM via `encryptToken` before storing in `workspace_byoc_credentials`.
  - **And** `GET /api/tenant/[subdomain]/settings/byoc` returns `{ hasSecret: true, fbAppId: "...", status: "..." }` without ever exposing the raw secret.

- **Scenario 3.3: Copy Helpers & Developer Instructions**
  - **Given** the user is setting up their Facebook App on the Meta Developer Portal,
  - **When** viewing the BYOC tab,
  - **Then** copyable 1-click helper cards are provided for:
    - **OAuth Valid Redirect URI**: `https://{rootDomain}/api/auth/facebook/callback`
    - **Webhook Callback URL**: `https://{rootDomain}/api/webhooks/facebook`
    - **Webhook Verify Token**
  - **And** a clear checklist of required Facebook Graph API permissions (`pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `business_management`) is displayed.

- **Scenario 3.4: Test Connection Diagnostics**
  - **Given** credentials are saved,
  - **When** the user clicks "Test App Connection",
  - **Then** the backend executes `POST /api/tenant/[subdomain]/settings/byoc/test` which queries Meta Graph API `https://graph.facebook.com/v26.0/{appId}?access_token={appId}|{appSecret}`.
  - **If valid**, the status is updated to `valid`, a green unboxed dot is shown, and a success banner confirms app reachability.
  - **If invalid**, the status is updated to `invalid`, a red unboxed dot is shown, and the error description from Meta is surfaced cleanly.

---

### User Story 4 (P3): Dynamic OAuth Credential Binding
As an operator connecting Facebook accounts,  
I want the OAuth connect flow to dynamically use my workspace's BYOC credentials,  
So that tokens are minted under my workspace's Meta App.

- **Scenario 4.1: Pre-OAuth BYOC Verification**
  - **Given** a user clicks "Connect Facebook Account" in `/tenant/[subdomain]/accounts`,
  - **When** the workspace has no valid BYOC credentials configured,
  - **Then** the user is prevented from connecting and redirected to `/tenant/[subdomain]/settings?tab=byoc` with an informative banner explaining that Facebook App credentials must be configured first.

- **Scenario 4.2: Dynamic Token Exchange**
  - **Given** a workspace has valid BYOC credentials configured,
  - **When** `/api/auth/facebook` initiates OAuth,
  - **Then** it passes the workspace's `fb_app_id` to Facebook's OAuth dialog and stores `workspaceId` in the signed `state` payload.
  - **When** Facebook calls `/api/auth/facebook/callback`,
  - **Then** the callback decrypts the workspace's `encrypted_fb_app_secret` and performs short-to-long token exchange using the workspace's specific App credentials.
