import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { deleteAgencyFacebookAppSettings, updateAgencyFacebookAppSettings } from '@/server/services/agency/settings-service'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('users')
      .select('fb_app_id, fb_app_secret')
      .eq('id', auth.user.id)
      .single()

    const hasFacebookApp = Boolean(
      profile?.fb_app_id?.trim() && profile?.fb_app_secret?.trim()
    )

    return NextResponse.json({ hasFacebookApp })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch settings'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  const body = await request.json().catch(() => null)
  const fbAppId = String(body?.fb_app_id || '')
  const fbAppSecret = String(body?.fb_app_secret || '')

  try {
    const result = await updateAgencyFacebookAppSettings(auth.user.id, fbAppId, fbAppSecret)
    return NextResponse.json({ success: true, appName: result.appName })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update settings'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE() {
  const auth = await requireApiRole(['agency'])
  if (auth.error) return auth.error

  try {
    await deleteAgencyFacebookAppSettings(auth.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete settings'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
