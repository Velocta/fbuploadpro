'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { validateRole } from '@/lib/supabase/guards'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { format, parse } from 'date-fns'
import { generateBalancedPostTimes } from '@/lib/scheduling'
import { updatePageSettingsSchema, togglePageStatusSchema, updateSourceUsernameSchema } from '@/lib/validations/page'
import { sanitizeToUtcHHMM } from '@/lib/posting-times'
import { zodErrorMessage } from '@/lib/validations/errors'
import type { Database } from '@/types/database.types'
import { sanitizeSourceIdentityInput } from '@/lib/source-identity'


type SourcePlatform = 'instagram' | 'youtube' | 'tiktok' | 'facebook'
type PageUpdate = Database['public']['Tables']['pages']['Update']

type DebuggableError = {
  message: string
  code?: string
  details?: string
  hint?: string
}

function formatDebugError(stage: string, err: unknown, context: Record<string, unknown> = {}) {
  const e = (err || {}) as DebuggableError
  const code = e.code || 'unknown'
  const details = e.details || ''
  const hint = e.hint || ''
  const message = e.message || 'Unknown error'
  const ctx = JSON.stringify(context)

  return {
    clientMessage: `[${stage}] ${message}${code !== 'unknown' ? ` (code=${code})` : ''}`,
    logMessage: `[pages.updateSourceUsername][${stage}] message="${message}" code="${code}" details="${details}" hint="${hint}" context=${ctx}`,
  }
}

function normalizeSourceUsername(sourcePlatform: SourcePlatform, sourceUsername: string): string {
  return sanitizeSourceIdentityInput(sourcePlatform, sourceUsername)
}

export async function updatePageSettings(formData: FormData) {
  await validateRole(['agency', 'super_admin'])

  const validatedFields = updatePageSettingsSchema.safeParse(Object.fromEntries(formData.entries()))

  if (!validatedFields.success) {
    return { error: zodErrorMessage(validatedFields.error) }
  }

  const {
    pageId,
    pageName,
    fbPageAccessToken: rawFbAccessToken,
    fbPageId: rawFbPageId,
    postsPerDay,
    scheduleType,
    timezone = 'UTC',
    postingTimes: postingTimesRawJson,
  } = validatedFields.data

  const supabase = await createClient()

  const updateData: PageUpdate = {}

  // Identity Fields
  if (pageName !== undefined) updateData.page_name = pageName.trim()

  // Connection Fields with Sanitization
  if (rawFbAccessToken !== undefined) updateData.fb_page_access_token = rawFbAccessToken.trim().replace(/\s/g, '')
  if (rawFbPageId !== undefined) updateData.fb_page_id = rawFbPageId.trim().replace(/\s/g, '')

  // Automation Fields
  if (postsPerDay !== undefined) updateData.posts_per_day = postsPerDay
  if (scheduleType !== undefined) updateData.schedule_type = scheduleType
  if (timezone !== undefined) updateData.timezone = timezone

  if (scheduleType === 'dailyrandom' && postsPerDay) {
    // Generate new random balanced times
    const localTimes = generateBalancedPostTimes(postsPerDay)
    updateData.posting_times = localTimes.map(localTime => {
      try {
        const zonedDate = fromZonedTime(`${format(new Date(), 'yyyy-MM-dd')} ${localTime}:00`, timezone)
        return sanitizeToUtcHHMM(formatInTimeZone(zonedDate, 'UTC', 'HH:mm'))
      } catch {
        return sanitizeToUtcHHMM(localTime)
      }
    })
  } else if (postingTimesRawJson) {
    let postingTimesRaw: string[] = []
    try {
      const parsed = JSON.parse(postingTimesRawJson || '[]')
      postingTimesRaw = Array.isArray(parsed) ? parsed.map((value) => String(value)) : []
    } catch {
      return { error: 'Invalid posting times payload.' }
    }

    // Server-side processing of AM/PM times to UTC 24-hour format
    updateData.posting_times = postingTimesRaw.map(timeStr => {
      try {
        const date = parse(timeStr, 'hh:mm a', new Date())
        const zonedDate = fromZonedTime(
          `${format(new Date(), 'yyyy-MM-dd')} ${format(date, 'HH:mm:00')}`,
          timezone
        )
        return sanitizeToUtcHHMM(formatInTimeZone(zonedDate, 'UTC', 'HH:mm'))
      } catch {
        return sanitizeToUtcHHMM(timeStr)
      }
    })
  }

  // Always set status to active when saving changes
  updateData.status = 'active'

  const { error } = await supabase
    .from('pages')
    .update(updateData)
    .eq('id', pageId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/agency/facebook/auto-download-upload/${pageId}`)
  return { success: true }
}

export async function togglePageStatus(pageId: string, currentStatus: string) {
  await validateRole(['agency', 'super_admin'])

  const validatedFields = togglePageStatusSchema.safeParse({ pageId, currentStatus })

  if (!validatedFields.success) {
    return { error: zodErrorMessage(validatedFields.error) }
  }

  const supabase = await createClient()

  // If current status is 'active', the user wants to deactivate it
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active'

  // Validation Logic before activating
  if (newStatus === 'active') {
    const { data: profile } = await supabase.from('pages').select('*').eq('id', pageId).single()

    if (!profile?.fb_page_access_token || !profile?.source_username) {
      return { error: 'Cannot activate: Missing credentials or source.' }
    }

    if (profile.status === 'fb_rate_limited') {
      return {
        error:
          'Cannot activate while rate limited. Meta is throttling this page — automation resumes automatically after the cooldown.',
      }
    }
  }

  const { error } = await supabase
    .from('pages')
    .update({ status: newStatus })
    .eq('id', pageId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/agency/facebook/auto-download-upload/${pageId}`)
  revalidatePath('/agency/facebook/auto-download-upload')
  return { success: true }
}

export async function updateSourceUsername(pageId: string, newUsername: string, newPlatform?: SourcePlatform) {
  await validateRole(['agency', 'super_admin'])
  const debugRequestId = crypto.randomUUID()

  const validatedFields = updateSourceUsernameSchema.safeParse({ pageId, newUsername, newPlatform })

  if (!validatedFields.success) {
    return { error: zodErrorMessage(validatedFields.error) }
  }

  const supabase = await createClient()

  // 1. Fetch current profile to get agency, current source, and platform
  const { data: profile, error: profileFetchError } = await supabase
    .from('pages')
    .select('agency_id, source_platform, source_username')
    .eq('id', pageId)
    .single()
  if (profileFetchError) {
    const formatted = formatDebugError('profile_fetch', profileFetchError, {
      requestId: debugRequestId,
      pageId,
    })
    console.error(formatted.logMessage)
    return { error: `${formatted.clientMessage} [request_id=${debugRequestId}]` }
  }
  if (!profile) return { error: 'Page not found' }
  const effectivePlatform: SourcePlatform = (newPlatform || profile.source_platform || 'instagram') as SourcePlatform
  const normalizedUsername = normalizeSourceUsername(effectivePlatform, newUsername)



  // 3. Delete pending reels for the old source via security-definer RPC (skips row trigger, batches internally).
  const oldSourceUsername = String(profile.source_username || '').trim()
  if (oldSourceUsername) {
    const { error: deleteBatchError } = await supabase.rpc('delete_old_source_reels_batch', {
      p_page_id: pageId,
      p_old_username: oldSourceUsername,
      p_batch_size: 500,
    })

    if (deleteBatchError) {
      const formatted = formatDebugError('delete_old_source_reels_batch', deleteBatchError, {
        requestId: debugRequestId,
        pageId,
        oldSourceUsername,
      })
      console.error(formatted.logMessage)
      return { error: `${formatted.clientMessage} [request_id=${debugRequestId}]` }
    }
  }

  // 4. Update Page Source & Reset Statuses
  try {
    const updatePayload: {
      source_username: string
      status:
        | 'active'
        | 'inactive'
        | 'fb_verification_required'
        | 'fb_rate_limited'
        | 'page_not_accessible'
        | 'invalid_token'
        | 'invalid_username'
        | 'completed'
      sync_status: 'pending' | 'browser_pending' | 'synced' | 'processing' | 'error'
      source_platform?: SourcePlatform
    } = {
      source_username: normalizedUsername,
      status: 'active',
      sync_status: 'pending', // Trigger re-sync for new reels from new handle
    }

    if (newPlatform) {
      updatePayload.source_platform = newPlatform
    }

    const { error: profileError } = await supabase
      .from('pages')
      .update(updatePayload)
      .eq('id', pageId)

    if (profileError) {
      if (profileError.code === '23505') {
        return { error: `The source account "${normalizedUsername}" is already being used.` }
      }
      const formatted = formatDebugError('page_update', profileError, {
        requestId: debugRequestId,
        pageId,
        effectivePlatform,
      })
      console.error(formatted.logMessage)
      return { error: `${formatted.clientMessage} [request_id=${debugRequestId}]` }
    }
  } catch (err: unknown) {
    const formatted = formatDebugError('unexpected', err, {
      requestId: debugRequestId,
      pageId,
      effectivePlatform,
    })
    console.error(formatted.logMessage)
    return {
      success: false,
      error: `${formatted.clientMessage} [request_id=${debugRequestId}]`
    }
  }

  revalidatePath(`/agency/facebook/auto-download-upload/${pageId}`)
  return { success: true }
}
