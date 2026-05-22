import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { requireApiRole } from '@/server/auth/guards'
import { buildDirectOauthUrl } from '@/server/services/facebook/oauth-service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  const url = new URL(request.url)
  const reconnectAccountId = url.searchParams.get('reconnectAccountId') || undefined

  try {
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const authUrl = await buildDirectOauthUrl(auth.user.id, host, protocol, reconnectAccountId)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start oauth'
    return NextResponse.redirect(new URL(`/agency/facebook?error=${encodeURIComponent(message)}`, request.url))
  }
}
