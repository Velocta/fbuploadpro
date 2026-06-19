export interface BrandConfig {
  name: string
  domain: string
  supportEmail: string
  logoUrl: string
  hideLanding: boolean
  hideSignup: boolean
  hideForgotPassword: boolean
}

export function getBrandConfig(hostname: string): BrandConfig {
  const host = (hostname || '').toLowerCase().split(':')[0] || ''

  // Check if hostname contains "vinsmoke"
  if (
    host === 'vinsmokemedia.online' ||
    host.endsWith('.vinsmokemedia.online') ||
    host.includes('vinsmoke')
  ) {
    return {
      name: 'Vinsmoke Media',
      domain: 'vinsmokemedia.online',
      supportEmail: 'support@vinsmokemedia.online',
      logoUrl: '/logo-vinsmoke.svg',
      hideLanding: true,
      hideSignup: true,
      hideForgotPassword: true,
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
  }
}
