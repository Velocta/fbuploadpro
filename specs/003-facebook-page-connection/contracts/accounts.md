# Interface Contract: Facebook Accounts Management (Multi-Account)

This document defines the schemas and API contracts for managing multiple connected Facebook accounts per tenant workspace.

---

## 1. Zod Schemas

```typescript
import { z } from 'zod';
import { FacebookAccountStatusSchema } from './facebook';

// Sanitized view model for UI presentation (zero token or secret exposure)
export const FacebookAccountViewSchema = z.object({
  id: z.string().uuid(),
  fbAccountId: z.string().min(1).max(100),
  displayName: z.string().min(1).max(255),
  status: FacebookAccountStatusSchema,
  tokenExpiresAt: z.coerce.date().nullable(),
  connectedPagesCount: z.number().int().nonnegative().default(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type FacebookAccountView = z.infer<typeof FacebookAccountViewSchema>;

export const ListFacebookAccountsResponseSchema = z.object({
  accounts: z.array(FacebookAccountViewSchema),
  total: z.number().int().nonnegative(),
});
export type ListFacebookAccountsResponse = z.infer<typeof ListFacebookAccountsResponseSchema>;

export const DisconnectAccountResponseSchema = z.object({
  success: z.boolean(),
  accountId: z.string().uuid(),
  disconnectedPagesCount: z.number().int().nonnegative(),
});
export type DisconnectAccountResponse = z.infer<typeof DisconnectAccountResponseSchema>;
```

---

## 2. Endpoint Contracts

### 2.1 List Connected Accounts (`GET /api/tenant/[subdomain]/accounts`)
Retrieves all connected Facebook accounts for the active tenant workspace.

- **Guards**: Session authenticated; tenant subdomain ownership verified.
- **Response `200 OK`**:
  ```json
  {
    "accounts": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "fbAccountId": "1000123456789",
        "displayName": "Alex Morgan (Agency Lead)",
        "status": "active",
        "tokenExpiresAt": "2026-12-06T12:00:00.000Z",
        "connectedPagesCount": 3,
        "createdAt": "2026-10-07T12:00:00.000Z",
        "updatedAt": "2026-10-07T12:00:00.000Z"
      },
      {
        "id": "987fcdeb-51a2-43f1-9876-543210987654",
        "fbAccountId": "1000987654321",
        "displayName": "Taylor Swift Marketing",
        "status": "expired",
        "tokenExpiresAt": "2026-10-01T00:00:00.000Z",
        "connectedPagesCount": 1,
        "createdAt": "2026-08-02T10:00:00.000Z",
        "updatedAt": "2026-10-01T00:00:00.000Z"
      }
    ],
    "total": 2
  }
  ```
- **Security**: Raw access tokens and encryption ciphertexts are completely excluded.

---

### 2.2 Disconnect Account (`DELETE /api/tenant/[subdomain]/accounts/[accountId]`)
Disconnects an individual Facebook account and cascades removal of all its linked pages.

- **Guards**: Session authenticated; tenant subdomain ownership verified; composite tenant assertion `(user_id, accountId)`.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "accountId": "123e4567-e89b-12d3-a456-426614174000",
    "disconnectedPagesCount": 3
  }
  ```
- **Isolation Guarantee**: Disconnecting this account has zero effect on any other connected account or its pages.
