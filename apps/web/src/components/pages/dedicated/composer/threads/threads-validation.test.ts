import { describe, it, expect } from 'vitest';
import { threadsWeightedTextLength } from '@fbuploadpro/contracts';
import {
  EMPTY_THREADS_OPTIONS,
  buildThreadsOptions,
  computeThreadsValidationError,
  getThreadsItemError,
  threadsKindForItems,
  validateThreadsOptions,
  type ThreadsOptionsFormState,
} from './threads-validation';
import type { DestinationMediaItem } from '../destination/destination-media';

const imageItem = (overrides: Partial<DestinationMediaItem> = {}): DestinationMediaItem => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'photo.jpg',
  mediaType: 'image',
  url: 'https://cdn.example.com/photo.jpg',
  mimeType: 'image/jpeg',
  fileSize: 1024,
  width: 1080,
  height: 1080,
  ...overrides,
});

const videoItem = (overrides: Partial<DestinationMediaItem> = {}): DestinationMediaItem => ({
  id: '22222222-2222-4222-8222-222222222222',
  name: 'clip.mp4',
  mediaType: 'video',
  url: 'https://cdn.example.com/clip.mp4',
  mimeType: 'video/mp4',
  fileSize: 2048,
  durationSeconds: 60,
  ...overrides,
});

const options = (overrides: Partial<ThreadsOptionsFormState> = {}): ThreadsOptionsFormState => ({
  ...EMPTY_THREADS_OPTIONS,
  ...overrides,
});

describe('kind derivation — the post kind follows the media selection', () => {
  it('derives text / image / video / carousel', () => {
    expect(threadsKindForItems([])).toBe('text');
    expect(threadsKindForItems([imageItem()])).toBe('image');
    expect(threadsKindForItems([videoItem()])).toBe('video');
    expect(threadsKindForItems([imageItem(), videoItem()])).toBe('carousel');
  });
});

describe('weighted text counting (contracts)', () => {
  it('counts emoji at their UTF-8 byte weight', () => {
    expect(threadsWeightedTextLength('abc')).toBe(3);
    expect(threadsWeightedTextLength('😀')).toBe(4);
    expect(threadsWeightedTextLength('a😀')).toBe(5);
  });
});

describe('options assembly', () => {
  it('carries the reply control and trims optional fields', () => {
    expect(
      buildThreadsOptions(
        'text',
        options({
          replyControl: 'mentioned_only',
          topicTag: ' Photography ',
          linkAttachment: ' https://example.com ',
        })
      )
    ).toEqual({
      replyControl: 'mentioned_only',
      topicTag: 'Photography',
      linkAttachment: 'https://example.com',
    });
  });

  it('never carries a link attachment on a media post', () => {
    const built = buildThreadsOptions(
      'image',
      options({ linkAttachment: 'https://example.com', altText: ' A photo ' })
    );
    expect(built).not.toHaveProperty('linkAttachment');
    expect(built.altText).toBe('A photo');
  });
});

describe('options validation defers to the shipped contracts schema', () => {
  it('rejects a topic tag with a period', () => {
    const error = validateThreadsOptions(
      'text',
      options({ topicTag: 'photo.graphy' }),
      {},
      []
    );
    expect(error?.field).toBe('topicTag');
  });

  it('rejects a non-URL link attachment', () => {
    const error = validateThreadsOptions(
      'text',
      options({ linkAttachment: 'not a url' }),
      {},
      []
    );
    expect(error?.field).toBe('linkAttachment');
  });

  it('surfaces the schema mutual-exclusion message for text + link attachments', () => {
    const error = validateThreadsOptions(
      'text',
      options({
        textAttachment: 'A long piece of writing.',
        linkAttachment: 'https://example.com',
      }),
      {},
      []
    );
    expect(error?.field).toBe('textAttachment');
    expect(error?.message).toContain('not both');
  });

  it('surfaces the schema mutual-exclusion message for quote + reply', () => {
    const error = validateThreadsOptions(
      'text',
      options({ quotePostId: 'post-1', replyToId: 'post-2' }),
      {},
      []
    );
    expect(error?.field).toBe('quotePostId');
    expect(error?.message).toContain('not both');
  });

  it('rejects carousel alt text over the schema cap', () => {
    const items = [imageItem(), videoItem()];
    const error = validateThreadsOptions('carousel', options(), {
      [items[0]!.id]: 'a'.repeat(1001),
    }, items);
    expect(error?.field).toBe('carouselAltText');
  });

  it('accepts a fully valid options set', () => {
    expect(
      validateThreadsOptions(
        'text',
        options({ topicTag: 'Photography', textAttachment: 'Long form.' }),
        {},
        []
      )
    ).toBeNull();
  });
});

describe('media rules from spec 124', () => {
  it('flags a GIF image and an over-size image', () => {
    expect(getThreadsItemError(imageItem({ mimeType: 'image/gif' }))).toContain(
      'JPEG or PNG'
    );
    expect(
      getThreadsItemError(imageItem({ fileSize: 9 * 1024 * 1024 }))
    ).toContain('8 MB');
  });

  it('flags an over-long video', () => {
    expect(getThreadsItemError(videoItem({ durationSeconds: 301 }))).toContain(
      '5 minutes'
    );
    expect(getThreadsItemError(videoItem())).toBeNull();
    expect(getThreadsItemError(imageItem())).toBeNull();
  });
});

describe('computeThreadsValidationError — the single decision point', () => {
  const base = {
    kind: 'text' as const,
    items: [] as DestinationMediaItem[],
    text: 'Hello Threads',
    optionsState: options(),
    carouselAltTexts: {},
    intent: 'now' as const,
    isScheduleInFuture: true,
    hasActiveSlots: true,
    hasCoveringSlot: true,
  };

  it('allows a valid text post', () => {
    expect(computeThreadsValidationError(base)).toBeNull();
  });

  it('requires text (or a long-text attachment) for a text post', () => {
    expect(computeThreadsValidationError({ ...base, text: '  ' })).toBe(
      'Write something for your text post.'
    );
    expect(
      computeThreadsValidationError({
        ...base,
        text: '',
        optionsState: options({ textAttachment: 'Long form instead.' }),
      })
    ).toBeNull();
  });

  it('blocks text past the weighted cap with the contracts message', () => {
    const error = computeThreadsValidationError({
      ...base,
      text: '😀'.repeat(126), // 126 × 4 = 504 weighted characters
    });
    expect(error).toContain('at most 500 characters');
  });

  it('blocks more than 5 links with the contracts message', () => {
    const error = computeThreadsValidationError({
      ...base,
      text: Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`).join(' '),
    });
    expect(error).toContain('at most 5 links');
  });

  it('blocks a link attachment combined with media', () => {
    const error = computeThreadsValidationError({
      ...base,
      kind: 'image',
      items: [imageItem()],
      optionsState: options({ linkAttachment: 'https://example.com' }),
    });
    expect(error).toContain('only go on text posts');
  });

  it('blocks queueing without a covering slot', () => {
    expect(
      computeThreadsValidationError({
        ...base,
        intent: 'queue',
        hasCoveringSlot: false,
      })
    ).toBe('No posting time covers Text posts yet.');
  });
});
