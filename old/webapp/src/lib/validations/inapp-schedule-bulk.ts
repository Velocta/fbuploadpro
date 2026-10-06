import { z } from 'zod'
import {
  bulkScheduleConfigSchema,
  bulkScheduleItemSchema,
} from '@/lib/validations/schedule-bulk-shared'
import { BULK_SCHEDULE_MAX_ITEMS } from '@/lib/direct-schedule-bulk'

export const bulkInappScheduleSchema = z
  .object({
    savedPageId: z.string().uuid(),
    items: z.array(bulkScheduleItemSchema).min(1).max(BULK_SCHEDULE_MAX_ITEMS),
    schedule: bulkScheduleConfigSchema.optional(),
  })
  .superRefine((data, ctx) => {
    data.items.forEach((item, index) => {
      if (item.mediaType !== 'text' && !item.mediaObjectKey) {
        ctx.addIssue({
          code: 'custom',
          message: 'Media file is required for image and video posts',
          path: ['items', index, 'mediaObjectKey'],
        })
      }
    })
  })

export type BulkInappScheduleInput = z.infer<typeof bulkInappScheduleSchema>
