import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { bulkCreateDirectSchedulePosts } from '@/server/services/facebook/direct-schedule-service'
import { bulkDirectScheduleSchema } from '@/lib/validations/direct-schedule-bulk'
import { zodErrorMessage } from '@/lib/validations/errors'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const parsed = bulkDirectScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }

    const { savedPageId, items, schedule } = parsed.data
    const result = await bulkCreateDirectSchedulePosts(auth.user.id, {
      savedPageId,
      items: items.map((item) => ({
        mediaType: item.mediaType,
        caption: item.caption,
        mediaObjectKey: item.mediaObjectKey,
      })),
      schedule: {
        startDate: schedule.startDate,
        postsPerDay: schedule.postsPerDay,
        scheduleType: schedule.scheduleType,
        postingTimes: schedule.postingTimes ?? [],
        timezone: schedule.timezone,
      },
    })

    const status = result.summary.failed > 0 && result.summary.scheduled > 0 ? 207 : 200
    return NextResponse.json(result, { status: result.summary.failed === result.summary.total ? 500 : status })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to bulk schedule posts'
    const status = message.includes('Insufficient') ? 402 : message.includes('at most') || message.includes('required') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
