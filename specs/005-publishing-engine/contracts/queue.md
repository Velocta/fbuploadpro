# Contracts: Queue Management & Enqueueing

**Branch**: `feat/005-publishing-engine-plan` | **Date**: 2026-10-07 | **Spec**: [specs/005-publishing-engine/spec.md](../spec.md)

This document defines the TypeScript types and Zod validation schemas for queueing media assets, managing scheduled items, and tracking status.

---

## 1. Zod Validation Schemas

```typescript
import { z } from 'zod';

// Queue Item Status
export const QueueItemStatusSchema = z.enum([
  'queued',
  'publishing',
  'published',
  'failed',
  'skipped',
]);

export type QueueItemStatus = z.infer<typeof QueueItemStatusSchema>;

// Enqueue Asset Request
export const EnqueueMediaRequestSchema = z.object({
  pageId: z.string().uuid(),
  mediaId: z.string().uuid(),
  slotId: z.string().uuid().optional(),
  scheduledTime: z.string().datetime().optional(), // If omitted, calculated from next vacant slot
  caption: z.string().max(5000).default(''),
  firstComment: z.string().max(2000).optional(),
});

export type EnqueueMediaRequest = z.infer<typeof EnqueueMediaRequestSchema>;

// Update Queue Item Request
export const UpdateQueueItemRequestSchema = z.object({
  caption: z.string().max(5000).optional(),
  firstComment: z.string().max(2000).optional(),
  scheduledTime: z.string().datetime().optional(),
  status: z.enum(['queued', 'skipped']).optional(),
});

export type UpdateQueueItemRequest = z.infer<typeof UpdateQueueItemRequestSchema>;

// Queue Item Domain Model
export const QueueItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  pageId: z.string().uuid(),
  slotId: z.string().uuid().nullable(),
  mediaId: z.string().uuid(),
  scheduledTime: z.string().datetime(),
  caption: z.string(),
  firstComment: z.string().nullable(),
  status: QueueItemStatusSchema,
  retryCount: z.number().int().nonnegative(),
  maxRetries: z.number().int().nonnegative(),
  fbPostId: z.string().nullable(),
  fbCommentId: z.string().nullable(),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Expanded media fields for UI display
  media: z
    .object({
      name: z.string(),
      mediaType: z.enum(['video', 'image']),
      thumbnailUrl: z.string().nullable(),
      url: z.string(),
      aspectRatio: z.string(),
      durationSeconds: z.number().nullable(),
    })
    .optional(),
});

export type QueueItem = z.infer<typeof QueueItemSchema>;

// List Queue Items Query
export const ListQueueItemsQuerySchema = z.object({
  pageId: z.string().uuid().optional(),
  status: QueueItemStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type ListQueueItemsQuery = z.infer<typeof ListQueueItemsQuerySchema>;

// List Queue Items Response
export const ListQueueItemsResponseSchema = z.object({
  items: z.array(QueueItemSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int(),
  offset: z.number().int(),
});

export type ListQueueItemsResponse = z.infer<typeof ListQueueItemsResponseSchema>;
```

---

## 2. API Endpoints

### 2.1 `POST /api/tenant/[subdomain]/publishing/queue`
Enqueues a media asset into the target Page queue.
- **Pre-flight check**: Verifies active page connection and valid slot schedule.
- **Request Body**: `EnqueueMediaRequest`
- **Response**: `201 Created` with `QueueItem`

### 2.2 `GET /api/tenant/[subdomain]/publishing/queue`
Lists upcoming or historical queue items with optional filters by page and status.
- **Query Params**: `pageId`, `status`, `limit`, `offset`
- **Response**: `200 OK` with `ListQueueItemsResponse`

### 2.3 `PATCH /api/tenant/[subdomain]/publishing/queue/[itemId]`
Updates an item's scheduled time, caption, or marks it as `skipped`.
- **Request Body**: `UpdateQueueItemRequest`
- **Response**: `200 OK` with updated `QueueItem`

### 2.4 `DELETE /api/tenant/[subdomain]/publishing/queue/[itemId]`
Removes an item from the queue before it is published.
- **Response**: `200 OK` with `{ success: true, itemId: string }`

### 2.5 `POST /api/tenant/[subdomain]/publishing/queue/[itemId]/publish-now`
Manually triggers immediate execution for an individual queued item.
- **Response**: `200 OK` with `{ success: true, message: 'Item dispatched for immediate publishing' }`
