import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { listDirectPostHistory, publishDirectPost } from '@/server/services/facebook/direct-post-service'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const posts = await listDirectPostHistory(auth.user.id)
    return NextResponse.json({ posts })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list posts'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const post = await publishDirectPost(auth.user.id, {
      facebookAccountId: String(body.facebookAccountId || ''),
      fbPageId: String(body.fbPageId || ''),
      mediaType: body.mediaType,
      caption: body.caption,
      firstComment: body.firstComment,
      mediaObjectKey: body.mediaObjectKey,
    })
    return NextResponse.json({ post })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to publish'
    const status = message.includes('Insufficient') ? 402 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
