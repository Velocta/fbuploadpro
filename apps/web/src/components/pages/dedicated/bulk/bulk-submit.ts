import type { PostFormat } from '@fbuploadpro/contracts';
import { ApiError } from '@/lib/api';
import {
  BulkEnqueueResponseSchema,
  type BulkEnqueueResponse,
} from '@/lib/api/schemas/queue';
import {
  buildFacebookEnqueueRequest,
  resolveFacebookDestinationId,
  submitDestinationEnqueue,
} from '../composer/destination-enqueue';

export interface BulkSubmitItem {
  mediaId: string;
  format: PostFormat;
  caption: string;
  scheduledTime: string;
}

export interface BulkCreateInput {
  pageId: string;
  subdomain: string;
  items: BulkSubmitItem[];
}

/** Attempts per row before the row is reported failed (429 back-off). */
const MAX_ATTEMPTS_PER_ITEM = 3;
/** Fallback wait when a 429 carries no parseable wait time. */
const DEFAULT_RATE_LIMIT_WAIT_MS = 10_000;
/** Never wait longer than this for one back-off, whatever the server says. */
const MAX_RATE_LIMIT_WAIT_MS = 65_000;

function rateLimitWaitMs(err: ApiError): number {
  const match = /wait (\d+) seconds/i.exec(err.message);
  const seconds = match ? Number(match[1]) : NaN;
  const ms = Number.isFinite(seconds)
    ? (seconds + 1) * 1000
    : DEFAULT_RATE_LIMIT_WAIT_MS;
  return Math.min(ms, MAX_RATE_LIMIT_WAIT_MS);
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Bulk-create submit plumbing on the typed API client (spec 137 §3.1,
 * spec 132 C2.5), RETARGETED to the unified destination enqueue
 * (Phase 7 gate G4, spec 119).
 *
 * The unified backend ships a single-item enqueue only — there is no
 * bulk endpoint — so a run submits one enqueue per row, sequentially,
 * and synthesises the same per-row result shape the modal has always
 * consumed (`{ results: [{ ok, itemId?, error? }] }`). Each row keeps
 * the exact scheduled time the review step computed (submitted as the
 * `scheduled` intent), so the times the user confirmed are the times
 * that land. Two consequences of the shape change, both deliberate:
 *
 *   - A row's HTTP failure is reported on that row (with the server's
 *     message) instead of failing the whole run; a destination that
 *     cannot be resolved still throws before any row is submitted, so
 *     the modal's refused-run path (an `ApiError` with kind 'http')
 *     reports it against every row, exactly as a refused bulk request
 *     did.
 *   - The enqueue endpoint is rate-limited per IP (60/min). A large
 *     run can legitimately hit that limit mid-run; a 429 row waits
 *     out the server's stated back-off and retries (bounded), rather
 *     than failing rows the legacy single request would have carried.
 */
export async function submitBulkCreate(input: BulkCreateInput): Promise<BulkEnqueueResponse> {
  const { pageId, subdomain, items } = input;

  const destinationId = await resolveFacebookDestinationId({ subdomain, pageId });

  const results: BulkEnqueueResponse['results'] = [];
  for (const item of items) {
    const request = buildFacebookEnqueueRequest(destinationId, {
      format: item.format,
      caption: item.caption,
      link: '',
      items: [
        {
          id: item.mediaId,
          mediaType: item.format === 'video' || item.format === 'reel' ? 'video' : 'image',
        },
      ],
      intent: 'schedule',
      scheduleDate: new Date(item.scheduledTime),
    });

    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        const created = await submitDestinationEnqueue(subdomain, request);
        results.push({ ok: true, itemId: created.id });
        break;
      } catch (err) {
        if (
          err instanceof ApiError &&
          err.status === 429 &&
          attempt < MAX_ATTEMPTS_PER_ITEM
        ) {
          await sleep(rateLimitWaitMs(err));
          continue;
        }
        results.push({
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : "Couldn't add this post. Please try again.",
        });
        break;
      }
    }
  }

  return BulkEnqueueResponseSchema.parse({ results });
}
