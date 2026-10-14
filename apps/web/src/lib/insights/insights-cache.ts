export interface CacheEntry<T> {
  data: T;
  cachedAt: string;
  expiresAt: number;
}

export function validateInsightsCacheConfig(): void {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error(
        'Upstash Redis credentials (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN) are strictly required for distributed insights caching in production.'
      );
    }
  }
}

class InsightsCache {
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): CacheEntry<T> | null {
    try {
      validateInsightsCacheConfig();
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        console.warn(
          '[InsightsCache] Upstash Redis credentials not configured. Falling back to in-memory insights cache.',
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry as CacheEntry<T>;
  }

  set<T>(key: string, data: T, ttlSeconds: number = 900): CacheEntry<T> {
    try {
      validateInsightsCacheConfig();
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        console.warn(
          '[InsightsCache] Upstash Redis credentials not configured. Falling back to in-memory insights cache.',
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    const entry: CacheEntry<T> = {
      data,
      cachedAt: new Date().toISOString(),
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
    this.cache.set(key, entry as CacheEntry<unknown>);
    return entry;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const globalInsightsCache = new InsightsCache();

