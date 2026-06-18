import { createAdminClient, createClient } from '@/lib/supabase/server'
import { REQUIRED_SCOPES } from '@/lib/constants/facebook'
import { graphGet } from '@/server/integrations/facebook/graph-client'
import { signData, verifyData } from '@/lib/utils/signing'
import { AxiosError } from 'axios'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type UserSettings = {
  fb_app_id: string | null
  fb_app_secret: string | null
}

type FacebookUserResponse = {
  id: string
  name: string
  picture?: {
    data?: {
      url?: string
    }
  }
}

export async function buildDirectOauthUrl(agencyId: string, host: string, protocol: string) {
  const supabase = await createClient()
  const { data: agencySettings } = await supabase
    .from('users')
    .select('fb_app_id, fb_app_secret')
    .eq('id', agencyId)
    .single()

  const settings = agencySettings as UserSettings | null
  if (!settings?.fb_app_id || !settings?.fb_app_secret) {
    throw new Error('REQUIRED_SETTINGS_MISSING')
  }

  const redirectUri = `${protocol}://${host}/agency/facebook/accounts/callback`
  const scope = REQUIRED_SCOPES.join(',')

  return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${settings.fb_app_id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code`
}

export async function buildMagicConnectLink(agencyId: string, host: string, protocol: string) {
  const token = signData({ agencyId }, 60 * 60 * 1000)
  return `${protocol}://${host}/fb-connect?token=${token}`
}

type AdminClient = SupabaseClient<Database>

type LinkedPageRow = {
  id: string
  fb_page_id: string
  status: string | null
}

const PAGE_TOKEN_FETCH_MAX_ATTEMPTS = 3
const PAGE_TOKEN_FETCH_RETRY_DELAY_MS = 500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchPageAccessTokenWithRetry(
  fbPageId: string,
  userAccessToken: string,
): Promise<string | null> {
  for (let attempt = 1; attempt <= PAGE_TOKEN_FETCH_MAX_ATTEMPTS; attempt++) {
    try {
      const tokenRes = await graphGet<{ access_token: string }>(fbPageId, {
        fields: 'access_token',
        access_token: userAccessToken,
      })
      if (tokenRes.data.access_token) {
        return tokenRes.data.access_token
      }
    } catch {
      if (attempt < PAGE_TOKEN_FETCH_MAX_ATTEMPTS) {
        await sleep(PAGE_TOKEN_FETCH_RETRY_DELAY_MS * attempt)
      }
    }
  }
  return null
}

/** Refreshes page access tokens from the user token; only invalid_token pages become active. */
export async function refreshLinkedPageTokens(
  supabase: AdminClient,
  accountId: string,
  agencyId: string,
  userAccessToken: string,
) {
  const { data: pagesToSync } = await supabase
    .from('pages')
    .select('id, fb_page_id, status')
    .eq('agency_id', agencyId)
    .eq('facebook_account_id', accountId)

  for (const page of (pagesToSync || []) as LinkedPageRow[]) {
    const pageAccessToken = await fetchPageAccessTokenWithRetry(page.fb_page_id, userAccessToken)
    if (!pageAccessToken) continue

    const updates: {
      fb_page_access_token: string
      updated_at: string
      status?: Database['public']['Enums']['profile_status_enum']
    } = {
      fb_page_access_token: pageAccessToken,
      updated_at: new Date().toISOString(),
    }
    if (page.status === 'invalid_token') {
      updates.status = 'active'
    }
    await supabase.from('pages').update(updates).eq('id', page.id)
  }

  const { data: rssPages } = await supabase
    .from('facebook_rss_autoposter_pages')
    .select('id, fb_page_id')
    .eq('agency_id', agencyId)
    .eq('facebook_account_id', accountId)

  for (const rssPage of rssPages || []) {
    const pageAccessToken = await fetchPageAccessTokenWithRetry(rssPage.fb_page_id, userAccessToken)
    if (!pageAccessToken) continue

    await supabase
      .from('facebook_rss_autoposter_pages')
      .update({
        fb_page_access_token: pageAccessToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rssPage.id)
  }
}

export async function buildMagicOauthUrl(token: string, host: string, protocol: string) {
  const payload = verifyData<{ agencyId: string }>(token)
  if (!payload) {
    throw new Error('Invalid or expired magic link. Please generate a new one.')
  }

  const supabase = await createAdminClient()
  const { data: agencySettings } = await supabase
    .from('users')
    .select('fb_app_id, fb_app_secret')
    .eq('id', payload.agencyId)
    .single()

  const settings = agencySettings as UserSettings | null
  if (!settings?.fb_app_id || !settings?.fb_app_secret) {
    throw new Error('This agency has not configured Facebook App credentials yet.')
  }

  const scope = REQUIRED_SCOPES.join(',')
  const redirectUri = `${protocol}://${host}/fb-callback`
  const state = signData({ magicAgencyId: payload.agencyId })

  return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${settings.fb_app_id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&response_type=code`
}

export async function processFacebookCallback(code: string, state: string | undefined, isMagic: boolean, host: string, protocol: string, sessionAgencyId?: string) {
  const supabase = await createAdminClient()
  let agencyId = sessionAgencyId

  if (state) {
    const magicPayload = verifyData<{ magicAgencyId: string }>(state)
    if (magicPayload) {
      agencyId = magicPayload.magicAgencyId
    }
  }

  if (!agencyId) {
    throw new Error('Could not determine Agency identity. Please try again from your dashboard.')
  }

  const { data: agencySettings, error: settingsError } = await supabase
    .from('users')
    .select('fb_app_id, fb_app_secret')
    .eq('id', agencyId)
    .single()

  const settings = agencySettings as UserSettings | null
  if (settingsError || !settings?.fb_app_id || !settings?.fb_app_secret) {
    throw new Error('Could not find app credentials for this agency.')
  }

  const redirectUri = isMagic
    ? `${protocol}://${host}/fb-callback`
    : `${protocol}://${host}/agency/facebook/accounts/callback`

  let shortLivedToken = ''
  try {
    const tokenRes = await graphGet<{ access_token: string }>('oauth/access_token', {
      client_id: settings.fb_app_id,
      client_secret: settings.fb_app_secret,
      redirect_uri: redirectUri,
      code,
    })
    shortLivedToken = tokenRes.data.access_token
  } catch (err) {
    const axiosError = err as AxiosError<{ error?: { message?: string } }>
    const fbMsg = axiosError.response?.data?.error?.message
    throw new Error(fbMsg ? `Facebook OAuth Error: ${fbMsg}` : 'Failed to exchange code for token. Please try again.')
  }

  const longLivedRes = await graphGet<{ access_token: string }>('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: settings.fb_app_id,
    client_secret: settings.fb_app_secret,
    fb_exchange_token: shortLivedToken,
  })
  const longLivedToken = longLivedRes.data.access_token

  const permRes = await graphGet<{ data: { permission: string; status: string }[] }>('me/permissions', {
    access_token: longLivedToken,
  })
  const granted = permRes.data.data.filter((p) => p.status === 'granted').map((p) => p.permission)
  const missing = REQUIRED_SCOPES.filter((required) => !granted.includes(required))
  if (missing.length > 0) {
    throw new Error(`Connection Failed. Missing permissions: ${missing.join(', ')}`)
  }

  const userRes = await graphGet<FacebookUserResponse>('me', {
    access_token: longLivedToken,
    fields: 'id,name,picture.type(large)',
  })
  const fbUser = userRes.data
  const profilePicture = fbUser.picture?.data?.url

  const { data: upsertedAccount, error: dbError } = await supabase
    .from('facebook_accounts')
    .upsert(
      {
        agency_id: agencyId,
        fb_user_id: fbUser.id,
        fb_user_name: fbUser.name,
        fb_user_access_token: longLivedToken,
        fb_user_image: profilePicture,
        status: 'active',
      },
      { onConflict: 'agency_id,fb_user_id' }
    )
    .select()
    .single()

  if (dbError || !upsertedAccount) {
    throw new Error('Failed to save account to database.')
  }

  await refreshLinkedPageTokens(supabase, upsertedAccount.id, agencyId, longLivedToken)
}
