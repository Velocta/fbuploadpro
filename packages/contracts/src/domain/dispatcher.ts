import { z } from 'zod';

// ==========================================
// Edge Dispatcher & Facebook Graph API Contracts (T117)
// ==========================================

// Due Queue Item claimed by worker
export const ClaimedQueueItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  pageId: z.string().uuid(),
  mediaId: z.string().uuid(),
  caption: z.string(),
  firstComment: z.string().nullable(),
  retryCount: z.number().int().nonnegative(),
  maxRetries: z.number().int().nonnegative(),
  // Joined media details
  mediaType: z.enum(['video', 'image']),
  mediaUrl: z.string().url(),
  storageKey: z.string(),
  // Joined page details
  fbPageId: z.string(),
  encryptedPageToken: z.string(),
  pageName: z.string(),
});

export type ClaimedQueueItem = z.infer<typeof ClaimedQueueItemSchema>;

// Dispatch Outcome
export interface DispatchOutcome {
  queueItemId: string;
  status: 'published' | 'failed' | 'retry';
  fbPostId?: string;
  fbCommentId?: string;
  errorMessage?: string;
  errorCode?: number;
  tokensDeducted: number;
}

// Publish Log Domain Model
export const PublishLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  queueItemId: z.string().uuid(),
  pageId: z.string().uuid(),
  status: z.enum(['success', 'failure', 'retry']),
  attemptNumber: z.number().int().positive(),
  fbResponseCode: z.number().int().nullable(),
  errorMessage: z.string().nullable(),
  errorDetails: z.record(z.unknown()).nullable(),
  tokensDeducted: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export type PublishLog = z.infer<typeof PublishLogSchema>;

// List Publish Logs Query
export const ListPublishLogsQuerySchema = z.object({
  pageId: z.string().uuid().optional(),
  status: z.enum(['success', 'failure', 'retry']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type ListPublishLogsQuery = z.infer<typeof ListPublishLogsQuerySchema>;

// List Publish Logs Response
export const ListPublishLogsResponseSchema = z.object({
  logs: z.array(PublishLogSchema),
  total: z.number().int().nonnegative(),
});

export type ListPublishLogsResponse = z.infer<typeof ListPublishLogsResponseSchema>;

// Dispatcher Service Interface
export interface IPublishDispatcher {
  /**
   * Atomically claims due queue items using FOR UPDATE SKIP LOCKED
   */
  claimDueItems(limit?: number): Promise<ClaimedQueueItem[]>;

  /**
   * Dispatches a single claimed item to Facebook Graph API v26.0
   */
  dispatchItem(item: ClaimedQueueItem): Promise<DispatchOutcome>;

  /**
   * Settles atomic 1-token decrement on success or logs failure
   */
  settleOutcome(outcome: DispatchOutcome): Promise<void>;

  /**
   * Executes the full claim-dispatch-settle batch cycle
   */
  runDispatchCycle(limit?: number): Promise<{ processed: number; succeeded: number; failed: number }>;
}

// Facebook Graph API Client Interface
export interface IFacebookPublishClient {
  /**
   * Publishes a video/reel via 3-phase session
   */
  publishReel(params: {
    pageId: string;
    accessToken: string;
    videoUrl: string;
    caption: string;
  }): Promise<{ postId: string }>;

  /**
   * Publishes an image/photo
   */
  publishPhoto(params: {
    pageId: string;
    accessToken: string;
    imageUrl: string;
    caption: string;
  }): Promise<{ postId: string }>;

  /**
   * Posts an automated first comment
   */
  postComment(params: {
    postId: string;
    accessToken: string;
    message: string;
  }): Promise<{ commentId: string }>;
}
