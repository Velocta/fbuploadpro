import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { processFacebookCallback } from '@/server/services/facebook/oauth-service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state') || undefined
  if (!code) {
    return NextResponse.redirect(new URL('/fb-callback?status=error&error=No%20authentication%20code%20received', request.url))
  }

  try {
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    await processFacebookCallback(code, state, true, host, protocol)
    return NextResponse.redirect(new URL('/fb-callback?status=success', request.url))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Callback processing failed'
    return NextResponse.redirect(new URL(`/fb-callback?status=error&error=${encodeURIComponent(message)}`, request.url))
  }
}
