import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import {
  createInappSchedulePost,
  listInappSchedulePosts,
} from '@/server/services/facebook/inapp-schedule-service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId') || undefined
    const status = searchParams.get('status') || undefined
    const bulkBatchId = searchParams.get('bulkBatchId') || undefined
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined

    const posts = await listInappSchedulePosts(auth.user.id, {
      pageId,
      limit,
      offset,
      status,
      bulkBatchId,
    })
    return NextResponse.json({ posts: posts.posts, totalCount: posts.totalCount })
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
    })
    return NextResponse.json({ post })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to queue post'
    const status = message.includes('Insufficient') ? 402 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
