/** @vitest-environment jsdom */
/**
 * Media data-layer behavioural tests (spec 133 PR-133-1, T9).
 *
 * Pins the data module's contract: request dedupe across consumers,
 * named invalidation after a folder mutation, the caption mutation's
 * optimistic update + rollback, and the duplicate check's single
 * typed-client call path. The API is served by a fetch stub keyed on
 * URL; no component presentation is asserted here.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/data/query-client';
import {
  checkMediaDuplicates,
  useCreateFolder,
  useMediaFolders,
  useMediaItems,
  useUpdateItemCaption,
} from '@/components/media/media-data';

const ITEM = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  userId: '00000000-0000-4000-8000-000000000001',
  folderId: null,
  name: 'Reel.mp4',
  fileSize: 1024,
  mimeType: 'video/mp4',
  mediaType: 'video',
  storageKey: 'users/u1/media/m1.mp4',
  url: 'https://media.fbuploadpro.com/users/u1/media/m1.mp4',
  thumbnailKey: null,
  thumbnailUrl: null,
  durationSeconds: 12,
  aspectRatio: '9:16',
  captionText: 'original caption',
  createdAt: '2026-10-10T12:00:00.000Z',
  updatedAt: '2026-10-10T12:00:00.000Z',
};

const FOLDER = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '00000000-0000-4000-8000-000000000001',
  parentId: null,
  name: 'Campaign A',
  itemCount: 1,
  subfolderCount: 0,
  createdAt: '2026-10-10T10:00:00.000Z',
  updatedAt: '2026-10-10T10:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

interface FetchCalls {
  list: number;
  folders: number;
  posts: Array<{ url: string; body: unknown }>;
  patches: Array<{ url: string; body: unknown }>;
}

/** Release gate for a hanging item PATCH (optimistic-update test). */
let releaseItemPatch: (() => void) | null = null;

function installFetchStub(options: { failItemPatch?: boolean } = {}): FetchCalls {
  const calls: FetchCalls = { list: 0, folders: 0, posts: [], patches: [] };
  releaseItemPatch = null;
  const stub = vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/media/folders') && method === 'GET') {
      calls.folders += 1;
      return jsonResponse({ folders: [FOLDER], unorganizedCount: 1 });
    }
    if (url.includes('/media/folders') && method === 'POST') {
      calls.posts.push({ url, body: JSON.parse(String(init?.body)) as unknown });
      return jsonResponse({ ...FOLDER, id: '22222222-2222-4222-8222-222222222222', name: 'New Folder' }, 201);
    }
    if (/\/media\/[0-9a-f-]+$/.test(url) && method === 'PATCH') {
      calls.patches.push({ url, body: JSON.parse(String(init?.body)) as unknown });
      if (options.failItemPatch) {
        // Hang until the test releases the gate, then fail — this is
        // what makes the optimistic window observable.
        await new Promise<void>((resolve) => {
          releaseItemPatch = resolve;
        });
        return jsonResponse({ error: 'boom' }, 500);
      }
      return jsonResponse({ ...ITEM, captionText: 'updated caption' });
    }
    if (url.includes('/media/check-duplicates') && method === 'POST') {
      calls.posts.push({ url, body: JSON.parse(String(init?.body)) as unknown });
      return jsonResponse({ duplicates: [] });
    }
    if (url.includes('/media?') || url.endsWith('/media')) {
      calls.list += 1;
      return jsonResponse({ items: [ITEM], total: 1, limit: 500, offset: 0, nextCursor: null });
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });
  vi.stubGlobal('fetch', stub);
  return calls;
}

function renderWithClient(client: QueryClient, ui: React.ReactElement) {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function ItemsProbe() {
  const query = useMediaItems('acme');
  return (
    <span data-testid="items">
      {(query.data ?? []).map((i) => `${i.name}:${i.captionText ?? ''}`).join(',')}
    </span>
  );
}

function FoldersProbe() {
  const query = useMediaFolders('acme');
  return <span data-testid="folders">{(query.data ?? []).map((f) => f.name).join(',')}</span>;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('media-data queries', () => {
  it('dedupes: two consumers of the media list produce exactly one request', async () => {
    const calls = installFetchStub();
    const client = createQueryClient('acme');
    renderWithClient(
      client,
      <>
        <ItemsProbe />
        <ItemsProbe />
      </>
    );
    await waitFor(() => {
      expect(screen.getAllByTestId('items')[0]?.textContent).toContain('Reel.mp4');
    });
    expect(calls.list).toBe(1);
  });

  it('maps the list response to contracts items (caption preserved)', async () => {
    installFetchStub();
    const client = createQueryClient('acme');
    renderWithClient(client, <ItemsProbe />);
    await waitFor(() => {
      expect(screen.getByTestId('items').textContent).toBe('Reel.mp4:original caption');
    });
  });
});

describe('media-data mutations', () => {
  it('folder create invalidates folders + list (both refetch)', async () => {
    const calls = installFetchStub();
    const client = createQueryClient('acme');
    let createFolder: ReturnType<typeof useCreateFolder> | null = null;
    function MutationsProbe() {
      createFolder = useCreateFolder('acme');
      return null;
    }
    renderWithClient(
      client,
      <>
        <ItemsProbe />
        <FoldersProbe />
        <MutationsProbe />
      </>
    );
    await waitFor(() => {
      expect(screen.getByTestId('folders').textContent).toBe('Campaign A');
    });
    expect(calls.list).toBe(1);
    expect(calls.folders).toBe(1);

    await act(async () => {
      await createFolder?.mutateAsync({ name: 'New Folder', parentId: null });
    });

    await waitFor(() => {
      expect(calls.list).toBe(2);
      expect(calls.folders).toBe(2);
    });
    expect(calls.posts[0]?.body).toEqual({ name: 'New Folder', parentId: null });
  });

  it('caption update applies optimistically and rolls back on failure', async () => {
    installFetchStub({ failItemPatch: true });
    const client = createQueryClient('acme');
    let updateCaption: ReturnType<typeof useUpdateItemCaption> | null = null;
    function MutationsProbe() {
      updateCaption = useUpdateItemCaption('acme');
      return null;
    }
    renderWithClient(
      client,
      <>
        <ItemsProbe />
        <MutationsProbe />
      </>
    );
    await waitFor(() => {
      expect(screen.getByTestId('items').textContent).toBe('Reel.mp4:original caption');
    });

    await act(async () => {
      updateCaption?.mutate({ mediaId: ITEM.id, captionText: 'optimistic' });
    });
    // Optimistic value is visible while the PATCH is still in flight.
    await waitFor(() => {
      expect(screen.getByTestId('items').textContent).toBe('Reel.mp4:optimistic');
    });
    // Release the gate: the PATCH fails and the cache rolls back.
    await act(async () => {
      releaseItemPatch?.();
    });
    await waitFor(() => {
      expect(screen.getByTestId('items').textContent).toBe('Reel.mp4:original caption');
    });
  });
});

describe('media-data duplicate check', () => {
  it('posts the entries through the typed client in a single call', async () => {
    const calls = installFetchStub();
    const result = await checkMediaDuplicates('acme', null, [
      { clientKey: '0', name: 'clip.mp4', fileSize: 10, folderId: null },
    ]);
    expect(result.duplicates).toEqual([]);
    expect(calls.posts).toHaveLength(1);
    expect(calls.posts[0]?.url).toBe('/api/tenant/acme/media/check-duplicates');
    expect(calls.posts[0]?.body).toEqual({
      folderId: null,
      entries: [{ clientKey: '0', name: 'clip.mp4', fileSize: 10, folderId: null }],
    });
  });
});
