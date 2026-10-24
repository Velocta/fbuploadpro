import type { DedicatedQueueItem } from '../pages/dedicated/queue/queue-types';

/**
 * Plain-language failure reason for a unified destination queue item
 * (spec 134 §3.5) — never a raw platform error. The platform-named
 * equivalent of the Page panel's `getFailedReason` (§5.1.5: the same
 * sentence shapes, with the platform's name substituted): for a
 * Facebook destination the output is byte-identical to the legacy
 * mapper's. The item's stored error is only ever INPUT to this
 * mapper (its detail keywords refine the sentence); it never renders.
 */
export function getDestinationFailedReason(
  item: DedicatedQueueItem,
  platformLabel: string,
  connectionDown: boolean,
  errorDetail?: string | null
): string {
  if (connectionDown) {
    return `Your ${platformLabel} connection expired before this posted.`;
  }
  const detail = (errorDetail ?? '').toLowerCase();
  if (/(upload|media file|attachment)/.test(detail)) {
    return 'The media upload failed.';
  }
  if (/(reject|declin|policy|spam|not accept|permission|forbidden)/.test(detail)) {
    return `${platformLabel} didn't accept this post.`;
  }
  if (
    item.retryCount != null &&
    item.maxRetries != null &&
    item.retryCount >= item.maxRetries
  ) {
    return `Tried ${item.maxRetries} times and still couldn't publish.`;
  }
  return 'Something went wrong while publishing.';
}
