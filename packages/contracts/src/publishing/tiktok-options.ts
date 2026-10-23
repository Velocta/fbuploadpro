import { z } from 'zod';

/**
 * TikTok platform_options schema (Spec 126).
 *
 * TikTok publishing is provider-managed end to end (D1/D3): Post for
 * Me holds the audited TikTok app; this app stores NO TikTok
 * credentials and no TikTok tokens, ever. What the composer stores
 * and the worker validates is only what the user picks for a post.
 *
 * The accepted values below are the ones the provider actually
 * accepts (verified against Post for Me's documented TikTok
 * configuration, `TiktokConfigurationDto`, in the spec 126 research
 * record). Anything the provider will not honour is rejected here —
 * at save/claim time, with plain language — never left to fail as an
 * opaque publish error:
 *
 *  - `privacy`: `public | followers | friends | private`; the
 *    provider's documented default is `public`. TikTok itself only
 *    honours a level the creator's own account settings allow; the
 *    publisher reads the APPLIED privacy back from the provider's
 *    result and fails plainly if it does not match the request
 *    (settling `published` on a private video would be a lie).
 *  - `allowComment` / `allowDuet` / `allowStitch`: who may react to
 *    the post. Optional — omitted means the provider/TikTok default
 *    applies; the publisher only sends a value the user picked.
 *  - `isAiGenerated`: marks the post as AI-generated content.
 *  - `autoAddMusic`: photo posts only.
 *
 * Deliberately NOT modelled: `isDraft`. Post for Me can ask TikTok
 * to create a draft the user must finish in the TikTok app, but that
 * contradicts this product's promise (the post goes live while you
 * sleep). Draft submission is out of scope for v1, and a
 * provider-reported draft/inbox-only outcome is a failure state,
 * never a success — see the publisher (apps/worker).
 */
export const TIKTOK_PRIVACY_LEVELS = [
  'public',
  'followers',
  'friends',
  'private',
] as const;

export type TikTokPrivacy = (typeof TIKTOK_PRIVACY_LEVELS)[number];

export const tikTokOptionsSchema = z.object({
  /** Who can see the post. Defaults to 'public' (the provider default). */
  privacy: z.enum(TIKTOK_PRIVACY_LEVELS).default('public'),
  /** Whether other TikTok users may comment on the post. */
  allowComment: z.boolean().optional(),
  /** Whether other TikTok users may duet with the post. */
  allowDuet: z.boolean().optional(),
  /** Whether other TikTok users may stitch the post. */
  allowStitch: z.boolean().optional(),
  /** Whether the post is AI-generated content (TikTok disclosure). */
  isAiGenerated: z.boolean().optional(),
  /** Photo posts only: let TikTok add music automatically. */
  autoAddMusic: z.boolean().optional(),
});

export type TikTokOptions = z.infer<typeof tikTokOptionsSchema>;

/** TikTok's documented caption limit, in characters. */
export const TIKTOK_CAPTION_MAX_LENGTH = 2200;

export function parseTikTokOptions(
  raw: unknown
): { ok: true; options: TikTokOptions } | { ok: false; error: string } {
  const result = tikTokOptionsSchema.safeParse(raw ?? {});
  if (result.success) {
    return { ok: true, options: result.data };
  }
  return {
    ok: false,
    error: result.error.issues
      .map((issue) => `${issue.path.join('.') || 'options'}: ${issue.message}`)
      .join('; '),
  };
}

/**
 * Field-level validation for a TikTok post beyond the options
 * schema. Returns a plain-language problem string, or null when the
 * fields are fine to send.
 */
export function validateTikTokPostFields(input: {
  caption: string | null | undefined;
}): string | null {
  const captionLength = (input.caption ?? '').length;
  if (captionLength > TIKTOK_CAPTION_MAX_LENGTH) {
    return `Your caption is ${captionLength.toLocaleString('en-US')} characters — TikTok allows up to ${TIKTOK_CAPTION_MAX_LENGTH.toLocaleString('en-US')}. Shorten it and try again.`;
  }
  return null;
}
