import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { requireApiRole } from '@/server/auth/guards'
import { buildMagicConnectLink } from '@/server/services/facebook/oauth-service'

export const runtime = 'nodejs'

export async function POST() {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const url = await buildMagicConnectLink(auth.user.id, host, protocol)
    return NextResponse.json({ url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate magic link'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
