/**
 * Tenant-aware navigation hrefs.
 *
 * On tenant subdomains (e.g. shahzebpyc.fbuploadpro.com) the middleware
 * rewrites clean paths (/accounts) to the internal /tenant/[subdomain]
 * route, so links should use clean paths to keep the address bar clean.
 * On Vercel previews (*.vercel.app) and apex-domain access there is no
 * subdomain to rewrite from, so the /tenant/[subdomain] prefix is required.
 */

/** Build a navigation href for a tenant workspace path. */
export function buildTenantHref(
  subdomain: string,
  path: string,
  useCleanPaths: boolean
): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (useCleanPaths) return cleanPath;
  return `/tenant/${subdomain}${cleanPath}`;
}

/**
 * Normalize a pathname for active-state comparisons.
 * Strips the /tenant/[subdomain] prefix when present so the same check
 * works whether the URL is clean (/accounts) or prefixed
 * (/tenant/shahzebpyc/accounts).
 */
export function normalizeTenantPath(pathname: string, subdomain: string): string {
  const prefix = `/tenant/${subdomain}`;
  if (!pathname) return '/';
  if (pathname === prefix || pathname === `${prefix}/`) return '/';
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return pathname;
}

/**
 * Server-side: determine whether clean tenant paths can be used for the
 * current request. True only when the request host is exactly the tenant's
 * own subdomain (e.g. shahzebpyc.fbuploadpro.com).
 */
export function shouldUseCleanTenantPaths(
  hostHeader: string | null | undefined,
  subdomain: string,
  rootDomain: string = 'fbuploadpro.com'
): boolean {
  if (!hostHeader || !subdomain) return false;
  const host = hostHeader.toLowerCase().split(':')[0] || '';
  const cleanRoot = rootDomain.toLowerCase().split(':')[0] || '';
  return host === `${subdomain.toLowerCase()}.${cleanRoot}`;
}
