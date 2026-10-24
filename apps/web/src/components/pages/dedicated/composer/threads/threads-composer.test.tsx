import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { resolvePublishLimit } from '@fbuploadpro/contracts';
import { ThreadsComposer, type ThreadsComposerProps } from './threads-composer';

const DESTINATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const IMAGE_ID = '11111111-1111-4111-8111-111111111111';
const VIDEO_ID = '22222222-2222-4222-8222-222222222222';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const baseMedia = {
  userId: '99999999-9999-4999-8999-999999999999',
  folderId: null,
  fileSize: 1024,
  storageKey: 'e2e/item',
  thumbnailKey: null,
  thumbnailUrl: null,
  aspectRatio: '1:1',
  captionText: null,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
};

const IMAGE_ITEM = {
  ...baseMedia,
  id: IMAGE_ID,
  name: 'sunset.jpg',
  mimeType: 'image/jpeg',
  mediaType: 'image',
  url: 'https://storage.e2e.invalid/sunset.jpg',
  durationSeconds: null,
  width: 1080,
  height: 1080,
};

const VIDEO_ITEM = {
  ...baseMedia,
  id: VIDEO_ID,
  name: 'clip.mp4',
  mimeType: 'video/mp4',
  mediaType: 'video',
  url: 'https://storage.e2e.invalid/clip.mp4',
  durationSeconds: 60,
  width: 1080,
  height: 1920,
};

function makeFetch(posts: Array<Record<string, unknown>>) {
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
          platform: 'threads',
          kind: body.kind,
          platformFormat: null,
          status: 'queued',
          scheduledTime: '2026-12-01T09:00:00.000Z',
          slotId: null,
          createdAt: '2026-10-24T00:00:00.000Z',
        },
        201
      );
    }
    if (url.includes('/posting-slots')) {
      return jsonResponse({ destinationId: DESTINATION_ID, timezone: 'UTC', slots: [] });
    }
    if (url.includes('/media')) {
      const items = [IMAGE_ITEM, VIDEO_ITEM];
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

function renderComposer(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  const props: ThreadsComposerProps = {
    subdomain: 'acme',
    destination: {
      id: DESTINATION_ID,
      name: 'My Brand',
      timezone: 'UTC',
      status: 'active',
    },
    onClose: vi.fn(),
    onSubmitted: vi.fn(),
  };
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ThreadsComposer {...props} />
    </QueryClientProvider>
  );
  return { ...utils, props };
}

describe('ThreadsComposer (spec 132 PR-C4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers the long-text attachment field (spec 124 verified it live — §4.2 gate)', () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    expect(
      screen.getByTestId('threads-composer-text-attachment-field')
    ).toBeInTheDocument();
  });

  it('renders the D5 limit note from the contracts config', () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    const limit = resolvePublishLimit('threads');
    const note = screen.getByTestId('threads-composer-limit-note');
    expect(note.textContent).toContain(String(limit?.publishedPosts?.maxCount));
  });

  it('posts a text post through the destination enqueue with topic tag + reply control', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    const { props } = renderComposer(makeFetch(posts));

    await user.type(screen.getByTestId('threads-composer-text-field'), 'Hello Threads');
    await user.type(
      screen.getByTestId('threads-composer-topic-tag-field'),
      'Photography'
    );
    const submit = screen.getByTestId('threads-composer-submit-btn');
    await waitFor(() => expect(submit).not.toBeDisabled());
    await user.click(submit);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      platform: 'threads',
      destinationId: DESTINATION_ID,
      kind: 'text',
      caption: 'Hello Threads',
      mediaItemIds: [],
      intent: 'now',
      platformOptions: { replyControl: 'everyone', topicTag: 'Photography' },
    });
    expect(props.onSubmitted).toHaveBeenCalledWith('Posted to My Brand.');
  });

  it('counts text by UTF-8 weight and blocks past 500 (emoji count for more)', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    const field = screen.getByTestId('threads-composer-text-field');
    fireEvent.change(field, { target: { value: '😀'.repeat(126) } });
    expect(screen.getByTestId('threads-composer-text-count')).toHaveTextContent(
      '504 / 500'
    );
    await waitFor(() =>
      expect(screen.getByTestId('threads-composer-submit-btn')).toBeDisabled()
    );
    fireEvent.blur(field);
    expect(await screen.findByText(/at most 500 characters/)).toBeInTheDocument();
    expect(user).toBeDefined();
  });

  it('blocks a text attachment combined with a link attachment (schema refinement)', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    await user.type(screen.getByTestId('threads-composer-text-field'), 'Hello');
    await user.type(
      screen.getByTestId('threads-composer-text-attachment-field'),
      'A long piece of writing.'
    );
    await user.type(
      screen.getByTestId('threads-composer-link-attachment-field'),
      'https://example.com'
    );
    await waitFor(() =>
      expect(screen.getByTestId('threads-composer-submit-btn')).toBeDisabled()
    );
    fireEvent.blur(screen.getByTestId('threads-composer-text-attachment-field'));
    expect(
      await screen.findByText(
        /long-text attachment or a link attachment, not both/
      )
    ).toBeInTheDocument();
  });

  it('publishes two picked items as a carousel with ordered carouselItems', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));

    await user.click(screen.getByTestId('threads-composer-open-library-btn'));
    await user.click(
      await screen.findByTestId(`threads-composer-library-item-${IMAGE_ID}`)
    );
    await user.click(screen.getByTestId(`threads-composer-library-item-${VIDEO_ID}`));
    await user.click(screen.getByTestId('threads-composer-library-done-btn'));
    await user.type(screen.getByTestId('threads-composer-text-field'), 'Swipe through');

    const submit = screen.getByTestId('threads-composer-submit-btn');
    await waitFor(() => expect(submit).not.toBeDisabled());
    await user.click(submit);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      platform: 'threads',
      kind: 'carousel',
      caption: 'Swipe through',
      mediaItemIds: [IMAGE_ID],
    });
    const options = posts[0]?.platformOptions as {
      carouselItems?: Array<Record<string, unknown>>;
    };
    expect(options.carouselItems).toHaveLength(2);
    expect(options.carouselItems?.[0]).toMatchObject({ mediaType: 'image' });
    expect(options.carouselItems?.[1]).toMatchObject({ mediaType: 'video' });
  });
});
