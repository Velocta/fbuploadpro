import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildFacebookEnqueueRequest,
  buildInstagramEnqueueRequest,
  buildThreadsEnqueueRequest,
  resolveFacebookDestinationId,
} from './destination-enqueue';

const DESTINATION_ID = '33333333-3333-4333-8333-333333333333';
const MEDIA_ID = '11111111-1111-4111-8111-111111111111';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const item = (id: string, mediaType: 'image' | 'video') => ({ id, mediaType });

describe('buildFacebookEnqueueRequest — composer vocabulary → unified contract', () => {
  it('maps a reel to the video kind carrying the reel platform format', () => {
    const request = buildFacebookEnqueueRequest(DESTINATION_ID, {
      format: 'reel',
      caption: 'Reel caption',
      link: '',
      items: [item(MEDIA_ID, 'video')],
      intent: 'queue',
      scheduleDate: null,
    });
    expect(request).toMatchObject({
      platform: 'facebook',
      destinationId: DESTINATION_ID,
      kind: 'video',
      platformFormat: 'reel',
      caption: 'Reel caption',
      mediaItemIds: [MEDIA_ID],
      intent: 'queue',
    });
    expect(request).not.toHaveProperty('scheduledAt');
    expect(request).not.toHaveProperty('slotId');
  });

  it('maps a text post with no media, even if items are passed', () => {
    const request = buildFacebookEnqueueRequest(DESTINATION_ID, {
      format: 'text',
      caption: 'Words only',
      link: ' https://example.com/post ',
      items: [item(MEDIA_ID, 'image')],
      intent: 'now',
      scheduleDate: null,
    });
    expect(request.kind).toBe('text');
    expect(request.mediaItemIds).toEqual([]);
    expect(request.platformFormat).toBeNull();
    expect(request.linkUrl).toBe('https://example.com/post');
    expect(request.intent).toBe('now');
  });

  it('carries only the first media item (the unified row stores one primary media)', () => {
    const request = buildFacebookEnqueueRequest(DESTINATION_ID, {
      format: 'image',
      caption: '',
      link: '',
      items: [item(MEDIA_ID, 'image'), item('22222222-2222-4222-8222-222222222222', 'image')],
      intent: 'queue',
      scheduleDate: null,
    });
    expect(request.kind).toBe('image');
    expect(request.mediaItemIds).toEqual([MEDIA_ID]);
  });

  it("maps the schedule intent to the contract's scheduled intent with scheduledAt", () => {
    const when = new Date('2027-01-05T09:30:00.000Z');
    const request = buildFacebookEnqueueRequest(DESTINATION_ID, {
      format: 'video',
      caption: 'Later',
      link: '',
      items: [item(MEDIA_ID, 'video')],
      intent: 'schedule',
      scheduleDate: when,
    });
    expect(request.intent).toBe('scheduled');
    expect(request.scheduledAt).toBe('2027-01-05T09:30:00.000Z');
    expect(request.platformFormat).toBeNull();
  });

  it('adds the story media-type hint the Facebook publisher reads', () => {
    const request = buildFacebookEnqueueRequest(DESTINATION_ID, {
      format: 'story',
      caption: '',
      link: '',
      items: [item(MEDIA_ID, 'video')],
      intent: 'now',
      scheduleDate: null,
    });
    expect(request.kind).toBe('story');
    expect(request.platformOptions).toEqual({ mediaType: 'video' });
  });

  it('omits an empty link instead of sending a blank linkUrl', () => {
    const request = buildFacebookEnqueueRequest(DESTINATION_ID, {
      format: 'image',
      caption: 'Pic',
      link: '   ',
      items: [item(MEDIA_ID, 'image')],
      intent: 'queue',
      scheduleDate: null,
    });
    expect(request).not.toHaveProperty('linkUrl');
  });
});

const SOCIAL_LIST = {
  accounts: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      platform: 'instagram',
      externalAccountId: 'ig-acct',
      displayName: 'Insta',
      avatarUrl: null,
      status: 'active',
      tokenExpiresAt: null,
      destinations: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          externalDestinationId: 'fb-page-1',
          name: 'Same external id, wrong platform',
          handle: null,
          avatarUrl: null,
          timezone: 'UTC',
          status: 'active',
        },
      ],
    },
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
        },
      ],
    },
  ],
};

describe('resolveFacebookDestinationId — page → unified destination', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('finds the facebook destination whose external id is the page Facebook id', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/accounts/social')) return jsonResponse(SOCIAL_LIST);
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const id = await resolveFacebookDestinationId({
      subdomain: 'acme',
      pageId: 'page-1',
      fbPageId: 'fb-page-1',
    });
    expect(id).toBe(DESTINATION_ID);
    // The held fbPageId is used directly — no page read is issued.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches the page read for the Facebook id when the caller does not hold it', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        if (url.includes('/accounts/social')) return jsonResponse(SOCIAL_LIST);
        if (url.includes('/pages/')) return jsonResponse({ page: { fbPageId: 'fb-page-1' } });
        throw new Error(`Unexpected fetch ${url}`);
      })
    );

    const id = await resolveFacebookDestinationId({ subdomain: 'acme', pageId: 'page-1' });
    expect(id).toBe(DESTINATION_ID);
    expect(urls.some((u) => u.includes('/pages/page-1'))).toBe(true);
  });

  it('throws a plain-language error when no destination matches the page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ accounts: [] }))
    );
    await expect(
      resolveFacebookDestinationId({
        subdomain: 'acme',
        pageId: 'page-1',
        fbPageId: 'fb-missing',
      })
    ).rejects.toThrow("Couldn't find this Page's publishing destination.");
  });
});

describe('buildInstagramEnqueueRequest — composer vocabulary → unified contract', () => {
  const mediaItem = (id: string, mediaType: 'image' | 'video') => ({
    id,
    mediaType,
    url: `https://cdn.example.com/${id}.jpg`,
  });

  it('maps a photo to the image kind with the primary media only', () => {
    const request = buildInstagramEnqueueRequest(DESTINATION_ID, {
      format: 'photo',
      caption: 'Hello',
      firstComment: '  first!  ',
      items: [mediaItem(MEDIA_ID, 'image')],
      options: { collaborators: ['brand.account'] },
      intent: 'now',
      scheduleDate: null,
    });
    expect(request).toMatchObject({
      platform: 'instagram',
      destinationId: DESTINATION_ID,
      kind: 'image',
      platformFormat: null,
      caption: 'Hello',
      firstComment: 'first!',
      mediaItemIds: [MEDIA_ID],
      intent: 'now',
      platformOptions: { collaborators: ['brand.account'] },
    });
    expect(request).not.toHaveProperty('scheduledAt');
    expect(request).not.toHaveProperty('slotId');
  });

  it('maps a Reel to the video kind carrying the reel platform format', () => {
    const request = buildInstagramEnqueueRequest(DESTINATION_ID, {
      format: 'reel',
      caption: 'Reel caption',
      firstComment: '',
      items: [mediaItem(MEDIA_ID, 'video')],
      options: { shareToFeed: false },
      intent: 'queue',
      scheduleDate: null,
    });
    expect(request.kind).toBe('video');
    expect(request.platformFormat).toBe('reel');
    expect(request.intent).toBe('queue');
    expect(request).not.toHaveProperty('firstComment');
    expect(request.platformOptions).toEqual({ shareToFeed: false });
  });

  it('maps a carousel with the full ordered item list in platformOptions', () => {
    const second = '22222222-2222-4222-8222-222222222222';
    const request = buildInstagramEnqueueRequest(DESTINATION_ID, {
      format: 'carousel',
      caption: 'Swipe',
      firstComment: '',
      items: [mediaItem(MEDIA_ID, 'image'), mediaItem(second, 'video')],
      options: {},
      intent: 'schedule',
      scheduleDate: new Date('2026-12-01T09:00:00.000Z'),
    });
    expect(request.kind).toBe('carousel');
    expect(request.mediaItemIds).toEqual([MEDIA_ID]);
    expect(request.intent).toBe('scheduled');
    expect(request.scheduledAt).toBe('2026-12-01T09:00:00.000Z');
    expect(request.platformOptions?.carouselItems).toEqual([
      { mediaUrl: `https://cdn.example.com/${MEDIA_ID}.jpg`, mediaType: 'image' },
      { mediaUrl: `https://cdn.example.com/${second}.jpg`, mediaType: 'video' },
    ]);
  });

  it('maps a Story with no caption, no first comment and no options', () => {
    const request = buildInstagramEnqueueRequest(DESTINATION_ID, {
      format: 'story',
      caption: 'should not ship',
      firstComment: 'should not ship',
      items: [mediaItem(MEDIA_ID, 'image')],
      options: { collaborators: ['brand.account'] },
      intent: 'now',
      scheduleDate: null,
    });
    expect(request.kind).toBe('story');
    expect(request.caption).toBe('');
    expect(request).not.toHaveProperty('firstComment');
    expect(request).not.toHaveProperty('platformOptions');
  });

  it('omits platformOptions entirely when nothing is set', () => {
    const request = buildInstagramEnqueueRequest(DESTINATION_ID, {
      format: 'photo',
      caption: '',
      firstComment: '',
      items: [mediaItem(MEDIA_ID, 'image')],
      options: {},
      intent: 'queue',
      scheduleDate: null,
    });
    expect(request).not.toHaveProperty('platformOptions');
  });
});

describe('buildThreadsEnqueueRequest — composer vocabulary → unified contract', () => {
  const mediaItem = (id: string, mediaType: 'image' | 'video') => ({
    id,
    mediaType,
    url: `https://cdn.example.com/${id}.jpg`,
  });

  it('maps a text post with no media and the reply control riding in options', () => {
    const request = buildThreadsEnqueueRequest(DESTINATION_ID, {
      kind: 'text',
      text: 'Hello Threads',
      items: [],
      carouselAltTexts: {},
      options: { replyControl: 'everyone', topicTag: 'Photography' },
      intent: 'now',
      scheduleDate: null,
    });
    expect(request).toMatchObject({
      platform: 'threads',
      destinationId: DESTINATION_ID,
      kind: 'text',
      caption: 'Hello Threads',
      mediaItemIds: [],
      intent: 'now',
      platformOptions: { replyControl: 'everyone', topicTag: 'Photography' },
    });
    expect(request).not.toHaveProperty('firstComment');
    expect(request).not.toHaveProperty('scheduledAt');
  });

  it('maps a single video with the primary media only', () => {
    const request = buildThreadsEnqueueRequest(DESTINATION_ID, {
      kind: 'video',
      text: 'Watch this',
      items: [mediaItem(MEDIA_ID, 'video')],
      carouselAltTexts: {},
      options: { replyControl: 'everyone', altText: 'A clip' },
      intent: 'schedule',
      scheduleDate: new Date('2026-12-01T09:00:00.000Z'),
    });
    expect(request.kind).toBe('video');
    expect(request.mediaItemIds).toEqual([MEDIA_ID]);
    expect(request.intent).toBe('scheduled');
    expect(request.scheduledAt).toBe('2026-12-01T09:00:00.000Z');
  });

  it('maps a carousel with ordered items and per-item alt text', () => {
    const second = '22222222-2222-4222-8222-222222222222';
    const request = buildThreadsEnqueueRequest(DESTINATION_ID, {
      kind: 'carousel',
      text: 'Swipe',
      items: [mediaItem(MEDIA_ID, 'image'), mediaItem(second, 'video')],
      carouselAltTexts: { [MEDIA_ID]: ' First slide ' },
      options: { replyControl: 'followers_only' },
      intent: 'queue',
      scheduleDate: null,
    });
    expect(request.kind).toBe('carousel');
    expect(request.mediaItemIds).toEqual([MEDIA_ID]);
    expect(request.intent).toBe('queue');
    expect(request.platformOptions?.carouselItems).toEqual([
      {
        mediaUrl: `https://cdn.example.com/${MEDIA_ID}.jpg`,
        mediaType: 'image',
        altText: 'First slide',
      },
      { mediaUrl: `https://cdn.example.com/${second}.jpg`, mediaType: 'video' },
    ]);
  });
});
