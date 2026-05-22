import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  getCookieDomain,
  getMainDomain,
  isLocalHost,
  isMainDomainHost,
  isVercelPreviewHost,
} from '@/lib/config/runtime'

export async function updateSession(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const isMainDomain = isMainDomainHost(hostname)
  const isPreviewHost = isVercelPreviewHost(hostname)

  let supabaseResponse = NextResponse.next({
    request,
  })

  // 1. Create Supabase Client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
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

  /* 
     1. Create Supabase Client...
     (Existing code lines 10-39)
  */

  // 2. Refresh Session
  // WARNING: getUser() triggers a token refresh. If the refresh token is invalid (400),
  // we must catch it and clear cookies to prevent an infinite reload loop.
  let user = null
  try {
    const { data: { user: fetchedUser }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    user = fetchedUser
  } catch {
    // If Refresh Token is invalid, we MUST clear the cookies so the client stops retrying
    // console.error('Auth Middleware Error:', err) // Optional log

    // Clear cookies in the response
    request.cookies.getAll()
      .filter((cookie) => cookie.name.startsWith('sb-'))
      .forEach((cookie) => supabaseResponse.cookies.delete(cookie.name))
    // Actually, createServerClient's 'setAll' callback handles setting emptiness if we sign out.
    // Let's force sign out conceptually
    await supabase.auth.signOut()
    user = null
  }

  // 2. Helper: Check for API Request
  // We want to return JSON 401 for API routes instead of HTML redirect
  const isApiRoute = request.nextUrl.pathname.startsWith('/api') || request.headers.get('accept')?.includes('application/json')
  const isPublicApiRoute = request.nextUrl.pathname.startsWith('/api/v1/public/')

  // 3. PUBLIC ROUTES (Login, Signup, Privacy, Terms, Homepage, etc.)
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup')
  const isPublicPage =
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname.startsWith('/privacy') ||
    request.nextUrl.pathname.startsWith('/terms') ||
    request.nextUrl.pathname.startsWith('/fb-connect') ||
    request.nextUrl.pathname.startsWith('/fb-callback')

  if (!user) {
    // If not logged in and trying to access protected routes -> Redirect to login
    if (!isAuthPage && !isPublicPage && !isPublicApiRoute) {
      if (isApiRoute) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = request.nextUrl.clone()
      const mainDomain = getMainDomain()

      if (!isMainDomain && !isPreviewHost && !isLocalHost(hostname)) {
        // Redirect to main domain login
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
        return NextResponse.redirect(`${protocol}://${mainDomain}/login`)
      }

      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // 3.5 FORCE MAIN DOMAIN FOR AUTH PAGES ON SUBDOMAINS
    // Even if they are on the login page specifically, we want them on the main domain.
    if (isAuthPage) {
      const mainDomain = getMainDomain()

      if (!isMainDomain && !isPreviewHost && !isLocalHost(hostname)) {
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
        return NextResponse.redirect(`${protocol}://${mainDomain}${request.nextUrl.pathname}`)
      }
    }

    return supabaseResponse
  }


  // 4. DASHBOARD PROTECTION (Logged in)
  if (user) {
    // Get role from app_metadata (synced via Supabase Trigger)
    const role = user.app_metadata?.role as string | undefined
    const path = request.nextUrl.pathname

    // CRITICAL: Prevent Infinite Loop if Role is Missing
    if (!role) {
      // If user has no role, we can't route them properly.
      // Send them to a generic "Role Missing" or "Contact Support" page, or force logout.
      // For now, we'll allow access to "/" but block dashboard access.
      if (path.startsWith('/agency') || path.startsWith('/super-admin')) {
        // Option: Sign them out to force a refresh? Or just show an error.
        // Let's redirect to a safe "unauthorized role" page or home with a param.
        const url = request.nextUrl.clone()
        url.pathname = '/' // Fallback to home
        return NextResponse.redirect(url)
      }
      return supabaseResponse
    }

    // A. If logged in but on Login page -> Redirect to their specific dashboard
    if (isAuthPage && !path.startsWith('/login/update-password')) {
      const url = request.nextUrl.clone()
      url.pathname = role === 'super_admin' ? '/super-admin' : '/agency'
      return NextResponse.redirect(url)
    }

    // B. Super Admin Gate
    if (path.startsWith('/super-admin') && role !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/agency'
      return NextResponse.redirect(url)
    }

    // C. Agency Gate
    if (path.startsWith('/agency') && role !== 'agency') {
      const url = request.nextUrl.clone()
      url.pathname = '/super-admin'
      return NextResponse.redirect(url)
    }

    // D. Subdomain Ownership Verification & Auto-Redirect
    const mainDomain = getMainDomain()

    if (role === 'agency' && !path.startsWith('/login')) {
      // Fetch user's assigned subdomain
      const { data: userData } = await supabase
        .from('users')
        .select('subdomain, tokens_balance')
        .eq('id', user.id)
        .single()

      if (userData?.subdomain) {
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
        const cleanMainDomain = mainDomain.replace(/^https?:\/\//, '').split(':')[0]
        const expectedHost = `${userData.subdomain}.${cleanMainDomain}`

        // If on the wrong subdomain (and not on localhost during dev)
        if (
          !isMainDomain &&
          !isPreviewHost &&
          !isLocalHost(hostname) &&
          hostname !== expectedHost
        ) {
          console.warn(`Subdomain Mismatch: User ${user.email} tried to access ${hostname}. Redirecting to ${expectedHost}`)
          return NextResponse.redirect(`${protocol}://${expectedHost}${path}`)
        }

        // If on the main domain, redirect to their assigned subdomain dashboard
        if (isMainDomain && !isLocalHost(hostname)) {
          // Force /agency path to avoid root redirect loop
          const targetPath = path === '/' ? '/agency' : path
          return NextResponse.redirect(`${protocol}://${expectedHost}${targetPath}`)
        }

      }
    }

  }

  // 5. SECURITY HEADERS
  supabaseResponse.headers.set('X-Frame-Options', 'DENY')
  supabaseResponse.headers.set('Content-Security-Policy', "frame-ancestors 'none'")
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return supabaseResponse
}
