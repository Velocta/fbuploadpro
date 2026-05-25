import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { requireRssAutoposterApiAccess } from '@/server/auth/rss-autoposter-access'
import { RSS_TEMPLATE_PRESETS } from '@/lib/rss-autoposter/presets'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error
  const rssAccess = await requireRssAutoposterApiAccess(auth.user.id)
  if (rssAccess) return rssAccess

  const presets = Object.entries(RSS_TEMPLATE_PRESETS).map(([key, value]) => ({
    key,
    label: value.label,
    definition: value.definition,
  }))
  return NextResponse.json({ presets })
}
