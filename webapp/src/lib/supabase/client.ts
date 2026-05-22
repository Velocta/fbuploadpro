import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'
import { getCookieDomain } from '@/lib/config/runtime'

export function createClient() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : undefined

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        domain: getCookieDomain(hostname),
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      }
    }
  )

}