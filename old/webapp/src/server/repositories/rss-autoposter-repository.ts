import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

type RssPageInsert = Database['public']['Tables']['facebook_rss_autoposter_pages']['Insert']

export async function listRssAutoposterPages(agencyId: string) {
  const supabase = await createClient()
  const { data: pages, error } = await supabase
    .from('facebook_rss_autoposter_pages')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const { data: accounts } = await supabase
    .from('facebook_accounts')
    .select('id, fb_user_name, fb_user_image, status')
    .eq('agency_id', agencyId)

  const accountMap = new Map((accounts ?? []).map((a) => [a.id, a]))

  return (pages ?? []).map((page) => ({
    ...page,
    facebook_accounts: accountMap.get(page.facebook_account_id) ?? null,
  }))
}

export async function getRssAutoposterPage(agencyId: string, pageId: string) {
  const supabase = await createClient()
  const { data: page, error } = await supabase
    .from('facebook_rss_autoposter_pages')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('id', pageId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!page) return null

  const { data: account } = await supabase
    .from('facebook_accounts')
    .select('fb_user_name, fb_user_image, status')
    .eq('id', page.facebook_account_id)
    .maybeSingle()

  return { ...page, facebook_accounts: account ?? null }
}

export async function insertRssAutoposterPage(row: RssPageInsert) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_rss_autoposter_pages')
    .insert(row)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data
}

type RssPageUpdate = Database['public']['Tables']['facebook_rss_autoposter_pages']['Update']

export async function updateRssAutoposterPage(
  agencyId: string,
  pageId: string,
  patch: RssPageUpdate
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_rss_autoposter_pages')
    .update(patch)
    .eq('agency_id', agencyId)
    .eq('id', pageId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteRssAutoposterPage(agencyId: string, pageId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('facebook_rss_autoposter_pages')
    .delete()
    .eq('agency_id', agencyId)
    .eq('id', pageId)
  if (error) throw new Error(error.message)
}

export async function listRssAutoposterItems(
  agencyId: string,
  pageId: string,
  options?: { limit?: number; statuses?: string[] }
) {
  const supabase = await createClient()
  let q = supabase
    .from('facebook_rss_autoposter_items')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('page_id', pageId)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 50)

  if (options?.statuses?.length) {
    q = q.in('status', options.statuses)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getRssAutoposterStats(agencyId: string) {
  const supabase = await createClient()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('facebook_rss_autoposter_items')
    .select('status')
    .eq('agency_id', agencyId)
    .gte('created_at', since)
  if (error) throw new Error(error.message)
  const rows = data ?? []
  return {
    published: rows.filter((r) => r.status === 'published').length,
    failed: rows.filter((r) => r.status === 'failed').length,
    skipped: rows.filter((r) => r.status === 'skipped').length,
  }
}
