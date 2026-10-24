import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BulkAddModal, type BulkAddModalProps } from './bulk-add-modal';
import type { PageSlotSummary } from '../tab-dashboard';

const PAGE_ID = '22222222-2222-4222-8222-222222222222';
const IMG_1 = '11111111-1111-4111-8111-111111111111';
const IMG_2 = '33333333-3333-4333-8333-333333333333';
const VID_1 = '44444444-4444-4444-8444-444444444444';

const SLOTS: PageSlotSummary[] = [
  { id: 'slot-1', slotTime: '09:00', timezone: 'UTC', isActive: true },
];

function mediaItem(id: string, name: string, mediaType: 'image' | 'video', captionText: string | null) {
  return {
    id,
    userId: '99999999-9999-4999-8999-999999999999',
    folderId: null,
    name,
    fileSize: 100,
    mimeType: mediaType === 'image' ? 'image/png' : 'video/mp4',
    mediaType,
    storageKey: `e2e/${name}`,
    url: `https://example.com/${name}`,
    thumbnailKey: null,
    thumbnailUrl: null,
    durationSeconds: null,
    aspectRatio: '1:1',
    captionText,
    width: 100,
    height: 100,
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
  };
}

const LIBRARY = [
  mediaItem(IMG_1, 'sunset.png', 'image', 'Library caption one'),
  mediaItem(IMG_2, 'beach.png', 'image', null),
  mediaItem(VID_1, 'clip.mp4', 'video', null),
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const DESTINATION_ID = '55555555-5555-4555-8555-555555555555';

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
          externalDestinationId: 'fb-page-bulk',
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

interface FetchBehaviour {
  bulkStatus?: number;
  bulkBody?: unknown;
  /** Fail the Nth (0-based) per-item enqueue with this message. */
  failItemIndex?: number;
  failMessage?: string;
  mediaStatus?: number;
}

function makeFetch(behaviour: FetchBehaviour, bulkPosts: Array<Record<string, unknown>>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/accounts/social')) {
      return jsonResponse(SOCIAL_LIST);
    }
    if (url.includes('/pages/')) {
      return jsonResponse({ page: { fbPageId: 'fb-page-bulk' } });
    }
    if (url.includes('/publishing/destination-queue') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      const itemIndex = bulkPosts.length;
      bulkPosts.push(body);
      if (behaviour.bulkBody !== undefined) {
        return jsonResponse(behaviour.bulkBody, behaviour.bulkStatus ?? 200);
      }
      if (behaviour.failItemIndex === itemIndex) {
        return jsonResponse({ message: behaviour.failMessage ?? 'Failed' }, 400);
      }
      return jsonResponse(
        {
          id: '77777777-7777-4777-8777-777777777777',
          workspaceId: '88888888-8888-4888-8888-888888888888',
          destinationId: DESTINATION_ID,
          platform: 'facebook',
          kind: body.kind,
          platformFormat: body.platformFormat ?? null,
          status: 'queued',
          scheduledTime: body.scheduledAt ?? '2026-12-01T09:00:00.000Z',
          slotId: null,
          createdAt: '2026-10-24T00:00:00.000Z',
        },
        201
      );
    }
    if (url.includes('/media')) {
      if (behaviour.mediaStatus && behaviour.mediaStatus !== 200) {
        return jsonResponse({ message: 'Media exploded' }, behaviour.mediaStatus);
      }
      return jsonResponse({
        items: LIBRARY,
        total: LIBRARY.length,
        limit: 200,
        offset: 0,
        nextCursor: null,
      });
    }
    return jsonResponse({});
  });
}

function renderBulk(
  fetchMock: ReturnType<typeof vi.fn>,
  props: Partial<BulkAddModalProps> = {}
) {
  vi.stubGlobal('fetch', fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  const fullProps: BulkAddModalProps = {
    pageId: PAGE_ID,
    subdomain: 'acme',
    slots: SLOTS,
    isOpen: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    ...props,
  };
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <BulkAddModal {...fullProps} />
    </QueryClientProvider>
  );
  return { ...utils, props: fullProps };
}

/** Step 1: open the library picker and pick the given items. */
async function pickMedia(user: ReturnType<typeof userEvent.setup>, ids: string[]) {
  await user.click(screen.getByTestId('bulk-choose-library-btn'));
  for (const id of ids) {
    await user.click(await screen.findByTestId(`bulk-library-pick-${id}`));
  }
}

async function toReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('bulk-continue-btn'));
  await screen.findByTestId('bulk-step-details');
  await user.click(screen.getByTestId('bulk-continue-btn'));
  await screen.findByTestId('bulk-step-review');
}

describe('BulkAddModal — full-page rebuild (spec 132 PR-C2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders as a full page, not an overlay: section, named stepper steps, no Post now in bulk', async () => {
    const bulkPosts: Array<Record<string, unknown>> = [];
    renderBulk(makeFetch({}, bulkPosts));
    const root = screen.getByTestId('bulk-add-modal');
    expect(root.tagName).toBe('SECTION');
    expect(screen.getByRole('heading', { name: 'Bulk add' })).toBeVisible();
    expect(screen.getByTestId('bulk-step-1')).toHaveTextContent('1. Choose media');
    expect(screen.getByTestId('bulk-step-2')).toHaveTextContent('2. Details');
    expect(screen.getByTestId('bulk-step-3')).toHaveTextContent('3. Review');
    expect(screen.queryByText('Post now')).toBeNull();
    // The 150 cap is stated in the UI (§5.12).
    expect(screen.getByTestId('bulk-selected-counter')).toHaveTextContent('Up to 150 posts per run.');
  });

  it('walks media → details → review and submits per-row captions to the unified enqueue', async () => {
    const user = userEvent.setup();
    const bulkPosts: Array<Record<string, unknown>> = [];
    const { props } = renderBulk(makeFetch({}, bulkPosts));

    await pickMedia(user, [IMG_1, IMG_2]);
    expect(screen.getByTestId('bulk-selected-counter')).toHaveTextContent('2 selected');

    await toReview(user);
    // Caption precedence (§5.14): the real library caption pre-fills row 1;
    // row 2 (no library caption, no shared caption) starts empty.
    expect(screen.getByTestId(`bulk-row-caption-${IMG_1}`)).toHaveValue('Library caption one');
    expect(screen.getByTestId(`bulk-row-caption-${IMG_2}`)).toHaveValue('');
    await user.type(screen.getByTestId(`bulk-row-caption-${IMG_2}`), 'Beach day');

    await user.click(screen.getByTestId('bulk-submit-btn'));
    const summary = await screen.findByTestId('bulk-summary');
    expect(summary).toHaveTextContent('2 added to queue, 0 failed');

    // One unified destination enqueue per row (the unified backend has
    // no bulk endpoint), each carrying its row's caption + media and
    // the review step's scheduled time as the scheduled intent.
    expect(bulkPosts).toHaveLength(2);
    expect(bulkPosts[0]).toMatchObject({
      platform: 'facebook',
      destinationId: DESTINATION_ID,
      kind: 'image',
      caption: 'Library caption one',
      mediaItemIds: [IMG_1],
      intent: 'scheduled',
    });
    expect(bulkPosts[1]).toMatchObject({
      caption: 'Beach day',
      mediaItemIds: [IMG_2],
    });
    expect(bulkPosts[0]).not.toHaveProperty('pageId');
    expect(String(bulkPosts[0]?.scheduledAt)).toBeTruthy();

    // Completion fires from the summary's Done — not at submit time — so
    // the summary can actually be read (the legacy overlay closed first).
    expect(props.onComplete).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('bulk-summary-done-btn'));
    expect(props.onComplete).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('reports partial failure per row in the end summary (§5.15)', async () => {
    const user = userEvent.setup();
    const bulkPosts: Array<Record<string, unknown>> = [];
    renderBulk(
      makeFetch(
        { failItemIndex: 1, failMessage: 'That file could not be added.' },
        bulkPosts
      )
    );
    await pickMedia(user, [IMG_1, IMG_2]);
    await toReview(user);
    await user.click(screen.getByTestId('bulk-submit-btn'));
    const summary = await screen.findByTestId('bulk-summary');
    expect(summary).toHaveTextContent('1 added to queue, 1 failed');
    expect(screen.getByTestId(`bulk-result-error-${IMG_2}`)).toHaveTextContent(
      'That file could not be added.'
    );
  });

  it('turns a refused bulk request into per-row failures carrying the server message', async () => {
    const user = userEvent.setup();
    const bulkPosts: Array<Record<string, unknown>> = [];
    renderBulk(makeFetch({ bulkStatus: 500, bulkBody: { message: 'Queue is paused.' } }, bulkPosts));
    await pickMedia(user, [IMG_1]);
    await toReview(user);
    await user.click(screen.getByTestId('bulk-submit-btn'));
    const summary = await screen.findByTestId('bulk-summary');
    expect(summary).toHaveTextContent('0 added to queue, 1 failed');
    expect(screen.getByTestId(`bulk-result-error-${IMG_1}`)).toHaveTextContent('Queue is paused.');
  });

  it('lists non-matching assets as excluded with the reason and a switch-format option (§5.13)', async () => {
    const user = userEvent.setup();
    const bulkPosts: Array<Record<string, unknown>> = [];
    renderBulk(makeFetch({}, bulkPosts));
    await pickMedia(user, [IMG_1, VID_1]);
    await user.click(screen.getByTestId('bulk-continue-btn'));
    await screen.findByTestId('bulk-step-details');
    // Default format is Photo: the video is excluded with its reason.
    expect(screen.getByTestId('bulk-excluded-summary')).toHaveTextContent(
      "1 video excluded — Photo needs images. 1 file won't be added."
    );
    // Switching to the suggested format makes the video eligible — with a
    // mixed selection the image is now the excluded one instead.
    await user.click(screen.getByTestId('bulk-switch-format-btn'));
    await waitFor(() =>
      expect(screen.getByTestId('bulk-excluded-summary')).toHaveTextContent(
        "1 image excluded — Video needs videos. 1 file won't be added."
      )
    );
  });

  it('surfaces a media-library load failure in the picker instead of failing silently', async () => {
    const user = userEvent.setup();
    const bulkPosts: Array<Record<string, unknown>> = [];
    renderBulk(makeFetch({ mediaStatus: 500 }, bulkPosts));
    await user.click(screen.getByTestId('bulk-choose-library-btn'));
    expect(await screen.findByText("Couldn't load your media. Please try again.")).toBeVisible();
  });

  it('keeps the queue destination by default and shows the successive-slot range (§5.11)', async () => {
    const user = userEvent.setup();
    const bulkPosts: Array<Record<string, unknown>> = [];
    renderBulk(makeFetch({}, bulkPosts));
    await pickMedia(user, [IMG_1, IMG_2]);
    await user.click(screen.getByTestId('bulk-continue-btn'));
    await screen.findByTestId('bulk-step-details');
    expect(screen.getByTestId('bulk-destination-queue')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('bulk-queue-range')).toHaveTextContent('2 posts →');
  });

  it('removing a review row drops it from the submit (§5.14)', async () => {
    const user = userEvent.setup();
    const bulkPosts: Array<Record<string, unknown>> = [];
    renderBulk(makeFetch({}, bulkPosts));
    await pickMedia(user, [IMG_1, IMG_2]);
    await toReview(user);
    await user.click(screen.getByTestId(`bulk-row-remove-${IMG_2}`));
    expect(screen.getByTestId('bulk-submit-btn')).toHaveTextContent('Add 1 post to queue');
    await user.click(screen.getByTestId('bulk-submit-btn'));
    expect(await screen.findByTestId('bulk-summary')).toHaveTextContent('1 added to queue, 0 failed');
    expect(bulkPosts).toHaveLength(1);
    expect(bulkPosts[0]?.mediaItemIds).toHaveLength(1);
  });
});
