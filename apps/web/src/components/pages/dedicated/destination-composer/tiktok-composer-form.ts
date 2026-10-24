import { z } from 'zod';
import {
  DestinationEnqueueRequestSchema,
  parseTikTokOptions,
  TIKTOK_PRIVACY_LEVELS,
  validateTikTokPostFields,
  type TikTokOptions,
  type TikTokPrivacy,
} from '@fbuploadpro/contracts';
import type { ComposerIntent } from '../composer/intent-selector';
import { SCHEDULE_FUTURE_MESSAGE } from '../composer/composer-form-schema';
import type { TikTokEnqueueRequest } from './destination-enqueue-client';

/**
 * TikTok composer form logic (spec 132 G-TT, spec 126's fields).
 *
 * Every option and limit comes from the contracts TikTok schema
 * module — this file holds no copy of them: the privacy values derive
 * from `TIKTOK_PRIVACY_LEVELS`, the caption gate IS
 * `validateTikTokPostFields` (2,200 chars, the contracts message
 * verbatim), and the options object is built through
 * `parseTikTokOptions`, so a contracts change changes the composer
 * without a composer edit.
 *
 * The interaction toggles (comments / duets / stitches / AI label /
 * automatic music) are tri-state in the form: 'default' OMITS the key
 * so TikTok's own account default applies — the publisher only ever
 * sends a value the user picked (spec 126). Privacy always carries a
 * value: the schema's own default is 'public', shown selected — the
 * user can change it, and what they see is what is sent.
 *
 * Deliberately NOT modelled, exactly as spec 126 decided: `isDraft`.
 * Nothing in this form can produce it — a TikTok post from this
 * product is published, never left as an in-app draft.
 */

export const TIKTOK_MEDIA_REQUIRED_MESSAGE =
  'Choose a video or photo for this post.';
export const TIKTOK_MEDIA_COUNT_MESSAGE =
  'TikTok posts use one video or one photo — remove the extras to continue.';
export const TIKTOK_MEDIA_TYPE_MESSAGE =
  'Remove or replace the flagged media to continue.';

export type TikTokPostKindChoice = 'video' | 'image';
export type TikTokToggleChoice = 'default' | 'on' | 'off';

export interface TikTokComposerFormValues {
  intent: ComposerIntent;
  kind: TikTokPostKindChoice;
  caption: string;
  privacy: TikTokPrivacy;
  allowComment: TikTokToggleChoice;
  allowDuet: TikTokToggleChoice;
  allowStitch: TikTokToggleChoice;
  isAiGenerated: TikTokToggleChoice;
  autoAddMusic: TikTokToggleChoice;
  scheduleValue: string;
}

export const TIKTOK_COMPOSER_DEFAULT_VALUES: TikTokComposerFormValues = {
  intent: 'queue',
  kind: 'video',
  caption: '',
  privacy: 'public',
  allowComment: 'default',
  allowDuet: 'default',
  allowStitch: 'default',
  isAiGenerated: 'default',
  autoAddMusic: 'default',
  scheduleValue: '',
};

const TIKTOK_PRIVACY_COPY: Record<
  TikTokPrivacy,
  { label: string; hint: string }
> = {
  public: { label: 'Public', hint: 'Anyone can see this post.' },
  followers: {
    label: 'Followers',
    hint: 'Only people who follow this account can see this post.',
  },
  friends: { label: 'Friends', hint: 'Only friends can see this post.' },
  private: { label: 'Private', hint: 'Only you can see this post.' },
};

/** Privacy choices derived from the contracts constant — never a local list. */
export const TIKTOK_PRIVACY_OPTIONS: Array<{
  value: TikTokPrivacy;
  label: string;
  hint: string;
}> = TIKTOK_PRIVACY_LEVELS.map((level) => ({
  value: level,
  ...TIKTOK_PRIVACY_COPY[level],
}));

function toggleToBoolean(
  choice: TikTokToggleChoice,
): boolean | undefined {
  return choice === 'default' ? undefined : choice === 'on';
}

/** Builds the contracts platform_options from the form's choices (validated by the caller). */
export function buildTikTokPlatformOptions(
  values: Pick<
    TikTokComposerFormValues,
    | 'kind'
    | 'privacy'
    | 'allowComment'
    | 'allowDuet'
    | 'allowStitch'
    | 'isAiGenerated'
    | 'autoAddMusic'
  >,
): TikTokOptions {
  const allowComment = toggleToBoolean(values.allowComment);
  const allowDuet = toggleToBoolean(values.allowDuet);
  const allowStitch = toggleToBoolean(values.allowStitch);
  const isAiGenerated = toggleToBoolean(values.isAiGenerated);
  // autoAddMusic is photo posts only (spec 126) — a video post never
  // carries it, whatever the toggle last held.
  const autoAddMusic =
    values.kind === 'image' ? toggleToBoolean(values.autoAddMusic) : undefined;
  const parsed = parseTikTokOptions({
    privacy: values.privacy,
    ...(allowComment !== undefined ? { allowComment } : {}),
    ...(allowDuet !== undefined ? { allowDuet } : {}),
    ...(allowStitch !== undefined ? { allowStitch } : {}),
    ...(isAiGenerated !== undefined ? { isAiGenerated } : {}),
    ...(autoAddMusic !== undefined ? { autoAddMusic } : {}),
  });
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.options;
}

export const tiktokComposerFormSchema = z
  .object({
    intent: z.enum(['now', 'schedule', 'queue']),
    kind: z.enum(['video', 'image']),
    caption: z.string(),
    privacy: z.enum([...TIKTOK_PRIVACY_LEVELS]),
    allowComment: z.enum(['default', 'on', 'off']),
    allowDuet: z.enum(['default', 'on', 'off']),
    allowStitch: z.enum(['default', 'on', 'off']),
    isAiGenerated: z.enum(['default', 'on', 'off']),
    autoAddMusic: z.enum(['default', 'on', 'off']),
    scheduleValue: z.string(),
  })
  .superRefine((values, ctx) => {
    // The caption limit is the contracts validator's, verbatim.
    const problem = validateTikTokPostFields({ caption: values.caption });
    if (problem) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['caption'],
        message: problem,
      });
    }
  });

export type TikTokComposerFormSchemaValues = z.infer<
  typeof tiktokComposerFormSchema
>;

export interface TikTokValidationContext {
  mediaCount: number;
  hasMediaTypeError: boolean;
  kind: TikTokPostKindChoice;
  caption: string;
  intent: ComposerIntent;
  isScheduleInFuture: boolean;
  hasActiveSlots: boolean;
  hasCoveringSlot: boolean;
}

/**
 * The single place deciding whether the TikTok submit is allowed and
 * why not (the family pattern). Caption format is the form schema's;
 * this covers media presence/count/type + intent state.
 */
export function computeTikTokValidationError(
  ctx: TikTokValidationContext,
): string | null {
  if (ctx.mediaCount === 0) return TIKTOK_MEDIA_REQUIRED_MESSAGE;
  if (ctx.mediaCount > 1) return TIKTOK_MEDIA_COUNT_MESSAGE;
  if (ctx.hasMediaTypeError) return TIKTOK_MEDIA_TYPE_MESSAGE;
  const problem = validateTikTokPostFields({ caption: ctx.caption });
  if (problem) return problem;
  if (ctx.intent === 'schedule' && !ctx.isScheduleInFuture)
    return SCHEDULE_FUTURE_MESSAGE;
  if (ctx.intent === 'queue' && !ctx.hasActiveSlots)
    return 'Set posting times first.';
  if (ctx.intent === 'queue' && !ctx.hasCoveringSlot) {
    return `No posting time covers ${ctx.kind === 'video' ? 'Videos' : 'Photos'} yet.`;
  }
  return null;
}

export interface BuildTikTokRequestInput {
  destinationId: string;
  values: TikTokComposerFormValues;
  mediaItemIds: string[];
  scheduleDate: Date | null;
}

/**
 * Assembles the enqueue request and validates it against the full
 * contracts enqueue schema before anything is sent (the family
 * pattern). The request carries NO title — TikTok posts don't have
 * one — and the options object only ever holds keys the strict
 * contracts schema models (never `isDraft`).
 */
export function buildTikTokEnqueueRequest(
  input: BuildTikTokRequestInput,
): { ok: true; request: TikTokEnqueueRequest } | { ok: false; error: string } {
  const { values } = input;
  let platformOptions: TikTokOptions;
  try {
    platformOptions = buildTikTokPlatformOptions(values);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Those TikTok options are not valid.',
    };
  }

  const request: TikTokEnqueueRequest = {
    platform: 'tiktok',
    destinationId: input.destinationId,
    kind: values.kind,
    caption: values.caption,
    mediaItemIds: input.mediaItemIds,
    intent:
      values.intent === 'schedule'
        ? 'scheduled'
        : values.intent === 'now'
          ? 'now'
          : 'queue',
    platformOptions,
  };
  if (values.intent === 'schedule' && input.scheduleDate) {
    request.scheduledAt = input.scheduleDate.toISOString();
  }

  const parsed = DestinationEnqueueRequestSchema.safeParse(request);
  if (!parsed.success) {
    const first = parsed.error.issues.at(0);
    return {
      ok: false,
      error: first?.message ?? 'This post is not ready to send.',
    };
  }
  return { ok: true, request };
}
