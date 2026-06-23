import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { createPresignedDownloadUrl } from '@/lib/r2/user-media'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { addDays, setHours, setMinutes, setSeconds, setMilliseconds, compareAsc } from 'date-fns'
import {
  getTokenCostForFeature,
  deductAgencyTokens,
  refundAgencyTokens,
  requireAgencyHasTokens,
} from '@/server/services/tokens/token-cost-service'

type InappQueueItem = {
  mediaType: 'text' | 'image' | 'video'
  caption?: string
  firstComment?: string
  mediaObjectKey?: string
}

export function projectScheduledTimes<
  T extends {
    status?: string | null
    published_at?: string | Date | null
    updated_at?: string | Date | null
  }
>(
  posts: T[],
  postingTimes: string[],
  timezone: string,
  startOffset: number = 0
) {
  if (!posts || posts.length === 0) return posts
  const times = Array.isArray(postingTimes) ? postingTimes : ['09:00 AM', '03:00 PM']
  const tz = timezone || 'UTC'

  const parsedSlots = times
    .map((timeStr) => {
      try {
        const match = timeStr.trim().match(/^(\d+):(\d+)\s*(AM|PM)?$/i)
        if (!match || !match[1] || !match[2]) return null
        let hour = parseInt(match[1], 10)
        const minute = parseInt(match[2], 10)
        const ampm = match[3]
        if (ampm) {
          if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12
          if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0
        }
        return { hour, minute }
      } catch {
        return null
      }
    })
    .filter(Boolean) as { hour: number; minute: number }[]

  if (parsedSlots.length === 0) {
    parsedSlots.push({ hour: 9, minute: 0 })
  }

  parsedSlots.sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute))

  const nowUtc = new Date()
  const zonedStart = toZonedTime(nowUtc, tz)

  const slots: Date[] = []
  let dayOffset = 0
  const maxSlotsNeeded = startOffset + posts.length + 10

  while (slots.length < maxSlotsNeeded) {
    const currentDay = addDays(zonedStart, dayOffset)
    for (const parsed of parsedSlots) {
      let candidate = setHours(currentDay, parsed.hour)
      candidate = setMinutes(candidate, parsed.minute)
      candidate = setSeconds(candidate, 0)
      candidate = setMilliseconds(candidate, 0)
      const utcDate = fromZonedTime(candidate, tz)
      
      // Slot must be at least 10 minutes in the future to avoid scheduling in the past
      if (utcDate.getTime() - nowUtc.getTime() >= 10 * 60 * 1000) {
        slots.push(utcDate)
      }
    }
    dayOffset++
    if (dayOffset > maxSlotsNeeded * 2 + 10) break
  }

  slots.sort(compareAsc)

  return posts.map((post, index) => {
    if (post.status === 'published') {
      return { ...post, scheduled_at: post.published_at || post.updated_at }
    }
    if (post.status === 'failed') {
      return { ...post, scheduled_at: post.updated_at }
    }
    const slotIdx = startOffset + index
    const projectedDate = slots[slotIdx] || nowUtc
    return { ...post, scheduled_at: projectedDate.toISOString() }
  })
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
    followersCount?: number
    postsPerDay?: number
    postingTimes?: string[]
    scheduleTimezone?: string
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
        followers_count: input.followersCount ?? 0,
        followers_gained: input.followersCount ?? 0,
        posts_per_day: input.postsPerDay ?? 2,
        posting_times: input.postingTimes ?? ['09:00 AM', '03:00 PM'],
        schedule_timezone: input.scheduleTimezone ?? 'UTC',
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

  // Find all pending posts to refund tokens before deleting page
  const { data: posts } = await supabase
    .from('facebook_inapp_schedule_posts')
    .select('id, tokens_charged')
    .eq('page_id', pageRowId)
    .eq('agency_id', agencyId)
    .eq('status', 'pending')

  for (const post of posts || []) {
    if (post.tokens_charged > 0) {
      try {
        await refundAgencyTokens(agencyId, post.tokens_charged)
      } catch (err) {
        console.error('Failed to refund token during page deletion:', post.id, err)
      }
    }
  }

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
  }
) {
  await requireAgencyHasTokens(agencyId)

  const supabase = await createClient()
  const { data: savedPage, error: pageError } = await supabase
    .from('facebook_inapp_schedule_pages')
    .select('id, fb_page_id, fb_page_access_token, schedule_timezone')
    .eq('id', input.savedPageId)
    .eq('agency_id', agencyId)
    .single()

  if (pageError || !savedPage) {
    throw new Error('Saved page not found')
  }

  if (input.mediaType !== 'text' && !input.mediaObjectKey) {
    throw new Error('Media file is required for image and video posts')
  }

  const tokenCost = await getTokenCostForFeature({
    feature: 'inapp_schedule',
    platform: 'facebook',
    mediaType: input.mediaType,
  })
  await deductAgencyTokens(agencyId, tokenCost)

  const { data: currentMax } = await supabase
    .from('facebook_inapp_schedule_posts')
    .select('queue_position')
    .eq('page_id', savedPage.id)
    .eq('status', 'pending')
    .order('queue_position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextPosition = currentMax && currentMax.queue_position !== null ? currentMax.queue_position + 1 : 0

  const { data, error } = await supabase
    .from('facebook_inapp_schedule_posts')
    .insert({
      agency_id: agencyId,
      page_id: savedPage.id,
      media_type: input.mediaType,
      caption: input.caption ?? null,
      first_comment: input.firstComment ?? null,
      media_object_key: input.mediaObjectKey ?? null,
      status: 'pending',
      tokens_charged: tokenCost,
      queue_position: nextPosition,
    })
    .select('*')
    .single()

  if (error) {
    await refundAgencyTokens(agencyId, tokenCost)
    throw new Error(error.message)
  }

  return data
}

export async function bulkCreateInappSchedulePosts(
  agencyId: string,
  input: {
    savedPageId: string
    items: InappQueueItem[]
  }
) {
  await requireAgencyHasTokens(agencyId)

  const supabase = await createClient()
  const { data: savedPage, error: pageError } = await supabase
    .from('facebook_inapp_schedule_pages')
    .select('id, fb_page_id, fb_page_access_token, schedule_timezone')
    .eq('id', input.savedPageId)
    .eq('agency_id', agencyId)
    .single()

  if (pageError || !savedPage) {
    throw new Error('Saved page not found')
  }

  let totalCost = 0
  const costs: number[] = []
  for (const item of input.items) {
    const cost = await getTokenCostForFeature({
      feature: 'inapp_schedule',
      platform: 'facebook',
      mediaType: item.mediaType,
    })
    costs.push(cost)
    totalCost += cost
  }

  await deductAgencyTokens(agencyId, totalCost)

  const { data: currentMax } = await supabase
    .from('facebook_inapp_schedule_posts')
    .select('queue_position')
    .eq('page_id', savedPage.id)
    .eq('status', 'pending')
    .order('queue_position', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextPosition = currentMax && currentMax.queue_position !== null ? currentMax.queue_position + 1 : 0
  const bulkBatchId = crypto.randomUUID()

  const rows = input.items.map((item, index) => ({
    agency_id: agencyId,
    page_id: savedPage.id,
    media_type: item.mediaType,
    caption: item.caption ?? null,
    first_comment: item.firstComment ?? null,
    media_object_key: item.mediaObjectKey ?? null,
    status: 'pending' as const,
    bulk_batch_id: bulkBatchId,
    tokens_charged: costs[index]!,
    queue_position: nextPosition++,
  }))

  const { data, error } = await supabase
    .from('facebook_inapp_schedule_posts')
    .insert(rows)
    .select('*')

  if (error) {
    await refundAgencyTokens(agencyId, totalCost)
    throw new Error(error.message)
  }

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
  const status = options?.status ?? 'all'

  const supabase = await createClient()

  let pagePostingTimes = ['09:00 AM', '03:00 PM']
  let pageTimezone = 'UTC'

  if (options?.pageId) {
    const { data: pageData } = await supabase
      .from('facebook_inapp_schedule_pages')
      .select('posting_times, schedule_timezone')
      .eq('id', options.pageId)
      .maybeSingle()
    if (pageData) {
      if (Array.isArray(pageData.posting_times)) {
        pagePostingTimes = pageData.posting_times
      }
      if (pageData.schedule_timezone) {
        pageTimezone = pageData.schedule_timezone
      }
    }
  }

  let query = supabase
    .from('facebook_inapp_schedule_posts')
    .select('*, facebook_inapp_schedule_pages(fb_page_name, posting_times, schedule_timezone)', { count: 'exact' })
    .eq('agency_id', agencyId)

  if (status === 'pending') {
    query = query.order('queue_position', { ascending: true, nullsFirst: false })
  } else {
    query = query.order('updated_at', { ascending: false })
  }

  query = query.range(offset, offset + limit - 1)

  if (options?.pageId) {
    query = query.eq('page_id', options.pageId)
  }

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  if (options?.bulkBatchId) {
    query = query.eq('bulk_batch_id', options.bulkBatchId)
  }

  const { data, count, error } = await query

  if (error) throw new Error(error.message)

  const rawPosts = await Promise.all(
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

  const posts = projectScheduledTimes(
    rawPosts,
    pagePostingTimes,
    pageTimezone,
    offset
  )

  return { posts, totalCount: count ?? 0 }
}

export async function cancelInappSchedulePost(agencyId: string, postId: string) {
  const supabase = await createClient()
  const { data: post, error: readError } = await supabase
    .from('facebook_inapp_schedule_posts')
    .select('id, page_id, status, tokens_charged')
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

  if (post.tokens_charged > 0) {
    try {
      await refundAgencyTokens(agencyId, post.tokens_charged)
    } catch (err) {
      console.error('Failed to refund tokens on cancellation:', err)
    }
  }
}

export async function updateInappPostMetadata(
  agencyId: string,
  postId: string,
  input: { caption?: string; firstComment?: string }
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

  const { data, error } = await supabase
    .from('facebook_inapp_schedule_posts')
    .update({
      caption: input.caption !== undefined ? input.caption : post.caption,
      first_comment: input.firstComment !== undefined ? input.firstComment : post.first_comment,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('agency_id', agencyId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function reorderInappScheduleQueue(
  agencyId: string,
  pageId: string,
  orderedPostIds: string[]
) {
  const supabase = await createClient()

  for (let idx = 0; idx < orderedPostIds.length; idx++) {
    const postId = orderedPostIds[idx]!
    const { error } = await supabase
      .from('facebook_inapp_schedule_posts')
      .update({
        queue_position: idx,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .eq('page_id', pageId)
      .eq('agency_id', agencyId)

    if (error) {
      console.error('Failed to update queue position for post:', postId, error.message)
    }
  }
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
  let published = 0

  data?.forEach((post) => {
    if (post.status === 'pending') pending++
    if (post.status === 'failed') failed++
    if (post.status === 'published') published++
  })

  return { pending, failed, published }
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
  let published = 0

  data?.forEach((post) => {
    if (post.status === 'pending') pending++
    if (post.status === 'failed') failed++
    if (post.status === 'published') published++
  })

  return { pending, failed, published }
}
