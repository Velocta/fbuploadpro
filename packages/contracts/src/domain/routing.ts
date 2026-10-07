import { RESERVED_SUBDOMAINS, type ReservedSubdomain } from './user.js';

export interface SubdomainExtractionResult {
  hostname: string;
  subdomain: string | null;
  isApex: boolean;
  isReserved: boolean;
}

export function extractSubdomain(
  hostHeader: string | null | undefined,
  rootDomain: string = 'fbuploadpro.com'
): SubdomainExtractionResult {
  if (!hostHeader) {
    return {
      hostname: '',
      subdomain: null,
      isApex: true,
      isReserved: false,
    };
  }

  // Strip port if present (e.g. client.localhost:3000 -> client.localhost)
  const normalizedHost = hostHeader.toLowerCase().split(':')[0]!;
  const normalizedRoot = rootDomain.toLowerCase().split(':')[0]!;

  // Handle localhost apex or raw IP
  if (
    normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost === normalizedRoot ||
    normalizedHost === `www.${normalizedRoot}`
  ) {
    return {
      hostname: normalizedHost,
      subdomain: null,
      isApex: true,
      isReserved: false,
    };
  }

  // Handle localhost subdomains (e.g. acme.localhost)
  if (normalizedHost.endsWith('.localhost')) {
    const subdomain = normalizedHost.slice(0, -'.localhost'.length);
    const isReserved = RESERVED_SUBDOMAINS.includes(subdomain as ReservedSubdomain);
    return {
      hostname: normalizedHost,
      subdomain,
      isApex: false,
      isReserved,
    };
  }

  // Handle domain subdomains (e.g. acme.fbuploadpro.com)
  const domainSuffix = `.${normalizedRoot}`;
  if (normalizedHost.endsWith(domainSuffix)) {
    const subdomain = normalizedHost.slice(0, -domainSuffix.length);
    if (subdomain === 'www') {
      return {
        hostname: normalizedHost,
        subdomain: null,
        isApex: true,
        isReserved: false,
      };
    }
    const isReserved = RESERVED_SUBDOMAINS.includes(subdomain as ReservedSubdomain);
    return {
      hostname: normalizedHost,
      subdomain,
      isApex: false,
      isReserved,
    };
  }

  // Fallback: external or apex host
  return {
    hostname: normalizedHost,
    subdomain: null,
    isApex: true,
    isReserved: false,
  };
}

export function getTenantRewriteUrl(
  subdomain: string,
  pathname: string,
  baseUrl: string | URL
): URL {
  const url = typeof baseUrl === 'string' ? new URL(baseUrl) : new URL(baseUrl.toString());
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const tenantPrefix = `/tenant/${subdomain}`;

  // If already prefixed, do not duplicate
  if (normalizedPath.startsWith(tenantPrefix)) {
    url.pathname = normalizedPath;
  } else if (normalizedPath === '/') {
    url.pathname = tenantPrefix;
  } else {
    url.pathname = `${tenantPrefix}${normalizedPath}`;
  }

  return url;
}
