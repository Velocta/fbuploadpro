export interface BrandConfig {
  name: string
  domain: string
  supportEmail: string
  logoUrl: string
  hideLanding: boolean
  hideSignup: boolean
  hideForgotPassword: boolean
  hideAddTokens: boolean
  hideTutorials: boolean
}

export function getBrandConfig(hostname: string): BrandConfig {
  const host = (hostname || '').toLowerCase().split(':')[0] || ''

  // Check if hostname matches Sajid Ali AI / Vinsmoke Media white-label domains
  if (
    host === 'sajidaliai.online' ||
    host.endsWith('.sajidaliai.online') ||
    host.includes('sajidali') ||
    host.includes('sajid') ||
    host === 'vinsmokemedia.online' ||
    host.endsWith('.vinsmokemedia.online') ||
    host.includes('vinsmoke')
  ) {
    return {
      name: 'Sajid Ali AI',
      domain: 'sajidaliai.online',
      supportEmail: 'support@sajidaliai.online',
      logoUrl: '/logo-vinsmoke.svg',
      hideLanding: true,
      hideSignup: true,
      hideForgotPassword: true,
      hideAddTokens: true,
      hideTutorials: true,
    }
  }

  // Default brand: FBupload Pro
  return {
    name: 'FBupload Pro',
    domain: 'fbuploadpro.com',
    supportEmail: 'support@fbuploadpro.com',
    logoUrl: '/logo.svg',
    hideLanding: false,
    hideSignup: false,
    hideForgotPassword: false,
    hideAddTokens: false,
    hideTutorials: false,
  }
}
