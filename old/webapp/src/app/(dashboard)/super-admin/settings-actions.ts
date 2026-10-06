'use server'

import { validateRole } from '@/lib/supabase/guards'
import { revalidatePath } from 'next/cache'
import { readTokenPrice, writeTokenPrice } from '@/server/repositories/system-settings'

export async function getTokenPrice() {
  await validateRole(['super_admin', 'agency'])
  return readTokenPrice()
}

export async function updateTokenPrice(price: number) {
  await validateRole(['super_admin'])
  try {
    await writeTokenPrice(price)
    revalidatePath('/super-admin')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update token price'
    return { error: message }
  }
}
