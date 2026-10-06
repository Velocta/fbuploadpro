import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { requireRssAutoposterApiAccess } from '@/server/auth/rss-autoposter-access'
import {
  getRssPage,
  removeRssAutoposterPage,
  updateRssAutoposterPageSettings,
} from '@/server/services/facebook/rss-autoposter-service'
import { updateRssAutoposterPageSchema } from '@/lib/validations/rss-autoposter'
import type { RssTemplateDefinition } from '@/contracts/rss-autoposter'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error
  const rssAccess = await requireRssAutoposterApiAccess(auth.user.id)
  if (rssAccess) return rssAccess
  const { id } = await params
  try {
    const page = await getRssPage(auth.user.id, id)
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ page })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load page'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error
  const rssAccess = await requireRssAutoposterApiAccess(auth.user.id)
  if (rssAccess) return rssAccess
  const { id } = await params
  try {
    const body = await request.json()
    const parsed = updateRssAutoposterPageSchema.safeParse({ ...body, pageId: id })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const page = await updateRssAutoposterPageSettings(auth.user.id, id, {
      rssFeedUrl: parsed.data.rssFeedUrl,
      timezone: parsed.data.timezone,
      postsPerDay: parsed.data.postsPerDay,
      scheduleType: parsed.data.scheduleType,
      postingTimes: parsed.data.postingTimes,
      templateDefinition: parsed.data.templateDefinition as RssTemplateDefinition | undefined,
      templatePresetKey: parsed.data.templatePresetKey,
      canvasAspectRatio: parsed.data.canvasAspectRatio,
      brandLogoObjectKey: parsed.data.brandLogoObjectKey,
      brandSiteUrl: parsed.data.brandSiteUrl,
      firstComment: parsed.data.firstComment,
      status: parsed.data.status,
    })
    return NextResponse.json({ page })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update page'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error
  const rssAccess = await requireRssAutoposterApiAccess(auth.user.id)
  if (rssAccess) return rssAccess
  const { id } = await params
  try {
    await removeRssAutoposterPage(auth.user.id, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete page'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
