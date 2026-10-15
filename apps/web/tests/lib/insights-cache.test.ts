import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  InsightsCache,
  validateInsightsCacheConfig,
  globalInsightsCache,
  insightsCache,
} from '@/lib/insights/insights-cache';

describe('InsightsCache Suite', () => {
  let cache: InsightsCache;

  beforeEach(() => {
    cache = new InsightsCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cache.clear();
  });

  describe('in-memory caching', () => {
    it('sets and retrieves cached data', () => {
      const entry = cache.set('key-1', { pageViews: 500 }, 300);
      expect(entry.data).toEqual({ pageViews: 500 });

      const retrieved = cache.get<{ pageViews: number }>('key-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.data).toEqual({ pageViews: 500 });
    });

    it('returns null for missing keys', () => {
      expect(cache.get('missing-key')).toBeNull();
    });

    it('expires items past their ttl', () => {
      cache.set('expiring-key', 'temporary', -1);
      const retrieved = cache.get('expiring-key');
      expect(retrieved).toBeNull();
    });

    it('deletes items explicitly', () => {
      cache.set('del-key', 'value', 300);
      cache.delete('del-key');
      expect(cache.get('del-key')).toBeNull();
    });

    it('clears all entries', () => {
      cache.set('k1', 'v1', 300);
      cache.set('k2', 'v2', 300);
      cache.clear();
      expect(cache.get('k1')).toBeNull();
      expect(cache.get('k2')).toBeNull();
    });

    it('deletes matching entries by predicate', () => {
      cache.set('insights:user-1:page-a:7d', 'data1', 300);
      cache.set('insights:user-1:page-b:7d', 'data2', 300);
      cache.set('other:user-1', 'keep', 300);

      cache.deleteMatching((k) => k.startsWith('insights:user-1:page-a'));

      expect(cache.get('insights:user-1:page-a:7d')).toBeNull();
      expect(cache.get('insights:user-1:page-b:7d')).not.toBeNull();
      expect(cache.get('other:user-1')).not.toBeNull();
    });

    it('deletes page insights specifically by userId and pageIdentifiers', () => {
      cache.set('insights:user-1:p123:7d', 'd1', 300);
      cache.set('insights:user-1:p123:28d', 'd2', 300);
      cache.set('insights:user-1:p999:7d', 'd3', 300);

      cache.deletePageInsights('user-1', 'p123', null, undefined);

      expect(cache.get('insights:user-1:p123:7d')).toBeNull();
      expect(cache.get('insights:user-1:p123:28d')).toBeNull();
      expect(cache.get('insights:user-1:p999:7d')).not.toBeNull();
    });

    it('no-ops when deletePageInsights is called with no valid page IDs', () => {
      cache.set('insights:user-1:p123:7d', 'd1', 300);
      cache.deletePageInsights('user-1', undefined, null, '');
      expect(cache.get('insights:user-1:p123:7d')).not.toBeNull();
    });
  });

  describe('getOrFetchAsync', () => {
    it('returns cached value without calling fetcher', async () => {
      cache.set('fetch-key', 'already-cached', 300);
      const fetcher = vi.fn().mockResolvedValue('new-value');

      const result = await cache.getOrFetchAsync('fetch-key', fetcher);
      expect(result).toBe('already-cached');
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('invokes fetcher on cache miss and caches result', async () => {
      const fetcher = vi.fn().mockResolvedValue({ followers: 1200 });

      const result = await cache.getOrFetchAsync('fetch-key-2', fetcher);
      expect(result).toEqual({ followers: 1200 });
      expect(fetcher).toHaveBeenCalledTimes(1);

      const cached = cache.get('fetch-key-2');
      expect(cached?.data).toEqual({ followers: 1200 });
    });
  });

  describe('Upstash Redis integration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('getAsync fetches and normalizes entry from Upstash Redis if not in memory', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example.com';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      const mockData = { views: 42 };
      const rawPayload = JSON.stringify({
        data: mockData,
        cachedAt: new Date().toISOString(),
        expiresAt: Date.now() + 60000,
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: rawPayload }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const entry = await cache.getAsync<{ views: number }>('remote-key');
      expect(entry).not.toBeNull();
      expect(entry?.data).toEqual(mockData);

      // Verify cached in memory
      expect(cache.get('remote-key')?.data).toEqual(mockData);
    });

    it('getAsync handles raw object result from Upstash Redis', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example.com';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      const mockPayload = {
        data: { count: 99 },
        cachedAt: new Date().toISOString(),
        expiresAt: Date.now() + 60000,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: mockPayload }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const entry = await cache.getAsync<{ count: number }>('obj-key');
      expect(entry?.data).toEqual({ count: 99 });
    });

    it('getAsync returns null if Upstash returns 404 or fails', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example.com';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });
      vi.stubGlobal('fetch', mockFetch);

      const entry = await cache.getAsync('failed-key');
      expect(entry).toBeNull();
    });

    it('setAsync writes to Upstash Redis and in-memory cache', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example.com';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
      });
      vi.stubGlobal('fetch', mockFetch);

      const entry = await cache.setAsync('async-key', { updated: true }, 600);
      expect(entry.data).toEqual({ updated: true });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://upstash.example.com/set/async-key'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('deleteAsync removes from memory and sends DEL to Upstash Redis', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example.com';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      cache.set('del-async', 'val', 300);
      await cache.deleteAsync('del-async');

      expect(cache.get('del-async')).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/del/del-async'),
        expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } })
      );
    });
  });

  describe('validateInsightsCacheConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('throws in production when Upstash environment variables are absent', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      expect(() => validateInsightsCacheConfig()).toThrow(
        /Upstash Redis credentials .* are strictly required/
      );
    });

    it('does not throw in development or test', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      expect(() => validateInsightsCacheConfig()).not.toThrow();
    });
  });

  describe('singletons', () => {
    it('exports global singletons correctly', () => {
      expect(globalInsightsCache).toBeInstanceOf(InsightsCache);
      expect(insightsCache).toBe(globalInsightsCache);
    });
  });
});
