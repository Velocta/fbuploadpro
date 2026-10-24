/**
 * X enqueue request assembly (spec 132 §4.5; enabling backend #750).
 *
 * The X slice of the contracts `DestinationEnqueueRequestSchema`
 * discriminated union, spelled out field-for-field like the Facebook
 * slice in `../destination-enqueue.ts`: the union's inferred
 * `platformOptions` widens across platforms, so each platform composer
 * names its own request shape and submits it through the shared
 * `submitDestinationEnqueue` (the server validates the full body
 * against the contracts schema — the strict X options schema rejects
 * anything outside poll / replySettings / quote / altText, so no
 * thread-chain keys can ever be sent: chains are not authored in v1).
 *
 * Media rule: at most ONE attachment. The unified queue item carries a
 * single primary media and the X publisher uploads exactly one file,
 * so `mediaItemIds` holds zero or one id — the composer's media area
 * blocks a second attachment rather than dropping one silently.
 */
import type { XPlatformOptions, XReplySettings } from '@fbuploadpro/contracts';
import type { ComposerIntent } from '../intent-selector';
import type { XMediaItem } from './x-media-area';
import type { XPostKind } from './x-slot-utils';

export type XEnqueueRequest = {
  platform: 'x';
  destinationId: string;
  kind: XPostKind;
  platformFormat?: string | null;
  caption: string;
  title?: string | null;
  firstComment?: string | null;
  mediaItemIds: string[];
  linkUrl?: string | null;
  intent: 'now' | 'scheduled' | 'queue';
  scheduledAt?: string;
  platformOptions?: XPlatformOptions;
};

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
export function xPostKind(item: XMediaItem | null): XPostKind {
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
