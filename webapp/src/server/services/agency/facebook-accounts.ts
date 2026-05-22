import { createClient } from '@/lib/supabase/server'

export async function listAgencyFacebookAccounts(agencyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('facebook_accounts')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

export async function removeAgencyFacebookAccount(agencyId: string, accountId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('facebook_accounts')
    .delete()
    .eq('id', accountId)
    .eq('agency_id', agencyId)

  if (error) {
    throw new Error(error.message)
  }
}
