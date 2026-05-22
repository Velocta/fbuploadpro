'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { validateRole } from '@/lib/supabase/guards'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { format, parse } from 'date-fns'
import { generateBalancedPostTimes } from '@/lib/scheduling'
import { createPageSchema, createPagesBulkSchema, deletePageSchema } from '@/lib/validations/page'
import { AxiosError } from 'axios'
import { REQUIRED_SCOPES } from '@/lib/constants/facebook'
import { graphGet } from '@/server/integrations/facebook/graph-client'
import { BulkPageInput } from '@/types/app.types'
import { sanitizeToUtcHHMM } from '@/lib/posting-times'
import { zodErrorMessage } from '@/lib/validations/errors'

type AgencyAuth = {
  is_active_override: boolean | null
  fb_app_id: string | null
  fb_app_secret: string | null
}

type SourcePlatform = 'instagram' | 'youtube' | 'tiktok' | 'facebook'
type ScheduleType = 'dailyrandom' | 'fixed'

function normalizeSourceUsername(sourcePlatform: SourcePlatform, sourceUsername: string): string {
  const cleaned = (sourceUsername || '').trim().replace(/\s/g, '')
  if (sourcePlatform === 'facebook') return cleaned
  return cleaned.replace(/^@/, '')
}

function buildRandomPostingTimes(timezone: string, postsPerDay: number): string[] {
  const localTimes = generateBalancedPostTimes(postsPerDay)
  return localTimes.map((localTime) => {
    try {
      const zonedDate = fromZonedTime(
        `${format(new Date(), 'yyyy-MM-dd')} ${localTime}:00`,
        timezone
      )
      return sanitizeToUtcHHMM(formatInTimeZone(zonedDate, 'UTC', 'HH:mm'))
    } catch {
      return sanitizeToUtcHHMM(localTime)
    }
  })
}

function buildFixedPostingTimes(timezone: string, postingTimesRaw: string[]): string[] {
  return postingTimesRaw.map((timeStr) => {
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

async function loadAgencyAuth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  agencyId: string
): Promise<{ agency?: AgencyAuth; error?: string }> {
  const { data: agency, error } = await supabase
    .from('users')
    .select('is_active_override, fb_app_id, fb_app_secret')
    .eq('id', agencyId)
    .single()

  if (error || !agency) {
    return { error: 'Failed to verify agency account status.' }
  }

  if (!agency.fb_app_id || !agency.fb_app_secret) {
    return { error: 'Facebook App ID or Secret is missing in your settings. Please configure them first.' }
  }

  if (!agency.is_active_override) {
    return { error: 'Your account has been suspended. Please contact support.' }
  }

  return { agency: agency as AgencyAuth }
}

async function validateAndInsertPage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    agencyId: string
    facebookAccountId: string
    timezone: string
    postsPerDay: number
    scheduleType: ScheduleType
    postingTimes?: string[]
    pageName: string
    sourceUsername: string
    sourcePlatform: SourcePlatform
    fbPageId: string
    fbPageAccessToken: string
    fbPageImage?: string
    followersCount?: number
  },
  agency: AgencyAuth
): Promise<{ success?: true; error?: string }> {
  const sourceUsername = normalizeSourceUsername(input.sourcePlatform, input.sourceUsername)
  const fbPageId = (input.fbPageId || '').trim().replace(/\s/g, '')
  const fbPageAccessToken = (input.fbPageAccessToken || '').trim().replace(/\s/g, '')

  const { data: existingPages, error: checkError } = await supabase
    .from('pages')
    .select('source_username')
    .eq('agency_id', input.agencyId)
    .eq('source_username', sourceUsername)

  if (checkError) return { error: checkError.message }
  if (existingPages && existingPages.length > 0) {
    return { error: `The source account "${sourceUsername}" is already being used by another page.` }
  }

  let finalPageAccessToken = fbPageAccessToken

  if (!finalPageAccessToken && input.facebookAccountId) {
    const { data: fbAccount, error: accError } = await supabase
      .from('facebook_accounts')
      .select('fb_user_access_token')
      .eq('id', input.facebookAccountId)
      .eq('agency_id', input.agencyId)
      .single()

    if (accError || !fbAccount) {
      return { error: 'Linked Facebook account not found or unauthorized.' }
    }

    try {
      const tokenRes = await graphGet<{ access_token: string }>(fbPageId, {
        fields: 'access_token',
        access_token: fbAccount.fb_user_access_token,
      })

      if (tokenRes.data.access_token) {
        finalPageAccessToken = tokenRes.data.access_token
      } else {
        return { error: 'Facebook returned no access token for this page.' }
      }
    } catch {
      return { error: 'Failed to retrieve Page Access Token from Facebook. Please try reconnecting your account.' }
    }
  }

  if (!finalPageAccessToken) {
    return { error: 'Page Access Token is missing and could not be retrieved.' }
  }

  try {
    const debugRes = await graphGet<{ data: { is_valid: boolean; scopes: string[]; error?: { message: string } } }>('debug_token', {
      input_token: finalPageAccessToken,
      access_token: `${agency.fb_app_id}|${agency.fb_app_secret}`,
    })

    const debugData = debugRes.data.data
    if (!debugData.is_valid) {
      return { error: `Invalid Page Access Token: ${debugData.error?.message || 'Unknown error'}` }
    }

    const grantedScopes = debugData.scopes || []
    const missing = REQUIRED_SCOPES.filter((scope) => !grantedScopes.includes(scope))
    if (missing.length > 0) {
      return { error: `Verification Failed: The Facebook connection is missing required permissions: ${missing.join(', ')}. Please reconnect your account.` }
    }
  } catch (err) {
    const axiosError = err as AxiosError<{ error?: { message: string } }>
    console.error('Token validation failed', axiosError.response?.data || axiosError.message)
    return { error: 'Failed to validate Facebook Token permissions. Please ensure your App ID and Secret are correct and try again.' }
  }

  const postingTimes = input.scheduleType === 'fixed'
    ? buildFixedPostingTimes(input.timezone, input.postingTimes || [])
    : buildRandomPostingTimes(input.timezone, input.postsPerDay)

  const { error } = await supabase
    .from('pages')
    .insert({
      agency_id: input.agencyId,
      facebook_account_id: input.facebookAccountId,
      page_name: input.pageName,
      fb_page_id: fbPageId,
      fb_page_access_token: finalPageAccessToken,
      source_platform: input.sourcePlatform,
      source_username: sourceUsername,
      status: 'active',
      sync_status: 'pending',
      timezone: input.timezone,
      posts_per_day: input.postsPerDay,
      schedule_type: input.scheduleType,
      posting_times: postingTimes,
      fb_page_image: input.fbPageImage,
      followers_count: input.followersCount,
    })

  if (error) {
    if (error.code === '23505') {
      return { error: 'This page or source user is already configured.' }
    }
    return { error: error.message }
  }

  return { success: true }
}

export async function createPage(formData: FormData) {
  await validateRole(['agency', 'super_admin'])

  const validatedFields = createPageSchema.safeParse(Object.fromEntries(formData.entries()))

  if (!validatedFields.success) {
    return { error: zodErrorMessage(validatedFields.error) }
  }

  const {
    agencyId,
    pageName,
    sourceUsername: rawSourceUsername,
    sourcePlatform,
    timezone,
    postsPerDay,
    facebookAccountId,
    fbPageId: rawFbPageId,
    fbPageAccessToken: rawFbPageAccessToken,
    fbPageImage,
    followersCount,
  } = validatedFields.data

  // Strict Timezone Validation
  // Intl.supportedValuesOf('timeZone') gives us a list of valid IANA timezones.
  if (!Intl.supportedValuesOf('timeZone').includes(timezone)) {
    return { error: 'Invalid Timezone selected. Please refresh and try again.' }
  }

  const supabase = await createClient()
  const { agency, error: authError } = await loadAgencyAuth(supabase, agencyId)
  if (authError || !agency) return { error: authError || 'Failed to verify agency account status.' }

  const result = await validateAndInsertPage(
    supabase,
    {
      agencyId,
      facebookAccountId,
      timezone,
      postsPerDay,
      scheduleType: 'dailyrandom',
      pageName,
      sourceUsername: rawSourceUsername,
      sourcePlatform,
      fbPageId: rawFbPageId,
      fbPageAccessToken: rawFbPageAccessToken,
      fbPageImage,
      followersCount,
    },
    agency
  )

  if (result.error) return { error: result.error }

  revalidatePath('/agency/facebook/auto-download-upload')
  return { success: true }
}

export async function createPagesBulk(formData: FormData) {
  await validateRole(['agency', 'super_admin'])

  let parsedPages: BulkPageInput[] = []
  try {
    parsedPages = JSON.parse((formData.get('pages') as string) || '[]')
  } catch {
    return {
      success: false,
      created: [],
      failed: [{ pageName: 'bulk-input', reason: 'Invalid bulk payload format.' }],
    }
  }

  const validatedFields = createPagesBulkSchema.safeParse({
    agencyId: formData.get('agencyId'),
    facebookAccountId: formData.get('facebookAccountId'),
    pages: parsedPages,
  })

  if (!validatedFields.success) {
    return {
      success: false,
      created: [],
      failed: [{
        pageName: 'bulk-input',
        reason: zodErrorMessage(validatedFields.error),
      }],
    }
  }

  const { agencyId, facebookAccountId, pages } = validatedFields.data

  const supabase = await createClient()
  const { agency, error: authError } = await loadAgencyAuth(supabase, agencyId)
  if (authError || !agency) {
    return {
      success: false,
      created: [],
      failed: [{ pageName: 'bulk-input', reason: authError || 'Failed to verify agency account status.' }],
    }
  }

  const created: Array<{ pageName: string }> = []
  const failed: Array<{ pageName: string; reason: string }> = []

  for (const page of pages) {
    if (!Intl.supportedValuesOf('timeZone').includes(page.timezone)) {
      failed.push({
        pageName: page.pageName,
        reason: 'Invalid Timezone selected. Please refresh and try again.',
      })
      continue
    }

    const result = await validateAndInsertPage(
      supabase,
      {
        agencyId,
        facebookAccountId,
        timezone: page.timezone,
        postsPerDay: page.postsPerDay,
        scheduleType: page.scheduleType,
        postingTimes: page.postingTimes || [],
        pageName: page.pageName,
        sourceUsername: page.sourceUsername,
        sourcePlatform: page.sourcePlatform,
        fbPageId: page.fbPageId,
        fbPageAccessToken: page.fbPageAccessToken,
        fbPageImage: page.fbPageImage,
        followersCount: page.followersCount,
      },
      agency
    )

    if (result.success) {
      created.push({ pageName: page.pageName })
    } else {
      failed.push({ pageName: page.pageName, reason: result.error || 'Unknown error' })
    }
  }

  revalidatePath('/agency/facebook/auto-download-upload')
  return {
    success: created.length > 0,
    created,
    failed,
  }
}

export async function deletePage(pageId: string) {
  await validateRole(['agency', 'super_admin'])

  const validatedFields = deletePageSchema.safeParse({ pageId })

  if (!validatedFields.success) {
    return { error: zodErrorMessage(validatedFields.error) }
  }

  const supabase = await createClient()

  // Delete reels in chunks first to avoid a large cascade delete statement.
  const deleteBatchSize = 300
  for (let i = 0; i < 300; i++) {
    const { data: batchRows, error: fetchBatchError } = await supabase
      .from('reels')
      .select('id')
      .eq('page_id', pageId)
      .order('id', { ascending: true })
      .limit(deleteBatchSize)

    if (fetchBatchError) {
      return { error: fetchBatchError.message }
    }

    const ids = (batchRows || []).map((row) => row.id)
    if (ids.length === 0) break

    const { error: deleteBatchError } = await supabase
      .from('reels')
      .delete()
      .in('id', ids)

    if (deleteBatchError) {
      return { error: deleteBatchError.message }
    }

    if (ids.length < deleteBatchSize) break
  }

  const { error } = await supabase
    .from('pages')
    .delete()
    .eq('id', pageId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/agency/facebook/auto-download-upload')
  return { success: true }
}
