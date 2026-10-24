import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DestinationDetail } from '@/lib/api/schemas/connect';
import { YouTubeComposer } from './youtube-composer';

const DESTINATION_ID = '22222222-2222-4222-8222-222222222222';
const VIDEO_ID = '33333333-3333-4333-8333-333333333333';

const DESTINATION: DestinationDetail = {
  id: DESTINATION_ID,
  externalDestinationId: 'UC-acme',
  name: 'Acme Channel',
  handle: '@acme',
  avatarUrl: null,
  timezone: 'UTC',
  status: 'active',
  accountType: null,
  platform: 'youtube',
  account: {
    id: '44444444-4444-4444-8444-444444444444',
    displayName: 'Acme',
    platform: 'youtube',
    status: 'active',
  },
};

const VIDEO_ITEM = {
  id: VIDEO_ID,
  userId: '55555555-5555-4555-8555-555555555555',
  folderId: null,
  name: 'morning.mp4',
  fileSize: 2048,
  mimeType: 'video/mp4',
  mediaType: 'video',
  storageKey: 'media/morning.mp4',
  url: 'https://storage.invalid/morning.mp4',
  thumbnailKey: null,
  thumbnailUrl: null,
  durationSeconds: 42,
  aspectRatio: '16:9',
  captionText: null,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
};

const SLOT = {
  id: '11111111-1111-4111-8111-111111111111',
  destinationId: DESTINATION_ID,
  kind: ['video'],
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
          platform: 'youtube',
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
        items: [VIDEO_ITEM],
        total: 1,
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
      <YouTubeComposer subdomain="acme" destination={DESTINATION} />
    </QueryClientProvider>,
  );
}

async function pickVideo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('composer-choose-library-btn'));
  await user.click(
    await screen.findByTestId(`composer-library-pick-${VIDEO_ID}`),
  );
}

async function choosePrivacy(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  await user.click(screen.getByTestId('youtube-composer-privacy-field'));
  await user.click(await screen.findByRole('option', { name: label }));
}

describe('YouTubeComposer (spec 132 G-YT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the schema fields only — no thumbnail control, no draft anything', async () => {
    renderComposer([]);
    expect(screen.getByTestId('youtube-composer')).toBeVisible();
    expect(screen.getByTestId('youtube-composer-title-field')).toBeVisible();
    expect(
      screen.getByTestId('youtube-composer-description-field'),
    ).toBeVisible();
    expect(screen.getByTestId('youtube-composer-privacy-field')).toBeVisible();
    expect(screen.getByTestId('youtube-composer-made-for-kids')).toBeVisible();
    expect(screen.queryByText(/thumbnail/i)).toBeNull();
    expect(screen.queryByText(/draft/i)).toBeNull();
    // Made-for-kids starts unchosen: neither radio is checked.
    expect(screen.getByTestId('youtube-composer-mfk-yes')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByTestId('youtube-composer-mfk-no')).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('gates submit on the video, the title, privacy, and the made-for-kids choice — then queues', async () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(posts);
    const user = userEvent.setup();
    const submit = screen.getByTestId('destination-composer-submit-btn');
    // No video yet.
    expect(submit).toBeDisabled();

    await pickVideo(user);
    await user.type(
      screen.getByTestId('youtube-composer-title-field'),
      'Morning routine',
    );
    // Privacy + made-for-kids still unchosen.
    expect(submit).toBeDisabled();

    await choosePrivacy(user, 'Public');
    // The made-for-kids gate (G-YT.3) still blocks on its own.
    expect(submit).toBeDisabled();

    await user.click(screen.getByTestId('youtube-composer-mfk-no'));
    await waitFor(() => expect(submit).toBeEnabled());
    expect(submit).toHaveTextContent('Add to queue');
    await user.click(submit);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      platform: 'youtube',
      destinationId: DESTINATION_ID,
      kind: 'video',
      title: 'Morning routine',
      mediaItemIds: [VIDEO_ID],
      intent: 'queue',
      platformOptions: { privacy: 'public', madeForKids: false },
    });
    // Optional keys are omitted, never sent empty.
    const options = posts[0]?.platformOptions as Record<string, unknown>;
    expect('tags' in options).toBe(false);
    expect('categoryId' in options).toBe(false);
    expect(await screen.findByTestId('youtube-composer-success')).toBeVisible();
  }, 20000);

  it('with no posting times, queue is unavailable and Post now carries the enqueue', async () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(posts, []);
    const user = userEvent.setup();
    expect(
      await screen.findByTestId('destination-composer-no-slots-notice'),
    ).toBeVisible();
    expect(screen.getByTestId('composer-intent-queue')).toBeDisabled();
    await pickVideo(user);
    await user.type(
      screen.getByTestId('youtube-composer-title-field'),
      'Launch day',
    );
    await choosePrivacy(user, 'Unlisted');
    await user.click(screen.getByTestId('youtube-composer-mfk-yes'));
    const submit = screen.getByTestId('destination-composer-submit-btn');
    await waitFor(() => expect(submit).toBeEnabled());
    expect(submit).toHaveTextContent('Post now');
    await user.click(submit);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      intent: 'now',
      platformOptions: { privacy: 'unlisted', madeForKids: true },
    });
  }, 20000);

  it('a non-active destination shows the reconnect state instead of the form', () => {
    vi.stubGlobal('fetch', makeFetch([], [SLOT]));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <YouTubeComposer
          subdomain="acme"
          destination={{ ...DESTINATION, status: 'expired' }}
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByTestId('youtube-composer')).toBeNull();
    expect(
      screen.getByText(/needs attention before you can post/i),
    ).toBeVisible();
  });
});
