import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import {
  getMainDomain,
  isMainDomainHost,
  isVercelPreviewHost,
} from '@/lib/config/runtime'
import { getBrandConfig } from '@/lib/config/brand'

export async function proxy(request: NextRequest) {
  const url = request.nextUrl

  const hostname = request.headers.get('host') || ''
  const cleanHost = (hostname.split(':')[0] ?? hostname).toLowerCase()

  const mainDomain = getMainDomain(hostname)
  const isMainDomain = isMainDomainHost(hostname)
  const isPreviewHost = isVercelPreviewHost(hostname)

  const brand = getBrandConfig(hostname)

  // 1. Dynamic white-label route blocks & redirects
  if (brand.hideLanding && url.pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (brand.hideSignup && url.pathname.startsWith('/signup')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (brand.hideForgotPassword && (
    url.pathname.startsWith('/login/forgot-password') ||
    url.pathname.startsWith('/login/verify-otp') ||
    url.pathname.startsWith('/login/update-password')
  )) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const isPublicMainRoute =
    isMainDomain &&
    (url.pathname === '/' ||
      url.pathname.startsWith('/privacy') ||
      url.pathname.startsWith('/terms'))

  if (isPublicMainRoute) {
    return NextResponse.next()
  }

  const response = await updateSession(request)
  const isManagedTenantHost =
    !isPreviewHost &&
    !isMainDomain &&
    cleanHost.endsWith(`.${mainDomain}`)
  const subdomain = isManagedTenantHost ? cleanHost.split('.')[0] : null

  if (subdomain && !['www', 'api', 'admin'].includes(subdomain)) {
    const isAuthPage = url.pathname.startsWith('/login') || url.pathname.startsWith('/signup')
    const isPublicPage =
      url.pathname.startsWith('/privacy') ||
      url.pathname.startsWith('/terms') ||
      url.pathname.startsWith('/fb-connect') ||
      url.pathname.startsWith('/fb-callback')

    if (isAuthPage || isPublicPage) {
      return response
    }

    if (url.pathname === '/') {
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
      return NextResponse.redirect(new URL(`${protocol}://${mainDomain}/`))
    }

    if (url.pathname.startsWith('/api')) {
      return response
    }

    if (!url.pathname.startsWith('/agency')) {
      return NextResponse.rewrite(new URL(`/agency${url.pathname}`, request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|txt|json|css|js)$).*)',
  ],
}
