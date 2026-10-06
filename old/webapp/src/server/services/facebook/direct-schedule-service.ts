import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createPresignedDownloadUrl } from '@/lib/r2/user-media'
import {
  generateBulkScheduleTimestamps,
  type BulkScheduleConfig,
} from '@/lib/direct-schedule-bulk'
import {
  cancelFacebookScheduledPost,
  publishFacebookFeedPost,
  rescheduleFacebookPost,
} from '@/server/integrations/facebook/page-publish'
import { requireAgencyHasTokens } from '@/server/services/tokens/token-cost-service'
import { assertScheduleWindow } from '@/lib/direct-schedule-bulk'

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000)
}

type SavedSchedulePage = {
  id: string
  fb_page_id: string
  fb_page_access_token: string
}

type SchedulePostItem = {
  mediaType: 'text' | 'image' | 'video'
  caption?: string
  mediaObjectKey?: string
}

export type BulkSchedulePostResult = {
  index: number
  postId?: string
  graphPostId?: string | null
  status: 'scheduled' | 'failed'
  error?: string
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

async function scheduleOnePost(
  agencyId: string,
  savedPage: SavedSchedulePage,
  input: SchedulePostItem & { scheduledAt: string; timezone: string },
  options?: { bulkBatchId?: string }
): Promise<{
  row: Awaited<ReturnType<typeof insertSchedulePostRow>>
  status: 'scheduled' | 'failed'
}> {
  const scheduledAt = new Date(input.scheduledAt)
  assertScheduleWindow(scheduledAt)

  if (input.mediaType !== 'text' && !input.mediaObjectKey) {
    throw new Error('Media file is required for image and video posts')
  }

  const supabase = await createClient()
  let fileUrl: string | undefined
  if (input.mediaObjectKey) {
    fileUrl = await createPresignedDownloadUrl(input.mediaObjectKey)
  }

  let graphPostId: string | null = null
  let status: 'scheduled' | 'failed' = 'scheduled'
  let errorMessage: string | null = null

  try {
    graphPostId = await publishFacebookFeedPost({
      pageId: savedPage.fb_page_id,
      pageToken: savedPage.fb_page_access_token,
      message: input.caption,
      fileUrl,
      mediaType: input.mediaType,
      scheduledPublishTime: toUnixSeconds(scheduledAt),
    })
  } catch (error) {
    status = 'failed'
    errorMessage = error instanceof Error ? error.message : 'Schedule failed'
  }

  const row = await insertSchedulePostRow(supabase, {
    agencyId,
    savedPage,
    input,
    scheduledAt,
    graphPostId,
    status,
    errorMessage,
    bulkBatchId: options?.bulkBatchId,
  })

  return { row, status }
}

async function insertSchedulePostRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    agencyId: string
    savedPage: SavedSchedulePage
    input: SchedulePostItem & { scheduledAt: string; timezone: string }
    scheduledAt: Date
    graphPostId: string | null
    status: 'scheduled' | 'failed'
    errorMessage: string | null
    bulkBatchId?: string
  }
) {
  const { data, error } = await supabase
    .from('facebook_direct_schedule_posts')
    .insert({
      agency_id: params.agencyId,
      page_id: params.savedPage.id,
      fb_page_id: params.savedPage.fb_page_id,
      media_type: params.input.mediaType,
      caption: params.input.caption ?? null,
      media_object_key: params.input.mediaObjectKey ?? null,
      scheduled_publish_time: params.scheduledAt.toISOString(),
      timezone: params.input.timezone,
      graph_post_id: params.graphPostId,
      status: params.status,
      error_message: params.errorMessage,
      bulk_batch_id: params.bulkBatchId ?? null,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
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

  const supabase = await createClient()
  const { data: savedPage, error: pageError } = await supabase
    .from('facebook_direct_schedule_pages')
    .select('id, fb_page_id, fb_page_access_token')
    .eq('id', input.savedPageId)
    .eq('agency_id', agencyId)
    .single()

  if (pageError || !savedPage) {
    throw new Error('Saved page not found')
  }

  const { row, status } = await scheduleOnePost(agencyId, savedPage, input)
  if (status === 'failed') {
    throw new Error(row.error_message || 'Schedule failed')
  }
  return row
}

export async function bulkCreateDirectSchedulePosts(
  agencyId: string,
  input: {
    savedPageId: string
    items: SchedulePostItem[]
    schedule: BulkScheduleConfig
  }
) {
  await requireAgencyHasTokens(agencyId)

  const supabase = await createClient()
  const { data: savedPage, error: pageError } = await supabase
    .from('facebook_direct_schedule_pages')
    .select('id, fb_page_id, fb_page_access_token')
    .eq('id', input.savedPageId)
    .eq('agency_id', agencyId)
    .single()

  if (pageError || !savedPage) {
    throw new Error('Saved page not found')
  }

  const timestamps = generateBulkScheduleTimestamps(input.items.length, input.schedule)
  const bulkBatchId = crypto.randomUUID()

  const results: BulkSchedulePostResult[] = []
  let scheduled = 0
  let failed = 0

  for (let index = 0; index < input.items.length; index++) {
    const item = input.items[index]!
    const scheduledAt = timestamps[index]!

    try {
      const { row, status } = await scheduleOnePost(
        agencyId,
        savedPage,
        {
          ...item,
          scheduledAt,
          timezone: input.schedule.timezone,
        },
        { bulkBatchId }
      )

      if (status === 'scheduled') {
        scheduled++
        results.push({
          index,
          postId: row.id,
          graphPostId: row.graph_post_id,
          status: 'scheduled',
        })
      } else {
        failed++
        results.push({
          index,
          postId: row.id,
          status: 'failed',
          error: row.error_message || 'Schedule failed',
        })
      }
    } catch (error) {
      failed++
      const message = error instanceof Error ? error.message : 'Schedule failed'
      results.push({
        index,
        status: 'failed',
        error: message,
      })
    }
  }

  return {
    batchId: bulkBatchId,
    results,
    summary: { scheduled, failed, total: input.items.length },
  }
}

export async function listDirectSchedulePosts(
  agencyId: string,
  options?: { pageId?: string; limit?: number; offset?: number; bulkBatchId?: string }
) {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  const supabase = await createClient()
  let query = supabase
    .from('facebook_direct_schedule_posts')
    .select('*, facebook_direct_schedule_pages(fb_page_name)', { count: 'exact' })
    .eq('agency_id', agencyId)
    .order('scheduled_publish_time', { ascending: false })
    .range(offset, offset + limit - 1)

  if (options?.pageId) {
    query = query.eq('page_id', options.pageId)
  }

  if (options?.bulkBatchId) {
    query = query.eq('bulk_batch_id', options.bulkBatchId)
  }

  const { data, count, error } = await query

  if (error) throw new Error(error.message)

  const posts = await Promise.all(
    (data ?? []).map(async (post) => {
      let media_url: string | null = null
      if (post.media_object_key) {
        try {
          media_url = await createPresignedDownloadUrl(post.media_object_key)
        } catch {
          console.error('Failed to get presigned URL for', post.media_object_key)
        }
      }
      return { ...post, media_url }
    })
  )

  return { posts, totalCount: count ?? 0 }
}

export async function getAgencyScheduleStats(agencyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_direct_schedule_posts')
    .select('status')
    .eq('agency_id', agencyId)

  if (error) throw new Error(error.message)

  let scheduled = 0
  let failed = 0

  data?.forEach((post) => {
    if (post.status === 'scheduled') scheduled++
    if (post.status === 'failed') failed++
  })

  return { scheduled, failed }
}

export async function getSchedulePageStats(agencyId: string, pageId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_direct_schedule_posts')
    .select('status')
    .eq('agency_id', agencyId)
    .eq('page_id', pageId)

  if (error) throw new Error(error.message)

  let scheduled = 0
  let failed = 0

  data?.forEach((post) => {
    if (post.status === 'scheduled') scheduled++
    if (post.status === 'failed') failed++
  })

  return { scheduled, failed }
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
    try {
      await cancelFacebookScheduledPost({
        graphPostId: post.graph_post_id,
        pageToken,
      })
    } catch (err) {
      console.error('Failed to delete scheduled post natively on Facebook, proceeding to cancel in DB:', err)
    }
  }

  const { error } = await supabase
    .from('facebook_direct_schedule_posts')
    .update({ status: 'cancelled' })
    .eq('id', postId)
    .eq('agency_id', agencyId)

  if (error) throw new Error(error.message)
}

export async function cancelByGraphId(agencyId: string, graphPostId: string, pageToken: string) {
  const supabase = await createClient()
  try {
    await cancelFacebookScheduledPost({ graphPostId, pageToken })
  } catch (err) {
    console.error('Failed to delete on Facebook in cancelByGraphId:', err)
  }

  const { error } = await supabase
    .from('facebook_direct_schedule_posts')
    .update({ status: 'cancelled' })
    .eq('graph_post_id', graphPostId)
    .eq('agency_id', agencyId)

  if (error) {
    console.error('Could not sync cancellation to DB', error.message)
  }
}

export async function rescheduleByGraphId(
  agencyId: string,
  graphPostId: string,
  pageToken: string,
  scheduledPublishTime: number,
  isoString: string,
  timezone: string
) {
  assertScheduleWindow(new Date(isoString))

  const supabase = await createClient()

  await rescheduleFacebookPost({
    graphPostId,
    pageToken,
    scheduledPublishTime,
  })

  const { error } = await supabase
    .from('facebook_direct_schedule_posts')
    .update({ scheduled_publish_time: isoString, timezone })
    .eq('graph_post_id', graphPostId)
    .eq('agency_id', agencyId)

  if (error) {
    console.error('Could not sync reschedule to DB', error.message)
  }
}
