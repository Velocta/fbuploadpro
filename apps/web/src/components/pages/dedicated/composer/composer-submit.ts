import { z } from 'zod';
import type { PostFormat } from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import type { PageSlotSummary } from '../tab-dashboard';
import type { ComposerIntent } from './intent-selector';
import type { ComposerMediaItem } from './composer-media-area';
import { formatSlotLong, formatSlotShort } from './queue-slot-utils';
import {
  buildFacebookEnqueueRequest,
  resolveFacebookDestinationId,
  submitDestinationEnqueue,
} from './destination-enqueue';

/**
 * Composer submit plumbing on the typed API client (spec 137 §3.1,
 * spec 132 C1.4). The success bodies of the queue mutations are not
 * consumed by the composer (the host refetches on `onSubmitted`), so
 * the response schema is a passthrough object: the client's error taxonomy
 * still applies in full — a failed request throws an `ApiError` carrying
 * the server's plain-language message, never a silent return.
 */
const QueueMutationAckSchema = z.object({}).passthrough();

export interface CreatePostInput {
  pageId: string;
  subdomain: string;
  /** The page's Facebook id from the host's page read, when held —
   *  destination resolution fetches it otherwise. */
  fbPageId?: string | null;
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
 * Creates a post for all three intents and returns the toast message.
 *
 * RETARGETED (Phase 7 gate G4, spec 119): creation submits through the
 * unified destination enqueue, inserting into the unified `queue_items`
 * the worker publishes from. Post now and Schedule pass an explicit
 * time (the `now`/`scheduled` intents); Queue omits it so the server
 * resolves the destination's next vacant unified posting slot. The
 * toast copy is unchanged — including the queue line, which is still
 * computed from the page's slot summaries the composer displays (the
 * slot READ path repoints with the Phase 7 queue surfaces; the submit
 * path is what this retarget owns).
 */
export async function submitCreatePost(input: CreatePostInput): Promise<string> {
  const { pageId, subdomain, format, items, caption, link, intent } = input;

  let message: string;
  if (intent === 'now') {
    message = `Posted to ${input.pageName}.`;
  } else if (intent === 'schedule' && input.scheduleDate) {
    message = `Scheduled for ${formatSlotLong(input.scheduleDate, input.scheduleTimezone)}.`;
  } else {
    message = input.nextSlotOccurrence
      ? `Added to queue — goes out ${formatSlotShort(input.nextSlotOccurrence, input.nextSlotForFormat?.timezone)}.`
      : 'Added to queue.';
  }

  const destinationId = await resolveFacebookDestinationId({
    subdomain,
    pageId,
    fbPageId: input.fbPageId,
  });
  const request = buildFacebookEnqueueRequest(destinationId, {
    format,
    caption,
    link,
    items,
    intent,
    scheduleDate: input.scheduleDate,
  });
  await submitDestinationEnqueue(subdomain, request);
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
 *
 * NOT retargeted by G4: the items this flow edits are legacy queue
 * items (the queue panel's read path is legacy until the Phase 7
 * cutover completes), and the unified backend ships no per-item
 * update or publish-now action — those are the unified queue
 * surfaces' actions (spec 134 PR-134-3 / Phase 7). Only the CREATE
 * path moved to the unified enqueue.
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
