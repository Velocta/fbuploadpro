import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { requireRssAutoposterApiAccess } from '@/server/auth/rss-autoposter-access'
import { renderTemplatePreview } from '@/server/services/facebook/rss-autoposter-service'
import { previewTemplateSchema } from '@/lib/validations/rss-autoposter'
import type { RssTemplateDefinition } from '@/contracts/rss-autoposter'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error
  const rssAccess = await requireRssAutoposterApiAccess(auth.user.id)
  if (rssAccess) return rssAccess

  try {
    const body = await request.json()
    const parsed = previewTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const definition = {
      ...parsed.data.templateDefinition,
      version: 1,
      canvas: {
        aspectRatio: parsed.data.canvasAspectRatio || '4:5',
        backgroundColor:
          (parsed.data.templateDefinition as RssTemplateDefinition).canvas?.backgroundColor ||
          '#000000',
      },
    } as RssTemplateDefinition

    const result = await renderTemplatePreview({
      agencyId: auth.user.id,
      templateDefinition: definition,
      variables: {
        rss: {
          title: parsed.data.sampleTitle || 'Sample headline for preview',
          description: parsed.data.sampleDescription || '',
          imageUrl: parsed.data.sampleImageUrl || '',
          link: 'https://example.com/article',
        },
        brand: {
          url: parsed.data.brandSiteUrl,
          logoUrl: parsed.data.brandLogoUrl,
        },
        page: { name: 'Your Page' },
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Preview failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
