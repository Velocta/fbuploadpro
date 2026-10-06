import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/supabase/server'

export type AppRole = 'super_admin' | 'agency'

export async function requireRole(allowedRoles: AppRole[]): Promise<User> {
  const user = await getSessionUser()
  if (!user) {
    throw new Error('Unauthorized')
  }

  const role = user.app_metadata?.role as AppRole | undefined
  if (!role || !allowedRoles.includes(role)) {
    throw new Error('Forbidden')
  }

  return user
}

export async function requireApiRole(allowedRoles: AppRole[]) {
  const user = await getSessionUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const role = user.app_metadata?.role as AppRole | undefined
  if (!role || !allowedRoles.includes(role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user }
}
