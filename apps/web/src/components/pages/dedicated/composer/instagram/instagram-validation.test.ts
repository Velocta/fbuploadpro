import { describe, it, expect } from 'vitest';
import { DestinationEnqueueRequestSchema } from '@fbuploadpro/contracts';
import {
  EMPTY_INSTAGRAM_OPTIONS,
  FIRST_COMMENT_MAX_CHARACTERS,
  buildInstagramOptions,
  computeInstagramValidationError,
  getInstagramItemError,
  getInstagramMediaCountError,
  instagramFormatsForAccountType,
  parseCollaborators,
  validateInstagramOptions,
  type InstagramOptionsFormState,
} from './instagram-validation';
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
  name: 'reel.mp4',
  mediaType: 'video',
  url: 'https://cdn.example.com/reel.mp4',
  mimeType: 'video/mp4',
  fileSize: 2048,
  durationSeconds: 30,
  width: 1080,
  height: 1920,
  ...overrides,
});

const options = (overrides: Partial<InstagramOptionsFormState> = {}): InstagramOptionsFormState => ({
  ...EMPTY_INSTAGRAM_OPTIONS,
  ...overrides,
});

describe('story gate (§4.1) — formats offered per account type', () => {
  it('offers Stories to a Business destination', () => {
    const ids = instagramFormatsForAccountType('BUSINESS').map((f) => f.id);
    expect(ids).toEqual(['photo', 'reel', 'carousel', 'story']);
  });

  it('does not offer Stories to a Creator destination — absent, not disabled', () => {
    const ids = instagramFormatsForAccountType('CREATOR').map((f) => f.id);
    expect(ids).toEqual(['photo', 'reel', 'carousel']);
  });

  it('does not offer Stories when the account type is unknown', () => {
    for (const unknown of [null, undefined, '']) {
      const ids = instagramFormatsForAccountType(unknown).map((f) => f.id);
      expect(ids).not.toContain('story');
    }
  });
});

describe('collaborators parsing + options assembly', () => {
  it('splits on commas and spaces and strips leading @', () => {
    expect(parseCollaborators(' @brand.account, creator.name  third ')).toEqual([
      'brand.account',
      'creator.name',
      'third',
    ]);
    expect(parseCollaborators('')).toEqual([]);
  });

  it('carries reel-only fields only on Reels', () => {
    const state = options({
      collaboratorsText: 'brand.account',
      shareToFeed: false,
      coverUrl: ' https://cdn.example.com/cover.jpg ',
      trialReel: true,
      graduationStrategy: 'MANUAL',
    });
    expect(buildInstagramOptions('reel', state)).toEqual({
      collaborators: ['brand.account'],
      shareToFeed: false,
      coverUrl: 'https://cdn.example.com/cover.jpg',
      trialParams: { graduationStrategy: 'MANUAL' },
    });
    expect(buildInstagramOptions('photo', state)).toEqual({
      collaborators: ['brand.account'],
    });
    expect(buildInstagramOptions('story', state)).toEqual({});
  });
});

describe('options validation defers to the shipped contracts schema', () => {
  it('rejects more collaborators than the schema allows', () => {
    const error = validateInstagramOptions(
      'photo',
      options({ collaboratorsText: 'one two three four' })
    );
    expect(error?.field).toBe('collaborators');
    expect(error?.message).toContain('at most 3 collaborators');
  });

  it('rejects a username the schema pattern forbids', () => {
    const error = validateInstagramOptions(
      'photo',
      options({ collaboratorsText: 'bad-name!' })
    );
    expect(error?.field).toBe('collaborators');
  });

  it('rejects a non-URL cover link on a Reel', () => {
    const error = validateInstagramOptions(
      'reel',
      options({ coverUrl: 'not a url' })
    );
    expect(error?.field).toBe('coverUrl');
  });

  it('accepts a fully valid options set', () => {
    expect(
      validateInstagramOptions(
        'reel',
        options({
          collaboratorsText: 'brand.account',
          coverUrl: 'https://cdn.example.com/cover.jpg',
          trialReel: true,
        })
      )
    ).toBeNull();
  });
});

describe('media item errors come from the contracts facts validators', () => {
  it('flags a PNG photo with the contracts JPEG message', () => {
    const error = getInstagramItemError(imageItem({ mimeType: 'image/png' }), 'photo');
    expect(error).toContain('JPEG');
  });

  it('flags a video in a photo post and an image in a Reel', () => {
    expect(getInstagramItemError(videoItem(), 'photo')).toContain('image files');
    expect(getInstagramItemError(imageItem(), 'reel')).toContain('video file');
  });

  it('flags an over-long Reel through the contracts duration rule', () => {
    const error = getInstagramItemError(videoItem({ durationSeconds: 901 }), 'reel');
    expect(error).toContain('15 minutes');
  });

  it('does not hold story images to the feed-photo JPEG rule', () => {
    expect(getInstagramItemError(imageItem({ mimeType: 'image/png' }), 'story')).toBeNull();
  });

  it('passes valid media', () => {
    expect(getInstagramItemError(imageItem(), 'photo')).toBeNull();
    expect(getInstagramItemError(videoItem(), 'reel')).toBeNull();
    expect(getInstagramItemError(imageItem(), 'carousel')).toBeNull();
    expect(getInstagramItemError(videoItem(), 'carousel')).toBeNull();
  });
});

describe('media count rules', () => {
  it('requires at least 2 items for a carousel', () => {
    expect(getInstagramMediaCountError([imageItem()], 'carousel')).toContain(
      'at least 2 items'
    );
    expect(
      getInstagramMediaCountError([imageItem(), videoItem()], 'carousel')
    ).toBeNull();
  });

  it('flags extras on single-media formats', () => {
    expect(getInstagramMediaCountError([imageItem(), imageItem()], 'photo')).toContain(
      'one image'
    );
    expect(getInstagramMediaCountError([imageItem()], 'photo')).toBeNull();
  });
});

describe('computeInstagramValidationError — the single decision point', () => {
  const base = {
    format: 'photo' as const,
    items: [imageItem()],
    caption: 'Hello',
    firstComment: '',
    optionsState: options(),
    intent: 'now' as const,
    isScheduleInFuture: true,
    hasActiveSlots: true,
    hasCoveringSlot: true,
  };

  it('allows a valid post-now photo', () => {
    expect(computeInstagramValidationError(base)).toBeNull();
  });

  it('blocks with no media chosen', () => {
    expect(computeInstagramValidationError({ ...base, items: [] })).toBe(
      'Choose media for this post.'
    );
  });

  it('blocks an over-limit caption with the contracts message', () => {
    const error = computeInstagramValidationError({
      ...base,
      caption: 'a'.repeat(2201),
    });
    expect(error).toContain('at most 2200 characters');
  });

  it('blocks queueing without a covering slot', () => {
    expect(
      computeInstagramValidationError({
        ...base,
        intent: 'queue',
        hasCoveringSlot: false,
      })
    ).toBe('No posting time covers Photos yet.');
  });

  it('blocks a past schedule', () => {
    expect(
      computeInstagramValidationError({
        ...base,
        intent: 'schedule',
        isScheduleInFuture: false,
      })
    ).toBe('Pick a time in the future.');
  });
});

describe('first-comment cap parity with the enqueue contract', () => {
  const baseRequest = {
    platform: 'instagram' as const,
    destinationId: '33333333-3333-4333-8333-333333333333',
    kind: 'image' as const,
    caption: 'Hi',
    mediaItemIds: ['11111111-1111-4111-8111-111111111111'],
    intent: 'now' as const,
  };

  it('the contract accepts a first comment at the composer cap', () => {
    const result = DestinationEnqueueRequestSchema.safeParse({
      ...baseRequest,
      firstComment: 'a'.repeat(FIRST_COMMENT_MAX_CHARACTERS),
    });
    expect(result.success).toBe(true);
  });

  it('the contract rejects a first comment one character over the cap', () => {
    const result = DestinationEnqueueRequestSchema.safeParse({
      ...baseRequest,
      firstComment: 'a'.repeat(FIRST_COMMENT_MAX_CHARACTERS + 1),
    });
    expect(result.success).toBe(false);
  });
});
