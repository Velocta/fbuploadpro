import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { getFacebookPagesForAccount } from '@/server/services/facebook/pages-service'

export const runtime = 'nodejs'

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  const { id } = await context.params
  try {
    const pages = await getFacebookPagesForAccount(id, auth.user.id)
    return NextResponse.json({ pages })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch pages'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
