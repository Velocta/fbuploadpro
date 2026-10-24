import {
  INSTAGRAM_CAROUSEL_MAX_ITEMS,
  INSTAGRAM_CAROUSEL_MIN_ITEMS,
  INSTAGRAM_MAX_COLLABORATORS,
  InstagramPlatformOptionsSchema,
  validateInstagramCaption,
  validateInstagramImageFacts,
  validateInstagramVideoFacts,
  type InstagramPlatformOptions,
} from '@fbuploadpro/contracts';
import type { ComposerIntent } from '../intent-selector';
import type { DestinationMediaItem } from '../destination/destination-media';

/**
 * Instagram composer validation (spec 132 §4.1) — a behavioural clone
 * of the Facebook composer's validation split: one decision point
 * (`computeInstagramValidationError`) decides whether submit is allowed
 * and why not, and every platform rule is enforced by the contracts
 * module itself (caption validator, media-facts validators, the strict
 * platform_options schema), never by a hard-coded copy — changing a
 * limit in contracts changes this composer's validation with it.
 */

export type InstagramFormat = 'photo' | 'reel' | 'carousel' | 'story';

export const INSTAGRAM_FORMAT_OPTIONS: ReadonlyArray<{
  id: InstagramFormat;
  label: string;
  pluralLabel: string;
}> = [
  { id: 'photo', label: 'Photo', pluralLabel: 'Photos' },
  { id: 'reel', label: 'Reel', pluralLabel: 'Reels' },
  { id: 'carousel', label: 'Carousel', pluralLabel: 'Carousels' },
  { id: 'story', label: 'Story', pluralLabel: 'Stories' },
];

export function instagramFormatPlural(format: InstagramFormat): string {
  return INSTAGRAM_FORMAT_OPTIONS.find((f) => f.id === format)?.pluralLabel ?? 'Posts';
}

/**
 * The formats a destination's composer offers. §4.1 story gate:
 * Stories are offered ONLY where the destination is a Business
 * account. A Creator destination — and, until the connect flow
 * surfaces the account type on the destination read, an unknown one —
 * does not offer stories at all: the option is absent from the list,
 * never rendered disabled. (The worker publisher enforces the same
 * rule server-side; unknown types pass there, but the composer never
 * offers what it cannot prove is allowed.)
 */
export function instagramFormatsForAccountType(
  accountType: string | null | undefined
): ReadonlyArray<{ id: InstagramFormat; label: string; pluralLabel: string }> {
  if (accountType === 'BUSINESS') return INSTAGRAM_FORMAT_OPTIONS;
  return INSTAGRAM_FORMAT_OPTIONS.filter((f) => f.id !== 'story');
}

/** Mirrors the enqueue contract's base `firstComment` cap
 *  (`DestinationEnqueueRequestSchema`); a contracts parity test fails
 *  if the two ever drift. */
export const FIRST_COMMENT_MAX_CHARACTERS = 2000;

export type InstagramGraduationStrategy =
  | 'SS_PERFORMANCE'
  | 'SS_PERFORMANCE_WITH_MANUAL_REVIEW'
  | 'MANUAL';

export const GRADUATION_STRATEGY_OPTIONS: ReadonlyArray<{
  id: InstagramGraduationStrategy;
  label: string;
}> = [
  { id: 'SS_PERFORMANCE', label: 'Automatic — graduates when it performs well' },
  {
    id: 'SS_PERFORMANCE_WITH_MANUAL_REVIEW',
    label: 'Performs well, then I review it',
  },
  { id: 'MANUAL', label: 'Manual — I decide when it graduates' },
];

/** The options fields as the form holds them (raw text in, schema out). */
export interface InstagramOptionsFormState {
  collaboratorsText: string;
  shareToFeed: boolean;
  coverUrl: string;
  trialReel: boolean;
  graduationStrategy: InstagramGraduationStrategy;
}

export const EMPTY_INSTAGRAM_OPTIONS: InstagramOptionsFormState = {
  collaboratorsText: '',
  shareToFeed: true,
  coverUrl: '',
  trialReel: false,
  graduationStrategy: 'SS_PERFORMANCE',
};

/** Parses the collaborators field: usernames separated by commas or spaces. */
export function parseCollaborators(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((part) => part.trim().replace(/^@/, ''))
    .filter((part) => part.length > 0);
}

/**
 * Assembles the platform options for the current format from the form
 * state. Reel-only fields ride only on Reels; collaborators ride on
 * every captioned format; carouselItems are NOT assembled here — the
 * enqueue builder derives them from the selected items (single source).
 */
export function buildInstagramOptions(
  format: InstagramFormat,
  state: InstagramOptionsFormState
): InstagramPlatformOptions {
  if (format === 'story') return {};
  const options: InstagramPlatformOptions = {};
  const collaborators = parseCollaborators(state.collaboratorsText);
  if (collaborators.length > 0) options.collaborators = collaborators;
  if (format === 'reel') {
    options.shareToFeed = state.shareToFeed;
    const coverUrl = state.coverUrl.trim();
    if (coverUrl) options.coverUrl = coverUrl;
    if (state.trialReel) {
      options.trialParams = { graduationStrategy: state.graduationStrategy };
    }
  }
  return options;
}

export interface InstagramOptionsError {
  message: string;
  field: 'collaborators' | 'coverUrl' | null;
}

/**
 * Validates the assembled options through the shipped strict schema —
 * the composer renders whatever the schema rejects, worded plainly.
 */
export function validateInstagramOptions(
  format: InstagramFormat,
  state: InstagramOptionsFormState
): InstagramOptionsError | null {
  const result = InstagramPlatformOptionsSchema.safeParse(
    buildInstagramOptions(format, state)
  );
  if (result.success) return null;
  const issue = result.error.issues[0];
  const field = issue?.path[0];
  if (field === 'collaborators') {
    return {
      field: 'collaborators',
      message:
        issue?.code === 'too_big'
          ? `You can invite at most ${INSTAGRAM_MAX_COLLABORATORS} collaborators.`
          : 'Collaborator usernames can only use letters, numbers, periods and underscores.',
    };
  }
  if (field === 'coverUrl') {
    return {
      field: 'coverUrl',
      message: "That doesn't look like a valid cover image link.",
    };
  }
  return { field: null, message: 'Check the options and try again.' };
}

// ---------------------------------------------------------------------------
// Media rules
// ---------------------------------------------------------------------------

export function instagramMaxItems(format: InstagramFormat): number {
  return format === 'carousel' ? INSTAGRAM_CAROUSEL_MAX_ITEMS : 1;
}

/** Cap notice for the media area when an add is blocked. */
export function instagramCapMessage(format: InstagramFormat): string {
  switch (format) {
    case 'photo':
      return 'Photo posts take 1 image. Remove the current one to pick another.';
    case 'reel':
      return 'Reels take 1 video. Remove the current one to pick another.';
    case 'story':
      return 'Stories take 1 file. Remove the current one to pick another.';
    case 'carousel':
      return `Carousels take up to ${INSTAGRAM_CAROUSEL_MAX_ITEMS} items. Remove an item to pick another.`;
  }
}

/**
 * Blocking per-item errors for the current format, from the contracts
 * media-facts validators. Unknown facts (a library item without a
 * recorded duration or size) cannot be checked and never block — the
 * validators themselves skip undefined facts.
 */
export function getInstagramItemError(
  item: DestinationMediaItem,
  format: InstagramFormat
): string | null {
  const imageFacts = () =>
    validateInstagramImageFacts({
      mimeType: item.mimeType ?? undefined,
      sizeBytes: item.fileSize ?? undefined,
      widthPx: item.width ?? undefined,
      heightPx: item.height ?? undefined,
    });
  const videoFacts = () =>
    validateInstagramVideoFacts({
      durationSeconds: item.durationSeconds ?? undefined,
      widthPx: item.width ?? undefined,
    });
  switch (format) {
    case 'photo':
      if (item.mediaType !== 'image') return 'Photos need image files — this is a video.';
      return imageFacts();
    case 'reel':
      if (item.mediaType !== 'video') return 'Reels need a video file — this is an image.';
      return videoFacts();
    case 'carousel':
      return item.mediaType === 'image' ? imageFacts() : videoFacts();
    case 'story':
      // Story media follows the story rules, not the feed-photo rules:
      // videos get the video checks; images are not held to the feed
      // JPEG/aspect rules (Meta accepts story images more broadly and
      // the contracts module scopes those rules to photos).
      return item.mediaType === 'video' ? videoFacts() : null;
  }
}

export function getInstagramMediaCountError(
  items: DestinationMediaItem[],
  format: InstagramFormat
): string | null {
  if (format === 'carousel') {
    if (items.length === 1) {
      return `A carousel needs at least ${INSTAGRAM_CAROUSEL_MIN_ITEMS} items — add one more, or switch to a photo or Reel.`;
    }
    if (items.length > INSTAGRAM_CAROUSEL_MAX_ITEMS) {
      return `Carousels take up to ${INSTAGRAM_CAROUSEL_MAX_ITEMS} items. Remove the extras to continue.`;
    }
    return null;
  }
  if (items.length <= 1) return null;
  if (format === 'photo') return 'Choose one image for this photo post.';
  if (format === 'reel') return 'Choose one video for this Reel.';
  return 'Choose one file for this Story.';
}

// ---------------------------------------------------------------------------
// The single submit decision point
// ---------------------------------------------------------------------------

export interface InstagramValidationContext {
  format: InstagramFormat;
  items: DestinationMediaItem[];
  caption: string;
  firstComment: string;
  optionsState: InstagramOptionsFormState;
  intent: ComposerIntent;
  isScheduleInFuture: boolean;
  hasActiveSlots: boolean;
  hasCoveringSlot: boolean;
}

/** Caption error from the contracts validator (null when valid). */
export function instagramCaptionError(
  format: InstagramFormat,
  caption: string
): string | null {
  if (format === 'story') return null;
  return validateInstagramCaption(caption);
}

/** Single place deciding whether submit is allowed and why not. */
export function computeInstagramValidationError(
  ctx: InstagramValidationContext
): string | null {
  if (ctx.items.length === 0) return 'Choose media for this post.';
  if (ctx.items.some((item) => getInstagramItemError(item, ctx.format) !== null)) {
    return 'Remove or replace the flagged media to continue.';
  }
  const countError = getInstagramMediaCountError(ctx.items, ctx.format);
  if (countError) return countError;
  const captionError = instagramCaptionError(ctx.format, ctx.caption);
  if (captionError) return captionError;
  if (
    ctx.format !== 'story' &&
    ctx.firstComment.trim().length > FIRST_COMMENT_MAX_CHARACTERS
  ) {
    return `First comments can be at most ${FIRST_COMMENT_MAX_CHARACTERS.toLocaleString('en-US')} characters.`;
  }
  const optionsError = validateInstagramOptions(ctx.format, ctx.optionsState);
  if (optionsError) return optionsError.message;
  if (ctx.intent === 'schedule' && !ctx.isScheduleInFuture) {
    return 'Pick a time in the future.';
  }
  if (ctx.intent === 'queue' && !ctx.hasActiveSlots) return 'Set posting times first.';
  if (ctx.intent === 'queue' && !ctx.hasCoveringSlot) {
    return `No posting time covers ${instagramFormatPlural(ctx.format)} yet.`;
  }
  return null;
}
