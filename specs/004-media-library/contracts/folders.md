# Contract: Media Folders API

This document defines the REST API endpoints, Zod boundary validation schemas, and contracts for organizational folders in the Media Library.

---

## 1. List Folders

### Endpoint
`GET /api/tenant/[subdomain]/media/folders`

### Response Schema (`FolderListResponseSchema`)
```typescript
import { z } from 'zod';

export const FolderResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  color: z.string().min(1).max(20),
  itemCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const FolderListResponseSchema = z.object({
  folders: z.array(FolderResponseSchema),
  unorganizedCount: z.number().int().nonnegative(),
});

export type FolderResponse = z.infer<typeof FolderResponseSchema>;
export type FolderListResponse = z.infer<typeof FolderListResponseSchema>;
```

---

## 2. Create Folder

### Endpoint
`POST /api/tenant/[subdomain]/media/folders`

### Request Body Schema (`CreateFolderRequestSchema`)
```typescript
export const CreateFolderRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.enum([
    'slate',
    'blue',
    'green',
    'purple',
    'amber',
    'rose',
    'emerald',
    'indigo',
  ]).default('slate'),
});

export type CreateFolderRequest = z.infer<typeof CreateFolderRequestSchema>;
```

### Response Schema
Returns `FolderResponseSchema` with `itemCount: 0`.

### Error Responses
- `400 Bad Request`: Validation failure.
- `409 Conflict`: `FOLDER_NAME_ALREADY_EXISTS` (Name collision within user workspace).

---

## 3. Update Folder

### Endpoint
`PATCH /api/tenant/[subdomain]/media/folders/[folderId]`

### Request Body Schema (`UpdateFolderRequestSchema`)
```typescript
export const UpdateFolderRequestSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  color: z.enum([
    'slate',
    'blue',
    'green',
    'purple',
    'amber',
    'rose',
    'emerald',
    'indigo',
  ]).optional(),
});

export type UpdateFolderRequest = z.infer<typeof UpdateFolderRequestSchema>;
```

### Response Schema
Returns updated `FolderResponseSchema`.

---

## 4. Delete Folder (Non-Destructive)

### Endpoint
`DELETE /api/tenant/[subdomain]/media/folders/[folderId]`

### Purpose
Permanently removes the custom folder while preserving all contained assets (reassigns their `folder_id` to `NULL`).

### Response Schema (`DeleteFolderResponseSchema`)
```typescript
export const DeleteFolderResponseSchema = z.object({
  success: z.literal(true),
  deletedFolderId: z.string().uuid(),
  preservedItemsCount: z.number().int().nonnegative(),
});

export type DeleteFolderResponse = z.infer<typeof DeleteFolderResponseSchema>;
```
