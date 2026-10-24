import { z } from 'zod';
import {
  DestinationEnqueueResponseSchema,
  type DestinationEnqueueIntent,
  type DestinationEnqueueKind,
  type FacebookDestinationOptions,
  type Platform,
  type PostFormat,
} from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import { ListSocialAccountsResponseSchema } from '@/lib/api/schemas/accounts';
import type { ComposerIntent } from './intent-selector';
import type { ComposerMediaItem } from './composer-media-area';

/**
 * Unified destination enqueue — the client half of the spec 119/132
 * enabling backend (contracts `DestinationEnqueueRequestSchema`,
 * endpoint merged as the web-enqueue cutover; Phase 7 gate G4).
 *
 * Until this module landed, the composer + bulk submit paths posted to
 * the legacy page-scoped queue route, whose rows land in
 * `legacy_queue_items` — a table the unified worker never reads. Every
 * create now goes to the destination enqueue endpoint and inserts into
 * the unified `queue_items` the claim pipeline actually drains.
 *
 * Destination resolution follows the unified surfaces' pattern (spec
 * 123/131): a Facebook Page's destination is the `destinations` row
 * whose `externalDestinationId` equals the page's Facebook id
 * (`fbPageId`, carried on the page read), found in the unified social
 * accounts list. The page→destination link is data, not convention —
 * a page with no destination row cannot enqueue, and that surfaces as
 * a plain-language error instead of a silent legacy fallback.
 */
export const DESTINATION_ENQUEUE_PATH = '/publishing/destination-queue';

/**
 * The Facebook slice of the contracts enqueue request, spelled out
 * field-for-field against the contracts field types. (The contracts
 * union is built through a generic variant helper, so its inferred
 * `platform` widens to the whole Platform enum and the precise
 * variant cannot be extracted from it; the wire shape — validated
 * server-side by `DestinationEnqueueRequestSchema` — is exactly this.)
 */
export interface FacebookEnqueueRequest {
  platform: 'facebook';
  destinationId: string;
  kind: DestinationEnqueueKind;
  platformFormat?: string | null;
  caption: string;
  title?: string | null;
  firstComment?: string | null;
  mediaItemIds: string[];
  linkUrl?: string | null;
  intent: DestinationEnqueueIntent;
  scheduledAt?: string;
  slotId?: string;
  platformOptions?: FacebookDestinationOptions;
}

/** The page read's Facebook id field (lenient — the composer only
 *  needs this one field from the page object for resolution). */
const PageFbIdResponseSchema = z
  .object({
    page: z
      .object({ fbPageId: z.string().nullable().optional() })
      .passthrough(),
  })
  .passthrough();

async function fetchPageFbId(subdomain: string, pageId: string): Promise<string> {
  const data = await api.get(buildTenantApiPath(subdomain, `/pages/${pageId}`), {
    schema: PageFbIdResponseSchema,
  });
  const fbPageId = data.page.fbPageId;
  if (!fbPageId) {
    throw new Error(
      "Couldn't find this Page's publishing destination. Reconnect the Page, then try again."
    );
  }
  return fbPageId;
}

/**
 * Resolves the unified destination id for a Facebook Page. Pass the
 * `fbPageId` when the caller already holds the page read (the composer
 * does); it is fetched here otherwise (the bulk flow does not read the
 * page today).
 */
export async function resolveFacebookDestinationId(input: {
  subdomain: string;
  pageId: string;
  fbPageId?: string | null | undefined;
}): Promise<string> {
  const fbPageId =
    input.fbPageId ?? (await fetchPageFbId(input.subdomain, input.pageId));
  const data = await api.get(buildTenantApiPath(input.subdomain, '/accounts/social'), {
    schema: ListSocialAccountsResponseSchema,
  });
  for (const account of data.accounts) {
    if (account.platform !== 'facebook') continue;
    const match = account.destinations.find(
      (destination) => destination.externalDestinationId === fbPageId
    );
    if (match) return match.id;
  }
  throw new Error(
    "Couldn't find this Page's publishing destination. Reconnect the Page, then try again."
  );
}

export interface FacebookEnqueueShape {
  format: PostFormat;
  caption: string;
  link: string;
  /** The post's media items; the unified row carries a single primary
   *  media (the first), exactly as the legacy create did. */
  items: Pick<ComposerMediaItem, 'id' | 'mediaType'>[];
  intent: ComposerIntent;
  scheduleDate: Date | null;
}

/**
 * Maps the composer's format/intent vocabulary onto the unified
 * enqueue contract (pure — unit-tested without the network):
 *   - reel is a `video` kind carrying the `reel` platform format
 *     (the unified kind vocabulary has no 'reel');
 *   - story posts carry the media-type hint the Facebook publisher
 *     reads from `platform_options` (spec 122);
 *   - 'schedule' is the contract's 'scheduled', with `scheduledAt`;
 *   - 'queue' carries no time and no slot pin: the server resolves
 *     the destination's next vacant unified posting slot (the
 *     composer's slot summaries are legacy page slots — their ids
 *     are not `posting_slots` ids and must never be sent as `slotId`).
 */
export function buildFacebookEnqueueRequest(
  destinationId: string,
  shape: FacebookEnqueueShape
): FacebookEnqueueRequest {
  const { format, caption, link, items, intent, scheduleDate } = shape;

  const kind =
    format === 'reel' || format === 'video'
      ? ('video' as const)
      : format === 'image'
        ? ('image' as const)
        : format === 'story'
          ? ('story' as const)
          : ('text' as const);

  const request: FacebookEnqueueRequest = {
    platform: 'facebook',
    destinationId,
    kind,
    platformFormat: format === 'reel' ? 'reel' : null,
    caption,
    mediaItemIds: format !== 'text' && items[0] ? [items[0].id] : [],
    intent:
      intent === 'schedule' ? 'scheduled' : intent === 'now' ? 'now' : 'queue',
  };

  const trimmedLink = link.trim();
  if (trimmedLink) request.linkUrl = trimmedLink;
  if (intent === 'schedule' && scheduleDate) {
    request.scheduledAt = scheduleDate.toISOString();
  }
  if (format === 'story' && items[0]) {
    request.platformOptions = { mediaType: items[0].mediaType };
  }
  return request;
}

/**
 * The wire shape every platform's enqueue request shares. Each platform
 * module spells its own slice field-for-field (the Facebook slice above;
 * the X slice in `./x/x-destination-enqueue.ts`) and submits through
 * this one transport — the server validates the full body against the
 * contracts union, so the shared submit only names the common fields.
 */
export type DestinationEnqueueWireRequest = {
  platform: Platform;
  destinationId: string;
  kind: DestinationEnqueueKind;
  caption: string;
  mediaItemIds: string[];
  intent: DestinationEnqueueIntent;
  [key: string]: unknown;
};

/** Submits one unified enqueue and validates the created-item body. */
export async function submitDestinationEnqueue(
  subdomain: string,
  request: FacebookEnqueueRequest | DestinationEnqueueWireRequest
) {
  return api.post(buildTenantApiPath(subdomain, DESTINATION_ENQUEUE_PATH), request, {
    schema: DestinationEnqueueResponseSchema,
  });
}
