import { describe, it, expect } from 'vitest';
import {
  TIKTOK_PRIVACY_LEVELS,
  validateTikTokPostFields,
} from '@fbuploadpro/contracts';
import { SCHEDULE_FUTURE_MESSAGE } from '../composer/composer-form-schema';
import {
  buildTikTokEnqueueRequest,
  buildTikTokPlatformOptions,
  computeTikTokValidationError,
  TIKTOK_COMPOSER_DEFAULT_VALUES,
  TIKTOK_MEDIA_COUNT_MESSAGE,
  TIKTOK_MEDIA_REQUIRED_MESSAGE,
  TIKTOK_MEDIA_TYPE_MESSAGE,
  TIKTOK_PRIVACY_OPTIONS,
  tiktokComposerFormSchema,
  type TikTokComposerFormValues,
  type TikTokValidationContext,
} from './tiktok-composer-form';

/**
 * TikTok composer form logic (spec 132 G-TT) — the gates trace to
 * spec 126's shipped schema: privacy values derive from the
 * contracts constant, the caption gate is the contracts validator
 * verbatim, toggles omit on 'default' (never an invented value),
 * autoAddMusic is photo-only, and `isDraft` cannot be produced.
 */

const DESTINATION_ID = '22222222-2222-4222-8222-222222222222';
const MEDIA_ID = '33333333-3333-4333-8333-333333333333';

function values(
  overrides: Partial<TikTokComposerFormValues> = {},
): TikTokComposerFormValues {
  return { ...TIKTOK_COMPOSER_DEFAULT_VALUES, ...overrides };
}

function ctx(
  overrides: Partial<TikTokValidationContext> = {},
): TikTokValidationContext {
  return {
    mediaCount: 1,
    hasMediaTypeError: false,
    kind: 'video',
    caption: 'Hello TikTok',
    intent: 'queue',
    isScheduleInFuture: true,
    hasActiveSlots: true,
    hasCoveringSlot: true,
    ...overrides,
  };
}

describe('tiktok composer form (spec 132 G-TT)', () => {
  it('defaults carry the schema default privacy and unchosen toggles', () => {
    expect(TIKTOK_COMPOSER_DEFAULT_VALUES.privacy).toBe('public');
    expect(TIKTOK_COMPOSER_DEFAULT_VALUES.kind).toBe('video');
    for (const key of [
      'allowComment',
      'allowDuet',
      'allowStitch',
      'isAiGenerated',
      'autoAddMusic',
    ] as const) {
      expect(TIKTOK_COMPOSER_DEFAULT_VALUES[key]).toBe('default');
    }
  });

  it('privacy options derive from the contracts constant, in order', () => {
    expect(TIKTOK_PRIVACY_OPTIONS.map((option) => option.value)).toEqual([
      ...TIKTOK_PRIVACY_LEVELS,
    ]);
  });

  it('builds options with only the privacy key when every toggle is Default', () => {
    expect(buildTikTokPlatformOptions(values())).toEqual({
      privacy: 'public',
    });
  });

  it('maps On/Off toggles to booleans and keeps Default omitted', () => {
    expect(
      buildTikTokPlatformOptions(
        values({
          privacy: 'followers',
          allowComment: 'off',
          allowDuet: 'on',
          isAiGenerated: 'on',
        }),
      ),
    ).toEqual({
      privacy: 'followers',
      allowComment: false,
      allowDuet: true,
      isAiGenerated: true,
    });
  });

  it('carries autoAddMusic for photo posts only — a video post never sends it', () => {
    expect(
      buildTikTokPlatformOptions(
        values({ kind: 'image', autoAddMusic: 'on' }),
      ),
    ).toEqual({ privacy: 'public', autoAddMusic: true });
    expect(
      buildTikTokPlatformOptions(
        values({ kind: 'video', autoAddMusic: 'on' }),
      ),
    ).toEqual({ privacy: 'public' });
  });

  it('the built options can never contain isDraft', () => {
    const options = buildTikTokPlatformOptions(
      values({ kind: 'image', autoAddMusic: 'on', allowComment: 'on' }),
    );
    expect('isDraft' in options).toBe(false);
  });

  it('gates media presence, count and type in order', () => {
    expect(computeTikTokValidationError(ctx({ mediaCount: 0 }))).toBe(
      TIKTOK_MEDIA_REQUIRED_MESSAGE,
    );
    expect(computeTikTokValidationError(ctx({ mediaCount: 2 }))).toBe(
      TIKTOK_MEDIA_COUNT_MESSAGE,
    );
    expect(
      computeTikTokValidationError(ctx({ hasMediaTypeError: true })),
    ).toBe(TIKTOK_MEDIA_TYPE_MESSAGE);
  });

  it('gates the caption with the contracts validator message, verbatim', () => {
    const longCaption = 'a'.repeat(2201);
    const expected = validateTikTokPostFields({ caption: longCaption });
    expect(expected).toContain('2,200');
    expect(computeTikTokValidationError(ctx({ caption: longCaption }))).toBe(
      expected,
    );
    expect(
      tiktokComposerFormSchema.safeParse(values({ caption: longCaption }))
        .success,
    ).toBe(false);
  });

  it('gates schedule-in-past and queue slot coverage per kind', () => {
    expect(
      computeTikTokValidationError(
        ctx({ intent: 'schedule', isScheduleInFuture: false }),
      ),
    ).toBe(SCHEDULE_FUTURE_MESSAGE);
    expect(
      computeTikTokValidationError(ctx({ hasActiveSlots: false })),
    ).toBe('Set posting times first.');
    expect(
      computeTikTokValidationError(ctx({ hasCoveringSlot: false })),
    ).toBe('No posting time covers Videos yet.');
    expect(
      computeTikTokValidationError(
        ctx({ kind: 'image', hasCoveringSlot: false }),
      ),
    ).toBe('No posting time covers Photos yet.');
    expect(computeTikTokValidationError(ctx())).toBeNull();
  });

  it('builds a video enqueue request the contracts schema accepts — no title key', () => {
    const built = buildTikTokEnqueueRequest({
      destinationId: DESTINATION_ID,
      values: values({ caption: 'Dance break', allowStitch: 'off' }),
      mediaItemIds: [MEDIA_ID],
      scheduleDate: null,
    });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.request).toEqual({
        platform: 'tiktok',
        destinationId: DESTINATION_ID,
        kind: 'video',
        caption: 'Dance break',
        mediaItemIds: [MEDIA_ID],
        intent: 'queue',
        platformOptions: { privacy: 'public', allowStitch: false },
      });
      expect('title' in built.request).toBe(false);
    }
  });

  it('builds a photo request with autoAddMusic and a scheduled time', () => {
    const when = new Date('2026-12-01T09:00:00.000Z');
    const built = buildTikTokEnqueueRequest({
      destinationId: DESTINATION_ID,
      values: values({
        kind: 'image',
        intent: 'schedule',
        autoAddMusic: 'off',
        privacy: 'private',
      }),
      mediaItemIds: [MEDIA_ID],
      scheduleDate: when,
    });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.request.kind).toBe('image');
      expect(built.request.intent).toBe('scheduled');
      expect(built.request.scheduledAt).toBe('2026-12-01T09:00:00.000Z');
      expect(built.request.platformOptions).toEqual({
        privacy: 'private',
        autoAddMusic: false,
      });
    }
  });
});
