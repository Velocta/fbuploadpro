/**
 * Form schema + defaults for the X composer (spec 132 §4.5) — the
 * house form standard (spec UX-F §2, UX rule 22): react-hook-form +
 * zod, errors inline next to the field AND in the top
 * `FormErrorSummary`, identical wording computed from the same
 * constants, nothing clears typed input, submit is loading-aware.
 *
 * Only the react-hook-form-owned fields live here (text, intent,
 * schedule value, reply settings, quote id, alt text). The media,
 * poll and slot rules sit in `x-composer-validation.ts`, mirroring how
 * the Facebook composer splits its schema from its validation module;
 * both import the same message constants so the summary and the
 * inline errors can never drift apart.
 */
import { z } from 'zod';
import {
  countXWeightedCharacters,
  X_ALT_TEXT_MAX_CHARACTERS,
  X_MAX_WEIGHTED_CHARACTERS,
  XReplySettingsSchema,
} from '@fbuploadpro/contracts';

export const X_TEXT_REQUIRED_MESSAGE = 'Write something for your post.';
export const X_TEXT_LIMIT_MESSAGE = `This post is over the ${X_MAX_WEIGHTED_CHARACTERS}-character limit for X.`;
export const X_SCHEDULE_FUTURE_MESSAGE = 'Pick a time in the future.';
export const X_ALT_TEXT_LIMIT_MESSAGE = `Alt text can be at most ${X_ALT_TEXT_MAX_CHARACTERS} characters.`;

export const xComposerFormSchema = z.object({
  intent: z.enum(['now', 'schedule', 'queue']),
  text: z.string().superRefine((value, ctx) => {
    if (countXWeightedCharacters(value) > X_MAX_WEIGHTED_CHARACTERS) {
      ctx.addIssue({ code: 'custom', message: X_TEXT_LIMIT_MESSAGE });
    }
  }),
  scheduleValue: z.string(),
  replySettings: XReplySettingsSchema,
  quoteTweetId: z.string(),
  altText: z.string().max(X_ALT_TEXT_MAX_CHARACTERS, X_ALT_TEXT_LIMIT_MESSAGE),
});

export type XComposerFormValues = z.infer<typeof xComposerFormSchema>;

/**
 * Defaults: the safest intent (queue — §5.1) until the destination's
 * slots resolve; the orchestrator falls back to "now" when the
 * destination has no posting times at all.
 */
export const X_COMPOSER_DEFAULT_VALUES: XComposerFormValues = {
  intent: 'queue',
  text: '',
  scheduleValue: '',
  replySettings: 'everyone',
  quoteTweetId: '',
  altText: '',
};
