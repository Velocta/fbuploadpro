'use server'

import { revalidatePath } from 'next/cache'
import { requireApiRole } from '@/server/auth/guards'
import { deleteDirectSchedulePage } from '@/server/services/facebook/direct-schedule-service'

export async function deleteSchedulePageAction(pageRowId: string) {
  try {
    const auth = await requireApiRole(['agency'])
    if (auth.error) throw new Error('Unauthorized')

    await deleteDirectSchedulePage(auth.user.id, pageRowId)
    revalidatePath('/agency/facebook/direct-schedule')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete page'
    return { success: false, error: message }
  }
}
