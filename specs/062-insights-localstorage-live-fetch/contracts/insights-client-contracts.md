# Client & Server Interface Contracts: Live Facebook Insights

**Feature**: [spec.md](../spec.md)
**Date**: 2026-10-16

---

## 1. Client LocalStorage API Contract

```typescript
export interface StoredPageInsights {
  data: PageInsightsResponse;
  cachedAt: number; // Date.now()
  expiresAt: number; // Date.now() + 15 * 60 * 1000
}

export function getCachedInsights(
  pageId: string,
  range: PageInsightsRange
): PageInsightsResponse | null {
  try {
    const raw = window.localStorage.getItem(`insights:${pageId}:${range}`);
    if (!raw) return null;
    const entry: StoredPageInsights = JSON.parse(raw);
    if (!entry || typeof entry !== 'object' || !entry.expiresAt || !entry.data) {
      window.localStorage.removeItem(`insights:${pageId}:${range}`);
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      return null; // Expired, trigger fetch
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCachedInsights(
  pageId: string,
  range: PageInsightsRange,
  data: PageInsightsResponse
): void {
  try {
    const entry: StoredPageInsights = {
      data,
      cachedAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    window.localStorage.setItem(`insights:${pageId}:${range}`, JSON.stringify(entry));
  } catch {
    // Ignore quota errors in private browsing
  }
}
```

---

## 2. Server Route Contract

### `GET /api/tenant/[subdomain]/pages/[pageId]/insights`

#### Query Parameters:
- `range`: `'7d' | '14d' | '28d' | '90d'` (Default: `'28d'`)
- `refresh`: `'true' | 'false'` (Optional)

#### Security:
- Requires valid `fbup_session` cookie.
- Strictly isolated to caller's `subdomain` workspace.
- Access token decrypted server-side; NEVER leaked to client.

#### Response Headers:
- `Cache-Control: private, no-cache, no-store, must-revalidate` (ensuring client controls caching via `localStorage`).
