import { z } from 'zod'
import { createBulkScheduleSchema } from '@/lib/validations/schedule-bulk-shared'

export const bulkDirectScheduleSchema = createBulkScheduleSchema()

export type BulkDirectScheduleInput = z.infer<typeof bulkDirectScheduleSchema>
