import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { bulkCreateInappSchedulePosts } from '@/server/services/facebook/inapp-schedule-service'
import { bulkInappScheduleSchema } from '@/lib/validations/inapp-schedule-bulk'
import { zodErrorMessage } from '@/lib/validations/errors'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const parsed = bulkInappScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }

    const { savedPageId, items, schedule } = parsed.data
    const result = await bulkCreateInappSchedulePosts(auth.user.id, {
      savedPageId,
      items: items.map((item) => ({
        mediaType: item.mediaType,
        caption: item.caption,
        firstComment: item.firstComment,
        mediaObjectKey: item.mediaObjectKey,
      })),
      schedule: {
        startDate: schedule.startDate,
        postsPerDay: schedule.postsPerDay,
        scheduleType: schedule.scheduleType,
        postingTimes: schedule.postingTimes ?? [],
        timezone: schedule.timezone,
        firstComment: schedule.firstComment,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to bulk queue posts'
    const status =
      message.includes('Insufficient') ? 402
      : message.includes('at most') || message.includes('required') || message.includes('valid') ? 400
      : 500
    return NextResponse.json({ error: message }, { status })
  }
}
