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

function isAllowedBrowserPreviewHost(
  parsed: URL,
  actualHostname: string,
  userSubdomain: string | undefined,
  cleanRoot: string
): boolean {
  const browserHost = window.location.hostname.toLowerCase();
  if (actualHostname === browserHost) return true;
  if (userSubdomain && actualHostname === `${userSubdomain}.${cleanRoot}`.toLowerCase()) return true;
  return Boolean(
    userSubdomain &&
      actualHostname.endsWith('.vercel.app') &&
      (parsed.pathname === `/tenant/${userSubdomain}` ||
        parsed.pathname.startsWith(`/tenant/${userSubdomain}/`))
  );
}

function isAllowedCustomDomainHost(
  actualHostname: string,
  userSubdomain: string | undefined,
  cleanRoot: string,
  serverPreviewHost: string | null
): boolean {
  if (userSubdomain) {
    const expectedHostname = `${userSubdomain}.${cleanRoot}`.toLowerCase();
    if (actualHostname === expectedHostname) return true;
    return actualHostname === serverPreviewHost?.toLowerCase();
  }
  return actualHostname === cleanRoot || actualHostname.endsWith(`.${cleanRoot}`);
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
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return defaultUrl;
    }

    if (parsed.searchParams.has('returnUrl')) {
      parsed.searchParams.delete('returnUrl');
      trimmed = parsed.toString();
    }

    const actualHostname = parsed.hostname.toLowerCase();
    if (isBrowserPreview) {
      return isAllowedBrowserPreviewHost(parsed, actualHostname, userSubdomain, cleanRoot)
        ? buildBrowserPreviewTenantUrl(parsed, userSubdomain)
        : defaultUrl;
    }

    if (isAllowedCustomDomainHost(actualHostname, userSubdomain, cleanRoot, serverPreviewHost)) {
      return trimmed;
    }
  } catch {
    return defaultUrl;
  }

  return defaultUrl;
}

function isDangerousRedirectScheme(url: string): boolean {
  return url.startsWith('//') || url.includes('\\') || /^(?:javascript|data|vbscript):/i.test(url);
}

function resolveRelativeRedirect(
  trimmed: string,
  userSubdomain: string | undefined,
  normalizedRoot: string,
  protocol: 'http' | 'https',
  isBrowserPreview: boolean,
  serverPreviewHost: string | null,
  defaultUrl: string
): string {
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
  if (!trimmed || isDangerousRedirectScheme(trimmed)) {
    return defaultUrl;
  }

  if (trimmed.startsWith('/')) {
    return resolveRelativeRedirect(
      trimmed,
      userSubdomain,
      normalizedRoot,
      protocol,
      isBrowserPreview,
      serverPreviewHost,
      defaultUrl
    );
  }

  return validateFullUrl(
    trimmed,
    userSubdomain,
    cleanRoot,
    isBrowserPreview,
    serverPreviewHost,
    defaultUrl
  );
}
