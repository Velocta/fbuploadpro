import {
  THREADS_CAROUSEL_MAX_ITEMS,
  THREADS_IMAGE_MAX_BYTES,
  THREADS_MAX_TEXT_ATTACHMENT_CHARACTERS,
  THREADS_REPLY_CONTROLS,
  THREADS_VIDEO_MAX_BYTES,
  THREADS_VIDEO_MAX_DURATION_SECONDS,
  ThreadsPlatformOptionsSchema,
  validateThreadsText,
  type ThreadsPlatformOptions,
  type ThreadsReplyControl,
} from '@fbuploadpro/contracts';
import type { ComposerIntent } from '../intent-selector';
import type { DestinationMediaItem } from '../destination/destination-media';

/**
 * Threads composer validation (spec 132 §4.2) — the Facebook/Instagram
 * split: one decision point decides whether submit is allowed and why
 * not, and every platform rule is enforced by the contracts module
 * itself (text validator + weighted counter, the strict
 * platform_options schema with its mutual-exclusion refinements), never
 * by a hard-coded copy. Media limits are spec 124's documented rules,
 * applied from the contracts constants. `replyChain` is deliberately
 * NOT offered: §4.2's field list does not include it.
 */

export type ThreadsKind = 'text' | 'image' | 'video' | 'carousel';

/** The post kind follows the media selection — Threads has no separate
 *  format choice: no media is a text post, one item is a photo/video
 *  post, two or more items publish as a carousel. */
export function threadsKindForItems(items: DestinationMediaItem[]): ThreadsKind {
  if (items.length === 0) return 'text';
  if (items.length === 1) return items[0]?.mediaType === 'video' ? 'video' : 'image';
  return 'carousel';
}

export const THREADS_KIND_LABELS: Record<ThreadsKind, { label: string; plural: string }> = {
  text: { label: 'Text post', plural: 'Text posts' },
  image: { label: 'Photo', plural: 'Photos' },
  video: { label: 'Video', plural: 'Videos' },
  carousel: { label: 'Carousel', plural: 'Carousels' },
};

export const REPLY_CONTROL_OPTIONS: ReadonlyArray<{
  id: ThreadsReplyControl;
  label: string;
}> = [
  { id: 'everyone', label: 'Everyone' },
  { id: 'accounts_you_follow', label: 'Accounts you follow' },
  { id: 'mentioned_only', label: 'Mentioned only' },
  { id: 'followers_only', label: 'Followers only' },
  { id: 'parent_post_author_only', label: "Only the post's author" },
];

/** The options fields as the form holds them (raw text in, schema out). */
export interface ThreadsOptionsFormState {
  replyControl: ThreadsReplyControl;
  topicTag: string;
  quotePostId: string;
  replyToId: string;
  linkAttachment: string;
  altText: string;
  textAttachment: string;
}

export const EMPTY_THREADS_OPTIONS: ThreadsOptionsFormState = {
  replyControl: 'everyone',
  topicTag: '',
  quotePostId: '',
  replyToId: '',
  linkAttachment: '',
  altText: '',
  textAttachment: '',
};

const trimmed = (value: string): string | undefined => {
  const t = value.trim();
  return t ? t : undefined;
};

/**
 * Assembles the platform options from the form state. The link
 * attachment is a text-post field (the publisher reads it only there);
 * single-media alt text rides here, carousel alt text rides in the
 * builder-derived `carouselItems`. carouselItems themselves are NOT
 * assembled here — the enqueue builder derives them from the selected
 * items (single source).
 */
export function buildThreadsOptions(
  kind: ThreadsKind,
  state: ThreadsOptionsFormState
): ThreadsPlatformOptions {
  const options: ThreadsPlatformOptions = {
    replyControl: state.replyControl,
  };
  const topicTag = trimmed(state.topicTag);
  if (topicTag) options.topicTag = topicTag;
  const quotePostId = trimmed(state.quotePostId);
  if (quotePostId) options.quotePostId = quotePostId;
  const replyToId = trimmed(state.replyToId);
  if (replyToId) options.replyToId = replyToId;
  if (kind === 'text') {
    const linkAttachment = trimmed(state.linkAttachment);
    if (linkAttachment) options.linkAttachment = linkAttachment;
  }
  if (kind === 'image' || kind === 'video') {
    const altText = trimmed(state.altText);
    if (altText) options.altText = altText;
  }
  const textAttachment = trimmed(state.textAttachment);
  if (textAttachment) options.textAttachment = textAttachment;
  return options;
}

export type ThreadsOptionsField =
  | 'topicTag'
  | 'linkAttachment'
  | 'altText'
  | 'textAttachment'
  | 'quotePostId'
  | 'carouselAltText'
  | null;

export interface ThreadsOptionsError {
  message: string;
  field: ThreadsOptionsField;
}

/**
 * Validates the assembled options through the shipped strict schema —
 * including its mutual-exclusion refinements (text vs link attachment,
 * quote vs reply), whose messages are already plain-language and are
 * surfaced verbatim.
 */
export function validateThreadsOptions(
  kind: ThreadsKind,
  state: ThreadsOptionsFormState,
  carouselAltTexts: Record<string, string>,
  items: DestinationMediaItem[]
): ThreadsOptionsError | null {
  const options = buildThreadsOptions(kind, state);
  if (kind === 'carousel') {
    options.carouselItems = items.map((item) => {
      const altText = trimmed(carouselAltTexts[item.id] ?? '');
      return {
        mediaUrl: item.url,
        mediaType: item.mediaType,
        ...(altText ? { altText } : {}),
      };
    });
  }
  const result = ThreadsPlatformOptionsSchema.safeParse(options);
  if (result.success) return null;
  const issue = result.error.issues[0];
  const head = issue?.path[0];
  if (head === 'carouselItems') {
    return {
      field: 'carouselAltText',
      message: 'Alt text can be at most 1,000 characters per item.',
    };
  }
  if (head === 'topicTag') {
    return {
      field: 'topicTag',
      message: 'Topic tags can be up to 50 characters, with no periods or ampersands.',
    };
  }
  if (head === 'linkAttachment') {
    return { field: 'linkAttachment', message: "That doesn't look like a valid link." };
  }
  if (head === 'altText') {
    return {
      field: 'altText',
      message: 'Alt text can be at most 1,000 characters.',
    };
  }
  if (head === 'textAttachment') {
    return {
      field: 'textAttachment',
      message:
        issue?.code === 'custom'
          ? issue.message
          : `Long text can be at most ${THREADS_MAX_TEXT_ATTACHMENT_CHARACTERS.toLocaleString('en-US')} characters.`,
    };
  }
  if (head === 'quotePostId' || head === 'replyToId') {
    return {
      field: 'quotePostId',
      message:
        issue?.code === 'custom'
          ? issue.message
          : 'Check the quote and reply fields and try again.',
    };
  }
  return { field: null, message: 'Check the options and try again.' };
}

// ---------------------------------------------------------------------------
// Media rules (spec 124 §6, from the contracts constants)
// ---------------------------------------------------------------------------

export function getThreadsItemError(item: DestinationMediaItem): string | null {
  if (item.mediaType === 'image') {
    if (
      item.mimeType !== undefined &&
      item.mimeType !== null &&
      item.mimeType !== 'image/jpeg' &&
      item.mimeType !== 'image/png'
    ) {
      return 'Threads images must be JPEG or PNG files.';
    }
    if (
      item.fileSize !== undefined &&
      item.fileSize !== null &&
      item.fileSize > THREADS_IMAGE_MAX_BYTES
    ) {
      return 'Threads images can be at most 8 MB. Choose a smaller image and try again.';
    }
    return null;
  }
  if (
    item.durationSeconds !== undefined &&
    item.durationSeconds !== null &&
    item.durationSeconds > THREADS_VIDEO_MAX_DURATION_SECONDS
  ) {
    return 'Threads videos can be at most 5 minutes long. Choose a shorter video and try again.';
  }
  if (
    item.fileSize !== undefined &&
    item.fileSize !== null &&
    item.fileSize > THREADS_VIDEO_MAX_BYTES
  ) {
    return 'Threads videos can be at most 1 GB. Choose a smaller video and try again.';
  }
  return null;
}

export function getThreadsMediaCountError(items: DestinationMediaItem[]): string | null {
  if (items.length > THREADS_CAROUSEL_MAX_ITEMS) {
    return `Carousels take up to ${THREADS_CAROUSEL_MAX_ITEMS} items. Remove the extras to continue.`;
  }
  return null;
}

export const THREADS_CAROUSEL_CAP_MESSAGE = `Carousels take up to ${THREADS_CAROUSEL_MAX_ITEMS} items. Remove an item to pick another.`;

// ---------------------------------------------------------------------------
// The single submit decision point
// ---------------------------------------------------------------------------

export interface ThreadsValidationContext {
  kind: ThreadsKind;
  items: DestinationMediaItem[];
  text: string;
  optionsState: ThreadsOptionsFormState;
  carouselAltTexts: Record<string, string>;
  intent: ComposerIntent;
  isScheduleInFuture: boolean;
  hasActiveSlots: boolean;
  hasCoveringSlot: boolean;
}

/** Single place deciding whether submit is allowed and why not. */
export function computeThreadsValidationError(
  ctx: ThreadsValidationContext
): string | null {
  const { kind, items, text, optionsState } = ctx;
  if (
    kind === 'text' &&
    !text.trim() &&
    !optionsState.textAttachment.trim()
  ) {
    return 'Write something for your text post.';
  }
  const textError = validateThreadsText(text);
  if (textError) return textError;
  if (items.some((item) => getThreadsItemError(item) !== null)) {
    return 'Remove or replace the flagged media to continue.';
  }
  const countError = getThreadsMediaCountError(items);
  if (countError) return countError;
  if (items.length > 0 && optionsState.linkAttachment.trim()) {
    return 'Link attachments only go on text posts. Remove the link to publish with media.';
  }
  const optionsError = validateThreadsOptions(
    kind,
    optionsState,
    ctx.carouselAltTexts,
    items
  );
  if (optionsError) return optionsError.message;
  if (ctx.intent === 'schedule' && !ctx.isScheduleInFuture) {
    return 'Pick a time in the future.';
  }
  if (ctx.intent === 'queue' && !ctx.hasActiveSlots) return 'Set posting times first.';
  if (ctx.intent === 'queue' && !ctx.hasCoveringSlot) {
    return `No posting time covers ${THREADS_KIND_LABELS[kind].plural} yet.`;
  }
  return null;
}

export { THREADS_REPLY_CONTROLS };
