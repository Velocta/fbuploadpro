import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { countXWeightedCharacters } from '@fbuploadpro/contracts';
import type { DestinationDetail } from '@/lib/api/schemas/connect';
import { XComposer, type XComposerProps } from './x-composer';

const DESTINATION_ID = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';
const SLOT_ID = '33333333-3333-4333-8333-333333333333';
const IMAGE_ID = '44444444-4444-4444-8444-444444444444';
const IMAGE_TWO_ID = '55555555-5555-4555-8555-555555555555';
const BIG_IMAGE_ID = '66666666-6666-4666-8666-666666666666';

const DESTINATION: DestinationDetail = {
  id: DESTINATION_ID,
  externalDestinationId: 'x-user-1',
  name: 'Acme X',
  handle: 'acme',
  avatarUrl: null,
  timezone: 'UTC',
  status: 'active',
  platform: 'x',
  account: { id: ACCOUNT_ID, displayName: 'Acme', platform: 'x', status: 'active' },
};

const SLOTS_RESPONSE = {
  destinationId: DESTINATION_ID,
  timezone: 'UTC',
  slots: [{ id: SLOT_ID, destinationId: DESTINATION_ID, kind: [], timeOfDay: '09:00', isActive: true }],
};

function mediaItem(id: string, name: string, fileSize: number) {
  return {
    id,
    userId: ACCOUNT_ID,
    folderId: null,
    name,
    fileSize,
    mimeType: 'image/png',
    mediaType: 'image',
    storageKey: `media/${id}.png`,
    url: `https://cdn.example/${id}.png`,
    thumbnailKey: null,
    thumbnailUrl: null,
    durationSeconds: null,
    aspectRatio: '1:1',
    captionText: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

const MEDIA_RESPONSE = {
  items: [
    mediaItem(IMAGE_ID, 'chart.png', 1024),
    mediaItem(IMAGE_TWO_ID, 'photo.png', 2048),
    mediaItem(BIG_IMAGE_ID, 'huge.png', 6 * 1024 * 1024),
  ],
  total: 3,
  limit: 50,
  offset: 0,
  nextCursor: null,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface FetchOptions {
  slots?: unknown;
  postStatus?: number;
  postBody?: unknown;
}

function makeFetch(posts: Array<Record<string, unknown>>, options: FetchOptions = {}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/publishing/destination-queue') && init?.method === 'POST') {
      posts.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      if (options.postStatus && options.postStatus >= 400) {
        return jsonResponse(options.postBody ?? { error: { message: 'Nope.' } }, options.postStatus);
      }
      return jsonResponse(
        {
          id: '77777777-7777-4777-8777-777777777777',
          workspaceId: '88888888-8888-4888-8888-888888888888',
          destinationId: DESTINATION_ID,
          platform: 'x',
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
    if (url.includes('/posting-slots')) {
      return jsonResponse(options.slots ?? SLOTS_RESPONSE);
    }
    if (url.includes('/media')) {
      return jsonResponse(MEDIA_RESPONSE);
    }
    return jsonResponse({});
  });
}

function renderComposer(
  fetchMock: ReturnType<typeof vi.fn>,
  props: Partial<XComposerProps> = {}
) {
  vi.stubGlobal('fetch', fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  const fullProps: XComposerProps = {
    subdomain: 'acme',
    destination: DESTINATION,
    ...props,
  };
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <XComposer {...fullProps} />
    </QueryClientProvider>
  );
  return { ...utils, props: fullProps };
}

async function pickLibraryImage(id: string) {
  const user = userEvent.setup();
  await user.click(screen.getByTestId('x-composer-choose-library-btn'));
  await user.click(await screen.findByTestId(`x-composer-library-pick-${id}`));
}

describe('XComposer (spec 132 §4.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the destination context and the contracts-derived limit note', async () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    expect(screen.getByTestId('x-composer').tagName).toBe('SECTION');
    expect(screen.getAllByText('Acme X').length).toBeGreaterThan(0);
    expect(screen.getByTestId('x-composer-limit-note')).toHaveTextContent(
      "This account's limit on X is 100 posts per 15 minutes."
    );
    expect(screen.getByTestId('x-composer-limit-note')).toHaveTextContent('never fail');
  });

  it('counts weighted characters via the contracts counter (links count as 23)', () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    const text = 'see https://example.com/some/really/long/path/here ok';
    fireEvent.change(screen.getByTestId('x-composer-text-field'), { target: { value: text } });
    const weighted = countXWeightedCharacters(text);
    expect(weighted).toBeLessThan(text.length);
    expect(screen.getByTestId('x-composer-text-count')).toHaveTextContent(`${weighted} / 280`);
  });

  it('blocks submit when the weighted count is over 280', () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    fireEvent.change(screen.getByTestId('x-composer-text-field'), {
      target: { value: 'a'.repeat(281) },
    });
    expect(screen.getByTestId('x-composer-text-count')).toHaveTextContent('281 / 280');
    expect(screen.getByTestId('x-composer-submit-btn')).toBeDisabled();
  });

  it('queues by default with the goes-out line from the destination slots', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    const onSubmitted = vi.fn();
    renderComposer(makeFetch(posts), { onSubmitted });

    expect(await screen.findByTestId('x-composer-queue-line')).toHaveTextContent(
      'Goes out at the next posting time:'
    );
    await user.type(screen.getByTestId('x-composer-text-field'), 'Queued hello');
    const submit = screen.getByTestId('x-composer-submit-btn');
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      platform: 'x',
      destinationId: DESTINATION_ID,
      kind: 'text',
      caption: 'Queued hello',
      mediaItemIds: [],
      intent: 'queue',
      platformOptions: { replySettings: 'everyone' },
    });
    expect(posts[0]?.scheduledAt).toBeUndefined();
    expect(
      within(screen.getByTestId('x-composer-success')).getByText(/Added to queue — goes out/)
    ).toBeVisible();
  });

  it('posts now with the quote id when one is pasted', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    await screen.findByTestId('x-composer-queue-line');

    await user.click(screen.getByTestId('composer-intent-now'));
    await user.type(screen.getByTestId('x-composer-text-field'), 'Now post');
    await user.type(screen.getByTestId('x-composer-quote-field'), '1234567890');
    const submit = screen.getByTestId('x-composer-submit-btn');
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      intent: 'now',
      platformOptions: { replySettings: 'everyone', quoteTweetId: '1234567890' },
    });
    expect(
      within(screen.getByTestId('x-composer-success')).getByText('Posted to Acme X.')
    ).toBeVisible();
  });

  it('schedules with an ISO instant, and blocks a past time', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    await screen.findByTestId('x-composer-queue-line');

    await user.click(screen.getByTestId('composer-intent-schedule'));
    const input = screen.getByTestId('x-composer-schedule-input');
    fireEvent.change(input, { target: { value: '2020-01-01T10:00' } });
    expect(await screen.findByTestId('x-composer-schedule-past')).toHaveTextContent(
      'Pick a time in the future.'
    );
    await user.type(screen.getByTestId('x-composer-text-field'), 'Scheduled post');
    expect(screen.getByTestId('x-composer-submit-btn')).toBeDisabled();

    fireEvent.change(input, { target: { value: '2027-06-01T10:00' } });
    const submit = screen.getByTestId('x-composer-submit-btn');
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ intent: 'scheduled', scheduledAt: '2027-06-01T10:00:00.000Z' });
  });

  it('falls back to Post now and disables Queue when the destination has no posting times', async () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts, { slots: { destinationId: DESTINATION_ID, timezone: 'UTC', slots: [] } }));
    expect(await screen.findByTestId('x-composer-now-note')).toBeVisible();
    expect(screen.getByTestId('composer-intent-queue')).toBeDisabled();
  });

  it('shows the no-covering-slot notice and blocks queue submit for an uncovered kind', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(
      makeFetch(posts, {
        slots: {
          destinationId: DESTINATION_ID,
          timezone: 'UTC',
          slots: [
            { id: SLOT_ID, destinationId: DESTINATION_ID, kind: ['video'], timeOfDay: '09:00', isActive: true },
          ],
        },
      })
    );
    expect(await screen.findByTestId('x-composer-queue-no-covering')).toHaveTextContent(
      'No posting time covers this kind of post yet.'
    );
    await user.type(screen.getByTestId('x-composer-text-field'), 'Text post');
    expect(screen.getByTestId('x-composer-submit-btn')).toBeDisabled();
  });

  it('attaches one image, sends alt text, and blocks a second attachment with the cap notice', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    await screen.findByTestId('x-composer-queue-line');

    await pickLibraryImage(IMAGE_ID);
    expect(screen.getByTestId('x-composer-selected-media')).toBeVisible();

    // Second attachment: blocked with the reason, the first item stays.
    await user.click(screen.getByTestId('x-composer-choose-library-btn'));
    await user.click(await screen.findByTestId(`x-composer-library-pick-${IMAGE_TWO_ID}`));
    expect(await screen.findByTestId('x-composer-media-cap-notice')).toHaveTextContent(
      'Posts on X take 1 media file.'
    );
    expect(screen.getByLabelText('Remove chart.png')).toBeVisible();

    await user.type(screen.getByTestId('x-composer-alt-text-field'), 'A chart');
    await user.click(screen.getByTestId('composer-intent-now'));
    const submit = screen.getByTestId('x-composer-submit-btn');
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      kind: 'image',
      mediaItemIds: [IMAGE_ID],
      platformOptions: { replySettings: 'everyone', altText: 'A chart' },
    });
  });

  it('flags an oversize image with the contracts message and blocks submit', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    await screen.findByTestId('x-composer-queue-line');

    await pickLibraryImage(BIG_IMAGE_ID);
    expect(await screen.findByTestId('x-composer-media-error')).toHaveTextContent(
      'Images can be at most 5 MB on X.'
    );
    await user.click(screen.getByTestId('composer-intent-now'));
    expect(screen.getByTestId('x-composer-submit-btn')).toBeDisabled();
    expect(posts).toHaveLength(0);
  });

  it('enforces poll XOR media visibly in both directions', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    await screen.findByTestId('x-composer-queue-line');

    // Media first: adding a poll is blocked with the reason, media stays.
    await pickLibraryImage(IMAGE_ID);
    await user.click(screen.getByTestId('x-composer-add-poll-btn'));
    expect(await screen.findByTestId('x-composer-poll-blocked-notice')).toHaveTextContent(
      'Polls cannot be combined with media on X.'
    );
    expect(screen.queryByTestId('x-composer-poll-option-0')).toBeNull();
    expect(screen.getByTestId('x-composer-selected-media')).toBeVisible();

    // Poll first: attaching is blocked with the reason, the poll stays.
    await user.click(screen.getByTestId('x-composer-remove-media'));
    await user.click(screen.getByTestId('x-composer-add-poll-btn'));
    expect(await screen.findByTestId('x-composer-poll-option-0')).toBeVisible();
    expect(screen.getByTestId('x-composer-media-poll-notice')).toHaveTextContent(
      "polls and media can't be combined on X"
    );
    expect(screen.getByTestId('x-composer-choose-library-btn')).toBeDisabled();
  });

  it('submits a poll with trimmed options and the chosen duration', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts));
    await screen.findByTestId('x-composer-queue-line');

    await user.click(screen.getByTestId('x-composer-add-poll-btn'));
    await user.type(screen.getByTestId('x-composer-poll-option-0'), 'Yes');
    await user.type(screen.getByTestId('x-composer-poll-option-1'), 'No');
    await user.type(screen.getByTestId('x-composer-text-field'), 'Best option?');
    await user.click(screen.getByTestId('composer-intent-now'));
    const submit = screen.getByTestId('x-composer-submit-btn');
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      kind: 'text',
      mediaItemIds: [],
      platformOptions: {
        replySettings: 'everyone',
        poll: { options: ['Yes', 'No'], durationMinutes: 1440 },
      },
    });
  });

  it('surfaces a server error in the submit section and keeps the typed text', async () => {
    const user = userEvent.setup();
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(
      makeFetch(posts, { postStatus: 400, postBody: { error: 'SLOT_TAKEN', message: 'That slot is taken.' } })
    );
    await screen.findByTestId('x-composer-queue-line');
    await user.type(screen.getByTestId('x-composer-text-field'), 'Will fail');
    await user.click(screen.getByTestId('composer-intent-now'));
    await user.click(screen.getByTestId('x-composer-submit-btn'));
    expect(await screen.findByTestId('x-composer-submit-error')).toHaveTextContent('That slot is taken.');
    expect(screen.getByTestId('x-composer-text-field')).toHaveValue('Will fail');
  });

  it('renders the not-connected state with no form when the destination is expired', () => {
    const posts: Array<Record<string, unknown>> = [];
    renderComposer(makeFetch(posts), {
      destination: { ...DESTINATION, status: 'expired' },
    });
    expect(screen.getByTestId('x-composer-not-connected')).toBeVisible();
    expect(screen.getByText('Session expired — reconnect to keep posting')).toBeVisible();
    expect(screen.queryByTestId('x-composer-text-field')).toBeNull();
    expect(screen.queryByTestId('x-composer-submit-btn')).toBeNull();
  });
});
