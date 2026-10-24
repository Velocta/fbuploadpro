import { z } from 'zod';
import { THREADS_REPLY_CONTROLS } from '@fbuploadpro/contracts';

/**
 * Threads composer form schema (spec 137 §3.8 form standard,
 * spec 132 §4.2). The form holds the field VALUES; the platform rules
 * themselves live in the contracts module and are applied by
 * `threads-validation.ts` (text validator + strict options schema),
 * so a contracts limit change changes this composer's validation
 * without a composer edit.
 */
export const threadsFormSchema = z.object({
  intent: z.enum(['now', 'schedule', 'queue']),
  text: z.string(),
  replyControl: z.enum(THREADS_REPLY_CONTROLS),
  topicTag: z.string(),
  quotePostId: z.string(),
  replyToId: z.string(),
  linkAttachment: z.string(),
  altText: z.string(),
  textAttachment: z.string(),
  scheduleValue: z.string(),
});

export type ThreadsFormValues = z.infer<typeof threadsFormSchema>;
