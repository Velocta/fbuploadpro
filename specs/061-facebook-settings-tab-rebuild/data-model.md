# Data Model: Rebuild Workspace Settings Facebook Tab

## Database Schema (Existing & Unchanged)

### `public.workspace_byoc_credentials`
No schema migrations are required. The existing table structure is utilized:

```sql
CREATE TABLE IF NOT EXISTS workspace_byoc_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fb_app_id VARCHAR(100) NOT NULL,
    encrypted_fb_app_secret TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'valid', 'invalid')),
    last_tested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_workspace_byoc UNIQUE (workspace_id),
    CONSTRAINT uq_workspace_byoc_user UNIQUE (user_id, workspace_id)
);
```

## API Payload Models

### GET `/api/tenant/[subdomain]/settings/byoc`
Response:
```json
{
  "workspaceId": "22222222-2222-4222-a222-222222222222",
  "subdomain": "acme",
  "fbAppId": "123456789012345",
  "hasSecret": true,
  "status": "valid",
  "lastTestedAt": "2026-10-16T12:00:00Z",
  "connectedAt": "2026-10-16T10:00:00Z"
}
```

### PUT `/api/tenant/[subdomain]/settings/byoc`
Request:
```json
{
  "fbAppId": "123456789012345",
  "fbAppSecret": "my_app_secret"
}
```
Response:
```json
{
  "success": true,
  "hasSecret": true,
  "status": "unverified",
  "connectedAt": "2026-10-16T12:00:00Z"
}
```

### DELETE `/api/tenant/[subdomain]/settings/byoc`
Request: No body required.
Response:
```json
{
  "success": true,
  "disconnected": true
}
```

## Frontend State Model (`BYOCSettingsView`)

```ts
interface FacebookTabState {
  isLoading: boolean;
  isSaving: boolean;
  isDisconnecting: boolean;
  isEditMode: boolean;
  showDisconnectModal: boolean;
  toast: { text: string; type: 'success' | 'error' } | null;
  // State 1 form fields
  appId: string;
  appSecret: string;
  showSecretInput: boolean;
  appIdError: string | null;
  appSecretError: string | null;
  // Saved credentials info
  savedCredentials: {
    fbAppId: string;
    hasSecret: boolean;
    connectedAt: string | null;
  } | null;
  // Clipboard
  copiedField: string | null;
  showSecretMasked: boolean;
}
```
