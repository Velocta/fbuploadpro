# Interface Contract: Facebook OAuth 2.0 & Token Exchange

This document defines the schemas, state parameters, and endpoint contracts for the Facebook OAuth connection flow.

---

## 1. Zod Schemas

```typescript
import { z } from 'zod';

export const OAuthStatePayloadSchema = z.object({
  tenantSubdomain: z.string().min(1).max(50),
  userId: z.string().uuid(),
  nonce: z.string().min(16),
  iat: z.number().int(),
  exp: z.number().int(),
});
export type OAuthStatePayload = z.infer<typeof OAuthStatePayloadSchema>;

export const FacebookOAuthCallbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1),
  error: z.string().optional(),
  error_reason: z.string().optional(),
  error_description: z.string().optional(),
});
export type FacebookOAuthCallbackQuery = z.infer<typeof FacebookOAuthCallbackQuerySchema>;

export const FacebookTokenExchangeResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().default('bearer'),
  expires_in: z.number().int().optional(), // In seconds (e.g. 5184000 for 60 days)
});
export type FacebookTokenExchangeResponse = z.infer<typeof FacebookTokenExchangeResponseSchema>;

export const FacebookUserProfileResponseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type FacebookUserProfileResponse = z.infer<typeof FacebookUserProfileResponseSchema>;
```

---

## 2. Endpoint Contracts

### 2.1 Initiate OAuth (`GET /api/auth/facebook`)
Initiates the OAuth connection flow for an authenticated tenant workspace.

- **Pre-conditions**: Valid session cookie (`fbup_session`) matching active tenant.
- **Request Headers**: Standard browser GET request.
- **Processing**:
  1. Extract active session (`userId`, `subdomain`).
  2. Generate signed `OAuthStatePayload` with 10-minute expiry.
  3. Construct Facebook authorization URL with scopes:
     `pages_show_list,pages_read_engagement,pages_manage_posts,business_management`.
  4. Respond with `302 Found` redirect to Facebook OAuth dialog.

---

### 2.2 OAuth Callback (`GET /api/auth/facebook/callback`)
Handles the authorization code redirect from Facebook.

- **Query Parameters**: Validated against `FacebookOAuthCallbackQuerySchema`.
- **Processing**:
  1. Verify signed `state` parameter: HMAC signature, validity period (`exp`), and match against active session (`userId`, `subdomain`).
  2. If `error` is present, redirect to `/tenant/{subdomain}/accounts?error={error_description}`.
  3. Exchange temporary `code` for short-lived token via Graph API.
  4. Exchange short-lived token for long-lived token (~60 days) via `fb_exchange_token`.
  5. Fetch Facebook user profile via Graph API `/me`.
  6. Symmetrically encrypt the long-lived token using AES-256-GCM (`TOKEN_ENCRYPTION_KEY`).
  7. Upsert into `facebook_accounts` on conflict `(user_id, fb_account_id)`:
     - Updates `encrypted_access_token`, `token_expires_at`, `status = 'active'`, `updated_at = now()`.
  8. Redirect to `/tenant/{subdomain}/accounts?connected=1`.
- **Error Handling**: Graceful redirect with sanitized error parameters; never leak tokens or keys.
