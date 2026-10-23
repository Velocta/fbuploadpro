import { z } from 'zod';
import type { PostFormat } from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import type { PageSlotSummary } from '../tab-dashboard';
import type { ComposerIntent } from './intent-selector';
import type { ComposerMediaItem } from './composer-media-area';
import { formatSlotLong, formatSlotShort } from './queue-slot-utils';

/**
 * Composer submit plumbing on the typed API client (spec 137 §3.1,
 * spec 132 C1.4). The success bodies of the queue mutations are not
 * consumed by the composer (the host refetches on `onSubmitted`), so the
 * response schema is a passthrough object: the client's error taxonomy
 * still applies in full — a failed request throws an `ApiError` carrying
 * the server's plain-language message, never a silent return.
 */
const QueueMutationAckSchema = z.object({}).passthrough();

export interface CreatePostInput {
  pageId: string;
  subdomain: string;
  format: PostFormat;
  items: ComposerMediaItem[];
  caption: string;
  link: string;
  intent: ComposerIntent;
  scheduleDate: Date | null;
  scheduleTimezone: string;
  nextSlotForFormat: PageSlotSummary | null;
  nextSlotOccurrence: Date | null;
  pageName: string;
}

/**
 * Creates a queue item for all three intents and returns the toast message.
 * Post now and Schedule pass an explicit scheduledTime; Queue omits it so the
 * server computes the next vacant slot for the format.
 */
export async function submitCreatePost(input: CreatePostInput): Promise<string> {
  const { pageId, subdomain, format, items, caption, link, intent } = input;
  const payload: Record<string, unknown> = {
    pageId,
    caption,
    postFormat: format,
  };
  if (format !== 'text' && items[0]) payload.mediaId = items[0].id;
  if (link.trim()) payload.linkUrl = link.trim();

  let message: string;
  if (intent === 'now') {
    payload.scheduledTime = new Date().toISOString();
    message = `Posted to ${input.pageName}.`;
  } else if (intent === 'schedule' && input.scheduleDate) {
    payload.scheduledTime = input.scheduleDate.toISOString();
    message = `Scheduled for ${formatSlotLong(input.scheduleDate, input.scheduleTimezone)}.`;
  } else {
    message = input.nextSlotOccurrence
      ? `Added to queue — goes out ${formatSlotShort(input.nextSlotOccurrence, input.nextSlotForFormat?.timezone)}.`
      : 'Added to queue.';
  }

  await api.post(buildTenantApiPath(subdomain, '/publishing/queue'), payload, {
    schema: QueueMutationAckSchema,
  });
  return message;
}

export interface EditPostInput {
  subdomain: string;
  itemId: string;
  format: PostFormat;
  caption: string;
  link: string;
  intent: ComposerIntent;
  scheduleDate: Date | null;
  wasFailed: boolean;
  pageName: string;
}

/**
 * Updates a queue item in place and returns the toast message. A failed post
 * being edited is re-queued; switching to Post now dispatches it immediately.
 */
export async function submitEditPost(input: EditPostInput): Promise<string> {
  const { subdomain, itemId, format, caption, link, intent } = input;
  const payload: Record<string, unknown> = {
    caption,
    linkUrl: link.trim() || null,
    postFormat: format,
  };
  if (intent === 'schedule' && input.scheduleDate) {
    payload.scheduledTime = input.scheduleDate.toISOString();
  } else if (intent === 'now') {
    payload.scheduledTime = new Date().toISOString();
  }
  if (input.wasFailed) payload.status = 'queued';

  await api.patch(buildTenantApiPath(subdomain, `/publishing/queue/${itemId}`), payload, {
    schema: QueueMutationAckSchema,
  });

  if (intent === 'now') {
    await api.post(
      buildTenantApiPath(subdomain, `/publishing/queue/${itemId}/publish-now`),
      undefined,
      { schema: QueueMutationAckSchema }
    );
    return `Posted to ${input.pageName}.`;
  }
  return 'Post updated.';
}
