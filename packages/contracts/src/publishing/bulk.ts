import { z } from 'zod';
import { PostFormatSchema } from '../domain/publishing.js';

/** Maximum posts accepted in a single bulk-add run. Enforced client- and server-side. */
export const BULK_MAX_ITEMS = 150;

/** One row of a bulk-add run. The client pre-computes the slot/schedule time per row. */
export const BulkQueueItemSchema = z.object({
  mediaId: z.string().uuid().nullable().optional(),
  format: PostFormatSchema,
  caption: z.string().max(5000).optional().default(''),
  linkUrl: z.string().url().nullable().optional(),
  scheduledTime: z.string().datetime(),
});

export type BulkQueueItem = z.infer<typeof BulkQueueItemSchema>;

export const BulkEnqueueRequestSchema = z.object({
  pageId: z.string().uuid(),
  items: z.array(BulkQueueItemSchema).min(1).max(BULK_MAX_ITEMS),
});

export type BulkEnqueueRequest = z.infer<typeof BulkEnqueueRequestSchema>;

export const BulkEnqueueItemResultSchema = z.object({
  ok: z.boolean(),
  itemId: z.string().optional(),
  error: z.string().optional(),
});

export type BulkEnqueueItemResult = z.infer<typeof BulkEnqueueItemResultSchema>;

export const BulkEnqueueResponseSchema = z.object({
  results: z.array(BulkEnqueueItemResultSchema),
});

export type BulkEnqueueResponse = z.infer<typeof BulkEnqueueResponseSchema>;
