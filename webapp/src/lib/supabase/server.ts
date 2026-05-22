import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { Database } from '@/types/database.types'
import { cache } from 'react'
import { getCookieDomain } from '@/lib/config/runtime'

export async function createClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const hostname = headerStore.get('host') || ''

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      cookieOptions: {
        domain: getCookieDomain(hostname),
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      }

    }
  )
}

/**
 * Use this only for server-side tasks that require bypassing RLS or managing Auth (e.g., auto-confirming email)
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * A pure admin client that bypasses RLS and session logic.
 * Use only for backend/server tasks.
 */
export async function createAdminClient() {
  // Use the standard non-SSR client for service role tasks
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const getSessionUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
})