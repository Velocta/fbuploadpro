'use server'

import { revalidatePath } from 'next/cache'
import { requireApiRole } from '@/server/auth/guards'
import { deleteInappSchedulePage } from '@/server/services/facebook/inapp-schedule-service'

export async function deleteInappPageAction(pageRowId: string) {
  try {
    const auth = await requireApiRole(['agency'])
    if (auth.error) throw new Error('Unauthorized')

    await deleteInappSchedulePage(auth.user.id, pageRowId)
    revalidatePath('/agency/facebook/inapp-schedule')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete page'
    return { success: false, error: message }
  }
}
