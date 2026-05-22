import { createClient } from '@/lib/supabase/server'

interface TokenTransactionResult {
  created_at: string
  type: string
  amount: number
  metadata: Record<string, unknown> | null
  reels: {
    username: string
    platform: string
    pages: {
      page_name: string
    } | null
  } | null
}

export async function buildUsageCsvForUser(userId: string): Promise<string> {
  const supabase = await createClient()
  const { data: transactions, error } = await supabase
    .from('token_transactions')
    .select(`
      id,
      amount,
      type,
      created_at,
      metadata,
      reels (
        username,
        platform,
        pages (
          page_name
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const headers = ['Date', 'Type', 'Amount', 'Platform', 'Source Username', 'Target Page', 'Notes']
  const rows = (transactions as unknown as TokenTransactionResult[]).map((t) => {
    const date = new Date(t.created_at).toLocaleString()
    const platform = t.reels?.platform || t.metadata?.platform || '-'
    const source = t.reels?.username || '-'
    const target = t.reels?.pages?.page_name || '-'
    const notes = t.metadata?.notes || '-'

    return [
      `"${date}"`,
      `"${t.type}"`,
      t.amount,
      `"${platform}"`,
      `"${source}"`,
      `"${target}"`,
      `"${notes}"`,
    ].join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}
