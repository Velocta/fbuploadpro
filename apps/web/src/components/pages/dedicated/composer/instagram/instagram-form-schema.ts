import { z } from 'zod';

/**
 * Instagram composer form schema (spec 137 §3.8 form standard,
 * spec 132 §4.1). The form holds the field VALUES; the platform rules
 * themselves live in the contracts module and are applied by
 * `instagram-validation.ts` (caption validator + strict options schema
 * + media-facts validators), so a contracts limit change changes this
 * composer's validation without a composer edit — the same split the
 * Facebook composer uses for media/slot rules.
 */
export const instagramFormSchema = z.object({
  intent: z.enum(['now', 'schedule', 'queue']),
  format: z.enum(['photo', 'reel', 'carousel', 'story']),
  caption: z.string(),
  firstComment: z.string(),
  collaboratorsText: z.string(),
  coverUrl: z.string(),
  shareToFeed: z.boolean(),
  trialReel: z.boolean(),
  graduationStrategy: z.enum([
    'SS_PERFORMANCE',
    'SS_PERFORMANCE_WITH_MANUAL_REVIEW',
    'MANUAL',
  ]),
  scheduleValue: z.string(),
});

export type InstagramFormValues = z.infer<typeof instagramFormSchema>;
