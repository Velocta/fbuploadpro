import { createClient } from '@/lib/supabase/server'
import { createAduBufferDownloadUrl } from '@/lib/r2/adu-buffer'
import type { Tables } from '@/types/database.types'

type ReelListRow = Pick<
  Tables<'reels'>,
  | 'id'
  | 'reel_id'
  | 'platform'
  | 'username'
  | 'status'
  | 'reel_caption'
  | 'downloaded_at'
  | 'graph_post_id'
  | 'media_object_key'
>

export type AduReelRow = ReelListRow & { media_url?: string | null }

async function assertPageAccess(pageId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: page, error } = await supabase
    .from('pages')
    .select('id')
    .eq('id', pageId)
    .eq('agency_id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!page) throw new Error('Page not found')
  return { supabase, userId: user.id }
}

export async function listAduReels(pageId: string, view: 'queue' | 'history') {
  const { supabase } = await assertPageAccess(pageId)
  const status = view === 'queue' ? 'downloaded' : 'posted'

  const { data, error } = await supabase
    .from('reels')
    .select('id, reel_id, platform, username, status, reel_caption, downloaded_at, graph_post_id, media_object_key')
    .eq('page_id', pageId)
    .eq('status', status)
    .order(view === 'queue' ? 'downloaded_at' : 'id', { ascending: false })

  if (error) throw new Error(error.message)

  const rows = await Promise.all(
    (data || []).map(async (reel) => {
      let media_url: string | null = null
      if (view === 'queue' && reel.media_object_key) {
        try {
          media_url = await createAduBufferDownloadUrl(reel.media_object_key)
        } catch {
          media_url = null
        }
      }
      return { ...reel, media_url }
    })
  )
  return rows
}

export async function updateAduReelCaption(pageId: string, reelId: number, caption: string) {
  const { supabase } = await assertPageAccess(pageId)
  const trimmed = caption.trim()
  if (!trimmed) throw new Error('Caption cannot be empty')

  const { error } = await supabase
    .from('reels')
    .update({ reel_caption: trimmed })
    .eq('id', reelId)
    .eq('page_id', pageId)
    .eq('status', 'downloaded')

  if (error) throw new Error(error.message)
}

export async function skipAduReel(pageId: string, reelId: number) {
  const { supabase } = await assertPageAccess(pageId)
  const { error } = await supabase.rpc('skip_adu_reel', { p_reel_id: reelId })
  if (error) throw new Error(error.message)
}

export async function deleteAduReel(pageId: string, reelId: number) {
  const { supabase } = await assertPageAccess(pageId)
  const { error } = await supabase
    .from('reels')
    .delete()
    .eq('id', reelId)
    .eq('page_id', pageId)
    .eq('status', 'downloaded')

  if (error) throw new Error(error.message)
}
