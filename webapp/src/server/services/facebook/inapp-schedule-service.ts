import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { requireAgencyHasTokens } from '@/server/services/tokens/token-cost-service'

const MIN_SCHEDULE_MS = 10 * 60 * 1000
const MAX_SCHEDULE_MS = 180 * 24 * 60 * 60 * 1000
const EDIT_LOCK_MS = 5 * 60 * 1000

function assertScheduleWindow(scheduledAt: Date) {
  const delta = scheduledAt.getTime() - Date.now()
  if (delta < MIN_SCHEDULE_MS) {
    throw new Error('Scheduled time must be at least 10 minutes in the future')
  }
  if (delta > MAX_SCHEDULE_MS) {
    throw new Error('Scheduled time cannot be more than 6 months in the future')
  }
}

export async function listInappSchedulePages(agencyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_inapp_schedule_pages')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertInappSchedulePage(
  agencyId: string,
  input: {
    facebookAccountId: string
    fbPageId: string
    fbPageName: string
    fbPageImage?: string
    fbPageAccessToken: string
  }
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_inapp_schedule_pages')
    .upsert(
      {
        agency_id: agencyId,
        facebook_account_id: input.facebookAccountId,
        fb_page_id: input.fbPageId,
        fb_page_name: input.fbPageName,
        fb_page_image: input.fbPageImage ?? null,
        fb_page_access_token: input.fbPageAccessToken,
      },
      { onConflict: 'agency_id,fb_page_id' }
    )
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteInappSchedulePage(agencyId: string, pageRowId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('facebook_inapp_schedule_pages')
    .delete()
    .eq('id', pageRowId)
    .eq('agency_id', agencyId)

  if (error) throw new Error(error.message)
}

export async function createInappSchedulePost(
  agencyId: string,
  input: {
    savedPageId: string
    mediaType: 'text' | 'image' | 'video'
    caption?: string
    firstComment?: string
    mediaObjectKey?: string
    scheduledAt: string
    timezone: string
  }
) {
  await requireAgencyHasTokens(agencyId)

  const scheduledAt = new Date(input.scheduledAt)
  assertScheduleWindow(scheduledAt)

  const supabase = await createClient()
  const { data: savedPage, error: pageError } = await supabase
    .from('facebook_inapp_schedule_pages')
    .select('*')
    .eq('id', input.savedPageId)
    .eq('agency_id', agencyId)
    .single()

  if (pageError || !savedPage) {
    throw new Error('Saved page not found')
  }

  if (input.mediaType !== 'text' && !input.mediaObjectKey) {
    throw new Error('Media file is required for image and video posts')
  }

  const { data, error } = await supabase
    .from('facebook_inapp_schedule_posts')
    .insert({
      agency_id: agencyId,
      page_id: savedPage.id,
      fb_page_id: savedPage.fb_page_id,
      fb_page_access_token: savedPage.fb_page_access_token,
      media_type: input.mediaType,
      caption: input.caption ?? null,
      first_comment: input.firstComment ?? null,
      media_object_key: input.mediaObjectKey ?? null,
      scheduled_at: scheduledAt.toISOString(),
      timezone: input.timezone,
      status: 'pending',
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function listInappSchedulePosts(agencyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_inapp_schedule_posts')
    .select('*, facebook_inapp_schedule_pages(fb_page_name)')
    .eq('agency_id', agencyId)
    .order('scheduled_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function cancelInappSchedulePost(agencyId: string, postId: string) {
  const supabase = await createClient()
  const { data: post, error: readError } = await supabase
    .from('facebook_inapp_schedule_posts')
    .select('id, status')
    .eq('id', postId)
    .eq('agency_id', agencyId)
    .single()

  if (readError || !post) {
    throw new Error('Post not found')
  }

  if (post.status !== 'pending') {
    throw new Error('Only pending posts can be cancelled')
  }

  const { error } = await supabase
    .from('facebook_inapp_schedule_posts')
    .update({ status: 'failed', error_message: 'Cancelled by user', updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('agency_id', agencyId)

  if (error) throw new Error(error.message)
}

export async function updateInappSchedulePost(
  agencyId: string,
  postId: string,
  input: { caption?: string; scheduledAt?: string; timezone?: string }
) {
  const supabase = await createClient()
  const { data: post, error: readError } = await supabase
    .from('facebook_inapp_schedule_posts')
    .select('*')
    .eq('id', postId)
    .eq('agency_id', agencyId)
    .single()

  if (readError || !post) {
    throw new Error('Post not found')
  }

  if (post.status !== 'pending') {
    throw new Error('Only pending posts can be edited')
  }

  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : new Date(post.scheduled_at)
  const msUntil = new Date(post.scheduled_at).getTime() - Date.now()
  if (msUntil < EDIT_LOCK_MS) {
    throw new Error('Cannot edit within 5 minutes of scheduled time')
  }

  if (input.scheduledAt) {
    assertScheduleWindow(scheduledAt)
  }

  const { data, error } = await supabase
    .from('facebook_inapp_schedule_posts')
    .update({
      caption: input.caption ?? post.caption,
      scheduled_at: input.scheduledAt ? scheduledAt.toISOString() : post.scheduled_at,
      timezone: input.timezone ?? post.timezone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('agency_id', agencyId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}
