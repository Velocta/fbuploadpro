import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createPresignedDownloadUrl } from '@/lib/r2/user-media'
import {
  generateBulkScheduleTimestamps,
  type BulkScheduleConfig,
} from '@/lib/direct-schedule-bulk'
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

type SavedInappPage = {
  id: string
  fb_page_id: string
  fb_page_access_token: string
}

type InappQueueItem = {
  mediaType: 'text' | 'image' | 'video'
  caption?: string
  firstComment?: string
  mediaObjectKey?: string
}

export async function listInappSchedulePages(agencyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_inapp_schedule_pages')
    .select('*, facebook_accounts(fb_user_name, fb_user_image)')
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

function resolveFirstComment(
  item: InappQueueItem,
  scheduleFirstComment?: string
): string | null {
  const value = item.firstComment?.trim() || scheduleFirstComment?.trim()
  return value || null
}

async function queueOneInappPost(
  supabase: Awaited<ReturnType<typeof createClient>>,
  agencyId: string,
  savedPage: SavedInappPage,
  input: InappQueueItem & { scheduledAt: string; timezone: string },
  options?: { bulkBatchId?: string; scheduleFirstComment?: string }
) {
  const scheduledAt = new Date(input.scheduledAt)
  assertScheduleWindow(scheduledAt)

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
      first_comment: resolveFirstComment(input, options?.scheduleFirstComment),
      media_object_key: input.mediaObjectKey ?? null,
      scheduled_at: scheduledAt.toISOString(),
      timezone: input.timezone,
      status: 'pending',
      bulk_batch_id: options?.bulkBatchId ?? null,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
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

  const supabase = await createClient()
  const { data: savedPage, error: pageError } = await supabase
    .from('facebook_inapp_schedule_pages')
    .select('id, fb_page_id, fb_page_access_token')
    .eq('id', input.savedPageId)
    .eq('agency_id', agencyId)
    .single()

  if (pageError || !savedPage) {
    throw new Error('Saved page not found')
  }

  return queueOneInappPost(supabase, agencyId, savedPage, input)
}

export async function bulkCreateInappSchedulePosts(
  agencyId: string,
  input: {
    savedPageId: string
    items: InappQueueItem[]
    schedule: BulkScheduleConfig & { firstComment?: string }
  }
) {
  await requireAgencyHasTokens(agencyId)

  const supabase = await createClient()
  const { data: savedPage, error: pageError } = await supabase
    .from('facebook_inapp_schedule_pages')
    .select('id, fb_page_id, fb_page_access_token')
    .eq('id', input.savedPageId)
    .eq('agency_id', agencyId)
    .single()

  if (pageError || !savedPage) {
    throw new Error('Saved page not found')
  }

  const timestamps = generateBulkScheduleTimestamps(input.items.length, input.schedule)
  const bulkBatchId = crypto.randomUUID()
  const scheduleFirstComment = input.schedule.firstComment

  const rows = input.items.map((item, index) => ({
    agency_id: agencyId,
    page_id: savedPage.id,
    fb_page_id: savedPage.fb_page_id,
    fb_page_access_token: savedPage.fb_page_access_token,
    media_type: item.mediaType,
    caption: item.caption ?? null,
    first_comment: resolveFirstComment(item, scheduleFirstComment),
    media_object_key: item.mediaObjectKey ?? null,
    scheduled_at: timestamps[index]!,
    timezone: input.schedule.timezone,
    status: 'pending' as const,
    bulk_batch_id: bulkBatchId,
  }))

  const { data, error } = await supabase
    .from('facebook_inapp_schedule_posts')
    .insert(rows)
    .select('*')

  if (error) throw new Error(error.message)

  return {
    batchId: bulkBatchId,
    posts: data ?? [],
    summary: { queued: data?.length ?? 0 },
  }
}

export async function listInappSchedulePosts(
  agencyId: string,
  options?: {
    pageId?: string
    limit?: number
    offset?: number
    status?: string
    bulkBatchId?: string
  }
) {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  const supabase = await createClient()
  let query = supabase
    .from('facebook_inapp_schedule_posts')
    .select('*, facebook_inapp_schedule_pages(fb_page_name)', { count: 'exact' })
    .eq('agency_id', agencyId)
    .order('scheduled_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (options?.pageId) {
    query = query.eq('page_id', options.pageId)
  }

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status)
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
        } catch (e) {
          console.error('Failed to get presigned URL for', post.media_object_key)
        }
      }
      return { ...post, media_url }
    })
  )

  return { posts, totalCount: count ?? 0 }
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

export async function getAgencyInappScheduleStats(agencyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_inapp_schedule_posts')
    .select('status')
    .eq('agency_id', agencyId)

  if (error) throw new Error(error.message)

  let pending = 0
  let failed = 0

  data?.forEach((post) => {
    if (post.status === 'pending') pending++
    if (post.status === 'failed') failed++
  })

  return { pending, failed }
}

export async function getInappSchedulePageStats(agencyId: string, pageId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_inapp_schedule_posts')
    .select('status')
    .eq('agency_id', agencyId)
    .eq('page_id', pageId)

  if (error) throw new Error(error.message)

  let pending = 0
  let failed = 0

  data?.forEach((post) => {
    if (post.status === 'pending') pending++
    if (post.status === 'failed') failed++
  })

  return { pending, failed }
}
