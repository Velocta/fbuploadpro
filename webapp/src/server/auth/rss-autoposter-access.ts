import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function getRssAutoposterEnabled(agencyId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('rss_autoposter_enabled')
    .eq('id', agencyId)
    .single()

  if (error || !data) return false
  return Boolean(data.rss_autoposter_enabled)
}

export async function requireRssAutoposterApiAccess(agencyId: string) {
  const enabled = await getRssAutoposterEnabled(agencyId)
  if (enabled) return null
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
