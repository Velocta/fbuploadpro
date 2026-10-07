# Contract: Caption Templates API

This document defines the REST API endpoints, Zod validation schemas, and contracts for reusable copywriting templates in the Media Library.

---

## 1. List Caption Templates

### Endpoint
`GET /api/tenant/[subdomain]/media/captions`

### Response Schema (`CaptionListResponseSchema`)
```typescript
import { z } from 'zod';

export const CaptionTemplateResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(150),
  content: z.string().min(1).max(5000),
  tags: z.array(z.string().min(1).max(50)),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CaptionListResponseSchema = z.object({
  templates: z.array(CaptionTemplateResponseSchema),
});

export type CaptionTemplateResponse = z.infer<typeof CaptionTemplateResponseSchema>;
export type CaptionListResponse = z.infer<typeof CaptionListResponseSchema>;
```

---

## 2. Create Caption Template

### Endpoint
`POST /api/tenant/[subdomain]/media/captions`

### Request Body Schema (`CreateCaptionTemplateRequestSchema`)
```typescript
export const CreateCaptionTemplateRequestSchema = z.object({
  title: z.string().trim().min(1).max(150),
  content: z.string().trim().min(1).max(5000),
  tags: z.array(z.string().trim().min(1).max(50)).default([]),
});

export type CreateCaptionTemplateRequest = z.infer<typeof CreateCaptionTemplateRequestSchema>;
```

### Response Schema
Returns created `CaptionTemplateResponseSchema`.

### Error Responses
- `400 Bad Request`: Validation failure.
- `409 Conflict`: `CAPTION_TITLE_ALREADY_EXISTS`.

---

## 3. Update Caption Template

### Endpoint
`PATCH /api/tenant/[subdomain]/media/captions/[captionId]`

### Request Body Schema (`UpdateCaptionTemplateRequestSchema`)
```typescript
export const UpdateCaptionTemplateRequestSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  content: z.string().trim().min(1).max(5000).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).optional(),
});

export type UpdateCaptionTemplateRequest = z.infer<typeof UpdateCaptionTemplateRequestSchema>;
```

### Response Schema
Returns updated `CaptionTemplateResponseSchema`.

---

## 4. Delete Caption Template

### Endpoint
`DELETE /api/tenant/[subdomain]/media/captions/[captionId]`

### Response Schema (`DeleteCaptionTemplateResponseSchema`)
```typescript
export const DeleteCaptionTemplateResponseSchema = z.object({
  success: z.literal(true),
  deletedCaptionId: z.string().uuid(),
});

export type DeleteCaptionTemplateResponse = z.infer<typeof DeleteCaptionTemplateResponseSchema>;
```
