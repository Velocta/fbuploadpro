import { createClient } from '@/lib/supabase/server'
import { graphGet } from '@/server/integrations/facebook/graph-client'
import { AxiosError } from 'axios'
import { Tables } from '@/types/database.types'
import { FacebookBusiness, FacebookGraphPage } from '@/types/app.types'

type FacebookAccountRow = Tables<'facebook_accounts'>
type FacebookPageResponse = {
  id: string
  name: string
  access_token: string
  fan_count?: number
  picture?: {
    data?: {
      url?: string
    }
  }
}

function extractFacebookErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<{ error?: { message?: string } }>
  const apiMessage = axiosError.response?.data?.error?.message
  return apiMessage || axiosError.message || fallback
}

export async function getFacebookPagesForAccount(accountId: string, agencyId: string) {
  const supabase = await createClient()
  const { data, error: accError } = await supabase
    .from('facebook_accounts')
    .select('fb_user_access_token')
    .eq('id', accountId)
    .eq('agency_id', agencyId)
    .single()

  if (accError || !data) {
    throw new Error('Account not found')
  }

  const account = data as Pick<FacebookAccountRow, 'fb_user_access_token'>

  try {
    const personalPagesRes = await graphGet<{ data: FacebookPageResponse[] }>('me/accounts', {
      access_token: account.fb_user_access_token,
      fields: 'id,name,access_token,picture.type(large),fan_count',
    })
    const personalPages: FacebookGraphPage[] = (personalPagesRes.data.data || []).map((p) => ({
      id: p.id,
      name: p.name,
      access_token: p.access_token,
      picture: p.picture?.data?.url,
      followers_count: p.fan_count,
    }))

    // Business endpoints can return 400 when business-level permissions are not granted.
    // In that case, continue with personal pages instead of failing the whole flow.
    let businesses: FacebookBusiness[] = []
    try {
      const businessesRes = await graphGet<{ data: FacebookBusiness[] }>('me/businesses', {
        access_token: account.fb_user_access_token,
      })
      businesses = businessesRes.data.data || []
    } catch (err) {
      const message = extractFacebookErrorMessage(err, 'Failed to fetch businesses from Facebook')
      console.warn('Unable to fetch Facebook businesses, continuing with personal pages only:', message)
    }

    const businessPromises = businesses.map(async (business) => {
      try {
        const [businessPagesRes, clientPagesRes] = await Promise.all([
          graphGet<{ data: FacebookPageResponse[] }>(`${business.id}/owned_pages`, {
            access_token: account.fb_user_access_token,
            fields: 'id,name,access_token,picture.type(large),fan_count',
          }),
          graphGet<{ data: FacebookPageResponse[] }>(`${business.id}/client_pages`, {
            access_token: account.fb_user_access_token,
            fields: 'id,name,access_token,picture.type(large),fan_count',
          }),
        ])

        const pages: FacebookGraphPage[] = (businessPagesRes.data.data || []).map((p) => ({
          id: p.id,
          name: p.name,
          access_token: p.access_token,
          picture: p.picture?.data?.url,
          followers_count: p.fan_count,
        }))
        const clientPages: FacebookGraphPage[] = (clientPagesRes.data.data || []).map((p) => ({
          id: p.id,
          name: p.name,
          access_token: p.access_token,
          picture: p.picture?.data?.url,
          followers_count: p.fan_count,
        }))
        return [...pages, ...clientPages]
      } catch (err) {
        const message = extractFacebookErrorMessage(err, 'Failed to fetch business pages from Facebook')
        console.error(`Error fetching pages for business ${business.id}:`, message)
        return []
      }
    })

    const allBusinessPagesResults = await Promise.all(businessPromises)
    const allBusinessPages = allBusinessPagesResults.flat()
    const combinedPages = [...personalPages, ...allBusinessPages]
    return Array.from(new Map(combinedPages.map((page) => [page.id, page])).values())
  } catch (error) {
    throw new Error(extractFacebookErrorMessage(error, 'Failed to fetch pages from Facebook'))
  }
}
