# Interface Contract: Facebook Pages Discovery & Selective Ingestion

This document defines the schemas and API contracts for discovering, selectively importing, and managing Facebook Pages. Exclusively Facebook Pages; zero Facebook Groups.

---

## 1. Zod Schemas

```typescript
import { z } from 'zod';
import { FacebookPageStatusSchema } from './facebook';

// In-memory representation of pages discovered from Graph API /me/accounts
export const DiscoveredPageSchema = z.object({
  fbPageId: z.string().min(1).max(100),
  pageName: z.string().min(1).max(255),
  category: z.string().nullable().optional(),
  followersCount: z.number().int().nonnegative().default(0),
  tasks: z.array(z.string()).default([]),
  isImported: z.boolean().default(false),
});
export type DiscoveredPage = z.infer<typeof DiscoveredPageSchema>;

export const DiscoverPagesResponseSchema = z.object({
  accountId: z.string().uuid(),
  accountDisplayName: z.string(),
  pages: z.array(DiscoveredPageSchema),
  total: z.number().int().nonnegative(),
});
export type DiscoverPagesResponse = z.infer<typeof DiscoverPagesResponseSchema>;

// Request schema for selectively importing chosen pages
export const ImportPagesRequestSchema = z.object({
  accountId: z.string().uuid(),
  selectedPageIds: z.array(z.string().min(1).max(100)).min(1),
});
export type ImportPagesRequest = z.infer<typeof ImportPagesRequestSchema>;

export const ImportPagesResponseSchema = z.object({
  success: z.boolean(),
  importedCount: z.number().int().nonnegative(),
  pages: z.array(
    z.object({
      id: z.string().uuid(),
      fbPageId: z.string(),
      pageName: z.string(),
    })
  ),
});
export type ImportPagesResponse = z.infer<typeof ImportPagesResponseSchema>;

// Sanitized view model for imported pages (zero token exposure)
export const FacebookPageViewSchema = z.object({
  id: z.string().uuid(),
  facebookAccountId: z.string().uuid(),
  accountDisplayName: z.string().optional(),
  fbPageId: z.string().min(1).max(100),
  pageName: z.string().min(1).max(255),
  category: z.string().nullable().optional(),
  followersCount: z.number().int().nonnegative(),
  status: FacebookPageStatusSchema,
  tasks: z.array(z.string()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type FacebookPageView = z.infer<typeof FacebookPageViewSchema>;

export const ListFacebookPagesResponseSchema = z.object({
  pages: z.array(FacebookPageViewSchema),
  total: z.number().int().nonnegative(),
});
export type ListFacebookPagesResponse = z.infer<typeof ListFacebookPagesResponseSchema>;

export const DisconnectPageResponseSchema = z.object({
  success: z.boolean(),
  pageId: z.string().uuid(),
});
export type DisconnectPageResponse = z.infer<typeof DisconnectPageResponseSchema>;
```

---

## 2. Endpoint Contracts

### 2.1 Discover Pages for Account (`GET /api/tenant/[subdomain]/accounts/[accountId]/pages/discover`)
Queries Facebook Graph API `/me/accounts` using the specified account's decrypted access token.

- **Guards**: Session authenticated; composite check `(user_id, accountId)`.
- **Response `200 OK`**:
  ```json
  {
    "accountId": "123e4567-e89b-12d3-a456-426614174000",
    "accountDisplayName": "Alex Morgan",
    "pages": [
      {
        "fbPageId": "109876543210987",
        "pageName": "Daily Tech Bytes",
        "category": "Media/News Company",
        "followersCount": 42500,
        "tasks": ["CREATE_CONTENT", "MANAGE", "MODERATE"],
        "isImported": false
      },
      {
        "fbPageId": "543210987654321",
        "pageName": "Viral Reels Central",
        "category": "Entertainment",
        "followersCount": 110200,
        "tasks": ["CREATE_CONTENT", "MANAGE"],
        "isImported": true
      }
    ],
    "total": 2
  }
  ```
- **Strict Scope**: Exclusively pages; zero group objects.

---

### 2.2 Selectively Import Pages (`POST /api/tenant/[subdomain]/pages/import`)
Imports user-selected pages from a discovery scan into the tenant workspace.

- **Request Body**: `ImportPagesRequestSchema`.
- **Processing**:
  1. Verify active session and composite tenant ownership `(user_id, accountId)`.
  2. Fetch account's decrypted access token.
  3. Query `/me/accounts` for the selected `fbPageId` entries.
  4. For each selected page, encrypt its Page Access Token using AES-256-GCM.
  5. Upsert into `facebook_pages` enforcing `uq_fb_pages_user_page`.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "importedCount": 1,
    "pages": [
      {
        "id": "abc12345-e89b-12d3-a456-426614174000",
        "fbPageId": "109876543210987",
        "pageName": "Daily Tech Bytes"
      }
    ]
  }
  ```

---

### 2.3 List Imported Pages (`GET /api/tenant/[subdomain]/pages`)
Returns all imported Facebook Pages across all connected accounts in the workspace.

- **Guards**: Session authenticated; tenant subdomain ownership verified.
- **Query Parameters (optional)**: `accountId` (filter by parent account), `status`.
- **Response `200 OK`**: Returns array conforming to `ListFacebookPagesResponseSchema`.

---

### 2.4 Disconnect Page (`DELETE /api/tenant/[subdomain]/pages/[pageId]`)
Disconnects an individual Facebook Page, purging its stored encrypted token and removing it from publishing targets.

- **Guards**: Session authenticated; composite tenant assertion `(user_id, pageId)`.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "pageId": "abc12345-e89b-12d3-a456-426614174000"
  }
  ```
- **Isolation Guarantee**: Disconnecting this page has zero impact on sibling pages or the parent Facebook account.
