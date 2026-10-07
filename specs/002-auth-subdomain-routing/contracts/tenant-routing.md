# Contract: Subdomain Extraction & Edge Routing

This document specifies the routing utility interfaces used by Next.js Edge Middleware for subdomain parsing and rewriting.

---

## 1. Subdomain Extraction Contract

```typescript
export interface SubdomainExtractionResult {
  hostname: string;
  subdomain: string | null;
  isApex: boolean;
  isReserved: boolean;
}

export function extractSubdomain(
  hostHeader: string | null | undefined,
  rootDomain: string = 'fbuploadpro.com'
): SubdomainExtractionResult;
```

### Behavior Matrix
- `fbuploadpro.com` ➔ `{ subdomain: null, isApex: true, isReserved: false }`
- `www.fbuploadpro.com` ➔ `{ subdomain: null, isApex: true, isReserved: false }`
- `localhost:3000` ➔ `{ subdomain: null, isApex: true, isReserved: false }`
- `127.0.0.1:3000` ➔ `{ subdomain: null, isApex: true, isReserved: false }`
- `admin.fbuploadpro.com` ➔ `{ subdomain: 'admin', isApex: false, isReserved: true }`
- `api.fbuploadpro.com` ➔ `{ subdomain: 'api', isApex: false, isReserved: true }`
- `client.fbuploadpro.com` ➔ `{ subdomain: 'client', isApex: false, isReserved: false }`
- `client.localhost:3000` ➔ `{ subdomain: 'client', isApex: false, isReserved: false }`

---

## 2. Path Rewriting Contract

```typescript
export function getTenantRewriteUrl(
  subdomain: string,
  pathname: string,
  baseUrl: string | URL
): URL;
```

- Input: `subdomain = 'alpha'`, `pathname = '/dashboard'`, `baseUrl = 'http://alpha.localhost:3000/dashboard'`
- Output: `http://alpha.localhost:3000/tenant/alpha/dashboard`
