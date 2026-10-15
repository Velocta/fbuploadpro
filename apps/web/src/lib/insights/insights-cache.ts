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

export class InsightsCache {
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

  async getAsync<T>(key: string): Promise<CacheEntry<T> | null> {
    const memoryEntry = this.get<T>(key);
    if (memoryEntry) {
      return memoryEntry;
    }

    const restUrl = process.env.UPSTASH_REDIS_REST_URL;
    const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (restUrl && restToken && typeof fetch === 'function') {
      try {
        const res = await fetch(`${restUrl}/get/${encodeURIComponent(key)}`, {
          headers: {
            Authorization: `Bearer ${restToken}`,
          },
        });
        if (res.ok) {
          const body = (await res.json()) as { result?: unknown };
          if (body && body.result) {
            let parsed: any = null;
            if (typeof body.result === 'string') {
              try {
                parsed = JSON.parse(body.result);
              } catch {
                parsed = null;
              }
            } else if (typeof body.result === 'object') {
              parsed = body.result;
            }

            if (parsed && typeof parsed === 'object') {
              const entry: CacheEntry<T> = ('data' in parsed && 'expiresAt' in parsed)
                ? parsed
                : {
                    data: parsed.data ?? parsed,
                    cachedAt: parsed.cachedAt ?? new Date().toISOString(),
                    expiresAt: parsed.expiresAt ?? (Date.now() + 900 * 1000),
                  };

              if (Date.now() <= entry.expiresAt) {
                this.cache.set(key, entry as CacheEntry<unknown>);
                return entry;
              }
            }
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[InsightsCache] Upstash Redis GET failed, using in-memory fallback:', err);
        }
      }
    }

    return null;
  }

  async setAsync<T>(key: string, data: T, ttlSeconds: number = 900): Promise<CacheEntry<T>> {
    const entry = this.set<T>(key, data, ttlSeconds);

    const restUrl = process.env.UPSTASH_REDIS_REST_URL;
    const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (restUrl && restToken && typeof fetch === 'function') {
      try {
        await fetch(`${restUrl}/set/${encodeURIComponent(key)}?EX=${ttlSeconds}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${restToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entry),
        });
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[InsightsCache] Upstash Redis SET failed, stored in-memory only:', err);
        }
      }
    }

    return entry;
  }

  async getOrFetchAsync<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 900
  ): Promise<T> {
    const cached = await this.getAsync<T>(key);
    if (cached) {
      return cached.data;
    }

    const data = await fetcher();
    if (data !== null && data !== undefined) {
      await this.setAsync<T>(key, data, ttlSeconds);
    }
    return data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  async deleteAsync(key: string): Promise<void> {
    this.delete(key);
    const restUrl = process.env.UPSTASH_REDIS_REST_URL;
    const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (restUrl && restToken && typeof fetch === 'function') {
      try {
        await fetch(`${restUrl}/del/${encodeURIComponent(key)}`, {
          headers: {
            Authorization: `Bearer ${restToken}`,
          },
        });
      } catch {
        // Ignored
      }
    }
  }

  deleteMatching(predicate: (key: string) => boolean): void {
    for (const key of Array.from(this.cache.keys())) {
      if (predicate(key)) {
        this.cache.delete(key);
      }
    }
  }

  deletePageInsights(userId: string, ...pageIdentifiers: (string | undefined | null)[]): void {
    const validIds = pageIdentifiers.filter(Boolean) as string[];
    if (validIds.length === 0) return;

    this.deleteMatching((key) => {
      // Key format: insights:${userId}:${pageId}:${range}
      return validIds.some((id) => key.startsWith(`insights:${userId}:${id}:`));
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const globalInsightsCache = new InsightsCache();
export const insightsCache = globalInsightsCache;

