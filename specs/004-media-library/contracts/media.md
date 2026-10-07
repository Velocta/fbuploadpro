# Contract: Media Upload, Ingestion & Asset Management API

This document defines the REST API endpoints, Zod boundary validation schemas, and payload contracts for media uploads, confirmations, filtering, updates, and purging.

---

## 1. Request Presigned Upload URL

### Endpoint
`POST /api/tenant/[subdomain]/media/upload-url`

### Purpose
Validates storage quota and MIME type, then generates presigned Cloudflare R2 `PUT` URLs for both the primary media binary and client-generated thumbnail preview.

### Request Body Schema (`UploadUrlRequestSchema`)
```typescript
import { z } from 'zod';

export const UploadUrlRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(524288000), // Max 500 MB
  mimeType: z.enum([
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]),
  thumbnailMimeType: z.enum(['image/webp', 'image/jpeg']).default('image/webp'),
});

export type UploadUrlRequest = z.infer<typeof UploadUrlRequestSchema>;
```

### Response Schema (`UploadUrlResponseSchema`)
```typescript
export const UploadUrlResponseSchema = z.object({
  mediaId: z.string().uuid(),
  mediaKey: z.string(),
  mediaUploadUrl: z.string().url(),
  thumbnailKey: z.string(),
  thumbnailUploadUrl: z.string().url(),
  publicMediaUrl: z.string().url(),
  publicThumbnailUrl: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
});

export type UploadUrlResponse = z.infer<typeof UploadUrlResponseSchema>;
```

### Error Responses
- `400 Bad Request`: `INVALID_MIME_TYPE` or `FILE_TOO_LARGE`
- `403 Forbidden`: `INSUFFICIENT_STORAGE_QUOTA` (Remaining quota is less than `fileSize`)
- `401 Unauthorized`: Unauthenticated / invalid session

---

## 2. Confirm Uploaded Media Asset

### Endpoint
`POST /api/tenant/[subdomain]/media/confirm`

### Purpose
Called by client immediately after successful `PUT` transfers to Cloudflare R2. Atomically records asset metadata, commits quota consumption, and links initial folders/tags.

### Request Body Schema (`ConfirmUploadRequestSchema`)
```typescript
export const ConfirmUploadRequestSchema = z.object({
  mediaId: z.string().uuid(),
  name: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.enum([
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]),
  mediaType: z.enum(['video', 'image']),
  storageKey: z.string().min(1).max(500),
  url: z.string().url(),
  thumbnailKey: z.string().min(1).max(500).nullable().optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
  durationSeconds: z.number().nonnegative().nullable().optional(),
  aspectRatio: z.string().min(1).max(20).default('unknown'),
  folderId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().min(1).max(50)).default([]),
  captionTemplateId: z.string().uuid().nullable().optional(),
  captionText: z.string().max(5000).nullable().optional(),
});

export type ConfirmUploadRequest = z.infer<typeof ConfirmUploadRequestSchema>;
```

### Response Schema (`MediaItemResponseSchema`)
```typescript
export const MediaItemResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
  name: z.string(),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
  mediaType: z.enum(['video', 'image']),
  storageKey: z.string(),
  url: z.string().url(),
  thumbnailKey: z.string().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  durationSeconds: z.number().nullable(),
  aspectRatio: z.string(),
  tags: z.array(z.string()),
  captionTemplateId: z.string().uuid().nullable(),
  captionText: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MediaItemResponse = z.infer<typeof MediaItemResponseSchema>;
```

---

## 3. List & Filter Media Items

### Endpoint
`GET /api/tenant/[subdomain]/media`

### Query Parameters Schema (`MediaListQuerySchema`)
```typescript
export const MediaListQuerySchema = z.object({
  folderId: z.string().uuid().or(z.literal('unorganized')).optional(),
  mediaType: z.enum(['video', 'image']).optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type MediaListQuery = z.infer<typeof MediaListQuerySchema>;
```

### Response Schema (`MediaListResponseSchema`)
```typescript
export const MediaListResponseSchema = z.object({
  items: z.array(MediaItemResponseSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type MediaListResponse = z.infer<typeof MediaListResponseSchema>;
```

---

## 4. Get, Update & Delete Media Item

### Endpoints
- `GET /api/tenant/[subdomain]/media/[mediaId]` -> Returns `MediaItemResponse`
- `PATCH /api/tenant/[subdomain]/media/[mediaId]` -> Update name, folder, tags, caption
- `DELETE /api/tenant/[subdomain]/media/[mediaId]` -> Purges asset from R2 & DB, refunds storage quota

### Update Request Schema (`UpdateMediaItemRequestSchema`)
```typescript
export const UpdateMediaItemRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  folderId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().min(1).max(50)).optional(),
  captionTemplateId: z.string().uuid().nullable().optional(),
  captionText: z.string().max(5000).nullable().optional(),
});

export type UpdateMediaItemRequest = z.infer<typeof UpdateMediaItemRequestSchema>;
```

### Delete Response Schema (`DeleteMediaItemResponseSchema`)
```typescript
export const DeleteMediaItemResponseSchema = z.object({
  success: z.literal(true),
  mediaId: z.string().uuid(),
  reclaimedBytes: z.number().int().positive(),
  remainingQuotaBytes: z.number().int().nonnegative(),
});

export type DeleteMediaItemResponse = z.infer<typeof DeleteMediaItemResponseSchema>;
```
