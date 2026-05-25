import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

export type FacebookAccountWithPageStats = {
  id: string
  agency_id: string
  fb_user_id: string
  fb_user_name: string | null
  fb_user_image: string | null
  fb_user_access_token: string
  status: Database['public']['Enums']['profile_status_enum']
  created_at: string | null
  updated_at: string | null
  linkedPagesCount: number
  invalidTokenPagesCount: number
}

export type FacebookAccountsListResult = {
  accounts: FacebookAccountWithPageStats[]
  summary: {
    total: number
    active: number
    invalidToken: number
  }
}

export async function listAgencyFacebookAccountsEnriched(
  agencyId: string,
): Promise<FacebookAccountsListResult> {
  const supabase = await createClient()

  const { data: accounts, error } = await supabase
    .from('facebook_accounts')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const rows = accounts || []
  const accountIds = rows.map((a) => a.id)

  const pageCountsByAccount = new Map<
    string,
    { linked: number; invalidToken: number }
  >()

  if (accountIds.length > 0) {
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('facebook_account_id, status')
      .eq('agency_id', agencyId)
      .in('facebook_account_id', accountIds)

    if (pagesError) {
      throw new Error(pagesError.message)
    }

    for (const page of pages || []) {
      const accountId = page.facebook_account_id
      if (!accountId) continue
      const current = pageCountsByAccount.get(accountId) ?? {
        linked: 0,
        invalidToken: 0,
      }
      current.linked += 1
      if (page.status === 'invalid_token') current.invalidToken += 1
      pageCountsByAccount.set(accountId, current)
    }
  }

  const enriched: FacebookAccountWithPageStats[] = rows.map((account) => {
    const counts = pageCountsByAccount.get(account.id) ?? {
      linked: 0,
      invalidToken: 0,
    }
    return {
      ...account,
      status: account.status ?? 'invalid_token',
      linkedPagesCount: counts.linked,
      invalidTokenPagesCount: counts.invalidToken,
    }
  })

  return {
    accounts: enriched,
    summary: {
      total: enriched.length,
      active: enriched.filter((a) => a.status === 'active').length,
      invalidToken: enriched.filter((a) => a.status === 'invalid_token').length,
    },
  }
}

export async function listAgencyFacebookAccounts(agencyId: string) {
  const { accounts } = await listAgencyFacebookAccountsEnriched(agencyId)
  return accounts
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
