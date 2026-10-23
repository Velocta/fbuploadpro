import { describe, it, expect, vi, afterEach } from 'vitest';
import { submitCreatePost, submitEditPost } from './composer-submit';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const baseCreate = {
  pageId: 'page-1',
  subdomain: 'acme',
  format: 'text' as const,
  items: [],
  caption: 'Hello',
  link: '',
  scheduleDate: null,
  scheduleTimezone: 'UTC',
  nextSlotForFormat: null,
  nextSlotOccurrence: null,
  pageName: 'Acme Page',
};

describe('composer-submit — typed API client plumbing (spec 132 C1.4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a queue post via the tenant queue endpoint and returns the queue message', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 'item-1' }, 201));
    vi.stubGlobal('fetch', fetchMock);

    const message = await submitCreatePost({ ...baseCreate, intent: 'queue' });

    expect(message).toBe('Added to queue.');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/tenant/acme/publishing/queue');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({
      pageId: 'page-1',
      caption: 'Hello',
      postFormat: 'text',
    });
  });

  it('surfaces a server failure as an error — never silently (no not-ok-return)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'Queue is unavailable' }, 500))
    );
    await expect(submitCreatePost({ ...baseCreate, intent: 'queue' })).rejects.toThrow(
      'Queue is unavailable'
    );
  });

  it('edit + Post now patches then calls publish-now', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return jsonResponse({ success: true });
      })
    );

    const message = await submitEditPost({
      subdomain: 'acme',
      itemId: 'item-9',
      format: 'image',
      caption: 'Edited',
      link: '',
      intent: 'now',
      scheduleDate: null,
      wasFailed: true,
      pageName: 'Acme Page',
    });

    expect(message).toBe('Posted to Acme Page.');
    expect(urls).toEqual([
      '/api/tenant/acme/publishing/queue/item-9',
      '/api/tenant/acme/publishing/queue/item-9/publish-now',
    ]);
  });
});
