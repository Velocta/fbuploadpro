'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { validateRole } from '@/lib/supabase/guards'
import { revalidatePath } from 'next/cache'
import { readTokenPrice } from '@/server/repositories/system-settings'

// Helper to get system settings
export async function getTokenPrice() {
    await validateRole(['super_admin', 'agency']) // Allow agencies to see price too
    return readTokenPrice()
}

export async function allocateTokens(agencyId: string, amountPaidPKR: number, notes?: string) {
    // 1. Validate Super Admin
    await validateRole(['super_admin'])
    const supabase = await createAdminClient()

    // 2. Fetch System Settings & Agency
    const price = await readTokenPrice()

    // Calculate Tokens (Floor to integer)
    // Avoid division by zero
    const safePrice = price > 0 ? price : 0.6
    const tokensToAdd = Math.floor(amountPaidPKR / safePrice)

    const { data: agency, error: fetchError } = await supabase
        .from('users')
        .select('name, tokens_balance')
        .eq('id', agencyId)
        .single()

    if (fetchError || !agency) {
        return { error: 'Agency not found.' }
    }

    const previousBalance = Number(agency.tokens_balance)
    const newBalance = previousBalance + tokensToAdd

    // 3. Perform Updates inside a transaction-like sequence
    // A. Update user balance
    const { error: balanceError } = await supabase
        .from('users')
        .update({ tokens_balance: newBalance })
        .eq('id', agencyId)

    if (balanceError) return { error: balanceError.message }

    // B. Log Token Transaction
    const { error: transError } = await supabase
        .from('token_transactions')
        .insert({
            user_id: agencyId,
            amount: tokensToAdd,
            type: 'purchase',
            metadata: {
                notes: notes || 'Manual allocation by Super Admin',
                amount_paid_pkr: amountPaidPKR,
                token_price: price,
                previous_balance: previousBalance,
                new_balance: newBalance
            }
        })

    if (transError) console.error('Token Transaction Log Error:', transError.message)

    // C. Log Revenue (Subscription Log)
    const { error: revError } = await supabase
        .from('subscription_logs')
        .insert({
            agency_id: agencyId,
            amount_paid: amountPaidPKR,
            type: 'renewal',
            notes: `Manual allocation: Paid ${amountPaidPKR} PKR -> ${tokensToAdd} Tokens (Rate: ${price}). ${notes || ''}`,

            previous_tokens_snapshot: previousBalance,
            tokens_allocated_snapshot: tokensToAdd,
            agency_name_snapshot: agency.name
        })

    if (revError) console.error('Subscription Log Error:', revError.message)

    revalidatePath('/super-admin')
    return { success: true, message: `Successfully allocated ${tokensToAdd} tokens to ${agency.name}.` }
}
