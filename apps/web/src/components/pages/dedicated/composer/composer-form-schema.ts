import { z } from 'zod';
import type { PostFormat } from '@fbuploadpro/contracts';
import { isValidLink } from './composer-link';

/**
 * Composer form schema (spec 137 §3.8 form standard, spec 132 C1.3).
 *
 * The text fields of the composer — caption, link, scheduled time — plus
 * the intent/format selectors live in react-hook-form under this schema.
 * Media selection and slot coverage are not text-field concerns: they are
 * validated by `computeValidationError` in `composer-validation.ts` (the
 * preserved single decision point for whether submit is allowed) and are
 * surfaced as form-level summary entries worded exactly like the legacy
 * inline notices. Messages here match the inline wording exactly, as the
 * form standard requires.
 */

export const LINK_ERROR_MESSAGE = "That doesn't look like a valid link.";
export const CAPTION_REQUIRED_MESSAGE = 'Write a caption for your text post.';
export const SCHEDULE_FUTURE_MESSAGE = 'Pick a time in the future.';

export const composerFormSchema = z
  .object({
    intent: z.enum(['now', 'schedule', 'queue']),
    format: z.enum(['text', 'image', 'video', 'reel', 'story']),
    caption: z.string(),
    link: z.string(),
    scheduleValue: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.format === 'text' && !values.caption.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['caption'],
        message: CAPTION_REQUIRED_MESSAGE,
      });
    }
    if (values.link.trim() && !isValidLink(values.link)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['link'],
        message: LINK_ERROR_MESSAGE,
      });
    }
  });

export type ComposerFormValues = z.infer<typeof composerFormSchema>;

export type ComposerPostFormat = PostFormat;
