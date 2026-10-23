import { describe, expect, it } from 'vitest';
import {
  parseYouTubePlatformOptions,
  utf8ByteLength,
  validateYouTubeUploadFields,
  youtubeTagsTotalChars,
  YOUTUBE_DESCRIPTION_MAX_BYTES,
  YOUTUBE_TAGS_MAX_CHARS,
  YOUTUBE_TITLE_MAX_CHARS,
} from '../../src/publishing/youtube-options.js';

// ==========================================
// YouTube platform_options validation (spec 125)
// ==========================================

describe('parseYouTubePlatformOptions', () => {
  it('accepts a full valid options object', () => {
    const parsed = parseYouTubePlatformOptions({
      privacy: 'unlisted',
      madeForKids: false,
      tags: ['boss', 'comedy'],
      categoryId: '22',
    });
    expect(parsed).toEqual({
      privacy: 'unlisted',
      madeForKids: false,
      tags: ['boss', 'comedy'],
      categoryId: '22',
    });
  });

  it('accepts the minimal shape (privacy + madeForKids only)', () => {
    expect(
      parseYouTubePlatformOptions({ privacy: 'public', madeForKids: true })
    ).toEqual({ privacy: 'public', madeForKids: true });
  });

  it('rejects a missing madeForKids — the audience declaration is required on every upload', () => {
    expect(() =>
      parseYouTubePlatformOptions({ privacy: 'public' })
    ).toThrow();
  });

  it('rejects a non-boolean madeForKids', () => {
    expect(() =>
      parseYouTubePlatformOptions({ privacy: 'public', madeForKids: 'no' })
    ).toThrow();
  });

  it('rejects an unknown privacy value', () => {
    expect(() =>
      parseYouTubePlatformOptions({
        privacy: 'friends',
        madeForKids: false,
      })
    ).toThrow();
  });

  it('rejects a missing privacy value', () => {
    expect(() =>
      parseYouTubePlatformOptions({ madeForKids: false })
    ).toThrow();
  });

  it('rejects tags totalling more than 500 characters', () => {
    const tags = ['x'.repeat(300), 'y'.repeat(250)];
    expect(youtubeTagsTotalChars(tags)).toBeGreaterThan(
      YOUTUBE_TAGS_MAX_CHARS
    );
    expect(() =>
      parseYouTubePlatformOptions({
        privacy: 'public',
        madeForKids: false,
        tags,
      })
    ).toThrow(/500/);
  });

  it('accepts tags totalling exactly 500 characters', () => {
    const tags = ['x'.repeat(249), 'y'.repeat(250)];
    expect(youtubeTagsTotalChars(tags)).toBe(YOUTUBE_TAGS_MAX_CHARS);
    expect(
      parseYouTubePlatformOptions({
        privacy: 'private',
        madeForKids: true,
        tags,
      }).tags
    ).toEqual(tags);
  });
});

describe('validateYouTubeUploadFields', () => {
  it('accepts fields within limits', () => {
    expect(
      validateYouTubeUploadFields({ title: 'Hello', description: 'World' })
    ).toBeNull();
  });

  it(`rejects a title over ${YOUTUBE_TITLE_MAX_CHARS} characters`, () => {
    const problem = validateYouTubeUploadFields({
      title: 'a'.repeat(YOUTUBE_TITLE_MAX_CHARS + 1),
      description: '',
    });
    expect(problem).toMatch(/100 characters/);
  });

  it('accepts a title of exactly 100 characters', () => {
    expect(
      validateYouTubeUploadFields({
        title: 'a'.repeat(YOUTUBE_TITLE_MAX_CHARS),
        description: '',
      })
    ).toBeNull();
  });

  it(`rejects a description over ${YOUTUBE_DESCRIPTION_MAX_BYTES} bytes`, () => {
    const problem = validateYouTubeUploadFields({
      title: 'ok',
      description: 'a'.repeat(YOUTUBE_DESCRIPTION_MAX_BYTES + 1),
    });
    expect(problem).toMatch(/5000 bytes/);
  });

  it('measures the description in UTF-8 bytes, not characters', () => {
    // 'é' is 2 bytes in UTF-8: 2501 chars = 5002 bytes > the limit,
    // even though the character count is far below 5000.
    const description = 'é'.repeat(2501);
    expect(description.length).toBeLessThan(YOUTUBE_DESCRIPTION_MAX_BYTES);
    expect(utf8ByteLength(description)).toBe(5002);
    expect(
      validateYouTubeUploadFields({ title: 'ok', description })
    ).toMatch(/5000 bytes/);
  });

  it('treats missing fields as empty', () => {
    expect(validateYouTubeUploadFields({})).toBeNull();
    expect(
      validateYouTubeUploadFields({ title: null, description: undefined })
    ).toBeNull();
  });
});
