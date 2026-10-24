import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  DestinationQueuePanel,
  DESTINATION_QUEUE_REORDER_SUCCESS_MESSAGE,
} from './destination-queue-panel';
import { toast } from '@/components/shared/ui/toast';
import type { DestinationDetail } from '@/lib/api/schemas/connect';
import type { UnifiedQueueItem } from '@/lib/api/schemas/unified-queue';

/**
 * Behavioural suite for the unified destination queue panel
 * (spec 134 PR-134-3, T29): the unified list read, the failed-retry
 * gate on the destination's own connection state, the per-platform
 * Edit matrix (T27), reorder through the unified item actions, the
 * typed empty states, and delete + Undo through the unified enqueue.
 * The API is stubbed at the fetch boundary, like the Page panel's
 * suite — assertions read real rendered output and the exact requests
 * the panel makes.
 */

vi.mock('@/components/shared/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  Toast: () => null,
  Toaster: () => null,
}));

vi.mock('@/components/pages/dedicated/composer/post-composer', () => ({
  PostComposer: (props: {
    initialPost?: { id: string; destinationId?: string | null; caption?: string | null };
  }) => (
    <div data-testid="composer-stub">
      Editing {props.initialPost?.id} for destination{' '}
      {props.initialPost?.destinationId} — {props.initialPost?.caption}
    </div>
  ),
}));

const DEST_ID = '33333333-3333-4333-8333-333333333333';
const SLOT_ID = '56565656-5656-4565-a656-565656565656';
const ID_A = '00000000-0000-4000-8000-000000000001';
const ID_B = '00000000-0000-4000-8000-000000000002';
const ID_F = '00000000-0000-4000-8000-000000000003';

function destination(overrides: Partial<DestinationDetail> = {}): DestinationDetail {
  return {
    id: DEST_ID,
    externalDestinationId: 'ig-1001',
    name: 'My Brand',
    handle: 'mybrand',
    avatarUrl: null,
    timezone: 'UTC',
    status: 'active',
    platform: 'instagram',
    account: {
      id: 'acct-1',
      displayName: 'Fixture Creator',
      platform: 'instagram',
      status: 'active',
    },
    ...overrides,
  } as DestinationDetail;
}

function unifiedItem(overrides: Partial<UnifiedQueueItem> = {}): UnifiedQueueItem {
  return {
    id: ID_A,
    destinationId: DEST_ID,
    platform: 'instagram',
    kind: 'image',
    platformFormat: null,
    caption: 'First post',
    title: null,
    firstComment: null,
    linkUrl: null,
    mediaItemId: null,
    mediaUrl: null,
    media: null,
    platformOptions: {},
    scheduledTime: '2999-12-01T09:00:00.000Z',
    slotId: SLOT_ID,
    status: 'queued',
    retryCount: 0,
    maxRetries: 3,
    errorDetail: null,
    externalPostId: null,
    publishedAt: null,
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
    ...overrides,
  };
}

const SLOTS_RESPONSE = {
  destinationId: DEST_ID,
  timezone: 'UTC',
  slots: [
    {
      id: SLOT_ID,
      destinationId: DEST_ID,
      kind: ['text', 'image', 'video', 'story', 'carousel'],
      timeOfDay: '09:00:00',
      isActive: true,
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface FetchLog {
  patches: Array<{ id: string; body: Record<string, unknown> }>;
  deletes: string[];
  retries: string[];
  enqueues: Array<Record<string, unknown>>;
  slotPosts: Array<Record<string, unknown>>;
}

function makeFetch(options: {
  items: UnifiedQueueItem[];
  destinationStatus?: string;
  withSlots?: boolean;
}) {
  const log: FetchLog = { patches: [], deletes: [], retries: [], enqueues: [], slotPosts: [] };
  const listResponse = {
    destinationId: DEST_ID,
    platform: 'instagram',
    timezone: 'UTC',
    destinationStatus: options.destinationStatus ?? 'active',
    limit: null,
    items: options.items,
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/publishing/destination-queue') && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      log.enqueues.push(body);
      return jsonResponse(
        {
          id: '00000000-0000-4000-8000-0000000000ff',
          workspaceId: '22222222-2222-4222-8222-222222222222',
          destinationId: DEST_ID,
          platform: 'instagram',
          kind: 'image',
          platformFormat: null,
          status: 'queued',
          scheduledTime: String(body.scheduledAt),
          slotId: null,
          createdAt: '2026-10-20T00:00:00.000Z',
        },
        201
      );
    }
    if (url.includes(`/destinations/${DEST_ID}/queue/`) && url.endsWith('/retry') && method === 'POST') {
      const id = url.split('/queue/')[1]?.replace('/retry', '') ?? '';
      log.retries.push(id);
      const source = options.items.find((i) => i.id === id);
      return jsonResponse({
        ...source,
        status: 'queued',
        scheduledTime: '2999-12-02T09:00:00.000Z',
      });
    }
    if (url.includes(`/destinations/${DEST_ID}/queue/`) && method === 'PATCH') {
      const id = url.split('/queue/')[1] ?? '';
      log.patches.push({ id, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return jsonResponse({});
    }
    if (url.includes(`/destinations/${DEST_ID}/queue/`) && method === 'DELETE') {
      log.deletes.push(url.split('/queue/')[1] ?? '');
      return jsonResponse({ success: true });
    }
    if (url.includes(`/destinations/${DEST_ID}/queue`)) {
      return jsonResponse(listResponse);
    }
    if (url.includes(`/destinations/${DEST_ID}/posting-slots`) && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      log.slotPosts.push(body);
      return jsonResponse(
        {
          id: '00000000-0000-4000-8000-0000000000aa',
          destinationId: DEST_ID,
          kind: ['text', 'image', 'video', 'story', 'carousel'],
          timeOfDay: '08:00:00',
          isActive: true,
        },
        201
      );
    }
    if (url.includes(`/destinations/${DEST_ID}/posting-slots`)) {
      return jsonResponse(
        options.withSlots === false
          ? { destinationId: DEST_ID, timezone: 'UTC', slots: [] }
          : SLOTS_RESPONSE
      );
    }
    if (url.includes('/pages')) {
      return jsonResponse({
        pages: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            facebookAccountId: '44444444-4444-4444-a444-444444444444',
            accountDisplayName: 'Fixture Creator',
            fbPageId: 'fb-2002',
            pageName: 'My Brand Page',
            profilePictureUrl: null,
            category: null,
            status: 'active',
            timezone: 'UTC',
            startingFollowers: 0,
            currentFollowers: 0,
            followersGained: 0,
            followersCount: 0,
            tasks: [],
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-10-01T00:00:00.000Z',
          },
        ],
        total: 1,
      });
    }
    return jsonResponse({});
  });
  return { fetchMock, log };
}

function renderPanel(
  dest: DestinationDetail,
  options: { items: UnifiedQueueItem[]; destinationStatus?: string; withSlots?: boolean }
) {
  const { fetchMock, log } = makeFetch(options);
  vi.stubGlobal('fetch', fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <DestinationQueuePanel subdomain="acme" destination={dest} />
    </QueryClientProvider>
  );
  return { ...utils, log, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('destination queue panel — unified list', () => {
  it('renders the destination items with their times and filter counts', async () => {
    renderPanel(destination(), {
      items: [
        unifiedItem(),
        unifiedItem({
          id: ID_B,
          caption: 'Second post',
          scheduledTime: '2999-12-01T10:00:00.000Z',
          slotId: null,
        }),
      ],
    });
    expect(await screen.findByText('First post')).toBeTruthy();
    expect(screen.getByText('Second post')).toBeTruthy();
    expect(screen.getByTestId(`queue-row-${ID_A}`)).toBeTruthy();
    expect(screen.getByTestId(`queue-row-${ID_B}`)).toBeTruthy();
  });

  it('reorders through the unified item actions, re-pinning the governing slot', async () => {
    const { log } = renderPanel(destination(), {
      items: [
        unifiedItem(),
        unifiedItem({
          id: ID_B,
          caption: 'Second post',
          scheduledTime: '2999-12-02T09:00:00.000Z',
        }),
      ],
    });
    await screen.findByText('First post');
    const rowA = screen.getByTestId(`queue-row-${ID_A}`);
    fireEvent.click(
      within(rowA).getByRole('button', { name: /Move down post/ })
    );
    await waitFor(() => expect(log.patches.length).toBe(2));
    const patchA = log.patches.find((p) => p.id === ID_A);
    const patchB = log.patches.find((p) => p.id === ID_B);
    expect(patchA?.body.scheduledTime).toBe('2999-12-02T09:00:00.000Z');
    expect(patchB?.body.scheduledTime).toBe('2999-12-01T09:00:00.000Z');
    expect(patchA?.body.slotId).toBe(SLOT_ID);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        DESTINATION_QUEUE_REORDER_SUCCESS_MESSAGE
      )
    );
  });
});

describe('destination queue panel — failed posts (spec 134 §3.5)', () => {
  it('maps the stored error to a plain-language platform reason and retries through the unified action', async () => {
    const { log } = renderPanel(destination(), {
      items: [
        unifiedItem({
          id: ID_F,
          status: 'failed',
          errorDetail: 'Graph error: permission forbidden for this destination',
          scheduledTime: '2026-01-01T09:00:00.000Z',
        }),
      ],
    });
    await screen.findByText('First post');
    expect(screen.getByText(/Instagram didn't accept this post\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Retry post/ }));
    await waitFor(() => expect(log.retries).toEqual([ID_F]));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Retrying')
      )
    );
  });

  it('blocks retry with the platform-named reason while the destination is disconnected', async () => {
    const { log } = renderPanel(destination({ status: 'disconnected' }), {
      items: [
        unifiedItem({
          id: ID_F,
          status: 'failed',
          scheduledTime: '2026-01-01T09:00:00.000Z',
        }),
      ],
      destinationStatus: 'disconnected',
    });
    await screen.findByText('First post');
    // The reason renders visibly and as the button's sr-only reason —
    // presence is what matters here, not the node count.
    expect(
      screen.getAllByText('Reconnect your Instagram account to retry.').length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/Your Instagram connection expired before this posted\./)
    ).toBeTruthy();
    const retryButton = screen.getByRole('button', { name: /Retry post/ });
    fireEvent.click(retryButton);
    expect(log.retries).toEqual([]);
  });
});

describe('destination queue panel — Edit matrix (T27)', () => {
  it('disables Edit with the platform reason where no composer exists yet', async () => {
    renderPanel(destination(), { items: [unifiedItem()] });
    await screen.findByText('First post');
    expect(
      screen.getAllByText("Instagram posts can't be edited here yet").length
    ).toBeGreaterThan(0);
  });

  it('mounts the Facebook composer pre-filled with the destination id for a Facebook destination', async () => {
    const fbDestination = destination({
      platform: 'facebook',
      externalDestinationId: 'fb-2002',
      account: {
        id: 'acct-1',
        displayName: 'Fixture Creator',
        platform: 'facebook',
        status: 'active',
      },
    } as Partial<DestinationDetail>);
    renderPanel(fbDestination, {
      items: [unifiedItem({ platform: 'facebook' })],
    });
    await screen.findByText('First post');
    fireEvent.click(screen.getByRole('button', { name: /Edit post/ }));
    const stub = await screen.findByTestId('composer-stub');
    expect(stub.textContent).toContain(DEST_ID);
    expect(stub.textContent).toContain('First post');
  });
});

describe('destination queue panel — delete + undo', () => {
  it('deletes through the unified route and restores through the unified enqueue on Undo', async () => {
    const { log } = renderPanel(destination(), { items: [unifiedItem()] });
    await screen.findByText('First post');
    fireEvent.click(screen.getByRole('button', { name: /Delete post/ }));
    await waitFor(() => expect(log.deletes).toEqual([ID_A]));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const successCall = vi
      .mocked(toast.success)
      .mock.calls.find((call) => call[0] === 'Post deleted.');
    const action = (
      successCall?.[1] as { action?: { onClick: () => void } } | undefined
    )?.action;
    expect(action).toBeTruthy();
    action?.onClick();
    await waitFor(() => expect(log.enqueues.length).toBe(1));
    expect(log.enqueues[0]?.intent).toBe('scheduled');
    expect(log.enqueues[0]?.scheduledAt).toBe('2999-12-01T09:00:00.000Z');
    expect(log.enqueues[0]?.destinationId).toBe(DEST_ID);
  });
});

describe('destination queue panel — typed empty states', () => {
  it('shows the setup-incomplete state with inline add when no posting time exists', async () => {
    const { log } = renderPanel(destination(), { items: [], withSlots: false });
    expect(await screen.findByText('No posting times yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add posting time' }));
    await waitFor(() => expect(log.slotPosts.length).toBe(1));
    expect(log.slotPosts[0]?.timeOfDay).toBe('09:00');
  });

  it('shows the first-use state when a posting time exists but nothing is queued', async () => {
    renderPanel(destination(), { items: [] });
    expect(await screen.findByText('Nothing here yet.')).toBeTruthy();
  });

  it('shows the queue-clear state when only cancelled items remain', async () => {
    renderPanel(destination(), {
      items: [unifiedItem({ status: 'cancelled' })],
    });
    expect(await screen.findByText('All caught up.')).toBeTruthy();
  });
});
