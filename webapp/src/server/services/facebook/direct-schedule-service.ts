import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createPresignedDownloadUrl } from '@/lib/r2/user-media'
import {
  cancelFacebookScheduledPost,
  publishFacebookFeedPost,
} from '@/server/integrations/facebook/page-publish'
import { requireAgencyHasTokens } from '@/server/services/tokens/token-cost-service'

const MIN_SCHEDULE_MS = 10 * 60 * 1000
const MAX_SCHEDULE_MS = 180 * 24 * 60 * 60 * 1000

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000)
}

function assertScheduleWindow(scheduledAt: Date) {
  const delta = scheduledAt.getTime() - Date.now()
  if (delta < MIN_SCHEDULE_MS) {
    throw new Error('Scheduled time must be at least 10 minutes in the future')
  }
  if (delta > MAX_SCHEDULE_MS) {
    throw new Error('Scheduled time cannot be more than 6 months in the future')
  }
}

export async function listDirectSchedulePages(agencyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_direct_schedule_pages')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertDirectSchedulePage(
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
    .from('facebook_direct_schedule_pages')
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

export async function deleteDirectSchedulePage(agencyId: string, pageRowId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('facebook_direct_schedule_pages')
    .delete()
    .eq('id', pageRowId)
    .eq('agency_id', agencyId)

  if (error) throw new Error(error.message)
}

export async function createDirectSchedulePost(
  agencyId: string,
  input: {
    savedPageId: string
    mediaType: 'text' | 'image' | 'video'
    caption?: string
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
    .from('facebook_direct_schedule_pages')
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

  let fileUrl: string | undefined
  if (input.mediaObjectKey) {
    fileUrl = await createPresignedDownloadUrl(input.mediaObjectKey)
  }

  const graphPostId = await publishFacebookFeedPost({
    pageId: savedPage.fb_page_id,
    pageToken: savedPage.fb_page_access_token,
    message: input.caption,
    fileUrl,
    mediaType: input.mediaType,
    scheduledPublishTime: toUnixSeconds(scheduledAt),
  })

  const { data, error } = await supabase
    .from('facebook_direct_schedule_posts')
    .insert({
      agency_id: agencyId,
      page_id: savedPage.id,
      fb_page_id: savedPage.fb_page_id,
      media_type: input.mediaType,
      caption: input.caption ?? null,
      media_object_key: input.mediaObjectKey ?? null,
      scheduled_publish_time: scheduledAt.toISOString(),
      timezone: input.timezone,
      graph_post_id: graphPostId,
      status: 'scheduled',
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function listDirectSchedulePosts(agencyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_direct_schedule_posts')
    .select('*, facebook_direct_schedule_pages(fb_page_name)')
    .eq('agency_id', agencyId)
    .order('scheduled_publish_time', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function cancelDirectSchedulePost(agencyId: string, postId: string) {
  const supabase = await createClient()
  const { data: post, error: readError } = await supabase
    .from('facebook_direct_schedule_posts')
    .select('*, facebook_direct_schedule_pages(fb_page_access_token)')
    .eq('id', postId)
    .eq('agency_id', agencyId)
    .single()

  if (readError || !post) {
    throw new Error('Scheduled post not found')
  }

  if (post.status !== 'scheduled') {
    throw new Error('Only scheduled posts can be cancelled')
  }

  const pageToken =
    (post as { facebook_direct_schedule_pages?: { fb_page_access_token?: string } })
      .facebook_direct_schedule_pages?.fb_page_access_token

  if (post.graph_post_id && pageToken) {
    await cancelFacebookScheduledPost({
      graphPostId: post.graph_post_id,
      pageToken,
    })
  }

  const { error } = await supabase
    .from('facebook_direct_schedule_posts')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('agency_id', agencyId)

  if (error) throw new Error(error.message)
}
