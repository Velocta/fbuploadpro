import { describe, expect, it } from 'vitest';
import {
  THREADS_OAUTH_SCOPES,
  ThreadsPlatformOptionsSchema,
  countThreadsLinks,
  parseThreadsPlatformOptions,
  threadsWeightedTextLength,
  validateThreadsText,
} from '../../src/index.js';

describe('Threads options (spec 124)', () => {
  it('requests the publish scopes at connect', () => {
    expect(THREADS_OAUTH_SCOPES).toEqual([
      'threads_basic',
      'threads_content_publish',
    ]);
  });

  it('accepts a valid options set and defaults to empty', () => {
    expect(parseThreadsPlatformOptions({})).toEqual({});
    expect(parseThreadsPlatformOptions(undefined)).toEqual({});
    const parsed = parseThreadsPlatformOptions({
      replyControl: 'mentioned_only',
      topicTag: 'LaunchDay',
      altText: 'A screenshot of the new dashboard',
      carouselItems: [
        { mediaUrl: 'https://cdn.example.com/1.jpg', mediaType: 'image' },
        { mediaUrl: 'https://cdn.example.com/2.jpg', mediaType: 'image' },
      ],
      replyChain: [{ text: 'Part two' }, { text: 'Part three' }],
    });
    expect(parsed.replyControl).toBe('mentioned_only');
    expect(parsed.carouselItems).toHaveLength(2);
    expect(parsed.replyChain).toHaveLength(2);
  });

  it('rejects carousels outside 2–20 items', () => {
    const item = { mediaUrl: 'https://cdn.example.com/1.jpg', mediaType: 'image' as const };
    expect(ThreadsPlatformOptionsSchema.safeParse({ carouselItems: [item] }).success).toBe(false);
    expect(
      ThreadsPlatformOptionsSchema.safeParse({
        carouselItems: Array.from({ length: 21 }, () => item),
      }).success
    ).toBe(false);
  });

  it('rejects unknown reply controls and topic tags with periods or ampersands', () => {
    expect(ThreadsPlatformOptionsSchema.safeParse({ replyControl: 'nobody' }).success).toBe(false);
    expect(ThreadsPlatformOptionsSchema.safeParse({ topicTag: 'bad.tag' }).success).toBe(false);
    expect(ThreadsPlatformOptionsSchema.safeParse({ topicTag: 'bad&tag' }).success).toBe(false);
    expect(ThreadsPlatformOptionsSchema.safeParse({ topicTag: 'x'.repeat(51) }).success).toBe(false);
  });

  it('rejects combining a text attachment with a link attachment, and quote with reply', () => {
    expect(
      ThreadsPlatformOptionsSchema.safeParse({
        textAttachment: 'long form',
        linkAttachment: 'https://example.com',
      }).success
    ).toBe(false);
    expect(
      ThreadsPlatformOptionsSchema.safeParse({
        quotePostId: 'post-1',
        replyToId: 'post-2',
      }).success
    ).toBe(false);
  });

  it('caps the text attachment at 10,000 characters', () => {
    expect(
      ThreadsPlatformOptionsSchema.safeParse({ textAttachment: 'x'.repeat(10000) }).success
    ).toBe(true);
    expect(
      ThreadsPlatformOptionsSchema.safeParse({ textAttachment: 'x'.repeat(10001) }).success
    ).toBe(false);
  });

  it('weighted text length counts UTF-8 bytes, so emoji weigh more than one', () => {
    expect(threadsWeightedTextLength('hello')).toBe(5);
    // 🎉 is a single visible character but 4 UTF-8 bytes.
    expect(threadsWeightedTextLength('🎉')).toBe(4);
    expect(threadsWeightedTextLength('café')).toBe(5);
  });

  it('text validation enforces the 500 weighted cap and the 5-link cap', () => {
    expect(validateThreadsText('short post')).toBeNull();
    expect(validateThreadsText('x'.repeat(501))).toContain('500');
    // 126 party emoji = 504 weighted characters — over the cap while
    // looking like a short post.
    expect(validateThreadsText('🎉'.repeat(126))).toContain('500');
    expect(validateThreadsText('🎉'.repeat(125))).toBeNull();
    const sixLinks = Array(6).fill('https://example.com').join(' ');
    expect(validateThreadsText(sixLinks)).toContain('5 links');
    expect(countThreadsLinks('see https://a.com and https://b.com/x')).toBe(2);
  });
});
