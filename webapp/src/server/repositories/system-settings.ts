import { createAdminClient } from '@/lib/supabase/server'

const DEFAULT_TOKEN_PRICE = 0.6

export async function readTokenPrice(): Promise<number> {
  const supabase = await createAdminClient()
  const { data } = await supabase.from('system_settings').select('token_price_pkr').single()
  return data?.token_price_pkr || DEFAULT_TOKEN_PRICE
}

export async function writeTokenPrice(price: number): Promise<void> {
  const supabase = await createAdminClient()
  const { data: existing } = await supabase.from('system_settings').select('id').limit(1).single()

  if (existing) {
    const { error } = await supabase
      .from('system_settings')
      .update({
        token_price_pkr: price,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase.from('system_settings').insert({ token_price_pkr: price })
  if (error) throw new Error(error.message)
}
