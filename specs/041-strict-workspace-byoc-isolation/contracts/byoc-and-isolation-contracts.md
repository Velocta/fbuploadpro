# Interface Contracts: 041-strict-workspace-byoc-isolation

## 1. Helper Interface: `resolveWorkspaceFacebookCredentials`

```ts
export interface ResolvedBYOCCredentials {
  ok: true;
  workspaceId: string;
  fbAppId: string;
  decryptedAppSecret: string;
  webhookVerifyToken: string | null;
}

export interface UnresolvedBYOCCredentials {
  ok: false;
  error: 'WORKSPACE_NOT_FOUND' | 'BYOC_NOT_CONFIGURED';
  message: string;
}

export type ResolveBYOCResult = ResolvedBYOCCredentials | UnresolvedBYOCCredentials;
```

---

## 2. API Endpoints

### 2.1 `GET /api/tenant/[subdomain]/settings/byoc`
- **Auth**: Authenticated session cookie (`fbup_session`), `canAccessTenant(session, subdomain)`
- **Behavior**: Queries `workspaces` for `.eq('subdomain', subdomain).eq('owner_id', session.userId)`. If not found, returns `404 Workspace not found`.
- **Response**:
  ```json
  {
    "workspaceId": "uuid",
    "subdomain": "string",
    "fbAppId": "string",
    "hasSecret": true,
    "webhookVerifyToken": null,
    "status": "valid",
    "lastTestedAt": "2026-10-14T12:00:00Z"
  }
  ```

### 2.2 `PUT /api/tenant/[subdomain]/settings/byoc`
- **Request Body**:
  ```json
  {
    "fbAppId": "123456789",
    "fbAppSecret": "optional_string",
    "webhookVerifyToken": "optional_string"
  }
  ```
- **Validation**:
  - `workspaces` strictly matching `.eq('subdomain', subdomain).eq('owner_id', session.userId)`.
  - If `fbAppSecret` is omitted/empty: checks if `workspace_byoc_credentials` row exists for `workspaceId` with `encrypted_fb_app_secret`. If no row exists, returns `400 Bad Request` with `{ "error": "Enter your Facebook App Secret to complete setup." }`.
  - If `fbAppSecret` provided: encrypts via `encryptToken(secret, getTokenEncryptionKey())` and upserts row.

### 2.3 `POST /api/tenant/[subdomain]/settings/byoc/test`
- **Behavior**: Queries `workspaces` for `.eq('subdomain', subdomain).eq('owner_id', session.userId)`. If not found, returns `404 Workspace not found`. Tests credentials against Meta Graph API v26.0 `GET https://graph.facebook.com/v26.0/{appId}`.

### 2.4 `GET /api/auth/facebook`
- **Behavior**: Resolves active workspace from `session.subdomain` and `session.userId`. Uses `resolveWorkspaceFacebookCredentials`.
- **If unconfigured**: Redirects to `/tenant/${session.subdomain}/settings?tab=byoc&error=credentials_required`.
- **If configured**: Redirects to Facebook OAuth dialog with `client_id=${fbAppId}`.

### 2.5 `POST /api/tenant/[subdomain]/accounts/magic-link`
- **Behavior**: Resolves active workspace BYOC credentials. If unconfigured, returns `422 Unprocessable Entity` with `{ "error": "BYOC_NOT_CONFIGURED", "message": "Facebook BYOC is not configured for this workspace." }`.

### 2.6 `GET /api/auth/facebook/callback`
- **Behavior**:
  - Resolves workspace from `statePayload.tenantSubdomain` and `statePayload.userId`.
  - Uses that workspace's BYOC credentials for code exchange.
  - Queries/upserts `facebook_accounts` scoped to `workspace_id = workspace.id` with `onConflict: 'workspace_id,fb_account_id'`.
  - Scopes `refreshConnectedPageTokens` to `workspace_id = workspace.id`.

### 2.7 Multi-Workspace Social Read/Mutation Routes
- `GET/DELETE /api/tenant/[subdomain]/accounts/**`: Scoped strictly by `workspace_id = workspace.id`.
- `GET/POST /api/tenant/[subdomain]/pages/**`: Scoped strictly by `workspace_id = workspace.id`.
- `GET/POST /api/tenant/[subdomain]/pages/[pageId]/slots/**`: Page must belong to `workspace_id`.
- `GET/POST /api/tenant/[subdomain]/publishing/queue/**`: Page must belong to `workspace_id`.
- `GET /api/tenant/[subdomain]/publishing/logs`: Filtered to pages belonging to `workspace_id`.
- `GET /api/tenant/[subdomain]/pages/[pageId]/insights`: Page must belong to `workspace_id`.

### 2.8 Global Media Library Routes
- `GET/POST /api/tenant/[subdomain]/media/**`: Filtered and created strictly by `user_id = session.userId`, accessible across all of the user's workspaces.
