import { z } from 'zod';

// ==========================================
// Threads platform options + field validation (spec 124)
// ==========================================
//
// The validated shape of `queue_items.platform_options` for Threads
// posts, plus the text/media field rules the Threads API enforces.
// Spec 128's Threads composer renders its fields from this schema; the
// worker's Threads publisher re-validates with it before creating any
// container.
//
// Media rule (spec 124 §6): public URL ONLY. There is no upload
// endpoint — Meta fetches `image_url` / `video_url` itself — so this
// module (and the publisher) contains no binary-upload path at all.
//
// Text attachments (`text_attachment`, up to 10,000 characters) were
// confirmed against the Threads API surface at build time (see the
// spec 124 PR's docs-verification record): the field is a validated
// `platform_options` entry and the publisher passes it through on the
// container. The `auto_publish_text` one-call shortcut was also
// confirmed to exist, but it is deliberately NOT used — the async
// poll-publish state machine remains the only publish path.

/** OAuth scopes requested by the Threads connect flow. */
export const THREADS_OAUTH_SCOPES: readonly string[] = [
  'threads_basic',
  'threads_content_publish',
];

// --- Text limits ---

/** Post text is capped at 500 UTF-8-weighted characters. */
export const THREADS_MAX_TEXT_WEIGHTED_CHARACTERS = 500;

/** At most 5 links per post. */
export const THREADS_MAX_LINKS = 5;

/** Long-form text attachment ceiling (10,000 characters). */
export const THREADS_MAX_TEXT_ATTACHMENT_CHARACTERS = 10000;

// --- Media limits ---

/** Images: JPEG or PNG, at most 8 MB. */
export const THREADS_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/** Videos: at most 5 minutes, at most 1 GB. */
export const THREADS_VIDEO_MAX_DURATION_SECONDS = 5 * 60;
export const THREADS_VIDEO_MAX_BYTES = 1024 * 1024 * 1024;

// --- Carousel limits ---

export const THREADS_CAROUSEL_MIN_ITEMS = 2;
export const THREADS_CAROUSEL_MAX_ITEMS = 20;

// --- Topic tag ---

/** A topic tag is at most 50 characters, with no periods or ampersands. */
export const THREADS_MAX_TOPIC_TAG_CHARACTERS = 50;

// --- Reply controls ---

export const THREADS_REPLY_CONTROLS = [
  'everyone',
  'accounts_you_follow',
  'mentioned_only',
  'parent_post_author_only',
  'followers_only',
] as const;
export type ThreadsReplyControl = (typeof THREADS_REPLY_CONTROLS)[number];

// ==========================================
// UTF-8-weighted text counting
// ==========================================
//
// Threads counts post text by UTF-8 byte weight, not by visible
// characters: an emoji (or any multi-byte character) consumes more
// than one of the 500. Counting runs over code points and sums each
// code point's UTF-8 byte length (1–4).

const textEncoder = new TextEncoder();

/** The UTF-8-weighted length of a Threads post text. */
export function threadsWeightedTextLength(text: string): number {
  return textEncoder.encode(text).length;
}

/** Counts distinct links (http/https URLs) in a post text. */
export function countThreadsLinks(text: string): number {
  return text.match(/https?:\/\/[^\s]+/gi)?.length ?? 0;
}

/**
 * Validates a Threads post text against the 500 weighted-character cap
 * and the 5-link cap. Returns a plain-language error, or null.
 */
export function validateThreadsText(text: string): string | null {
  if (threadsWeightedTextLength(text) > THREADS_MAX_TEXT_WEIGHTED_CHARACTERS) {
    return `Threads posts can be at most ${THREADS_MAX_TEXT_WEIGHTED_CHARACTERS} characters (emoji count for more than one). Shorten the post and try again.`;
  }
  if (countThreadsLinks(text) > THREADS_MAX_LINKS) {
    return `Threads posts can include at most ${THREADS_MAX_LINKS} links. Remove a link and try again.`;
  }
  return null;
}

// ==========================================
// Media descriptors
// ==========================================

export const ThreadsCarouselItemSchema = z.object({
  mediaUrl: z.string().url(),
  mediaType: z.enum(['image', 'video']),
  altText: z.string().max(1000).optional(),
});
export type ThreadsCarouselItem = z.infer<typeof ThreadsCarouselItemSchema>;

/** One follow-up post in a reply chain, published in order. */
export const ThreadsReplyChainItemSchema = z.object({
  text: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['image', 'video']).optional(),
  altText: z.string().max(1000).optional(),
});
export type ThreadsReplyChainItem = z.infer<typeof ThreadsReplyChainItemSchema>;

// ==========================================
// platform_options schema
// ==========================================

export const ThreadsPlatformOptionsSchema = z
  .object({
    /** Who may reply to the post. */
    replyControl: z.enum(THREADS_REPLY_CONTROLS).optional(),
    /** One topic tag for the post (no periods or ampersands). */
    topicTag: z
      .string()
      .min(1)
      .max(THREADS_MAX_TOPIC_TAG_CHARACTERS)
      .regex(/^[^.&]+$/, 'Topic tags cannot contain periods or ampersands')
      .optional(),
    /** The Threads post this post quotes. */
    quotePostId: z.string().min(1).optional(),
    /** The Threads post this post replies to. */
    replyToId: z.string().min(1).optional(),
    /** Link preview attachment (text posts). */
    linkAttachment: z.string().url().optional(),
    /** Alt text for the post's media (up to 1,000 characters). */
    altText: z.string().max(1000).optional(),
    /**
     * Long-form text attachment (up to 10,000 characters). Confirmed
     * field at build time; passed through on the container and never
     * combined with a link attachment (the API treats them as mutually
     * exclusive).
     */
    textAttachment: z
      .string()
      .min(1)
      .max(THREADS_MAX_TEXT_ATTACHMENT_CHARACTERS)
      .optional(),
    /** Carousel items (2–20) for carousel posts. */
    carouselItems: z
      .array(ThreadsCarouselItemSchema)
      .min(THREADS_CAROUSEL_MIN_ITEMS)
      .max(THREADS_CAROUSEL_MAX_ITEMS)
      .optional(),
    /** Follow-up posts published as a reply chain, in order. */
    replyChain: z.array(ThreadsReplyChainItemSchema).min(1).max(10).optional(),
  })
  .strict()
  .superRefine((options, ctx) => {
    if (options.textAttachment && options.linkAttachment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['textAttachment'],
        message:
          'A post can carry a long-text attachment or a link attachment, not both. Remove one and try again.',
      });
    }
    if (options.quotePostId && options.replyToId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quotePostId'],
        message:
          'A post can quote another post or reply to one, not both. Remove one and try again.',
      });
    }
  });
export type ThreadsPlatformOptions = z.infer<typeof ThreadsPlatformOptionsSchema>;

/** Parses raw `platform_options` jsonb into validated Threads options. */
export function parseThreadsPlatformOptions(
  raw: Record<string, unknown> | null | undefined
): ThreadsPlatformOptions {
  return ThreadsPlatformOptionsSchema.parse(raw ?? {});
}
