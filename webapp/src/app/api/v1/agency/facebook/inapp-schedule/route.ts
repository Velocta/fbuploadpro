import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import {
  createInappSchedulePost,
  listInappSchedulePosts,
} from '@/server/services/facebook/inapp-schedule-service'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const posts = await listInappSchedulePosts(auth.user.id)
    return NextResponse.json({ posts })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list queue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const post = await createInappSchedulePost(auth.user.id, {
      savedPageId: String(body.savedPageId || ''),
      mediaType: body.mediaType,
      caption: body.caption,
      firstComment: body.firstComment,
      mediaObjectKey: body.mediaObjectKey,
      scheduledAt: String(body.scheduledAt || ''),
      timezone: String(body.timezone || 'UTC'),
    })
    return NextResponse.json({ post })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to queue post'
    const status = message.includes('Insufficient') ? 402 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
