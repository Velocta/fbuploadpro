import { z } from 'zod';
import {
  DestinationEnqueueResponseSchema,
  type DestinationEnqueueIntent,
  type DestinationEnqueueKind,
  type FacebookDestinationOptions,
  type InstagramPlatformOptions,
  type Platform,
  type PostFormat,
  type ThreadsPlatformOptions,
  type XPlatformOptions,
  type XReplySettings,
} from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import { ListSocialAccountsResponseSchema } from '@/lib/api/schemas/accounts';
import type { ComposerIntent } from './intent-selector';
import type { ComposerMediaItem } from './composer-media-area';
import type { XMediaItem } from './x/x-media-area';

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

/**
 * The composer format → unified kind/platform-format mapping, shared
 * by the create builder below and the composer EDIT flow's unified
 * branch (composer-submit) so the two can never drift: reel is a
 * `video` kind carrying the `reel` platform format (the unified kind
 * vocabulary has no 'reel'); every other format is its own kind.
 */
export function facebookFormatToUnifiedKind(format: PostFormat): {
  kind: DestinationEnqueueKind;
  platformFormat: string | null;
} {
  if (format === 'reel') return { kind: 'video', platformFormat: 'reel' };
  if (format === 'video') return { kind: 'video', platformFormat: null };
  if (format === 'image') return { kind: 'image', platformFormat: null };
  if (format === 'story') return { kind: 'story', platformFormat: null };
  return { kind: 'text', platformFormat: null };
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

  const { kind, platformFormat } = facebookFormatToUnifiedKind(format);

  const request: FacebookEnqueueRequest = {
    platform: 'facebook',
    destinationId,
    kind,
    platformFormat,
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
 * slice is spelled out field-for-field in this module (Facebook,
 * Instagram, Threads and X below) and submits through this one
 * transport — the server validates the full body against the contracts
 * union, so the shared submit only names the common fields.
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

// ---------------------------------------------------------------------------
// Instagram (spec 132 PR-C3)
// ---------------------------------------------------------------------------

/** The Instagram slice of the contracts enqueue request, spelled out
 *  field-for-field like the Facebook slice above (same widening
 *  rationale; the wire shape is server-validated). */
export interface InstagramEnqueueRequest {
  platform: 'instagram';
  destinationId: string;
  kind: DestinationEnqueueKind;
  platformFormat?: string | null;
  caption: string;
  firstComment?: string | null;
  mediaItemIds: string[];
  intent: DestinationEnqueueIntent;
  scheduledAt?: string;
  slotId?: string;
  platformOptions?: InstagramPlatformOptions;
}

export type InstagramEnqueueFormat = 'photo' | 'reel' | 'carousel' | 'story';

export interface InstagramEnqueueShape {
  format: InstagramEnqueueFormat;
  caption: string;
  firstComment: string;
  /** Selected media in post order. The unified row stores the first as
   *  its primary media; a carousel's full list travels in
   *  `platformOptions.carouselItems`, per the endpoint's contract. */
  items: Array<Pick<ComposerMediaItem, 'id' | 'mediaType' | 'url'>>;
  /** Platform options assembled + validated against
   *  `InstagramPlatformOptionsSchema` by the composer (carouselItems
   *  excluded — the builder derives them from `items`). */
  options: InstagramPlatformOptions;
  intent: ComposerIntent;
  scheduleDate: Date | null;
}

/**
 * Maps the Instagram composer's format/intent vocabulary onto the
 * unified enqueue contract (pure — unit-tested without the network):
 *   - photo is an `image` kind; Reel is a `video` kind carrying the
 *     `reel` platform format (the worker publisher reads exactly this);
 *   - carousel is a `carousel` kind whose full item list (in selection
 *     order) rides in `platformOptions.carouselItems`;
 *   - a Story carries no caption and no first comment — the publisher
 *     ignores both for stories, so they are never sent;
 *   - 'schedule' is the contract's 'scheduled', with `scheduledAt`;
 *     'queue' carries no time and no slot pin (server-resolved).
 */
export function buildInstagramEnqueueRequest(
  destinationId: string,
  shape: InstagramEnqueueShape
): InstagramEnqueueRequest {
  const { format, items, intent, scheduleDate } = shape;
  const isStory = format === 'story';

  const request: InstagramEnqueueRequest = {
    platform: 'instagram',
    destinationId,
    kind:
      format === 'photo'
        ? 'image'
        : format === 'reel'
          ? 'video'
          : format === 'carousel'
            ? 'carousel'
            : 'story',
    platformFormat: format === 'reel' ? 'reel' : null,
    caption: isStory ? '' : shape.caption,
    mediaItemIds: items[0] ? [items[0].id] : [],
    intent:
      intent === 'schedule' ? 'scheduled' : intent === 'now' ? 'now' : 'queue',
  };

  if (!isStory) {
    const firstComment = shape.firstComment.trim();
    if (firstComment) request.firstComment = firstComment;
  }
  if (intent === 'schedule' && scheduleDate) {
    request.scheduledAt = scheduleDate.toISOString();
  }
  if (!isStory) {
    const options: InstagramPlatformOptions = { ...shape.options };
    if (format === 'carousel') {
      options.carouselItems = items.map((item) => ({
        mediaUrl: item.url,
        mediaType: item.mediaType,
      }));
    }
    if (Object.keys(options).length > 0) request.platformOptions = options;
  }
  return request;
}

/** Submits one Instagram enqueue and validates the created-item body. */
export async function submitInstagramEnqueue(
  subdomain: string,
  request: InstagramEnqueueRequest
) {
  return api.post(buildTenantApiPath(subdomain, DESTINATION_ENQUEUE_PATH), request, {
    schema: DestinationEnqueueResponseSchema,
  });
}

// ---------------------------------------------------------------------------
// Threads (spec 132 PR-C4)
// ---------------------------------------------------------------------------

/** The Threads slice of the contracts enqueue request, spelled out
 *  field-for-field like the slices above (same widening rationale; the
 *  wire shape is server-validated). Threads has no first-comment
 *  concept in spec 124, so the field is never sent. */
export interface ThreadsEnqueueRequest {
  platform: 'threads';
  destinationId: string;
  kind: DestinationEnqueueKind;
  platformFormat?: string | null;
  caption: string;
  mediaItemIds: string[];
  intent: DestinationEnqueueIntent;
  scheduledAt?: string;
  slotId?: string;
  platformOptions?: ThreadsPlatformOptions;
}

export interface ThreadsEnqueueShape {
  kind: 'text' | 'image' | 'video' | 'carousel';
  /** The post text (the caption on media posts). */
  text: string;
  /** Selected media in post order. The unified row stores the first as
   *  its primary media; a carousel's full list travels in
   *  `platformOptions.carouselItems`, per the endpoint's contract. */
  items: Array<Pick<ComposerMediaItem, 'id' | 'mediaType' | 'url'>>;
  /** Per-item carousel alt text, by media item id. */
  carouselAltTexts: Record<string, string>;
  /** Platform options assembled + validated against
   *  `ThreadsPlatformOptionsSchema` by the composer (carouselItems
   *  excluded — the builder derives them from `items`). */
  options: ThreadsPlatformOptions;
  intent: ComposerIntent;
  scheduleDate: Date | null;
}

/**
 * Maps the Threads composer's kind/intent vocabulary onto the unified
 * enqueue contract (pure — unit-tested without the network). The kind
 * is the composer's derived kind verbatim (the worker publisher reads
 * exactly these kinds); 'schedule' is the contract's 'scheduled', with
 * `scheduledAt`; 'queue' carries no time and no slot pin
 * (server-resolved).
 */
export function buildThreadsEnqueueRequest(
  destinationId: string,
  shape: ThreadsEnqueueShape
): ThreadsEnqueueRequest {
  const { kind, items, intent, scheduleDate } = shape;

  const request: ThreadsEnqueueRequest = {
    platform: 'threads',
    destinationId,
    kind,
    platformFormat: null,
    caption: shape.text,
    mediaItemIds: items[0] ? [items[0].id] : [],
    intent:
      intent === 'schedule' ? 'scheduled' : intent === 'now' ? 'now' : 'queue',
  };

  if (intent === 'schedule' && scheduleDate) {
    request.scheduledAt = scheduleDate.toISOString();
  }
  const options: ThreadsPlatformOptions = { ...shape.options };
  if (kind === 'carousel') {
    options.carouselItems = items.map((item) => {
      const altText = shape.carouselAltTexts[item.id]?.trim();
      return {
        mediaUrl: item.url,
        mediaType: item.mediaType,
        ...(altText ? { altText } : {}),
      };
    });
  }
  if (Object.keys(options).length > 0) request.platformOptions = options;
  return request;
}

/** Submits one Threads enqueue and validates the created-item body. */
export async function submitThreadsEnqueue(
  subdomain: string,
  request: ThreadsEnqueueRequest
) {
  return api.post(buildTenantApiPath(subdomain, DESTINATION_ENQUEUE_PATH), request, {
    schema: DestinationEnqueueResponseSchema,
  });
}

// ---------------------------------------------------------------------------
// X (spec 132 PR-C2)
// ---------------------------------------------------------------------------

/**
 * The X slice of the contracts enqueue request, spelled out
 * field-for-field like the slices above (same widening rationale; the
 * wire shape is server-validated). The strict X options schema rejects
 * anything outside poll / replySettings / quote / altText, so no
 * thread-chain keys can ever be sent: chains are not authored in v1.
 *
 * Media rule: at most ONE attachment. The unified queue item carries a
 * single primary media and the X publisher uploads exactly one file,
 * so `mediaItemIds` holds zero or one id — the composer's media area
 * blocks a second attachment rather than dropping one silently.
 */
export interface XEnqueueRequest {
  platform: 'x';
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
  platformOptions?: XPlatformOptions;
}

export interface XEnqueueShape {
  /** The post text (the enqueue `caption`). */
  text: string;
  /** The single attached media item, or null for a text post. */
  item: XMediaItem | null;
  intent: ComposerIntent;
  /** Resolved schedule instant — required when intent is 'schedule'. */
  scheduleDate: Date | null;
  replySettings: XReplySettings;
  /** The quoted post's id as typed; blank means no quote. */
  quoteTweetId: string;
  /** Alt text for the attached media; blank means none. */
  altText: string;
  /** The poll, when one is being authored (never with media). */
  poll: { options: string[]; durationMinutes: number } | null;
}

/** The enqueue kind for the current shape: the media decides. */
export function xPostKind(item: XMediaItem | null): DestinationEnqueueKind {
  return item ? item.mediaType : 'text';
}

/**
 * Assembles the request. `replySettings` is always sent (the control is
 * explicit, with "everyone" as its default); quote and alt text ride
 * only when present; the poll rides only when authored.
 */
export function buildXEnqueueRequest(destinationId: string, shape: XEnqueueShape): XEnqueueRequest {
  const platformOptions: XPlatformOptions = { replySettings: shape.replySettings };
  const quoteTweetId = shape.quoteTweetId.trim();
  if (quoteTweetId) {
    platformOptions.quoteTweetId = quoteTweetId;
  }
  if (shape.item && shape.altText.trim()) {
    platformOptions.altText = shape.altText.trim();
  }
  if (shape.poll) {
    platformOptions.poll = {
      options: shape.poll.options.map((option) => option.trim()),
      durationMinutes: shape.poll.durationMinutes,
    };
  }

  const request: XEnqueueRequest = {
    platform: 'x',
    destinationId,
    kind: xPostKind(shape.item),
    caption: shape.text,
    mediaItemIds: shape.item ? [shape.item.id] : [],
    intent: shape.intent === 'schedule' ? 'scheduled' : shape.intent,
    platformOptions,
  };
  if (shape.intent === 'schedule' && shape.scheduleDate) {
    request.scheduledAt = shape.scheduleDate.toISOString();
  }
  return request;
}

/** Submits one X enqueue and validates the created-item body. */
export async function submitXEnqueue(
  subdomain: string,
  request: XEnqueueRequest
) {
  return api.post(buildTenantApiPath(subdomain, DESTINATION_ENQUEUE_PATH), request, {
    schema: DestinationEnqueueResponseSchema,
  });
}
