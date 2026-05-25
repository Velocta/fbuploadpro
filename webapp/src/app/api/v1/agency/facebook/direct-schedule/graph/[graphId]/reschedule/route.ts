import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { rescheduleByGraphId } from '@/server/services/facebook/direct-schedule-service'
import { parseISO, getUnixTime } from 'date-fns'

export const runtime = 'nodejs'

export async function POST(
  request: Request,
  context: { params: Promise<{ graphId: string }> }
) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const { graphId } = await context.params
    const body = await request.json()
    const { pageToken, scheduledAt, timezone } = body

    if (!pageToken || !scheduledAt || !timezone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const scheduledDate = parseISO(scheduledAt)
    const scheduledPublishTime = getUnixTime(scheduledDate)

    await rescheduleByGraphId(
      auth.user.id,
      graphId,
      pageToken,
      scheduledPublishTime,
      scheduledDate.toISOString(),
      timezone
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reschedule post on Graph API'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
