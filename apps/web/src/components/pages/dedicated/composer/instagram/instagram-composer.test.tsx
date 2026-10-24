import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { resolvePublishLimit } from '@fbuploadpro/contracts';
import {
  InstagramComposer,
  type InstagramComposerProps,
} from './instagram-composer';

const DESTINATION_ID = '33333333-3333-4333-8333-333333333333';
const MEDIA_ID = '11111111-1111-4111-8111-111111111111';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const MEDIA_ITEM = {
  id: MEDIA_ID,
  userId: '99999999-9999-4999-8999-999999999999',
  folderId: null,
  name: 'sunset.jpg',
  fileSize: 1024,
  mimeType: 'image/jpeg',
  mediaType: 'image',
  storageKey: 'e2e/sunset.jpg',
  url: 'https://storage.e2e.invalid/sunset.jpg',
  thumbnailKey: null,
  thumbnailUrl: null,
  durationSeconds: null,
  aspectRatio: '1:1',
  captionText: 'A real caption',
  width: 1080,
  height: 1080,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
};

const SLOT = {
  id: '44444444-4444-4444-8444-444444444444',
  destinationId: DESTINATION_ID,
  kind: ['image'],
  timeOfDay: '09:00:00',
  isActive: true,
};

interface FetchOptions {
  slots?: Array<Record<string, unknown>>;
  media?: Array<Record<string, unknown>>;
}

function makeFetch(posts: Array<Record<string, unknown>>, opts: FetchOptions = {}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/publishing/destination-queue') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      posts.push(body);
      return jsonResponse(
        {
          id: '77777777-7777-4777-8777-777777777777',
          workspaceId: '88888888-8888-4888-8888-888888888888',
          destinationId: DESTINATION_ID,
          platform: 'instagram',
          kind: body.kind,
          platformFormat: body.platformFormat ?? null,
          status: 'queued',
          scheduledTime: '2026-12-01T09:00:00.000Z',
          slotId: null,
          createdAt: '2026-10-24T00:00:00.000Z',
        },
        201
      );
    }
    if (url.includes('/posting-slots')) {
      return jsonResponse({
        destinationId: DESTINATION_ID,
        timezone: 'UTC',
        slots: opts.slots ?? [],
      });
    }
    if (url.includes('/media')) {
      const items = opts.media ?? [MEDIA_ITEM];
      return jsonResponse({
        items,
        total: items.length,
        limit: 50,
        offset: 0,
        nextCursor: null,
      });
    }
    return jsonResponse({});
  });
}

function renderComposer(
  fetchMock: ReturnType<typeof vi.fn>,
  props: Partial<InstagramComposerProps> = {}
) {
  vi.stubGlobal('fetch', fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  const fullProps: InstagramComposerProps = {
    subdomain: 'acme',
    destination: {
      id: DESTINATION_ID,
      name: 'My Brand',
      timezone: 'UTC',
      status: 'active',
    },
    onClose: vi.fn(),
    onSubmitted: vi.fn(),
    ...props,
  };
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <InstagramComposer {...fullProps} />
    </QueryClientProvider>
  );
  return { ...utils, props: fullProps };
}

async function pickLibraryItem(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('instagram-composer-open-library-btn'));
  const item = await screen.findByTestId(`instagram-composer-library-item-${MEDIA_ID}`);
  await user.click(item);
  await screen.findByTestId('instagram-composer-selected-media');
}

describe('InstagramComposer (spec 132 PR-C3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers Stories only to a Business destination (§4.1 gate)', async () => {
    const posts: Array<Record<string, unknown>> = [];
    const business = renderComposer(makeFetch(posts), { accountType: 'BUSINESS' });
    expect(
      screen.getByTestId('instagram-composer-format-story')
    ).toBeInTheDocument();
    business.unmount();

    renderComposer(makeFetch(posts), { accountType: 'CREATOR' });
    expect(
      screen.queryByTestId('instagram-composer-format-story')
    ).not.toBeInTheDocument();
  });

  it('does not offer Stories when the account type is unknown (the frame today)', () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    expect(
      screen.queryByTestId('instagram-composer-format-story')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('instagram-composer-format-photo')).toBeInTheDocument();
    expect(screen.getByTestId('instagram-composer-format-reel')).toBeInTheDocument();
    expect(
      screen.getByTestId('instagram-composer-format-carousel')
    ).toBeInTheDocument();
  });

  it('renders the D5 limit note from the contracts config', () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    const limit = resolvePublishLimit('instagram');
    const note = screen.getByTestId('instagram-composer-limit-note');
    expect(note.textContent).toContain(String(limit?.publishedPosts?.maxCount));
    expect(note.textContent).toContain(String(limit?.publishCalls?.maxCount));
  });

  it('posts a photo now through the destination enqueue, with caption prefill + first comment', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    const { props } = renderComposer(makeFetch(posts));

    await pickLibraryItem(user);
    // The library item's real caption pre-fills the caption field.
    const captionField = screen.getByTestId(
      'instagram-composer-caption-field'
    ) as HTMLTextAreaElement;
    await waitFor(() => expect(captionField.value).toBe('A real caption'));

    await user.type(
      screen.getByTestId('instagram-composer-first-comment-field'),
      'First!'
    );
    const submit = screen.getByTestId('instagram-composer-submit-btn');
    await waitFor(() => expect(submit).not.toBeDisabled());
    await user.click(submit);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      platform: 'instagram',
      destinationId: DESTINATION_ID,
      kind: 'image',
      caption: 'A real caption',
      firstComment: 'First!',
      mediaItemIds: [MEDIA_ID],
      intent: 'now',
    });
    expect(props.onSubmitted).toHaveBeenCalledWith('Posted to My Brand.');
  });

  it('queues through the destination enqueue when a covering slot exists', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    const { props } = renderComposer(makeFetch(posts, { slots: [SLOT] }));

    // Intent defaults to queue once slots load, with the goes-out line.
    await screen.findByTestId('instagram-composer-queue-goes-out');
    await pickLibraryItem(user);
    const submit = screen.getByTestId('instagram-composer-submit-btn');
    await waitFor(() => expect(submit).not.toBeDisabled());
    await user.click(submit);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ platform: 'instagram', intent: 'queue' });
    expect(posts[0]).not.toHaveProperty('scheduledAt');
    expect(posts[0]).not.toHaveProperty('slotId');
    expect(props.onSubmitted).toHaveBeenCalledWith(
      expect.stringContaining('Added to queue')
    );
  });

  it('blocks a PNG photo with the contracts JPEG rule and disables submit', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(
      makeFetch(posts, {
        media: [{ ...MEDIA_ITEM, mimeType: 'image/png', name: 'sunset.png' }],
      })
    );
    await pickLibraryItem(user);
    expect(await screen.findByText(/JPEG/)).toBeInTheDocument();
    expect(screen.getByTestId('instagram-composer-submit-btn')).toBeDisabled();
  });

  it('blocks an over-limit caption (contracts 2,200) and disables submit', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    await pickLibraryItem(user);
    const captionField = screen.getByTestId('instagram-composer-caption-field');
    fireEvent.change(captionField, { target: { value: 'a'.repeat(2201) } });
    await waitFor(() =>
      expect(screen.getByTestId('instagram-composer-submit-btn')).toBeDisabled()
    );
    fireEvent.blur(captionField);
    expect(await screen.findByText(/at most 2200 characters/)).toBeInTheDocument();
  });

  it('shows the no-slots notice and disables queueing when no posting times exist', async () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    expect(
      await screen.findByTestId('instagram-composer-no-slots-notice')
    ).toBeInTheDocument();
    expect(screen.getByTestId('composer-intent-queue')).toBeDisabled();
  });
});
