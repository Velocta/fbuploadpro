import { describe, expect, it } from 'vitest';
import {
  parseTikTokOptions,
  validateTikTokPostFields,
  TIKTOK_CAPTION_MAX_LENGTH,
  TIKTOK_PRIVACY_LEVELS,
} from '../../src/publishing/tiktok-options.js';

// ==========================================
// TikTok platform_options validation (spec 126)
// ==========================================

describe('parseTikTokOptions', () => {
  it('accepts a full valid options object', () => {
    const result = parseTikTokOptions({
      privacy: 'followers',
      allowComment: true,
      allowDuet: false,
      allowStitch: true,
      isAiGenerated: true,
      autoAddMusic: false,
    });
    expect(result).toEqual({
      ok: true,
      options: {
        privacy: 'followers',
        allowComment: true,
        allowDuet: false,
        allowStitch: true,
        isAiGenerated: true,
        autoAddMusic: false,
      },
    });
  });

  it('defaults privacy to public — the provider default — when options are empty', () => {
    expect(parseTikTokOptions({})).toEqual({
      ok: true,
      options: { privacy: 'public' },
    });
    expect(parseTikTokOptions(null)).toEqual({
      ok: true,
      options: { privacy: 'public' },
    });
    expect(parseTikTokOptions(undefined)).toEqual({
      ok: true,
      options: { privacy: 'public' },
    });
  });

  it('accepts exactly the privacy levels the provider accepts', () => {
    expect(TIKTOK_PRIVACY_LEVELS).toEqual([
      'public',
      'followers',
      'friends',
      'private',
    ]);
    for (const privacy of TIKTOK_PRIVACY_LEVELS) {
      expect(parseTikTokOptions({ privacy }).ok).toBe(true);
    }
  });

  it('rejects privacy values the provider does not accept — before claim, not at publish', () => {
    // 'unlisted' is a YouTube value; TikTok's own vocabulary
    // (PUBLIC_TO_EVERYONE / SELF_ONLY) is TikTok-API shape, not the
    // provider's. Neither may reach the publisher.
    for (const privacy of ['unlisted', 'PUBLIC_TO_EVERYONE', 'SELF_ONLY', 'everyone']) {
      const result = parseTikTokOptions({ privacy });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('privacy');
      }
    }
  });

  it('rejects a non-boolean permission toggle', () => {
    const result = parseTikTokOptions({ allowDuet: 'yes' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('allowDuet');
    }
  });

  it('rejects a draft flag — draft delivery is out of scope for v1', () => {
    // The schema has no isDraft field and is .strict(): a stored draft
    // request FAILS validation outright. It must never be silently
    // stripped and degraded into a normal public post.
    const result = parseTikTokOptions({ privacy: 'public', isDraft: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('isDraft');
    }
  });

  it('rejects any other unknown option key', () => {
    const result = parseTikTokOptions({ privacy: 'public', somethingElse: 1 });
    expect(result.ok).toBe(false);
  });
});

describe('validateTikTokPostFields', () => {
  it('accepts a caption within the limit', () => {
    expect(validateTikTokPostFields({ caption: 'Boss has spoken.' })).toBeNull();
  });

  it('treats a missing caption as empty', () => {
    expect(validateTikTokPostFields({ caption: null })).toBeNull();
    expect(validateTikTokPostFields({ caption: undefined })).toBeNull();
    expect(validateTikTokPostFields({})).toBeNull();
  });

  it(`accepts a caption of exactly ${TIKTOK_CAPTION_MAX_LENGTH} characters`, () => {
    expect(
      validateTikTokPostFields({ caption: 'a'.repeat(TIKTOK_CAPTION_MAX_LENGTH) })
    ).toBeNull();
  });

  it('rejects an over-limit caption with a plain-language message', () => {
    const problem = validateTikTokPostFields({
      caption: 'a'.repeat(TIKTOK_CAPTION_MAX_LENGTH + 1),
    });
    expect(problem).toMatch(/2,200/);
    expect(problem).toMatch(/Shorten it and try again/);
  });
});
