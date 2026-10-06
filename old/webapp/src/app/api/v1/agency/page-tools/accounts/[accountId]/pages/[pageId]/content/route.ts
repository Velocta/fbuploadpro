import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { listPageToolsContent } from '@/server/services/agency/page-tools-service'

export const runtime = 'nodejs'

const ALLOWED_TYPES = new Set(['posts', 'photos', 'reels'])

export async function GET(request: Request, context: { params: Promise<{ accountId: string; pageId: string }> }) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  const { accountId, pageId } = await context.params
  const { searchParams } = new URL(request.url)
  const pageAccessToken = request.headers.get('x-page-access-token') || undefined
  const type = String(searchParams.get('type') || 'posts')
  const after = searchParams.get('after') || undefined
  const limitRaw = Number(searchParams.get('limit') || 25)
  const limit = Number.isFinite(limitRaw) ? limitRaw : 25

  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 })
  }

  try {
    const result = await listPageToolsContent({
      agencyId: auth.user.id,
      accountId,
      pageId,
      type: type as 'posts' | 'photos' | 'reels',
      after,
      limit,
      pageAccessToken,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch page content'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

