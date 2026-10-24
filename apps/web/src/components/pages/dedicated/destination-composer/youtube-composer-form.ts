import { z } from 'zod';
import {
  DestinationEnqueueRequestSchema,
  parseYouTubePlatformOptions,
  validateYouTubeUploadFields,
  youtubeTagsTotalChars,
  YOUTUBE_DESCRIPTION_MAX_BYTES,
  YOUTUBE_PRIVACY_STATUSES,
  YOUTUBE_TAGS_MAX_CHARS,
  YOUTUBE_TITLE_MAX_CHARS,
  type YouTubePlatformOptions,
  type YouTubePrivacyStatus,
} from '@fbuploadpro/contracts';
import type { ComposerIntent } from '../composer/intent-selector';
import { SCHEDULE_FUTURE_MESSAGE } from '../composer/composer-form-schema';
import type { YouTubeEnqueueRequest } from './destination-enqueue-client';

/**
 * YouTube composer form logic (spec 132 G-YT, spec 125's fields).
 *
 * Every limit and optionality rule comes from the contracts YouTube
 * schema + its field validators — this module holds no copy of the
 * numbers: the form schema delegates to `validateYouTubeUploadFields`
 * (title/description), `youtubeTagsTotalChars` (tags) and
 * `parseYouTubePlatformOptions` (the options object), so a contracts
 * change changes the composer's validation without a composer edit.
 *
 * The made-for-kids gate (spec.md §4.3): the value starts UNCHOSEN
 * (''), there is no default and no pre-selection, and both the form
 * schema and the submit decision below refuse until the user picks
 * "Made for kids" or "Not made for kids" explicitly. Privacy likewise
 * starts unchosen (the contracts schema requires it with no default).
 */

export const YOUTUBE_TITLE_REQUIRED_MESSAGE = 'Give your video a title.';
export const YOUTUBE_PRIVACY_REQUIRED_MESSAGE =
  'Choose who can see this video.';
export const YOUTUBE_MADE_FOR_KIDS_REQUIRED_MESSAGE =
  'Say whether this video is made for kids — YouTube needs an answer for every upload.';
export const YOUTUBE_MEDIA_REQUIRED_MESSAGE = 'Choose a video for this post.';
export const YOUTUBE_MEDIA_TYPE_MESSAGE =
  'Remove or replace the flagged media to continue.';
export const YOUTUBE_TAGS_TOTAL_MESSAGE = `Tags must total at most ${YOUTUBE_TAGS_MAX_CHARS} characters`;

export type YouTubeMadeForKidsChoice = '' | 'yes' | 'no';

export interface YouTubeComposerFormValues {
  intent: ComposerIntent;
  title: string;
  description: string;
  privacy: '' | YouTubePrivacyStatus;
  madeForKids: YouTubeMadeForKidsChoice;
  tagsText: string;
  categoryId: string;
  scheduleValue: string;
}

export const YOUTUBE_COMPOSER_DEFAULT_VALUES: YouTubeComposerFormValues = {
  intent: 'queue',
  title: '',
  description: '',
  privacy: '',
  madeForKids: '',
  tagsText: '',
  categoryId: '',
  scheduleValue: '',
};

/** Standard YouTube category ids (the schema carries the id as a free string). */
export const YOUTUBE_CATEGORIES: Array<{ id: string; label: string }> = [
  { id: '1', label: 'Film & Animation' },
  { id: '2', label: 'Autos & Vehicles' },
  { id: '10', label: 'Music' },
  { id: '15', label: 'Pets & Animals' },
  { id: '17', label: 'Sports' },
  { id: '19', label: 'Travel & Events' },
  { id: '20', label: 'Gaming' },
  { id: '22', label: 'People & Blogs' },
  { id: '23', label: 'Comedy' },
  { id: '24', label: 'Entertainment' },
  { id: '25', label: 'News & Politics' },
  { id: '26', label: 'Howto & Style' },
  { id: '27', label: 'Education' },
  { id: '28', label: 'Science & Technology' },
];

export function parseYouTubeTags(tagsText: string): string[] {
  return tagsText
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/** Builds the contracts platform_options from the form's choices (validated by the caller). */
export function buildYouTubePlatformOptions(
  values: Pick<
    YouTubeComposerFormValues,
    'privacy' | 'madeForKids' | 'tagsText' | 'categoryId'
  >,
): YouTubePlatformOptions {
  const tags = parseYouTubeTags(values.tagsText);
  return parseYouTubePlatformOptions({
    privacy: values.privacy,
    madeForKids: values.madeForKids === 'yes',
    ...(tags.length > 0 ? { tags } : {}),
    ...(values.categoryId ? { categoryId: values.categoryId } : {}),
  });
}

export const youtubeComposerFormSchema = z
  .object({
    intent: z.enum(['now', 'schedule', 'queue']),
    title: z.string(),
    description: z.string(),
    privacy: z.enum(['', ...YOUTUBE_PRIVACY_STATUSES]),
    madeForKids: z.enum(['', 'yes', 'no']),
    tagsText: z.string(),
    categoryId: z.string(),
    scheduleValue: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!values.title.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['title'],
        message: YOUTUBE_TITLE_REQUIRED_MESSAGE,
      });
    }
    // Title-length + description-bytes problems come from the
    // contracts validator, routed to their field by message prefix.
    const fieldProblem = validateYouTubeUploadFields({
      title: values.title,
      description: values.description,
    });
    if (fieldProblem) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [fieldProblem.startsWith('Title') ? 'title' : 'description'],
        message: fieldProblem,
      });
    }
    if (!values.privacy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['privacy'],
        message: YOUTUBE_PRIVACY_REQUIRED_MESSAGE,
      });
    }
    if (!values.madeForKids) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['madeForKids'],
        message: YOUTUBE_MADE_FOR_KIDS_REQUIRED_MESSAGE,
      });
    }
    const tags = parseYouTubeTags(values.tagsText);
    if (
      tags.length > 0 &&
      youtubeTagsTotalChars(tags) > YOUTUBE_TAGS_MAX_CHARS
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tagsText'],
        message: YOUTUBE_TAGS_TOTAL_MESSAGE,
      });
    }
  });

export type YouTubeComposerFormSchemaValues = z.infer<
  typeof youtubeComposerFormSchema
>;

export interface YouTubeValidationContext {
  hasVideo: boolean;
  hasMediaTypeError: boolean;
  title: string;
  description: string;
  privacy: string;
  madeForKids: string;
  tagsText: string;
  intent: ComposerIntent;
  isScheduleInFuture: boolean;
  hasActiveSlots: boolean;
  hasCoveringSlot: boolean;
}

/**
 * The single place deciding whether the YouTube submit is allowed and
 * why not (the Facebook composer's `computeValidationError` pattern).
 * Field-format problems (title length, description bytes, tags total)
 * are the form schema's; this covers presence + intent state.
 */
export function computeYouTubeValidationError(
  ctx: YouTubeValidationContext,
): string | null {
  if (!ctx.hasVideo) return YOUTUBE_MEDIA_REQUIRED_MESSAGE;
  if (ctx.hasMediaTypeError) return YOUTUBE_MEDIA_TYPE_MESSAGE;
  if (!ctx.title.trim()) return YOUTUBE_TITLE_REQUIRED_MESSAGE;
  const fieldProblem = validateYouTubeUploadFields({
    title: ctx.title,
    description: ctx.description,
  });
  if (fieldProblem) return fieldProblem;
  const tags = parseYouTubeTags(ctx.tagsText);
  if (tags.length > 0 && youtubeTagsTotalChars(tags) > YOUTUBE_TAGS_MAX_CHARS) {
    return YOUTUBE_TAGS_TOTAL_MESSAGE;
  }
  if (!ctx.privacy) return YOUTUBE_PRIVACY_REQUIRED_MESSAGE;
  if (!ctx.madeForKids) return YOUTUBE_MADE_FOR_KIDS_REQUIRED_MESSAGE;
  if (ctx.intent === 'schedule' && !ctx.isScheduleInFuture)
    return SCHEDULE_FUTURE_MESSAGE;
  if (ctx.intent === 'queue' && !ctx.hasActiveSlots)
    return 'Set posting times first.';
  if (ctx.intent === 'queue' && !ctx.hasCoveringSlot) {
    return 'No posting time covers Videos yet.';
  }
  return null;
}

export interface BuildYouTubeRequestInput {
  destinationId: string;
  values: YouTubeComposerFormValues;
  mediaItemIds: string[];
  scheduleDate: Date | null;
}

/**
 * Assembles the enqueue request and validates it against the full
 * contracts enqueue schema before anything is sent — the same schema
 * the endpoint validates with, so a client-side shape problem surfaces
 * here instead of as a server rejection.
 */
export function buildYouTubeEnqueueRequest(
  input: BuildYouTubeRequestInput,
): { ok: true; request: YouTubeEnqueueRequest } | { ok: false; error: string } {
  const { values } = input;
  let platformOptions: YouTubePlatformOptions;
  try {
    platformOptions = buildYouTubePlatformOptions(values);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Those YouTube options are not valid.',
    };
  }

  const request: YouTubeEnqueueRequest = {
    platform: 'youtube',
    destinationId: input.destinationId,
    kind: 'video',
    caption: values.description,
    title: values.title.trim(),
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

export { YOUTUBE_TITLE_MAX_CHARS, YOUTUBE_DESCRIPTION_MAX_BYTES };
