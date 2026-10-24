import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DestinationDetail } from '@/lib/api/schemas/connect';
import { TikTokComposer } from './tiktok-composer';

const DESTINATION_ID = '22222222-2222-4222-8222-222222222222';
const VIDEO_ID = '33333333-3333-4333-8333-333333333333';
const IMAGE_ID = '44444444-4444-4444-8444-444444444444';

const DESTINATION: DestinationDetail = {
  id: DESTINATION_ID,
  externalDestinationId: 'tt-acme',
  name: 'Acme TikTok',
  handle: '@acme',
  avatarUrl: null,
  timezone: 'UTC',
  status: 'active',
  accountType: null,
  platform: 'tiktok',
  account: {
    id: '55555555-5555-4555-8555-555555555555',
    displayName: 'Acme',
    platform: 'tiktok',
    status: 'active',
  },
};

const VIDEO_ITEM = {
  id: VIDEO_ID,
  userId: '66666666-6666-4666-8666-666666666666',
  folderId: null,
  name: 'dance.mp4',
  fileSize: 4096,
  mimeType: 'video/mp4',
  mediaType: 'video',
  storageKey: 'media/dance.mp4',
  url: 'https://storage.invalid/dance.mp4',
  thumbnailKey: null,
  thumbnailUrl: null,
  durationSeconds: 15,
  aspectRatio: '9:16',
  captionText: null,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
};

const IMAGE_ITEM = {
  ...VIDEO_ITEM,
  id: IMAGE_ID,
  name: 'cover.jpg',
  mimeType: 'image/jpeg',
  mediaType: 'image',
  storageKey: 'media/cover.jpg',
  url: 'https://storage.invalid/cover.jpg',
  durationSeconds: null,
  aspectRatio: '4:5',
};

const SLOT = {
  id: '11111111-1111-4111-8111-111111111111',
  destinationId: DESTINATION_ID,
  kind: ['video', 'image'],
  timeOfDay: '09:00',
  isActive: true,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeFetch(posts: Array<Record<string, unknown>>, slots: unknown[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (
      url.includes('/publishing/destination-queue') &&
      init?.method === 'POST'
    ) {
      posts.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return jsonResponse(
        {
          id: '77777777-7777-4777-8777-777777777777',
          workspaceId: '88888888-8888-4888-8888-888888888888',
          destinationId: DESTINATION_ID,
          platform: 'tiktok',
          kind: 'video',
          platformFormat: null,
          status: 'queued',
          scheduledTime: '2026-12-01T09:00:00.000Z',
          slotId: null,
          createdAt: '2026-10-24T00:00:00.000Z',
        },
        201,
      );
    }
    if (url.includes('/posting-slots')) {
      return jsonResponse({
        destinationId: DESTINATION_ID,
        timezone: 'UTC',
        slots,
      });
    }
    if (url.includes('/media')) {
      return jsonResponse({
        items: [VIDEO_ITEM, IMAGE_ITEM],
        total: 2,
        limit: 50,
        offset: 0,
        nextCursor: null,
      });
    }
    return jsonResponse({});
  });
}

function renderComposer(
  posts: Array<Record<string, unknown>>,
  slots: unknown[] = [SLOT],
) {
  vi.stubGlobal('fetch', makeFetch(posts, slots));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TikTokComposer subdomain="acme" destination={DESTINATION} />
    </QueryClientProvider>,
  );
}

async function pickMedia(
  user: ReturnType<typeof userEvent.setup>,
  itemId: string,
) {
  await user.click(screen.getByTestId('composer-choose-library-btn'));
  await user.click(await screen.findByTestId(`composer-library-pick-${itemId}`));
}

describe('TikTokComposer (spec 132 G-TT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the schema fields only — no draft anything, no auto-music for video', async () => {
    renderComposer([]);
    expect(screen.getByTestId('tiktok-composer')).toBeVisible();
    expect(screen.getByTestId('tiktok-composer-kind')).toBeVisible();
    expect(screen.getByTestId('tiktok-composer-caption-field')).toBeVisible();
    expect(screen.getByTestId('tiktok-composer-privacy-field')).toBeVisible();
    expect(screen.getByTestId('tiktok-composer-allow-comment')).toBeVisible();
    expect(screen.getByTestId('tiktok-composer-allow-duet')).toBeVisible();
    expect(screen.getByTestId('tiktok-composer-allow-stitch')).toBeVisible();
    expect(screen.getByTestId('tiktok-composer-ai-generated')).toBeVisible();
    // autoAddMusic is photo-only in the schema.
    expect(screen.queryByTestId('tiktok-composer-auto-music')).toBeNull();
    expect(screen.queryByText(/draft/i)).toBeNull();
    // Toggles start on Default — the omitted-key state, shown honestly.
    expect(
      screen.getByTestId('tiktok-composer-allow-comment-default'),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('queues a video with the picked toggles — Default stays omitted', async () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(posts);
    const user = userEvent.setup();
    const submit = screen.getByTestId('destination-composer-submit-btn');
    expect(submit).toBeDisabled();

    await pickMedia(user, VIDEO_ID);
    await user.type(
      screen.getByTestId('tiktok-composer-caption-field'),
      'Dance break',
    );
    await user.click(screen.getByTestId('tiktok-composer-allow-duet-off'));
    await waitFor(() => expect(submit).toBeEnabled());
    expect(submit).toHaveTextContent('Add to queue');
    await user.click(submit);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      platform: 'tiktok',
      destinationId: DESTINATION_ID,
      kind: 'video',
      caption: 'Dance break',
      mediaItemIds: [VIDEO_ID],
      intent: 'queue',
      platformOptions: { privacy: 'public', allowDuet: false },
    });
    const options = posts[0]?.platformOptions as Record<string, unknown>;
    expect('allowComment' in options).toBe(false);
    expect('autoAddMusic' in options).toBe(false);
    expect('isDraft' in options).toBe(false);
    expect('title' in (posts[0] as Record<string, unknown>)).toBe(false);
    expect(await screen.findByTestId('tiktok-composer-success')).toBeVisible();
  }, 20000);

  it('photo posts reveal auto-music and send it when picked', async () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(posts);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('tiktok-composer-kind-photo'));
    expect(
      await screen.findByTestId('tiktok-composer-auto-music'),
    ).toBeVisible();
    await pickMedia(user, IMAGE_ID);
    await user.click(screen.getByTestId('tiktok-composer-auto-music-on'));
    const submit = screen.getByTestId('destination-composer-submit-btn');
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      kind: 'image',
      mediaItemIds: [IMAGE_ID],
      platformOptions: { privacy: 'public', autoAddMusic: true },
    });
  }, 20000);

  it('a non-active destination shows the reconnect state instead of the form', () => {
    vi.stubGlobal('fetch', makeFetch([], [SLOT]));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <TikTokComposer
          subdomain="acme"
          destination={{ ...DESTINATION, status: 'expired' }}
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByTestId('tiktok-composer')).toBeNull();
    expect(
      screen.getByText(/needs attention before you can post/i),
    ).toBeVisible();
  });
});
