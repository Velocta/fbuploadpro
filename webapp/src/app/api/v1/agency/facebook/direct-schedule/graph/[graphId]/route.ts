import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { cancelByGraphId } from '@/server/services/facebook/direct-schedule-service'

export const runtime = 'nodejs'

export async function DELETE(
  request: Request,
  context: { params: Promise<{ graphId: string }> }
) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const pageToken = searchParams.get('pageToken')
    if (!pageToken) {
      return NextResponse.json({ error: 'Missing pageToken' }, { status: 400 })
    }

    const { graphId } = await context.params
    await cancelByGraphId(auth.user.id, graphId, pageToken)

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel post on Graph API'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
