import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import {
  deleteDirectSchedulePage,
  listDirectSchedulePages,
  upsertDirectSchedulePage,
} from '@/server/services/facebook/direct-schedule-service'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const pages = await listDirectSchedulePages(auth.user.id)
    return NextResponse.json({ pages })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list pages'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const page = await upsertDirectSchedulePage(auth.user.id, {
      facebookAccountId: String(body.facebookAccountId || ''),
      fbPageId: String(body.fbPageId || ''),
      fbPageName: String(body.fbPageName || ''),
      fbPageImage: body.fbPageImage,
      fbPageAccessToken: String(body.fbPageAccessToken || ''),
    })
    return NextResponse.json({ page })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save page'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    await deleteDirectSchedulePage(auth.user.id, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete page'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
