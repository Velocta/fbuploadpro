import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PostComposer, type PostComposerProps } from './post-composer';
import type { PageSlotSummary } from '../tab-dashboard';

const SLOTS: PageSlotSummary[] = [
  { id: 'slot-1', slotTime: '09:00', timezone: 'UTC', isActive: true },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderComposer(
  fetchMock: ReturnType<typeof vi.fn>,
  props: Partial<PostComposerProps> = {}
) {
  vi.stubGlobal('fetch', fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  const fullProps: PostComposerProps = {
    pageId: '22222222-2222-4222-8222-222222222222',
    subdomain: 'acme',
    slots: SLOTS,
    onClose: vi.fn(),
    onSubmitted: vi.fn(),
    ...props,
  };
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <PostComposer {...fullProps} />
    </QueryClientProvider>
  );
  return { ...utils, props: fullProps };
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

/** Page-read + destination-resolution handlers; enqueue POSTs are recorded into `posts`. */
function makeFetch(page: Record<string, unknown>, posts: Array<Record<string, unknown>>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/publishing/destination-queue') && init?.method === 'POST') {
      posts.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return jsonResponse(
        {
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
        },
        201
      );
    }
    if (url.includes('/accounts/social')) {
      return jsonResponse(SOCIAL_LIST);
    }
    if (url.includes('/pages/')) {
      return jsonResponse({ page, queueCounts: { queued: 0, publishing: 0, published: 0, failed: 0 } });
    }
    return jsonResponse({});
  });
}

const ACTIVE_PAGE = { pageName: 'Acme Page', fbPageId: 'fb-page-1', status: 'active' };

describe('PostComposer — full-page rebuild (spec 132 PR-C1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders as a full page, not an overlay: no backdrop, destination context named', async () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(ACTIVE_PAGE, posts));
    expect(screen.queryByTestId('post-composer-backdrop')).toBeNull();
    expect(screen.getByTestId('post-composer').tagName).toBe('SECTION');
    expect(screen.getByRole('heading', { name: 'Create post' })).toBeVisible();
    // Destination context (UX R1): the Page name arrives from the page read
    // (it appears in the header context and again in the preview pane).
    expect((await screen.findAllByText('Acme Page')).length).toBeGreaterThan(0);
    expect(screen.getByText('Facebook Page')).toBeVisible();
  });

  it('opens empty with the queue intent and a disabled submit (no dangerous defaults)', () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(ACTIVE_PAGE, posts));
    expect(screen.getByTestId('composer-media-empty')).toBeVisible();
    expect(screen.getByTestId('composer-caption-field')).toHaveValue('');
    expect(screen.getByTestId('submit-post-composer-btn')).toBeDisabled();
    expect(screen.getByTestId('composer-queue-goes-out')).toBeVisible();
  });

  it('creates a text post through the typed client and reports the queue line', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    const { props } = renderComposer(makeFetch(ACTIVE_PAGE, posts));

    await user.click(screen.getByTestId('composer-format-text'));
    await user.type(screen.getByTestId('composer-caption-field'), 'Hello from the test');
    const submit = screen.getByTestId('submit-post-composer-btn');
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() => expect(props.onSubmitted).toHaveBeenCalledTimes(1));
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      caption: 'Hello from the test',
      platform: 'facebook',
      destinationId: DESTINATION_ID,
      kind: 'text',
      intent: 'queue',
    });
    expect(posts[0]).not.toHaveProperty('postFormat');
    expect(vi.mocked(props.onSubmitted).mock.calls[0]?.[0]).toContain('Added to queue');
  });

  it('shows the D5 cooldown banner only when the Page is rate-limited, with no invented time', async () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch({ pageName: 'Acme Page', status: 'fb_rate_limited' }, posts));
    const notice = await screen.findByTestId('composer-cooldown-notice');
    expect(notice).toBeVisible();
    expect(notice.textContent).toContain('short cooldown');
    expect(notice.textContent).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('shows no cooldown banner for an active Page', async () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(ACTIVE_PAGE, posts));
    expect((await screen.findAllByText('Acme Page')).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('composer-cooldown-notice')).toBeNull();
  });

  it('link validation is visible on blur and blocks submit (form standard)', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(ACTIVE_PAGE, posts));

    await user.click(screen.getByTestId('composer-format-text'));
    await user.type(screen.getByTestId('composer-caption-field'), 'Caption here');
    const link = screen.getByTestId('composer-link-field');
    await user.type(link, 'not-a-link');
    await user.tab();

    expect(await screen.findByTestId('composer-link-error')).toHaveTextContent(
      "That doesn't look like a valid link."
    );
    expect(link).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('submit-post-composer-btn')).toBeDisabled();
  });
});
