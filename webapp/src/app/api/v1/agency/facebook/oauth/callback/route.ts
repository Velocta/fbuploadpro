import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { requireApiRole } from '@/server/auth/guards'
import { processFacebookCallback } from '@/server/services/facebook/oauth-service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) {
    return NextResponse.redirect(new URL('/agency/facebook/callback?status=error&error=Unauthorized', request.url))
  }

  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state') || undefined
  if (!code) {
    return NextResponse.redirect(new URL('/agency/facebook/callback?status=error&error=No%20authentication%20code%20received', request.url))
  }

  try {
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    await processFacebookCallback(code, state, false, host, protocol, auth.user.id)
    return NextResponse.redirect(new URL('/agency/facebook/callback?status=success', request.url))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Callback processing failed'
    return NextResponse.redirect(new URL(`/agency/facebook/callback?status=error&error=${encodeURIComponent(message)}`, request.url))
  }
}
