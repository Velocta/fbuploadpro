import 'server-only'

import { createAdminClient } from '@/lib/supabase/server'

export async function getTokenCostForFeature(params: {
  feature: string
  platform?: string
  mediaType?: string
  sourcePlatform?: string | null
}) {
  const supabase = await createAdminClient()
  const platform = params.platform ?? 'facebook'
  const mediaType = params.mediaType ?? '*'

  let query = supabase
    .from('token_cost_rules')
    .select('token_cost')
    .eq('feature', params.feature)
    .eq('platform', platform)
    .eq('media_type', mediaType)

  query =
    params.sourcePlatform == null
      ? query.is('source_platform', null)
      : query.eq('source_platform', params.sourcePlatform)

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (data) {
    return data.token_cost
  }

  let wildcardQuery = supabase
    .from('token_cost_rules')
    .select('token_cost')
    .eq('feature', params.feature)
    .eq('platform', platform)
    .eq('media_type', '*')

  wildcardQuery =
    params.sourcePlatform == null
      ? wildcardQuery.is('source_platform', null)
      : wildcardQuery.eq('source_platform', params.sourcePlatform)

  const { data: wildcard, error: wildcardError } = await wildcardQuery.maybeSingle()

  if (wildcardError) {
    throw new Error(wildcardError.message)
  }

  return wildcard?.token_cost ?? 0
}

export async function deductAgencyTokens(agencyId: string, amount: number) {
  if (amount <= 0) return

  const supabase = await createAdminClient()
  const { data: user, error: readError } = await supabase
    .from('users')
    .select('tokens_balance')
    .eq('id', agencyId)
    .single()

  if (readError || !user) {
    throw new Error(readError?.message || 'Agency not found')
  }

  const nextBalance = Math.max(0, (user.tokens_balance ?? 0) - amount)
  const { error: updateError } = await supabase
    .from('users')
    .update({ tokens_balance: nextBalance })
    .eq('id', agencyId)

  if (updateError) {
    throw new Error(updateError.message)
  }
}

export async function requireAgencyHasTokens(agencyId: string) {
  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('users')
    .select('tokens_balance')
    .eq('id', agencyId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if ((data?.tokens_balance ?? 0) <= 0) {
    throw new Error('Insufficient token balance')
  }
}
