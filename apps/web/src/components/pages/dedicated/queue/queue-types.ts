import type { FacebookPageItem } from '../../page-card';
import type { PostFormat } from '@fbuploadpro/contracts';

/**
 * A queue item as rendered by the Content tab. Shape is identical to the
 * previous tab implementation so the page route keeps working unchanged.
 */
export interface DedicatedQueueItem {
  id: string;
  mediaId?: string | null;
  postFormat?: PostFormat;
  linkUrl?: string | null;
  caption?: string | null;
  firstComment?: string | null;
  scheduledTime: string;
  status: 'queued' | 'publishing' | 'published' | 'failed' | 'skipped' | 'cancelled';
  retryCount?: number;
  maxRetries?: number;
  fbPostId?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  media?: {
    name: string;
    mediaType: 'video' | 'image';
    thumbnailUrl?: string | null;
    url: string;
    aspectRatio?: string;
    durationSeconds?: number | null;
  } | null;
}

export interface PageTabQueueProps {
  page: FacebookPageItem;
  queueItems: DedicatedQueueItem[];
  isLoading?: boolean;
  onPublishNow: (itemId: string) => Promise<void>;
  onUpdateItem: (itemId: string, data: { caption?: string; firstComment?: string | null }) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onOpenAddQueue: () => void;
  /**
   * Optional backstop called after every successful queue mutation
   * (reorder, reschedule, edit, delete, retry, bulk add) so the page route
   * can refresh its own queue data — keeping the dashboard/calendar tabs
   * in sync without a full page reload.
   */
  onMutated?: () => void;
}

/** Content-tab status filter. "Queued" = slot-based, "Scheduled" = custom time. */
export type QueueFilter = 'all' | 'queued' | 'scheduled' | 'published' | 'failed';

export const QUEUE_FILTERS: ReadonlyArray<QueueFilter> = [
  'all',
  'queued',
  'scheduled',
  'published',
  'failed',
];

export const QUEUE_FILTER_LABELS: Record<QueueFilter, string> = {
  all: 'All',
  queued: 'Queued',
  scheduled: 'Scheduled',
  published: 'Published',
  failed: 'Failed',
};
