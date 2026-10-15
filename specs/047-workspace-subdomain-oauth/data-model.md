# Data Model: 047 Workspace Subdomain BYOC OAuth Alignment

**Feature Directory**: `specs/047-workspace-subdomain-oauth`  
**Status**: In Implementation  
**Created**: 2026-10-15  

---

## 1. Ephemeral OAuth State Envelope

The OAuth state envelope is an HMAC-SHA256 signed JSON payload transmitted in the `state` query parameter to Meta and verified upon callback.

```typescript
export interface OAuthStatePayload {
  tenantSubdomain: string;
  userId: string;
  nonce: string;
  iat: number;
  exp: number;
  isMagic?: boolean;
  expectedFbAccountId?: string;
  expectedDisplayName?: string;
  redirectUri?: string; // Newly added: exact workspace callback URL
}
```

### Validation Schema (`packages/contracts/src/domain/oauth.ts`)
```typescript
export const OAuthStatePayloadSchema = z.object({
  tenantSubdomain: z.string().min(1).max(50),
  userId: z.string().uuid(),
  nonce: z.string().min(16),
  iat: z.number().int(),
  exp: z.number().int(),
  isMagic: z.boolean().optional(),
  expectedFbAccountId: z.string().min(1).optional(),
  expectedDisplayName: z.string().min(1).optional(),
  redirectUri: z.string().url().optional(),
});
```

---

## 2. Database Entities (Unchanged)

Existing tables `workspace_byoc_credentials`, `facebook_accounts`, and `facebook_pages` remain structurally unchanged. No SQL migrations are required.
