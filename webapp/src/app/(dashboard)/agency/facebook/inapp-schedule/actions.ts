'use server'

import { revalidatePath } from 'next/cache'
import { requireApiRole } from '@/server/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { deleteInappSchedulePage } from '@/server/services/facebook/inapp-schedule-service'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { format, parse } from 'date-fns'
import { sanitizeToUtcHHMM } from '@/lib/posting-times'

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

export async function updateInappPageSettingsAction(formData: FormData) {
  try {
    const auth = await requireApiRole(['agency', 'super_admin'])
    if (auth.error) throw new Error('Unauthorized')

    const pageId = formData.get('pageId') as string
    const postsPerDay = Number(formData.get('postsPerDay') ?? 2)
    const timezone = formData.get('timezone') as string || 'UTC'
    const postingTimesRaw = formData.get('postingTimes') as string

    if (!pageId) throw new Error('pageId is required')

    let postingTimes: string[] = []
    if (postingTimesRaw) {
      try {
        const parsed = JSON.parse(postingTimesRaw)
        postingTimes = Array.isArray(parsed) ? parsed.map(String) : []
      } catch {
        postingTimes = []
      }
    }

    const supabase = await createClient()

    // Convert times from user timezone to UTC to save in database
    const utcPostingTimes = postingTimes.map(timeStr => {
      try {
        const date = parse(timeStr, 'hh:mm a', new Date())
        const zonedDate = fromZonedTime(
          `${format(new Date(), 'yyyy-MM-dd')} ${format(date, 'HH:mm:00')}`,
          timezone
        )
        return sanitizeToUtcHHMM(formatInTimeZone(zonedDate, 'UTC', 'HH:mm'))
      } catch {
        return sanitizeToUtcHHMM(timeStr)
      }
    })

    const { error } = await supabase
      .from('facebook_inapp_schedule_pages')
      .update({
        posts_per_day: postsPerDay,
        posting_times: utcPostingTimes,
        schedule_timezone: timezone,
      })
      .eq('id', pageId)
      .eq('agency_id', auth.user.id)

    if (error) throw error
    
    revalidatePath(`/agency/facebook/inapp-schedule/${pageId}`)
    revalidatePath('/agency/facebook/inapp-schedule')

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update page settings'
    return { success: false, error: message }
  }
}
