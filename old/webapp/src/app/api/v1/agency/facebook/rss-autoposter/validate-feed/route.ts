import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { requireRssAutoposterApiAccess } from '@/server/auth/rss-autoposter-access'
import { fetchAndValidateRssFeed } from '@/server/services/facebook/rss-autoposter-service'
import { validateFeedSchema } from '@/lib/validations/rss-autoposter'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error
  const rssAccess = await requireRssAutoposterApiAccess(auth.user.id)
  if (rssAccess) return rssAccess

  try {
    const body = await request.json()
    const parsed = validateFeedSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const result = await fetchAndValidateRssFeed(parsed.data.rssFeedUrl)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to validate feed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
