/**
 * Secure Post-Authentication Redirection Sanitizer (Spec 017 / AUTH-01)
 *
 * Enforces strict defense against open redirect vulnerabilities by ensuring
 * that any `returnUrl` provided after login or OTP verification resolves
 * strictly to internal application routes or the user's authorized tenant subdomain.
 */

function normalizeDomainInput(rootDomain: string): {
  cleanRoot: string;
  normalizedRoot: string;
  isLocal: boolean;
  protocol: 'http' | 'https';
} {
  const stripped = rootDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0] || 'localhost:3000';
  const cleanRoot = stripped.split(':')[0] || 'localhost';
  const isLocal = cleanRoot.includes('localhost') || cleanRoot.includes('127.0.0.1');
  const protocol = isLocal ? 'http' : 'https';
  return { cleanRoot, normalizedRoot: stripped, isLocal, protocol };
}

function resolvePreviewContext(
  cleanRoot: string,
  isLocal: boolean,
  requestHost?: string | null
): { isBrowserPreview: boolean; serverPreviewHost: string | null } {
  const browserHost =
    typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const isBrowserLocal =
    browserHost === 'localhost' ||
    browserHost === '127.0.0.1' ||
    browserHost.endsWith('.localhost');

  const isBrowserPreview =
    Boolean(browserHost) &&
    (browserHost.endsWith('.vercel.app') || (isLocal && !isBrowserLocal));

  const cleanReqHost = requestHost?.trim().toLowerCase().split(':')[0] || '';
  let serverPreviewHost: string | null = null;
  if (!isBrowserPreview) {
    if (cleanReqHost.endsWith('.vercel.app')) {
      serverPreviewHost = cleanReqHost;
    } else if (process.env.VERCEL_URL && (isLocal || cleanRoot === 'localhost')) {
      serverPreviewHost = process.env.VERCEL_URL;
    }
  }

  return { isBrowserPreview, serverPreviewHost };
}

function computeDefaultUrl(
  userSubdomain: string | undefined,
  normalizedRoot: string,
  protocol: 'http' | 'https',
  isBrowserPreview: boolean,
  serverPreviewHost: string | null
): string {
  if (isBrowserPreview) {
    return userSubdomain
      ? `${window.location.origin}/tenant/${userSubdomain}`
      : `${window.location.origin}/`;
  }
  if (serverPreviewHost) {
    return userSubdomain
      ? `https://${serverPreviewHost}/tenant/${userSubdomain}`
      : `https://${serverPreviewHost}/`;
  }
  return userSubdomain
    ? `${protocol}://${userSubdomain}.${normalizedRoot}/`
    : '/';
}

function buildBrowserPreviewTenantUrl(
  parsed: URL,
  userSubdomain: string | undefined
): string {
  const origin = window.location.origin;
  if (!userSubdomain) {
    return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  const tenantPrefix = `/tenant/${userSubdomain}`;
  if (parsed.pathname === '/' || parsed.pathname === '') {
    return `${origin}${tenantPrefix}${parsed.search}${parsed.hash}`;
  }
  if (parsed.pathname === tenantPrefix || parsed.pathname.startsWith(`${tenantPrefix}/`)) {
    return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  return `${origin}${tenantPrefix}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function validateFullUrl(
  trimmed: string,
  userSubdomain: string | undefined,
  cleanRoot: string,
  isBrowserPreview: boolean,
  serverPreviewHost: string | null,
  defaultUrl: string
): string {
  try {
    const parsed = new URL(trimmed);
    const actualHostname = parsed.hostname.toLowerCase();

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return defaultUrl;
    }

    if (parsed.searchParams.has('returnUrl')) {
      parsed.searchParams.delete('returnUrl');
      trimmed = parsed.toString();
    }

    if (isBrowserPreview) {
      const browserHost = window.location.hostname.toLowerCase();
      const isSameBrowserHost = actualHostname === browserHost;
      const isTenantHost = Boolean(
        userSubdomain && actualHostname === `${userSubdomain}.${cleanRoot}`.toLowerCase()
      );
      const isVercelTenantPath = Boolean(
        userSubdomain &&
          actualHostname.endsWith('.vercel.app') &&
          (parsed.pathname === `/tenant/${userSubdomain}` ||
            parsed.pathname.startsWith(`/tenant/${userSubdomain}/`))
      );

      if (isSameBrowserHost || isTenantHost || isVercelTenantPath) {
        return buildBrowserPreviewTenantUrl(parsed, userSubdomain);
      }
      return defaultUrl;
    }

    if (userSubdomain) {
      const expectedHostname = `${userSubdomain}.${cleanRoot}`.toLowerCase();
      if (actualHostname === expectedHostname) {
        return trimmed;
      }
      if (serverPreviewHost && actualHostname === serverPreviewHost.toLowerCase()) {
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

export function sanitizeAuthRedirectUrl(
  rawReturnUrl: string | null | undefined,
  userSubdomain?: string | undefined,
  rootDomain: string = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000',
  requestHost?: string | null
): string {
  const { cleanRoot, normalizedRoot, isLocal, protocol } = normalizeDomainInput(rootDomain);
  const { isBrowserPreview, serverPreviewHost } = resolvePreviewContext(
    cleanRoot,
    isLocal,
    requestHost
  );
  const defaultUrl = computeDefaultUrl(
    userSubdomain,
    normalizedRoot,
    protocol,
    isBrowserPreview,
    serverPreviewHost
  );

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
    if (trimmed.includes(':')) {
      return defaultUrl;
    }
    let cleanTrimmed = trimmed;
    try {
      const dummy = new URL(trimmed, 'https://localhost');
      if (dummy.searchParams.has('returnUrl')) {
        dummy.searchParams.delete('returnUrl');
        cleanTrimmed = `${dummy.pathname}${dummy.search}${dummy.hash}`;
      }
    } catch {
      // Retain trimmed as fallback
    }
    if (isBrowserPreview) {
      return `${window.location.origin}${cleanTrimmed}`;
    }
    if (serverPreviewHost) {
      return `https://${serverPreviewHost}${cleanTrimmed}`;
    }
    return userSubdomain
      ? `${protocol}://${userSubdomain}.${normalizedRoot}${cleanTrimmed}`
      : cleanTrimmed;
  }

  // 4. Fully-qualified URL validation
  return validateFullUrl(
    trimmed,
    userSubdomain,
    cleanRoot,
    isBrowserPreview,
    serverPreviewHost,
    defaultUrl
  );
}
