import { createClient } from '@/lib/supabase/server'
import { graphGet } from '@/server/integrations/facebook/graph-client'

export async function updateAgencyFacebookAppSettings(agencyId: string, fbAppId: string, fbAppSecret: string) {
  const supabase = await createClient()
  const trimmedId = fbAppId.trim()
  const trimmedSecret = fbAppSecret.trim()

  if (!trimmedId || !trimmedSecret) {
    throw new Error('Both App ID and App Secret are required.')
  }
  if (trimmedId.length > 50 || trimmedSecret.length > 100) {
    throw new Error('Input too long.')
  }
  if (!/^\d+$/.test(trimmedId)) {
    throw new Error('Invalid App ID format. Must be numeric.')
  }

  const response = await graphGet<{ name: string }>(trimmedId, {
    access_token: `${trimmedId}|${trimmedSecret}`,
  })
  const appName = response.data.name
  if (!appName) {
    throw new Error('Could not retrieve app name.')
  }

  const { error } = await supabase
    .from('users')
    .update({
      fb_app_id: trimmedId,
      fb_app_secret: trimmedSecret,
      fb_app_name: appName,
    })
    .eq('id', agencyId)

  if (error) throw new Error(error.message)
  return { appName }
}

export async function deleteAgencyFacebookAppSettings(agencyId: string) {
  const supabase = await createClient()
  const [{ count: accountsCount }, { count: pagesCount }] = await Promise.all([
    supabase.from('facebook_accounts').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId),
    supabase.from('pages').select('*', { count: 'exact', head: true }).eq('agency_id', agencyId),
  ])

  if ((accountsCount || 0) > 0 || (pagesCount || 0) > 0) {
    throw new Error(`You have ${accountsCount} account(s) and ${pagesCount} page(s) connected. Please remove them first.`)
  }

  const { error } = await supabase
    .from('users')
    .update({
      fb_app_id: null,
      fb_app_secret: null,
      fb_app_name: null,
    })
    .eq('id', agencyId)

  if (error) throw new Error(error.message)
}
