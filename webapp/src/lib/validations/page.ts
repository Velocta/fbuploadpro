import { z } from 'zod'

export const createPageSchema = z.object({
  agencyId: z.string().uuid(),
  facebookAccountId: z.string().uuid(),
  pageName: z.string().min(1, 'Page name is required'),
  fbPageId: z.string().min(1, 'Facebook Page ID is required'),
  fbPageAccessToken: z.string().min(1, 'Page Access Token is required'),
  fbPageImage: z.string().optional(),
  sourceUsername: z.string().min(1, 'Source username is required'),
  sourcePlatform: z.enum(['instagram', 'youtube', 'tiktok', 'facebook']),
  timezone: z.string(),
  postsPerDay: z.coerce.number().min(0).max(12),
  followersCount: z.coerce.number().optional(),
})

export const createPagesBulkSchema = z.object({
  agencyId: z.string().uuid(),
  facebookAccountId: z.string().uuid(),
  pages: z.array(z.object({
    pageName: z.string().min(1, 'Page name is required'),
    fbPageId: z.string().min(1, 'Facebook Page ID is required'),
    fbPageAccessToken: z.string().min(1, 'Page Access Token is required'),
    fbPageImage: z.string().optional(),
    followersCount: z.coerce.number().optional(),
    sourceUsername: z.string().min(1, 'Source username is required'),
    sourcePlatform: z.enum(['instagram', 'youtube', 'tiktok', 'facebook']),
    postsPerDay: z.coerce.number().min(1).max(12),
    timezone: z.string().min(1, 'Timezone is required'),
    scheduleType: z.enum(['dailyrandom', 'fixed']).default('dailyrandom'),
    postingTimes: z.array(z.string()).optional().default([]),
  }).superRefine((page, ctx) => {
    if (page.scheduleType !== 'fixed') return

    if (!page.postingTimes || page.postingTimes.length !== page.postsPerDay) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Fixed posting requires ${page.postsPerDay} posting times.`,
        path: ['postingTimes'],
      })
      return
    }

    if (page.postingTimes.some((time) => !String(time || '').trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'All fixed posting times are required.',
        path: ['postingTimes'],
      })
    }
  })).min(1, 'Select at least one page'),
})

export const deletePageSchema = z.object({
  pageId: z.string().uuid(),
})

export const updatePageSettingsSchema = z.object({
  pageId: z.string().uuid(),
  pageName: z.string().min(1, 'Display Name is required').optional(),
  fbPageAccessToken: z.string().optional(),
  fbPageId: z.string().optional(),
  postsPerDay: z.coerce.number().min(0).max(12).optional(),
  scheduleType: z.enum(['fixed', 'randomfixed', 'dailyrandom']).optional(),
  timezone: z.string().optional(),
  postingTimes: z.string().optional(), // JSON string of AM/PM times
})

export const togglePageStatusSchema = z.object({
  pageId: z.string().uuid(),
  currentStatus: z.string(),
})

export const updateSourceUsernameSchema = z.object({
  pageId: z.string().uuid(),
  newUsername: z.string().min(1, 'New username is required'),
  newPlatform: z.enum(['instagram', 'youtube', 'tiktok', 'facebook']).optional(),
})
