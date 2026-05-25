import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { requireRssAutoposterApiAccess } from '@/server/auth/rss-autoposter-access'
import {
  createRssAutoposterPage,
  listRssPages,
  removeRssAutoposterPage,
} from '@/server/services/facebook/rss-autoposter-service'
import { createRssAutoposterPageSchema } from '@/lib/validations/rss-autoposter'
import type { RssTemplateDefinition } from '@/contracts/rss-autoposter'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error
  const rssAccess = await requireRssAutoposterApiAccess(auth.user.id)
  if (rssAccess) return rssAccess

  try {
    const pages = await listRssPages(auth.user.id)
    return NextResponse.json({ pages })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list pages'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error
  const rssAccess = await requireRssAutoposterApiAccess(auth.user.id)
  if (rssAccess) return rssAccess

  try {
    const body = await request.json()
    const parsed = createRssAutoposterPageSchema.safeParse({
      ...body,
      agencyId: auth.user.id,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const page = await createRssAutoposterPage(auth.user.id, {
      facebookAccountId: parsed.data.facebookAccountId,
      fbPageId: parsed.data.fbPageId,
      fbPageName: parsed.data.fbPageName,
      fbPageAccessToken: parsed.data.fbPageAccessToken,
      fbPageImage: parsed.data.fbPageImage,
      rssFeedUrl: parsed.data.rssFeedUrl,
      timezone: parsed.data.timezone,
      postsPerDay: parsed.data.postsPerDay,
      scheduleType: parsed.data.scheduleType,
      postingTimes: parsed.data.postingTimes,
      templateDefinition: parsed.data.templateDefinition as RssTemplateDefinition,
      templatePresetKey: parsed.data.templatePresetKey,
      canvasAspectRatio: parsed.data.canvasAspectRatio,
      brandLogoObjectKey: parsed.data.brandLogoObjectKey,
      brandSiteUrl: parsed.data.brandSiteUrl,
      firstComment: parsed.data.firstComment,
    })
    return NextResponse.json({ page })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create page'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error
  const rssAccess = await requireRssAutoposterApiAccess(auth.user.id)
  if (rssAccess) return rssAccess

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    await removeRssAutoposterPage(auth.user.id, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete page'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
