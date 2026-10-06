import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { updateInappPostMetadata } from '@/server/services/facebook/inapp-schedule-service'

export const runtime = 'nodejs'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  const { id } = await context.params
  try {
    const body = await request.json()
    const post = await updateInappPostMetadata(auth.user.id, id, {
      caption: body.caption,
      firstComment: body.firstComment,
    })
    return NextResponse.json({ post })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
