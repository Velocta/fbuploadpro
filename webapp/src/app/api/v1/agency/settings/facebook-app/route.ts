import { NextResponse } from 'next/server'
import { requireApiRole } from '@/server/auth/guards'
import { deleteAgencyFacebookAppSettings, updateAgencyFacebookAppSettings } from '@/server/services/agency/settings-service'

export const runtime = 'nodejs'

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
