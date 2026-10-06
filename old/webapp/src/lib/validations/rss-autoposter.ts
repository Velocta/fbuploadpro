import { z } from 'zod'

const scheduleTypeSchema = z.enum(['dailyrandom', 'fixed', 'randomfixed'])

export const createRssAutoposterPageSchema = z
  .object({
    agencyId: z.string().uuid(),
    facebookAccountId: z.string().uuid(),
    fbPageId: z.string().min(1),
    fbPageName: z.string().min(1),
    fbPageAccessToken: z.string().min(1),
    fbPageImage: z.string().optional(),
    rssFeedUrl: z.string().url(),
    timezone: z.string().min(1),
    postsPerDay: z.coerce.number().min(1).max(12),
    scheduleType: scheduleTypeSchema.default('dailyrandom'),
    postingTimes: z.array(z.string()).default([]),
    templateDefinition: z.record(z.string(), z.unknown()),
    templatePresetKey: z.string().optional(),
    canvasAspectRatio: z.enum(['4:5', '1:1', '16:9']).default('4:5'),
    brandLogoObjectKey: z.string().optional(),
    brandSiteUrl: z.string().optional(),
    firstComment: z.string().max(8000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleType === 'fixed') {
      if (data.postingTimes.length !== data.postsPerDay) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Fixed posting requires ${data.postsPerDay} posting times.`,
          path: ['postingTimes'],
        })
      }
    }
  })

export const updateRssAutoposterPageSchema = z.object({
  pageId: z.string().uuid(),
  rssFeedUrl: z.string().url().optional(),
  timezone: z.string().optional(),
  postsPerDay: z.coerce.number().min(0).max(12).optional(),
  scheduleType: scheduleTypeSchema.optional(),
  postingTimes: z.array(z.string()).optional(),
  templateDefinition: z.record(z.string(), z.unknown()).optional(),
  templatePresetKey: z.string().optional(),
  canvasAspectRatio: z.enum(['4:5', '1:1', '16:9']).optional(),
  brandLogoObjectKey: z.string().nullable().optional(),
  brandSiteUrl: z.string().nullable().optional(),
  firstComment: z.string().max(8000).nullable().optional(),
  status: z.enum(['active', 'paused']).optional(),
})

export const validateFeedSchema = z.object({
  rssFeedUrl: z.string().url(),
})

export const previewTemplateSchema = z.object({
  templateDefinition: z.record(z.string(), z.unknown()),
  canvasAspectRatio: z.enum(['4:5', '1:1', '16:9']).optional(),
  sampleTitle: z.string().optional(),
  sampleDescription: z.string().optional(),
  sampleImageUrl: z.string().url().optional(),
  brandLogoUrl: z.string().url().optional(),
  brandSiteUrl: z.string().optional(),
})
