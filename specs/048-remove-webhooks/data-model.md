# Data Model: Webhook Removal & Updated BYOC Credentials Schema

## Updated Database Schema

```sql
-- Table: public.workspace_byoc_credentials (Updated)
ALTER TABLE public.workspace_byoc_credentials
  DROP COLUMN IF EXISTS webhook_verify_token;
```

### Table Structure After Migration
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `workspace_id` | `UUID` | `PRIMARY KEY, REFERENCES workspaces(id) ON DELETE CASCADE` | Scoped workspace ID |
| `fb_app_id` | `VARCHAR(255)` | `NOT NULL` | Meta App ID |
| `encrypted_fb_app_secret`| `TEXT` | `NOT NULL` | AES-256-GCM encrypted App Secret |
| `status` | `VARCHAR(50)` | `DEFAULT 'unverified'` | Validation status (`unverified`, `valid`, `invalid`) |
| `last_tested_at` | `TIMESTAMPTZ` | `NULL` | Timestamp of last connection test |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | Last update timestamp |

## Updated Domain Contracts (`packages/contracts`)

### 1. `BYOCCredentialsView`
```typescript
export const BYOCCredentialsViewSchema = z.object({
  workspaceId: z.string().uuid(),
  subdomain: z.string(),
  fbAppId: z.string().default(''),
  hasSecret: z.boolean().default(false),
  status: BYOCStatusSchema.default('unverified'),
  lastTestedAt: z.coerce.date().nullable().optional(),
});
```

### 2. `SaveBYOCCredentialsRequest`
```typescript
export const SaveBYOCCredentialsRequestSchema = z.object({
  fbAppId: z.string().trim().min(1, 'Facebook App ID is required').max(100),
  fbAppSecret: z.string().trim().min(1, 'Facebook App Secret is required').max(255).optional(),
});
```

### 3. `RESERVED_SUBDOMAINS`
```typescript
export const RESERVED_SUBDOMAINS = [
  'admin',
  'api',
  'app',
  'auth',
  'billing',
  'dashboard',
  'internal',
  'mail',
  'status',
  'system',
  'test',
  'www',
] as const;
```
