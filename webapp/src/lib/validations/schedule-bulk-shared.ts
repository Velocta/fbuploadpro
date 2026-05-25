import { z } from 'zod'
import { BULK_SCHEDULE_MAX_ITEMS } from '@/lib/direct-schedule-bulk'

export const bulkScheduleItemSchema = z.object({
  mediaType: z.enum(['text', 'image', 'video']),
  caption: z.string().max(10000).optional(),
  mediaObjectKey: z.string().min(1).optional(),
  firstComment: z.string().max(10000).optional(),
})

export const bulkScheduleItemSchemaDirect = z.object({
  mediaType: z.enum(['text', 'image', 'video']),
  caption: z.string().max(10000).optional(),
  mediaObjectKey: z.string().min(1).optional(),
})

const bulkScheduleConfigCore = {
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  postsPerDay: z.number().int().min(1).max(5),
  scheduleType: z.enum(['fixed', 'dailyrandom']),
  postingTimes: z.array(z.string()).optional(),
  timezone: z.string().min(1),
}

function refineBulkScheduleConfig(
  data: {
    postsPerDay: number
    scheduleType: 'fixed' | 'dailyrandom'
    postingTimes?: string[]
  },
  ctx: z.RefinementCtx
) {
  if (data.scheduleType === 'fixed') {
    const times = data.postingTimes ?? []
    if (times.length !== data.postsPerDay) {
      ctx.addIssue({
        code: 'custom',
        message: `Fixed schedule requires exactly ${data.postsPerDay} posting time(s)`,
        path: ['postingTimes'],
      })
    }
    const empty = times.some((t) => !String(t || '').trim())
    if (empty) {
      ctx.addIssue({
        code: 'custom',
        message: 'All fixed posting time slots must be filled',
        path: ['postingTimes'],
      })
    }
  }
}

export const bulkScheduleConfigSchema = z
  .object({
    ...bulkScheduleConfigCore,
    firstComment: z.string().max(10000).optional(),
  })
  .superRefine(refineBulkScheduleConfig)

export const bulkScheduleConfigSchemaDirect = z
  .object({ ...bulkScheduleConfigCore })
  .superRefine(refineBulkScheduleConfig)

function refineBulkScheduleItems(
  data: { items: Array<{ mediaType: string; mediaObjectKey?: string }> },
  ctx: z.RefinementCtx
) {
  data.items.forEach((item, index) => {
    if (item.mediaType !== 'text' && !item.mediaObjectKey) {
      ctx.addIssue({
        code: 'custom',
        message: 'Media file is required for image and video posts',
        path: ['items', index, 'mediaObjectKey'],
      })
    }
  })
}

export function createBulkScheduleSchema() {
  return z
    .object({
      savedPageId: z.string().uuid(),
      items: z.array(bulkScheduleItemSchemaDirect).min(1).max(BULK_SCHEDULE_MAX_ITEMS),
      schedule: bulkScheduleConfigSchemaDirect,
    })
    .superRefine(refineBulkScheduleItems)
}
