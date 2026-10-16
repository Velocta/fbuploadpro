# Contracts: Rebuild Workspace Settings Facebook Tab

## Endpoints

### 1. `GET /api/tenant/[subdomain]/settings/byoc`
- **Method**: `GET`
- **Session**: Required (`fbup_session`)
- **Tenant Scope**: Session user must have tenant access to `[subdomain]`.
- **Response `200 OK`**:
  ```ts
  {
    workspaceId: string;
    subdomain: string;
    fbAppId: string;
    hasSecret: boolean;
    status: 'unverified' | 'valid' | 'invalid';
    lastTestedAt: string | null;
    connectedAt: string | null;
  }
  ```

### 2. `PUT /api/tenant/[subdomain]/settings/byoc`
- **Method**: `PUT`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```ts
  {
    fbAppId: string; // 10-20 numeric digits
    fbAppSecret?: string; // required on initial setup, optional when updating
  }
  ```
- **Response `200 OK`**:
  ```ts
  {
    success: true;
    hasSecret: true;
    status: 'unverified';
    connectedAt: string;
  }
  ```

### 3. `DELETE /api/tenant/[subdomain]/settings/byoc`
- **Method**: `DELETE`
- **Headers**: None
- **Response `200 OK`**:
  ```ts
  {
    success: true;
    disconnected: true;
  }
  ```
- **Behavior**: Deletes the row in `workspace_byoc_credentials` corresponding to the tenant's workspace. All other tables (`facebook_accounts`, `facebook_pages`, `queue_items`, `media_items`) are untouched.
