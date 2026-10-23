import { describe, expect, it } from 'vitest';
import {
  INSTAGRAM_MAX_CAPTION_CHARACTERS,
  INSTAGRAM_OAUTH_SCOPES,
  InstagramPlatformOptionsSchema,
  countInstagramHashtags,
  countInstagramMentions,
  parseInstagramPlatformOptions,
  validateInstagramCaption,
  validateInstagramImageFacts,
  validateInstagramVideoFacts,
} from '../../src/index.js';

describe('Instagram options (spec 124)', () => {
  it('requests the manage-comments permission at connect (first comment needs it)', () => {
    expect(INSTAGRAM_OAUTH_SCOPES).toContain('instagram_business_manage_comments');
    expect(INSTAGRAM_OAUTH_SCOPES).toContain('instagram_business_content_publish');
    expect(INSTAGRAM_OAUTH_SCOPES).toContain('instagram_business_basic');
  });

  it('accepts a valid options set and defaults to empty', () => {
    expect(parseInstagramPlatformOptions({})).toEqual({});
    expect(parseInstagramPlatformOptions(null)).toEqual({});
    const parsed = parseInstagramPlatformOptions({
      collaborators: ['alice', 'bob.smith', 'carol_1'],
      shareToFeed: true,
      carouselItems: [
        { mediaUrl: 'https://cdn.example.com/1.jpg', mediaType: 'image' },
        { mediaUrl: 'https://cdn.example.com/2.mp4', mediaType: 'video' },
      ],
    });
    expect(parsed.collaborators).toHaveLength(3);
    expect(parsed.carouselItems).toHaveLength(2);
  });

  it('rejects more than 3 collaborators and malformed usernames', () => {
    expect(
      InstagramPlatformOptionsSchema.safeParse({
        collaborators: ['a', 'b', 'c', 'd'],
      }).success
    ).toBe(false);
    expect(
      InstagramPlatformOptionsSchema.safeParse({
        collaborators: ['not a username!'],
      }).success
    ).toBe(false);
  });

  it('rejects out-of-scope v1 fields (location/product tags, alt text) via strict mode', () => {
    for (const key of ['locationId', 'productTags', 'altText', 'userTags']) {
      expect(
        InstagramPlatformOptionsSchema.safeParse({ [key]: 'x' }).success,
        key
      ).toBe(false);
    }
  });

  it('rejects carousels outside 2–10 items', () => {
    const item = { mediaUrl: 'https://cdn.example.com/1.jpg', mediaType: 'image' as const };
    expect(
      InstagramPlatformOptionsSchema.safeParse({ carouselItems: [item] }).success
    ).toBe(false);
    expect(
      InstagramPlatformOptionsSchema.safeParse({
        carouselItems: Array.from({ length: 11 }, () => item),
      }).success
    ).toBe(false);
  });

  it('caption validation enforces 2,200 chars / 30 hashtags / 20 mentions', () => {
    expect(validateInstagramCaption('hello #world @friend')).toBeNull();
    expect(
      validateInstagramCaption('x'.repeat(INSTAGRAM_MAX_CAPTION_CHARACTERS + 1))
    ).toContain('2200');
    expect(validateInstagramCaption(Array(31).fill('#tag').join(' '))).toContain('30');
    expect(validateInstagramCaption(Array(21).fill('@user').join(' '))).toContain('20');
    expect(countInstagramHashtags('#one #two three')).toBe(2);
    expect(countInstagramMentions('@one @two')).toBe(2);
  });

  it('image facts enforce JPEG, 8 MB, and the 4:5–1.91:1 aspect window', () => {
    expect(validateInstagramImageFacts({ mimeType: 'image/jpeg', sizeBytes: 1000 })).toBeNull();
    expect(validateInstagramImageFacts({ mimeType: 'image/png' })).toContain('JPEG');
    expect(validateInstagramImageFacts({ sizeBytes: 9 * 1024 * 1024 })).toContain('8 MB');
    expect(validateInstagramImageFacts({ widthPx: 1000, heightPx: 2000 })).toContain('4:5');
    expect(validateInstagramImageFacts({ widthPx: 1910, heightPx: 1000 })).toBeNull();
    expect(validateInstagramImageFacts({})).toBeNull();
  });

  it('video facts enforce 3s–15min, ≤1920px wide, 23–60 fps', () => {
    expect(validateInstagramVideoFacts({ durationSeconds: 30, widthPx: 1080, fps: 30 })).toBeNull();
    expect(validateInstagramVideoFacts({ durationSeconds: 2 })).toContain('3 seconds');
    expect(validateInstagramVideoFacts({ durationSeconds: 901 })).toContain('15 minutes');
    expect(validateInstagramVideoFacts({ widthPx: 2000 })).toContain('1920');
    expect(validateInstagramVideoFacts({ fps: 120 })).toContain('60 frames');
  });
});
