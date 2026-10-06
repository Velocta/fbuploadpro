import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { bulkDeletePageToolsContent } from '@/server/services/agency/page-tools-service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  let body: { accountId?: unknown; pageAccessToken?: unknown; contentIds?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const accountId = typeof body.accountId === 'string' ? body.accountId : ''
  const pageAccessToken = typeof body.pageAccessToken === 'string' ? body.pageAccessToken : undefined
  const contentIds = Array.isArray(body.contentIds)
    ? body.contentIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []

  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
  }
  if (!contentIds.length) {
    return NextResponse.json({ error: 'contentIds must be a non-empty string array' }, { status: 400 })
  }

  try {
    const result = await bulkDeletePageToolsContent({
      agencyId: auth.user.id,
      accountId,
      pageAccessToken,
      contentIds,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Batch delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

