import { z } from 'zod';

// ==========================================
// YouTube platform_options (spec 125, D3 — via Post for Me)
// ==========================================
//
// The validated shape of `queue_items.platform_options` for YouTube,
// plus the field limits YouTube itself enforces on an upload. The
// composer (spec 128) renders these fields; the YouTube publisher
// (apps/worker) re-validates with the same helpers before it submits
// anything to the provider, so an invalid row can never reach Post
// for Me.
//
// Field limits (YouTube's own, carried from spec 125):
//   - title:       ≤ 100 characters
//   - description: ≤ 5,000 BYTES (UTF-8 — not characters)
//   - tags:        ≤ 500 characters in total across all tags
//
// `madeForKids` is a REQUIRED boolean: YouTube requires an explicit
// audience declaration on every upload, so the schema has no default
// and no omission path — a missing value fails validation here, long
// before claim.

export const YOUTUBE_PRIVACY_STATUSES = ['public', 'private', 'unlisted'] as const;

export type YouTubePrivacyStatus = (typeof YOUTUBE_PRIVACY_STATUSES)[number];

export const YOUTUBE_TITLE_MAX_CHARS = 100;
export const YOUTUBE_DESCRIPTION_MAX_BYTES = 5000;
export const YOUTUBE_TAGS_MAX_CHARS = 500;

export const youtubePlatformOptionsSchema = z
  .object({
    privacy: z.enum(YOUTUBE_PRIVACY_STATUSES),
    /** Explicit audience declaration — required on every upload, never omitted. */
    madeForKids: z.boolean(),
    tags: z.array(z.string()).optional(),
    /** YouTube category id (a numeric string, e.g. "22" for People & Blogs). */
    categoryId: z.string().min(1).optional(),
  })
  // Strict like every sibling platform schema: unknown keys fail
  // validation instead of being silently stripped.
  .strict();

export type YouTubePlatformOptions = z.infer<typeof youtubePlatformOptionsSchema>;

/** Total tag characters the way YouTube counts them: tags plus separators. */
export function youtubeTagsTotalChars(tags: readonly string[]): number {
  if (tags.length === 0) return 0;
  return tags.join(',').length;
}

const utf8Encoder = new TextEncoder();

/** UTF-8 byte length — the unit YouTube's description limit is measured in. */
export function utf8ByteLength(value: string): number {
  return utf8Encoder.encode(value).length;
}

/**
 * Validates raw `platform_options` for a YouTube queue item. Throws a
 * ZodError on any violation (including a missing `madeForKids`).
 */
export function parseYouTubePlatformOptions(raw: unknown): YouTubePlatformOptions {
  const options = youtubePlatformOptionsSchema.parse(raw ?? {});
  if (options.tags && youtubeTagsTotalChars(options.tags) > YOUTUBE_TAGS_MAX_CHARS) {
    throw new z.ZodError([
      {
        code: 'custom',
        message: `Tags must total at most ${YOUTUBE_TAGS_MAX_CHARS} characters`,
        path: ['tags'],
      },
    ]);
  }
  return options;
}

/**
 * Validates the free-standing upload fields that live outside
 * `platform_options` (the item's `title` column and its caption, which
 * becomes the YouTube description). Returns a plain-language problem
 * string, or null when the fields are within limits.
 */
export function validateYouTubeUploadFields(fields: {
  title?: string | null | undefined;
  description?: string | null | undefined;
}): string | null {
  const title = fields.title ?? '';
  if ([...title].length > YOUTUBE_TITLE_MAX_CHARS) {
    return `Title must be at most ${YOUTUBE_TITLE_MAX_CHARS} characters`;
  }
  const description = fields.description ?? '';
  if (utf8ByteLength(description) > YOUTUBE_DESCRIPTION_MAX_BYTES) {
    return `Description must be at most ${YOUTUBE_DESCRIPTION_MAX_BYTES} bytes`;
  }
  return null;
}
