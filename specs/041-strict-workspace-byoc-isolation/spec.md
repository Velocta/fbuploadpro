# Feature Specification: 041-strict-workspace-byoc-isolation

**Feature Branch**: `fetch_upstream_main_changes`
**Created**: 2026-10-14
**Status**: Approved
**Input**: Strict Per-Workspace Facebook BYOC, Multi-Workspace Account/Page Isolation, and Global User Media Library

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 100% Strict Per-Workspace Facebook BYOC (Priority: P1)

As a workspace administrator, I want Facebook publishing in my workspace to execute exclusively with my workspace's own Meta Developer App ID and App Secret, so the platform operator never requires or provides a global shared Facebook App, eliminating multi-tenant token mixing and platform credential liability.

**Why this priority**:
Zero platform process.env credential fallbacks enforces complete security compliance, multi-tenant IP isolation, and alignment with Meta developer policies.

**Independent Test**:
Can be fully tested by attempting direct OAuth initiation (`/api/auth/facebook`), magic link generation, or callback without configured workspace BYOC credentials, verifying they fail fast with a typed `BYOC_NOT_CONFIGURED` directive, and verifying that once configured, OAuth code and token exchanges use strictly the active workspace's credentials.

**Acceptance Scenarios**:
1. **Given** a workspace where BYOC credentials have not been configured, **When** the user attempts to connect a Facebook account via Direct OAuth or Magic Link, **Then** the request is blocked and the user is redirected or instructed to configure Facebook BYOC in Settings with zero fallback to global platform environment variables.
2. **Given** a workspace with valid BYOC credentials configured in `workspace_byoc_credentials`, **When** the user initiates Facebook OAuth, **Then** the Facebook authorization dialog opens using that workspace's configured `fb_app_id`, and callback exchanges long-lived tokens using that workspace's decrypted `fb_app_secret`.
3. **Given** an environment where `FACEBOOK_APP_ID` or `FACEBOOK_APP_SECRET` are present or absent in `process.env`, **When** any Facebook OAuth or publishing flow runs, **Then** `process.env` credentials are completely ignored and never referenced.

---

### User Story 2 - Fix Security & Logic Bugs in BYOC Settings & Test Endpoints (Priority: P1)

As a workspace owner, I want `/api/tenant/[subdomain]/settings/byoc` and its test connection endpoint to enforce strict workspace ownership checks and reject first-time credential saves that omit an App Secret, so that empty secrets cannot silently succeed with zero rows updated and workspace ownership cannot be bypassed.

**Why this priority**:
Prevents silent credential setup failure (where omitting secret on first save succeeds with 200 without creating a credential row) and enforces defense-in-depth ownership verification (`owner_id = session.userId`).

**Independent Test**:
Can be fully tested by sending a PUT request to `/api/tenant/[subdomain]/settings/byoc` on a fresh workspace with empty `fbAppSecret` and asserting HTTP 400 Bad Request, and attempting requests with mismatched subdomain ownership asserting HTTP 404/403.

**Acceptance Scenarios**:
1. **Given** a workspace with no existing row in `workspace_byoc_credentials`, **When** the client submits a PUT request with `fbAppId` but leaves `fbAppSecret` empty, **Then** the server responds with HTTP 400 Bad Request and an informative message requiring the App Secret for initial setup.
2. **Given** a workspace with an existing row in `workspace_byoc_credentials` containing an encrypted secret, **When** the client submits a PUT request with a new `fbAppId` and empty `fbAppSecret`, **Then** the server updates the App ID while preserving the existing secret.
3. **Given** a user requesting BYOC settings or connection testing for a subdomain they do not own, **Then** the server rejects the request with HTTP 404 or 403, and never attempts a blind upsert on `workspaces`.

---

### User Story 3 - Rename Settings Section to "Facebook BYOC" & Add Pre-Connect UX Guard (Priority: P1)

As a workspace operator, I want the Settings tab and header to clearly state "Facebook BYOC" and the Accounts page to warn me if BYOC is unconfigured before I attempt connecting accounts, so that I understand exactly what configuration is required.

**Why this priority**:
Establishes the clean platform convention for future "Instagram BYOC" while preparing for future platform-provided X and TikTok credentials, preventing frustrating failed OAuth attempts.

**Independent Test**:
Can be fully tested in UI components by asserting the presence of the "Facebook BYOC" tab label and header, and observing the pre-connection alert banner and prompt modal when visiting `/tenant/[subdomain]/accounts` with unconfigured BYOC.

**Acceptance Scenarios**:
1. **Given** the workspace settings view (`/tenant/[subdomain]/settings`), **When** the page renders, **Then** the tab and section header read "Facebook BYOC" instead of "BYOC Facebook App".
2. **Given** a workspace without configured Facebook BYOC credentials, **When** visiting `/tenant/[subdomain]/accounts`, **Then** a prominent warning banner is rendered guiding the user to configure Facebook BYOC, and clicking "Connect Facebook Account" displays an advisory dialog routing directly to Settings.

---

### User Story 4 - Strict Per-Workspace Isolation for Accounts, Pages, Slots, Queues & Insights (Priority: P1)

As a multi-workspace user, I want Facebook accounts, pages, publishing slots, queue items, publish logs, and daily insights created in Workspace 1 to be completely invisible and inaccessible in Workspace 2, so that distinct brands or clients remain strictly partitioned.

**Why this priority**:
Eliminates cross-workspace resource bleed where a single user's multiple workspaces could see or manipulate each other's social profiles, queues, or analytics.

**Independent Test**:
Can be fully tested by creating Facebook accounts and pages in Workspace A, then querying `/api/tenant/[subdomain]/accounts`, `/pages`, `/slots`, `/publishing/queue`, `/publishing/logs`, and `/insights` under Workspace B of the same user, and asserting zero records bleed across workspaces.

**Acceptance Scenarios**:
1. **Given** Facebook Account 1 and Page 1 connected in Workspace A, **When** querying accounts or pages in Workspace B owned by the same user, **Then** Account 1 and Page 1 are not returned.
2. **Given** Page 1 belonging to Workspace A, **When** a client sends a request to `/api/tenant/[subdomainB]/pages/[page1Id]` or its slots/insights subroutes, **Then** the server responds with HTTP 404 Page not found.
3. **Given** queue items and publish logs generated for Page 1 in Workspace A, **When** listing queue items or publish logs in Workspace B, **Then** only queue items and logs belonging to Workspace B's pages are returned.

---

### User Story 5 - Global User Media Library & Downloader Across All Workspaces (Priority: P1)

As a creator or marketing team managing multiple workspaces under one user account, I want my Media Library (`media_folders`, `media_items`) and Cloud Downloader to be global per user across all my workspaces, so I never have to re-upload or re-download videos and images when switching workspaces.

**Why this priority**:
Ensures high operator efficiency: uploaded media assets and saved cloud downloads belong to the user's creative vault and can be scheduled to any connected page across any of their workspaces.

**Independent Test**:
Can be fully tested by uploading a video or creating a folder in Workspace A, switching to Workspace B of the same user, and verifying that the folder and media item are instantly visible, editable, and schedulable in Workspace B, while remaining completely inaccessible to any different user.

**Acceptance Scenarios**:
1. **Given** User 1 uploading media in Workspace A, **When** User 1 navigates to the Media Library in Workspace B, **Then** all folders and media items from User 1 are visible.
2. **Given** User 2 in their own workspace, **When** User 2 lists media folders or items, **Then** none of User 1's media items or folders are visible or accessible (strict `user_id` multi-tenant isolation).
3. **Given** `media_folders` and `media_items` database tables, **Then** `workspace_id` is nullable, sibling folder uniqueness is enforced per user (`user_id, parent_id, LOWER(name)`), and RLS policies enforce `auth.uid() = user_id`.

---

### User Story 6 - Comprehensive Regression & Isolation QA (Priority: P1)

As a platform engineer and QA specialist, I want rigorous automated test suites verifying strict per-workspace BYOC enforcement, cross-workspace account/page isolation, global user media visibility, and settings UI edge cases, ensuring zero regressions.

**Why this priority**:
Guarantees continuous delivery confidence and non-negotiable verification of multi-tenant isolation rules.

**Independent Test**:
Verified through dedicated Vitest suites in `apps/web/tests/security/multi-workspace-resource-isolation.test.ts`, `apps/web/tests/api/auth-facebook.test.ts`, `apps/web/tests/api/multi-account-oauth.test.ts`, and `apps/web/tests/ui/byoc-settings.test.tsx`.

**Acceptance Scenarios**:
1. Test suite asserts OAuth initiation rejects unconfigured workspaces without falling back to `process.env`.
2. Test suite asserts accounts and pages in Workspace A never bleed into Workspace B.
3. Test suite asserts media items and folders are accessible across all workspaces of the same user.
4. Test suite asserts Settings UI renders "Facebook BYOC" and blocks first-time saves omitting App Secret.

---

### Edge Cases

- **First-time BYOC save with omitted secret**: Server returns HTTP 400 Bad Request with `"Enter your Facebook App Secret to complete setup."`
- **Subsequent BYOC save with omitted secret**: Server preserves existing encrypted secret and updates App ID and webhook verify token.
- **Magic link OAuth initiated without BYOC**: `/api/tenant/[subdomain]/accounts/magic-link` returns HTTP 422 `BYOC_NOT_CONFIGURED` preventing issuance of dead links.
- **Direct OAuth initiated without BYOC**: `/api/auth/facebook` redirects to `/tenant/${subdomain}/settings?tab=byoc&error=credentials_required`.
- **Direct OAuth callback on workspace mismatch**: State contains `tenantSubdomain` and `userId`; callback validates credentials and upserts account scoped to `workspace_id`.
- **Page Slots / Insights requested for page belonging to another workspace**: Route resolves active workspace from subdomain, checks `facebook_pages.workspace_id = workspace.id`, returns HTTP 404 if not matching.
- **Folder creation with duplicate name under same parent**: Rejected with HTTP 409 Conflict based on user-level sibling constraint.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST eradicate all references to `process.env.FACEBOOK_APP_ID` and `process.env.FACEBOOK_APP_SECRET` across runtime code and example environment files.
- **FR-002**: System MUST provide a centralized server credential resolver `resolveWorkspaceFacebookCredentials` querying `workspace_byoc_credentials` for the workspace matching `subdomain` and `owner_id`.
- **FR-003**: System MUST require both `fb_app_id` and `encrypted_fb_app_secret` to be configured in `workspace_byoc_credentials` before permitting Facebook OAuth initiation.
- **FR-004**: System MUST reject first-time BYOC credential saves that omit `fbAppSecret` with HTTP 400 Bad Request.
- **FR-005**: System MUST allow subsequent BYOC credential updates to omit `fbAppSecret`, preserving the existing encrypted secret.
- **FR-006**: System MUST query `workspaces` strictly by `subdomain` and `owner_id = session.userId` across all BYOC settings and test endpoints, returning 404 if not found.
- **FR-007**: System MUST rename the settings navigation tab and section heading to "Facebook BYOC" in `/tenant/[subdomain]/settings`.
- **FR-008**: System MUST render a pre-connection warning banner and advisory modal on `/tenant/[subdomain]/accounts` when Facebook BYOC is not configured.
- **FR-009**: System MUST persist and query `facebook_accounts` and `facebook_pages` with `workspace_id` scoping, ensuring accounts and pages are strictly partitioned per workspace.
- **FR-010**: System MUST enforce that `/pages/[pageId]/slots/**`, `/publishing/queue/**`, `/publishing/logs`, and `/pages/[pageId]/insights` scope operations to pages belonging to the active `workspace_id`.
- **FR-011**: System MUST make `workspace_id` nullable on `media_folders` and `media_items` via forward migration `20261014180000_global_user_media_library.sql`.
- **FR-012**: System MUST enforce sibling-level folder uniqueness per user (`user_id, parent_id, LOWER(name)`) on `media_folders`.
- **FR-013**: System MUST update Row Level Security policies on `media_folders` and `media_items` to `auth.uid() = user_id`, enabling global access across all workspaces owned by the user.
- **FR-014**: System MUST align domain contracts `DatabaseMediaFolderRow` and `DatabaseMediaItemRow` to reflect nullable `workspace_id`.
- **FR-015**: System MUST deliver all database migrations strictly via forward SQL migration files without direct Supabase MCP mutation.

### Key Entities

- **Workspace BYOC Credentials (`workspace_byoc_credentials`)**: Workspace-scoped Facebook App credentials (`workspace_id`, `fb_app_id`, `encrypted_fb_app_secret`, `status`, `last_tested_at`).
- **Facebook Account (`facebook_accounts`)**: Workspace-scoped connected profile (`workspace_id`, `user_id`, `fb_account_id`, `display_name`, `status`, `token_expires_at`).
- **Facebook Page (`facebook_pages`)**: Workspace-scoped managed Facebook page (`workspace_id`, `user_id`, `facebook_account_id`, `fb_page_id`, `page_name`, `status`).
- **Media Folder (`media_folders`)**: Global user asset hierarchy (`user_id`, `parent_id`, `name`).
- **Media Item (`media_items`)**: Global user video/image asset (`user_id`, `folder_id`, `name`, `storage_key`, `url`, `caption_text`).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Facebook OAuth connections strictly use workspace-level BYOC credentials with 0 fallback to global environment variables.
- **SC-002**: 100% isolation across workspaces: zero accounts, pages, queues, or insights from Workspace A appear in Workspace B of the same user.
- **SC-003**: 100% global user media availability: all media items and folders created by a user are immediately available in any workspace owned by that user.
- **SC-004**: Zero silent BYOC setup failures: initial credential saves without an App Secret fail immediately with clear inline feedback.
- **SC-005**: 100% automated test pass rate for all security isolation and API regression test suites.

---

## Assumptions

- The platform operator does not configure global Facebook App credentials; every customer workspace provides its own App ID and Secret.
- Future integrations for X (Twitter) and TikTok will provide platform-level credentials, whereas Facebook and Instagram follow the BYOC pattern.
- The user account (`user_id`) is the boundary of media asset ownership, while the workspace (`workspace_id`) is the boundary of social network connections and scheduling.
- AES-256-GCM token encryption uses `TOKEN_ENCRYPTION_KEY` on the web app and `FB_ENCRYPTION_MASTER_KEY` on the worker.
