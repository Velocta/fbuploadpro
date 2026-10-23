import { z } from 'zod';

// ==========================================
// X platform options + weighted-character validation (spec 127)
// ==========================================
//
// The validated shape of `queue_items.platform_options` for X posts and
// the 280 weighted-character rule X enforces on post text. Spec 128's X
// composer renders its fields from this schema; the worker's X publisher
// re-validates with it before calling the API.
//
// Thread chains are deliberately ABSENT: on pay-per-use access, X's
// documented reply restriction has no self-reply carve-out, and spec 127
// ships chains only after a live verification that cannot run until the
// global app exists and is funded (LIVE-PENDING, recorded in the PR).
// The schema is `.strict()`, so a `thread` / `reply_to_id` key is a
// validation failure, never a silently-ignored extra. Replies to other
// people's posts are out of scope for v1 regardless.

/** Hard text limit for X posts in v1 (weighted characters, everyone). */
export const X_MAX_WEIGHTED_CHARACTERS = 280;

/** Every URL counts as exactly this many weighted characters (t.co wrapping). */
export const X_URL_WEIGHTED_LENGTH = 23;

/**
 * OAuth 2.0 scopes requested by the global-app connect flow (spec 127
 * Scope.2). `media.write` appears in some third-party reports but is
 * absent from X's official examples; it is NOT requested until the live
 * developer console confirms it exists (LIVE-PENDING in the PR).
 */
export const X_OAUTH_SCOPES: readonly string[] = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'offline.access',
];

// --- Media limits (conservative official spec, enforced for everyone) ---

export const X_MAX_IMAGES_PER_POST = 4;
export const X_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const X_GIF_MAX_BYTES = 15 * 1024 * 1024;
export const X_VIDEO_MAX_BYTES = 512 * 1024 * 1024;
export const X_VIDEO_MIN_DURATION_SECONDS = 0.5;
export const X_VIDEO_MAX_DURATION_SECONDS = 140;

// --- Poll bounds ---

export const X_POLL_MIN_OPTIONS = 2;
export const X_POLL_MAX_OPTIONS = 4;
export const X_POLL_OPTION_MAX_CHARACTERS = 25;
export const X_POLL_MIN_DURATION_MINUTES = 5;
export const X_POLL_MAX_DURATION_MINUTES = 7 * 24 * 60; // 7 days

/** Alt text ceiling for one media item. */
export const X_ALT_TEXT_MAX_CHARACTERS = 1000;

// ==========================================
// Weighted-character counting
// ==========================================
//
// Rules (spec 127 Scope.3, X's published counting):
//   - any URL counts 23, whatever its real length;
//   - CJK characters and emoji count 2;
//   - everything else counts 1.
// An emoji *sequence* (ZWJ family, skin-tone variant, flag, keycap) is
// one visible character and counts 2 in total, so counting runs over
// grapheme clusters, not code points.

const URL_PATTERN = /https?:\/\/[^\s]+/gi;

/** Code-point ranges whose characters weigh 2 (CJK + fullwidth forms). */
const DOUBLE_WEIGHT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x11ff], // Hangul Jamo
  [0x2e80, 0x9fff], // CJK Radicals, Kangxi, Ideographs, Hiragana, Katakana
  [0xa000, 0xa4ff], // Yi
  [0xac00, 0xd7ff], // Hangul Syllables
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
  [0xfe10, 0xfe1f], // Vertical forms
  [0xfe30, 0xfe6f], // CJK Compatibility Forms / Small Form Variants
  [0xff00, 0xff60], // Fullwidth Forms
  [0xffe0, 0xffe6], // Fullwidth signs
  [0x16fe0, 0x16fe4],
  [0x17000, 0x18aff],
  [0x20000, 0x2fffd], // CJK Ext. B+ (supplementary ideographic plane)
  [0x30000, 0x3fffd], // CJK Ext. G+ (tertiary ideographic plane)
];

function isDoubleWeightCodePoint(cp: number): boolean {
  for (const [lo, hi] of DOUBLE_WEIGHT_RANGES) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

function isEmojiCodePoint(cp: number): boolean {
  return (
    (cp >= 0x1f000 && cp <= 0x1faff) || // emoticons, pictographs, transport, supplemental
    (cp >= 0x2600 && cp <= 0x27bf) || // Miscellaneous Symbols + Dingbats
    cp === 0x203c || // ‼
    cp === 0x2049 || // ⁉
    cp === 0x00a9 || // ©
    cp === 0x00ae || // ®
    cp === 0x2122 || // ™
    cp === 0x2139 // ℹ
  );
}

const graphemeSegmenter: { segment(text: string): Iterable<{ segment: string }> } | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new (Intl as unknown as {
        Segmenter: new (
          locales: string,
          options: { granularity: string }
        ) => { segment(text: string): Iterable<{ segment: string }> };
      }).Segmenter('en', { granularity: 'grapheme' })
    : null;

function graphemes(text: string): string[] {
  if (graphemeSegmenter) {
    return [...graphemeSegmenter.segment(text)].map((part) => part.segment);
  }
  return [...text];
}

/** Weighted length of one grapheme cluster (URLs already stripped by the caller). */
function weightedGraphemeLength(grapheme: string): number {
  const codePoints = [...grapheme].map((ch) => ch.codePointAt(0) ?? 0);
  // An emoji sequence (ZWJ chain, flag pair, skin-tone variant, keycap)
  // is a single visible emoji: weight 2 in total.
  if (codePoints.some((cp) => isEmojiCodePoint(cp))) return 2;
  let total = 0;
  for (const cp of codePoints) {
    total += isDoubleWeightCodePoint(cp) ? 2 : 1;
  }
  return total;
}

/**
 * The weighted character count X charges for `text`: URLs at 23 each,
 * CJK/emoji at 2 per visible character, everything else at 1.
 */
export function countXWeightedCharacters(text: string): number {
  let total = 0;
  let lastIndex = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    total += countPlainSegment(text.slice(lastIndex, index));
    total += X_URL_WEIGHTED_LENGTH;
    lastIndex = index + match[0].length;
  }
  total += countPlainSegment(text.slice(lastIndex));
  return total;
}

function countPlainSegment(segment: string): number {
  let total = 0;
  for (const grapheme of graphemes(segment)) {
    total += weightedGraphemeLength(grapheme);
  }
  return total;
}

export interface XTextValidation {
  valid: boolean;
  weightedLength: number;
  remaining: number;
}

/** Validates post text against the 280 weighted-character limit. */
export function validateXText(text: string): XTextValidation {
  const weightedLength = countXWeightedCharacters(text);
  return {
    valid: weightedLength <= X_MAX_WEIGHTED_CHARACTERS,
    weightedLength,
    remaining: X_MAX_WEIGHTED_CHARACTERS - weightedLength,
  };
}

// ==========================================
// Media validation
// ==========================================

export interface XMediaInput {
  mediaType: 'image' | 'gif' | 'video';
  fileSizeBytes?: number | null | undefined;
  durationSeconds?: number | null | undefined;
}

export interface XMediaValidation {
  valid: boolean;
  error?: string | undefined;
}

/** Validates one media asset against the conservative v1 limits (spec 127 Scope.3). */
export function validateXMedia(media: XMediaInput): XMediaValidation {
  const size = media.fileSizeBytes ?? null;
  switch (media.mediaType) {
    case 'image':
      if (size !== null && size > X_IMAGE_MAX_BYTES) {
        return { valid: false, error: 'Images can be at most 5 MB on X.' };
      }
      return { valid: true };
    case 'gif':
      if (size !== null && size > X_GIF_MAX_BYTES) {
        return { valid: false, error: 'GIFs can be at most 15 MB on X.' };
      }
      return { valid: true };
    case 'video': {
      if (size !== null && size > X_VIDEO_MAX_BYTES) {
        return { valid: false, error: 'Videos can be at most 512 MB on X.' };
      }
      const duration = media.durationSeconds ?? null;
      if (
        duration !== null &&
        (duration < X_VIDEO_MIN_DURATION_SECONDS || duration > X_VIDEO_MAX_DURATION_SECONDS)
      ) {
        return { valid: false, error: 'Videos must be between 0.5 and 140 seconds on X.' };
      }
      return { valid: true };
    }
    default:
      return { valid: false, error: 'Unsupported media type for X.' };
  }
}

// ==========================================
// platform_options schema
// ==========================================

export const XPollOptionsSchema = z
  .object({
    options: z
      .array(z.string().min(1).max(X_POLL_OPTION_MAX_CHARACTERS))
      .min(X_POLL_MIN_OPTIONS)
      .max(X_POLL_MAX_OPTIONS),
    durationMinutes: z
      .number()
      .int()
      .min(X_POLL_MIN_DURATION_MINUTES)
      .max(X_POLL_MAX_DURATION_MINUTES),
  })
  .strict();

export type XPollOptions = z.infer<typeof XPollOptionsSchema>;

/** Who may reply to the post, as X's `reply_settings` values spell it. */
export const XReplySettingsSchema = z.enum([
  'everyone',
  'mentionedUsers',
  'following',
  'verified',
]);

export type XReplySettings = z.infer<typeof XReplySettingsSchema>;

/**
 * X `platform_options` (validated per platform by contracts, spec 119 §4.1).
 * No thread/reply-chain field exists (see header) and no reply-to-another-
 * person's-post field exists: both are out of v1 scope.
 */
export const XPlatformOptionsSchema = z
  .object({
    poll: XPollOptionsSchema.optional(),
    replySettings: XReplySettingsSchema.optional(),
    /** Tweet id this post quotes. */
    quoteTweetId: z.string().min(1).optional(),
    /** Alt text for the post's media (set via the media metadata call). */
    altText: z.string().min(1).max(X_ALT_TEXT_MAX_CHARACTERS).optional(),
  })
  .strict();

export type XPlatformOptions = z.infer<typeof XPlatformOptionsSchema>;

export interface XPlatformOptionsValidation {
  valid: boolean;
  options?: XPlatformOptions | undefined;
  error?: string | undefined;
}

/**
 * Full options validation for one queue item, including the cross-field
 * rule the zod schema alone cannot see: a poll cannot be combined with
 * media (X platform rule, spec 127 Scope.3).
 */
export function validateXPlatformOptions(
  raw: Record<string, unknown> | null | undefined,
  context: { hasMedia: boolean }
): XPlatformOptionsValidation {
  const parsed = XPlatformOptionsSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      valid: false,
      error: first ? `${first.path.join('.') || 'options'}: ${first.message}` : 'Invalid X options.',
    };
  }
  if (parsed.data.poll && context.hasMedia) {
    return { valid: false, error: 'Polls cannot be combined with media on X.' };
  }
  return { valid: true, options: parsed.data };
}
