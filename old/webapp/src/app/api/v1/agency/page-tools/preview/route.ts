import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { resolveDeleteCandidates } from '@/server/services/agency/page-tools-service'

export const runtime = 'nodejs'

const ALLOWED_TYPES = new Set(['posts', 'photos', 'reels'])
const ALLOWED_SORTS = new Set(['oldest_first', 'newest_first'])

export async function POST(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  let body: {
    accountId?: unknown
    pageId?: unknown
    type?: unknown
    sort?: unknown
    dateFrom?: unknown
    dateTo?: unknown
    pageAccessToken?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const accountId = typeof body.accountId === 'string' ? body.accountId : ''
  const pageId = typeof body.pageId === 'string' ? body.pageId : ''
  const type = typeof body.type === 'string' ? body.type : 'posts'
  const sort = typeof body.sort === 'string' ? body.sort : 'oldest_first'
  const dateFrom = typeof body.dateFrom === 'string' ? body.dateFrom : undefined
  const dateTo = typeof body.dateTo === 'string' ? body.dateTo : undefined
  const pageAccessToken = typeof body.pageAccessToken === 'string' ? body.pageAccessToken : undefined

  if (!accountId || !pageId) {
    return NextResponse.json({ error: 'accountId and pageId are required' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 })
  }
  if (!ALLOWED_SORTS.has(sort)) {
    return NextResponse.json({ error: 'Invalid sort strategy' }, { status: 400 })
  }

  try {
    const result = await resolveDeleteCandidates({
      agencyId: auth.user.id,
      accountId,
      pageId,
      type: type as 'posts' | 'photos' | 'reels',
      sort: sort as 'oldest_first' | 'newest_first',
      dateFrom,
      dateTo,
      pageAccessToken,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to preview delete candidates'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

