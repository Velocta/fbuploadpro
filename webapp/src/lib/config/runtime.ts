const DEFAULT_MAIN_DOMAIN = 'fbuploadpro.com'

function normalizeHost(value: string): string {
  return value.replace(/^https?:\/\//, '').split(':')[0].toLowerCase()
}

export function getMainDomain(): string {
  return normalizeHost(process.env.NEXT_PUBLIC_MAIN_DOMAIN || DEFAULT_MAIN_DOMAIN)
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
  const mainDomain = getMainDomain()
  return host === mainDomain || host === `www.${mainDomain}` || isLocalHost(host)
}

export function getCookieDomain(hostname?: string): string | undefined {
  if (hostname && (isVercelPreviewHost(hostname) || isLocalHost(hostname))) {
    return undefined
  }

  return process.env.NEXT_PUBLIC_COOKIE_DOMAIN || `.${getMainDomain()}`
}
