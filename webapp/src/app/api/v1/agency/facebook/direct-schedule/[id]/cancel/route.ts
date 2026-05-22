import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { cancelDirectSchedulePost } from '@/server/services/facebook/direct-schedule-service'

export const runtime = 'nodejs'

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  const { id } = await context.params
  try {
    await cancelDirectSchedulePost(auth.user.id, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
