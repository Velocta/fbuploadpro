import { describe, it, expect, vi, afterEach } from 'vitest';
import { submitCreatePost, submitEditPost } from './composer-submit';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const DESTINATION_ID = '33333333-3333-4333-8333-333333333333';

const SOCIAL_LIST = {
  accounts: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      platform: 'facebook',
      externalAccountId: 'fb-acct',
      displayName: 'FB',
      avatarUrl: null,
      status: 'active',
      tokenExpiresAt: null,
      destinations: [
        {
          id: DESTINATION_ID,
          externalDestinationId: 'fb-page-1',
          name: 'Acme Page',
          handle: null,
          avatarUrl: null,
          timezone: 'UTC',
          status: 'active',
          accountType: null,
        },
      ],
    },
  ],
};

const ENQUEUE_RESPONSE = {
  id: '77777777-7777-4777-8777-777777777777',
  workspaceId: '88888888-8888-4888-8888-888888888888',
  destinationId: DESTINATION_ID,
  platform: 'facebook',
  kind: 'text',
  platformFormat: null,
  status: 'queued',
  scheduledTime: '2026-12-01T09:00:00.000Z',
  slotId: null,
  createdAt: '2026-10-24T00:00:00.000Z',
};

const baseCreate = {
  pageId: 'page-1',
  subdomain: 'acme',
  fbPageId: 'fb-page-1',
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

/** Serves the destination-resolution read; enqueue POSTs are recorded. */
function makeFetch(posts: Array<Record<string, unknown>>, enqueueStatus = 201) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/accounts/social')) return jsonResponse(SOCIAL_LIST);
    if (url.includes('/publishing/destination-queue') && init?.method === 'POST') {
      posts.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return jsonResponse(
        enqueueStatus === 201 ? ENQUEUE_RESPONSE : { error: 'Queue is unavailable' },
        enqueueStatus
      );
    }
    throw new Error(`Unexpected fetch ${url}`);
  });
}

describe('composer-submit — typed API client plumbing (spec 132 C1.4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a post via the unified destination enqueue and returns the queue message', async () => {
    const posts: Array<Record<string, unknown>> = [];
    const fetchMock = makeFetch(posts);
    vi.stubGlobal('fetch', fetchMock);

    const message = await submitCreatePost({ ...baseCreate, intent: 'queue' });

    expect(message).toBe('Added to queue.');
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      platform: 'facebook',
      destinationId: DESTINATION_ID,
      kind: 'text',
      caption: 'Hello',
      mediaItemIds: [],
      intent: 'queue',
    });
    // The legacy page-scoped payload is gone: no pageId, no postFormat.
    expect(posts[0]).not.toHaveProperty('pageId');
    expect(posts[0]).not.toHaveProperty('postFormat');
    const enqueueCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/publishing/destination-queue')
    );
    expect(enqueueCall?.[0]).toBe('/api/tenant/acme/publishing/destination-queue');
  });

  it('surfaces a server failure as an error — never silently (no not-ok-return)', async () => {
    const posts: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', makeFetch(posts, 500));
    await expect(submitCreatePost({ ...baseCreate, intent: 'queue' })).rejects.toThrow(
      'Queue is unavailable'
    );
  });

  it('edit + Post now patches then calls publish-now (a legacy item keeps the legacy route)', async () => {
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

  it('edit on a unified item settles through the unified item actions (spec 134 PR-134-3)', async () => {
    const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url: String(input),
          method: init?.method ?? 'GET',
          ...(init?.body
            ? { body: JSON.parse(String(init.body)) as Record<string, unknown> }
            : {}),
        });
        return jsonResponse({ success: true });
      })
    );

    const message = await submitEditPost({
      subdomain: 'acme',
      itemId: 'item-9',
      destinationId: DESTINATION_ID,
      format: 'reel',
      caption: 'Edited reel',
      link: '',
      intent: 'now',
      scheduleDate: null,
      wasFailed: true,
      pageName: 'Acme Page',
    });

    expect(message).toBe('Posted to Acme Page.');
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `PATCH /api/tenant/acme/destinations/${DESTINATION_ID}/queue/item-9`,
      `POST /api/tenant/acme/destinations/${DESTINATION_ID}/queue/item-9/publish-now`,
    ]);
    // The unified payload: kind + platformFormat pair (never the
    // legacy postFormat), and the failed item requeues.
    expect(calls[0]?.body).toMatchObject({
      caption: 'Edited reel',
      kind: 'video',
      platformFormat: 'reel',
      status: 'queued',
    });
    expect(calls[0]?.body).not.toHaveProperty('postFormat');
  });
});
