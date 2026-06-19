const DEFAULT_MAIN_DOMAIN = 'fbuploadpro.com'

export function normalizeHost(value: string): string {
  const withoutProtocol = value.replace(/^https?:\/\//, '')
  const host = withoutProtocol.split(':')[0] ?? withoutProtocol
  return host.toLowerCase()
}

export function getBaseDomain(hostname: string): string {
  const host = normalizeHost(hostname)
  if (isLocalHost(host) || isVercelPreviewHost(host)) {
    if (host.includes('vinsmoke')) {
      return 'vinsmokemedia.online'
    }
    return normalizeHost(process.env.NEXT_PUBLIC_MAIN_DOMAIN || DEFAULT_MAIN_DOMAIN)
  }

  const knownDomains = ['fbuploadpro.com', 'vinsmokemedia.online']
  for (const domain of knownDomains) {
    if (host === domain || host.endsWith('.' + domain)) {
      return domain
    }
  }

  const parts = host.split('.')
  if (parts.length >= 2) {
    return parts.slice(-2).join('.')
  }
  return host
}

export function getMainDomain(hostname?: string): string {
  let host = hostname
  if (!host && typeof window !== 'undefined') {
    host = window.location.hostname
  }
  if (!host) {
    return normalizeHost(process.env.NEXT_PUBLIC_MAIN_DOMAIN || DEFAULT_MAIN_DOMAIN)
  }
  return getBaseDomain(host)
}

export function isLocalHost(hostname: string): boolean {
  const host = normalizeHost(hostname)
  return host === 'localhost' || host === '127.0.0.1'
}

export function isVercelPreviewHost(hostname: string): boolean {
  return normalizeHost(hostname).endsWith('.vercel.app')
}

export function isMainDomainHost(hostname: string): boolean {
  const host = normalizeHost(hostname)
  const mainDomain = getMainDomain(host)
  return host === mainDomain || host === `www.${mainDomain}` || isLocalHost(host)
}

export function getCookieDomain(hostname?: string): string | undefined {
  let host = hostname
  if (!host && typeof window !== 'undefined') {
    host = window.location.hostname
  }
  
  if (host && (isVercelPreviewHost(host) || isLocalHost(host))) {
    return undefined
  }

  const baseDomain = host ? getBaseDomain(host) : getMainDomain()
  
  if (baseDomain.includes('vinsmoke')) {
    return '.vinsmokemedia.online'
  }

  return process.env.NEXT_PUBLIC_COOKIE_DOMAIN || `.${baseDomain}`
}

