import { NextResponse } from 'next/server'
import { renderAndUploadForWorker } from '@/server/services/facebook/rss-autoposter-service'
import type { RssRenderVariables, RssTemplateDefinition } from '@/contracts/rss-autoposter'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const secret = request.headers.get('x-rss-worker-secret')
  const expected = process.env.RSS_WORKER_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const agencyId = String(body.agencyId || '')
    const templateDefinition = body.templateDefinition as RssTemplateDefinition
    const variables = body.variables as RssRenderVariables
    if (!agencyId || !templateDefinition || !variables) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { objectKey } = await renderAndUploadForWorker({
      agencyId,
      templateDefinition,
      variables,
    })
    return NextResponse.json({ objectKey })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Render failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
