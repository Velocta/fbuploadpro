import { describe, it, expect } from 'vitest';
import {
  buildYouTubeEnqueueRequest,
  buildYouTubePlatformOptions,
  computeYouTubeValidationError,
  parseYouTubeTags,
  YOUTUBE_MADE_FOR_KIDS_REQUIRED_MESSAGE,
  YOUTUBE_PRIVACY_REQUIRED_MESSAGE,
  YOUTUBE_COMPOSER_DEFAULT_VALUES,
  youtubeComposerFormSchema,
  type YouTubeComposerFormValues,
  type YouTubeValidationContext,
} from './youtube-composer-form';

const VALID: YouTubeComposerFormValues = {
  intent: 'queue',
  title: 'Morning routine',
  description: 'How the day starts.',
  privacy: 'public',
  madeForKids: 'no',
  tagsText: '',
  categoryId: '',
  scheduleValue: '',
};

const VALID_CTX: YouTubeValidationContext = {
  hasVideo: true,
  hasMediaTypeError: false,
  title: 'Morning routine',
  description: '',
  privacy: 'public',
  madeForKids: 'no',
  tagsText: '',
  intent: 'queue',
  isScheduleInFuture: false,
  hasActiveSlots: true,
  hasCoveringSlot: true,
};

describe('youtube composer form (spec 132 G-YT)', () => {
  it('starts with made-for-kids and privacy UNCHOSEN — no default, no pre-selection', () => {
    expect(YOUTUBE_COMPOSER_DEFAULT_VALUES.madeForKids).toBe('');
    expect(YOUTUBE_COMPOSER_DEFAULT_VALUES.privacy).toBe('');
  });

  it('the form schema refuses submit until made-for-kids is explicitly chosen (G-YT.3 gate)', () => {
    const result = youtubeComposerFormSchema.safeParse({
      ...VALID,
      madeForKids: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === 'madeForKids',
      );
      expect(issue?.message).toBe(YOUTUBE_MADE_FOR_KIDS_REQUIRED_MESSAGE);
    }
  });

  it('the form schema requires an explicit privacy choice', () => {
    const result = youtubeComposerFormSchema.safeParse({
      ...VALID,
      privacy: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'privacy');
      expect(issue?.message).toBe(YOUTUBE_PRIVACY_REQUIRED_MESSAGE);
    }
  });

  it('title and description limits come from the contracts validator', () => {
    const longTitle = youtubeComposerFormSchema.safeParse({
      ...VALID,
      title: 'x'.repeat(101),
    });
    expect(longTitle.success).toBe(false);
    if (!longTitle.success) {
      expect(longTitle.error.issues.map((i) => i.message)).toContain(
        'Title must be at most 100 characters',
      );
    }
    const longDescription = youtubeComposerFormSchema.safeParse({
      ...VALID,
      description: 'a'.repeat(5001),
    });
    expect(longDescription.success).toBe(false);
    if (!longDescription.success) {
      expect(longDescription.error.issues.map((i) => i.message)).toContain(
        'Description must be at most 5000 bytes',
      );
    }
    // The description limit is BYTES: 2,501 two-byte characters exceed it.
    const wideDescription = youtubeComposerFormSchema.safeParse({
      ...VALID,
      description: 'é'.repeat(2501),
    });
    expect(wideDescription.success).toBe(false);
  });

  it('tags total is enforced through the contracts total-chars helper', () => {
    const result = youtubeComposerFormSchema.safeParse({
      ...VALID,
      tagsText: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
    expect(parseYouTubeTags(' cooking, , morning routine ')).toEqual([
      'cooking',
      'morning routine',
    ]);
  });

  it('builds platform options through the strict contracts schema — empty tags/category omitted', () => {
    const options = buildYouTubePlatformOptions(VALID);
    expect(options).toEqual({ privacy: 'public', madeForKids: false });
    expect('tags' in options).toBe(false);
    expect('categoryId' in options).toBe(false);
    const withExtras = buildYouTubePlatformOptions({
      ...VALID,
      madeForKids: 'yes',
      tagsText: 'cooking, routine',
      categoryId: '22',
    });
    expect(withExtras).toEqual({
      privacy: 'public',
      madeForKids: true,
      tags: ['cooking', 'routine'],
      categoryId: '22',
    });
  });

  it('builds an enqueue request the contracts schema accepts, per intent', () => {
    const queued = buildYouTubeEnqueueRequest({
      destinationId: '22222222-2222-4222-8222-222222222222',
      values: VALID,
      mediaItemIds: ['33333333-3333-4333-8333-333333333333'],
      scheduleDate: null,
    });
    expect(queued.ok).toBe(true);
    if (queued.ok) {
      expect(queued.request).toMatchObject({
        platform: 'youtube',
        kind: 'video',
        title: 'Morning routine',
        caption: 'How the day starts.',
        intent: 'queue',
      });
      expect(queued.request.scheduledAt).toBeUndefined();
    }
    const when = new Date('2026-12-01T09:00:00.000Z');
    const scheduled = buildYouTubeEnqueueRequest({
      destinationId: '22222222-2222-4222-8222-222222222222',
      values: { ...VALID, intent: 'schedule' },
      mediaItemIds: ['33333333-3333-4333-8333-333333333333'],
      scheduleDate: when,
    });
    expect(scheduled.ok).toBe(true);
    if (scheduled.ok) {
      expect(scheduled.request.intent).toBe('scheduled');
      expect(scheduled.request.scheduledAt).toBe(when.toISOString());
    }
  });

  it('the submit decision gates on made-for-kids after every other field is valid', () => {
    expect(computeYouTubeValidationError(VALID_CTX)).toBeNull();
    expect(
      computeYouTubeValidationError({ ...VALID_CTX, madeForKids: '' }),
    ).toBe(YOUTUBE_MADE_FOR_KIDS_REQUIRED_MESSAGE);
    expect(computeYouTubeValidationError({ ...VALID_CTX, privacy: '' })).toBe(
      YOUTUBE_PRIVACY_REQUIRED_MESSAGE,
    );
    expect(
      computeYouTubeValidationError({ ...VALID_CTX, hasVideo: false }),
    ).toBe('Choose a video for this post.');
    expect(
      computeYouTubeValidationError({ ...VALID_CTX, hasCoveringSlot: false }),
    ).toBe('No posting time covers Videos yet.');
  });
});
