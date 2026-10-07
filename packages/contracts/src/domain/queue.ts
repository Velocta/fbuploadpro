import { z } from 'zod';

// ==========================================
// Page Queue Slots (T115)
// ==========================================

// Slot Time regex: HH:MM or HH:MM:SS (24-hour format)
export const SlotTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Invalid time format. Expected HH:MM or HH:MM:SS');

// IANA Timezone validation
export const TimezoneSchema = z.string().min(1).max(50).default('UTC');

// Create Slot Request
export const CreateQueueSlotRequestSchema = z.object({
  pageId: z.string().uuid(),
  slotTime: SlotTimeSchema,
  timezone: TimezoneSchema,
});

export type CreateQueueSlotRequest = z.infer<typeof CreateQueueSlotRequestSchema>;

// Update Slot Request
export const UpdateQueueSlotRequestSchema = z.object({
  slotTime: SlotTimeSchema.optional(),
  timezone: TimezoneSchema.optional(),
  isActive: z.boolean().optional(),
});

export type UpdateQueueSlotRequest = z.infer<typeof UpdateQueueSlotRequestSchema>;

// Queue Slot Domain Model
export const PageQueueSlotSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  pageId: z.string().uuid(),
  slotTime: z.string(),
  timezone: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PageQueueSlot = z.infer<typeof PageQueueSlotSchema>;

// List Slots Response
export const ListQueueSlotsResponseSchema = z.object({
  slots: z.array(PageQueueSlotSchema),
  total: z.number().int().nonnegative(),
});

export type ListQueueSlotsResponse = z.infer<typeof ListQueueSlotsResponseSchema>;

// ==========================================
// Queue Management & Enqueueing (T116)
// ==========================================

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
