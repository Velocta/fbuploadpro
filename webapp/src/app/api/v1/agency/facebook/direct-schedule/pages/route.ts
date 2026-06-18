import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import {
  deleteDirectSchedulePage,
  listDirectSchedulePages,
  upsertDirectSchedulePage,
  getAgencyScheduleStats,
} from '@/server/services/facebook/direct-schedule-service'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const supabase = await createClient()
    const [{ data: pages }, stats] = await Promise.all([
      supabase
        .from('facebook_direct_schedule_pages')
        .select(`
          id,
          fb_page_id,
          fb_page_name,
          fb_page_image,
          created_at,
          facebook_accounts(fb_user_name, fb_user_image)
        `)
        .eq('agency_id', auth.user.id)
        .order('created_at', { ascending: false }),
      getAgencyScheduleStats(auth.user.id)
    ])

    const formattedPages = (pages || []).map((p) => ({
      id: p.id,
      fb_page_id: p.fb_page_id,
      fb_page_name: p.fb_page_name,
      fb_page_image: p.fb_page_image,
      created_at: p.created_at,
      facebook_accounts: Array.isArray(p.facebook_accounts)
        ? p.facebook_accounts[0] || null
        : p.facebook_accounts || null,
    }))

    return NextResponse.json({ pages: formattedPages, stats })
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
