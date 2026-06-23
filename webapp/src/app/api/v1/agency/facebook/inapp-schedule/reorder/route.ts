import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { reorderInappScheduleQueue } from '@/server/services/facebook/inapp-schedule-service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const { pageId, orderedPostIds } = await request.json()
    if (!pageId || !Array.isArray(orderedPostIds)) {
      return NextResponse.json({ error: 'Missing pageId or orderedPostIds' }, { status: 400 })
    }

    await reorderInappScheduleQueue(auth.user.id, pageId, orderedPostIds)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reorder queue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
