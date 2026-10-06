import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { buildMagicOauthUrl } from '@/server/services/facebook/oauth-service'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  try {
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const authUrl = await buildMagicOauthUrl(token, host, protocol)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start magic oauth'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
