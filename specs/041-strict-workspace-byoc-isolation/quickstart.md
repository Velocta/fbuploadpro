# Quickstart Validation Guide: 041-strict-workspace-byoc-isolation

## 1. Prerequisites
- Remote Supabase database credentials configured in `.env.local`
- Monorepo packages installed (`pnpm install`)

## 2. Validation Scenarios

### Scenario A: Strict Per-Workspace BYOC Verification
1. Initiate OAuth on an unconfigured workspace:
   `GET /api/auth/facebook` with session for `unconfigured-workspace`.
   - **Expected**: Redirects to `/tenant/unconfigured-workspace/settings?tab=byoc&error=credentials_required`.
2. Attempt first-time BYOC save with missing secret:
   `PUT /api/tenant/fresh-ws/settings/byoc` with `{ "fbAppId": "12345" }`.
   - **Expected**: HTTP 400 Bad Request with message to enter Facebook App Secret.
3. Configure valid BYOC credentials:
   `PUT /api/tenant/fresh-ws/settings/byoc` with `{ "fbAppId": "12345", "fbAppSecret": "secret123" }`.
   - **Expected**: HTTP 200 OK.
4. Initiate OAuth again:
   - **Expected**: Redirects to Facebook OAuth dialog with `client_id=12345`.

### Scenario B: Multi-Workspace Isolation Verification
1. In Workspace 1 (`alexcreator`), connect Facebook Account A and import Page A.
2. In Workspace 2 (`alexcreatorxyza`), list accounts via `GET /api/tenant/alexcreatorxyza/accounts`.
   - **Expected**: Zero accounts returned (empty list). Account A is not visible.
3. Query `GET /api/tenant/alexcreatorxyza/pages`.
   - **Expected**: Zero pages returned. Page A is not visible.
4. Query `GET /api/tenant/alexcreatorxyza/pages/[pageA_id]`.
   - **Expected**: HTTP 404 Page not found.

### Scenario C: Global User Media Library Across Workspaces
1. In Workspace 1 (`alexcreator`), create folder "Reels 2026" and upload "clip1.mp4".
2. In Workspace 2 (`alexcreatorxyza`), list folders via `GET /api/tenant/alexcreatorxyza/media/folders`.
   - **Expected**: "Reels 2026" is returned.
3. List media items via `GET /api/tenant/alexcreatorxyza/media`.
   - **Expected**: "clip1.mp4" is returned.
4. Schedule "clip1.mp4" to Page B connected in Workspace 2.
   - **Expected**: Enqueued successfully without needing to re-upload.
