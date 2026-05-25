import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { requireRssAutoposterApiAccess } from '@/server/auth/rss-autoposter-access'
import { createAgencyUploadPresign } from '@/server/services/uploads/presign-service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const filename = String(body.filename || '')
    const contentType = String(body.contentType || '')
    const feature = String(body.feature || '')

    if (!filename || !contentType || !feature) {
      return NextResponse.json({ error: 'filename, contentType, and feature are required' }, { status: 400 })
    }

    if (feature === 'rss-autoposter') {
      const rssAccess = await requireRssAutoposterApiAccess(auth.user.id)
      if (rssAccess) return rssAccess
    }

    const result = await createAgencyUploadPresign({
      agencyId: auth.user.id,
      filename,
      contentType,
      feature,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create presigned URL'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
