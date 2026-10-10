/**
 * Secure Post-Authentication Redirection Sanitizer (Spec 017 / AUTH-01)
 *
 * Enforces strict defense against open redirect vulnerabilities by ensuring
 * that any `returnUrl` provided after login or OTP verification resolves
 * strictly to internal application routes or the user's authorized tenant subdomain.
 */

export function sanitizeAuthRedirectUrl(
  rawReturnUrl: string | null | undefined,
  userSubdomain?: string | undefined,
  rootDomain: string = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'
): string {
  const cleanRoot = rootDomain.toLowerCase().split(':')[0] || 'localhost';
  const isLocal = cleanRoot.includes('localhost') || cleanRoot.includes('127.0.0.1');
  const protocol = isLocal ? 'http' : 'https';

  // Detect Vercel preview environments (*.vercel.app) where wildcard subdomains are unavailable
  const isBrowserPreview =
    typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');
  const isServerPreview =
    Boolean(process.env.VERCEL_URL && (isLocal || cleanRoot === 'localhost'));

  let defaultUrl: string;
  if (isBrowserPreview) {
    defaultUrl = userSubdomain
      ? `${window.location.origin}/tenant/${userSubdomain}`
      : `${window.location.origin}/`;
  } else if (isServerPreview && process.env.VERCEL_URL) {
    defaultUrl = userSubdomain
      ? `https://${process.env.VERCEL_URL}/tenant/${userSubdomain}`
      : `https://${process.env.VERCEL_URL}/`;
  } else {
    defaultUrl = userSubdomain
      ? `${protocol}://${userSubdomain}.${rootDomain}/`
      : '/';
  }

  if (!rawReturnUrl || typeof rawReturnUrl !== 'string') {
    return defaultUrl;
  }

  const trimmed = rawReturnUrl.trim();
  if (!trimmed) {
    return defaultUrl;
  }

  // 1. Reject protocol-relative URLs (e.g. //evil.com) and backslashes (e.g. /\evil.com)
  if (trimmed.startsWith('//') || trimmed.includes('\\')) {
    return defaultUrl;
  }

  // 2. Reject javascript:, data:, and vbscript: URIs
  if (/^(?:javascript|data|vbscript):/i.test(trimmed)) {
    return defaultUrl;
  }

  // 3. Relative path handling (starts with single '/')
  if (trimmed.startsWith('/')) {
    // Reject any relative path containing colon to avoid scheme interpretation
    if (trimmed.includes(':')) {
      return defaultUrl;
    }
    if (isBrowserPreview) {
      return `${window.location.origin}${trimmed}`;
    }
    if (isServerPreview && process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}${trimmed}`;
    }
    return userSubdomain
      ? `${protocol}://${userSubdomain}.${rootDomain}${trimmed}`
      : trimmed;
  }

  // 4. Fully-qualified URL validation
  try {
    const parsed = new URL(trimmed);
    const actualHostname = parsed.hostname.toLowerCase();

    // Reject non-http/https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return defaultUrl;
    }

    if (userSubdomain) {
      const expectedHostname = `${userSubdomain}.${cleanRoot}`.toLowerCase();
      // Must strictly match the user's specific tenant workspace host
      if (actualHostname === expectedHostname) {
        return trimmed;
      }
    } else if (actualHostname === cleanRoot || actualHostname.endsWith(`.${cleanRoot}`)) {
      return trimmed;
    }
  } catch {
    return defaultUrl;
  }

  return defaultUrl;
}
