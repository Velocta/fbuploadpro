export interface CacheEntry<T> {
  data: T;
  cachedAt: string;
  expiresAt: number;
}

class InsightsCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry as CacheEntry<T>;
  }

  set<T>(key: string, data: T, ttlSeconds: number = 900): CacheEntry<T> {
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
