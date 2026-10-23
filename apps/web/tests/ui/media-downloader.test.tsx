/**
 * @file media-downloader.test.tsx
 * @description Comprehensive UI & behavioral tests for Spec 031:
 * Cloud Media Downloader, Auto-Provisioned 'Downloads' Default Folder,
 * Nested Folder Selection & Inline 'New Folder' Creation, Intra-Batch URL
 * Deduplication, Unified Batch Progress Bar, Recent Downloads List with
 * Auto-Populated Captions, 'Open in Folder' Navigation, and Failed Link 'Retry'.
 *
 * Spec 140 PR-140-2 setup: the legacy `initial*` test-only prop API died
 * with the old component. The rebuilt surface
 * (`downloader-surface.tsx`) is rendered into jsdom through the
 * PR-140-1 data-layer pattern — a QueryClientProvider plus a fetch stub
 * serving the typed client's API responses — and driven with
 * user-event. Assertions are the pre-rebuild ones, re-expressed against
 * the live DOM (the two assertions that read legacy inline-style values
 * out of the static markup — a `border-radius` style and the raw
 * PALETTE hex — are replaced by their post-rebuild equivalents: the
 * palette hex must NOT appear in the rendered markup at all, because
 * styling now comes from token classes; the capsule-pill ban is kept).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { PALETTE } from '@/lib/theme';
import { DownloaderSurface } from '@/components/downloader/downloader-surface';
import {
  initializeDownloaderFolders,
  createDownloaderFolder,
  executeDownloaderBatch,
  retryFailedDownloadEntry,
  type DownloaderBatchProgressState,
  type DownloaderFailedEntry,
} from '@/components/downloader/downloader-data';
import {
  validateDownloaderBatchInput,
  buildMediaFolderHref,
} from '@/components/downloader/media-downloader-helpers';

// userEvent interaction tests run long under coverage instrumentation;
// the per-test budget below replaces the 5s default for this file's
// interaction cases only (assertions and waits are unchanged).
const INTERACTION_TIMEOUT = 20_000;

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useParams: () => ({
    subdomain: 'acme',
  }),
}));

const SAMPLE_FOLDERS: MediaFolder[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '00000000-0000-4000-8000-000000000001',
    parentId: null,
    name: 'Downloads',
    itemCount: 3,
    subfolderCount: 0,
    createdAt: '2026-10-11T08:00:00.000Z',
    updatedAt: '2026-10-11T08:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    userId: '00000000-0000-4000-8000-000000000001',
    parentId: null,
    name: 'Campaign A',
    itemCount: 2,
    subfolderCount: 1,
    createdAt: '2026-10-11T08:05:00.000Z',
    updatedAt: '2026-10-11T08:05:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    userId: '00000000-0000-4000-8000-000000000001',
    parentId: '22222222-2222-4222-8222-222222222222',
    name: 'TikTok Reels',
    itemCount: 5,
    subfolderCount: 0,
    createdAt: '2026-10-11T08:10:00.000Z',
    updatedAt: '2026-10-11T08:10:00.000Z',
  },
];

const SAMPLE_DOWNLOADED_ITEMS: MediaItemResponse[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    userId: '00000000-0000-4000-8000-000000000001',
    folderId: '11111111-1111-4111-8111-111111111111',
    name: 'tiktok_creator_hook.mp4',
    mediaType: 'video',
    mimeType: 'video/mp4',
    fileSize: 12582912, // 12.0 MB
    storageKey: 'users/u1/media/tiktok_creator_hook.mp4',
    url: 'https://media.fbuploadpro.com/users/u1/media/tiktok_creator_hook.mp4',
    thumbnailKey: 'users/u1/thumbnails/tiktok_creator_hook.webp',
    thumbnailUrl: 'https://media.fbuploadpro.com/users/u1/thumbnails/tiktok_creator_hook.webp',
    durationSeconds: 32,
    aspectRatio: '9:16',
    captionText: 'POV: You automated your entire content calendar 🚀 #growth',
    createdAt: '2026-10-11T08:30:00.000Z',
    updatedAt: '2026-10-11T08:30:00.000Z',
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    userId: '00000000-0000-4000-8000-000000000001',
    folderId: '33333333-3333-4333-8333-333333333333',
    name: 'carousel_slide_1.jpg',
    mediaType: 'image',
    mimeType: 'image/jpeg',
    fileSize: 1572864, // 1.5 MB
    storageKey: 'users/u1/media/carousel_slide_1.jpg',
    url: 'https://media.fbuploadpro.com/users/u1/media/carousel_slide_1.jpg',
    thumbnailKey: null,
    thumbnailUrl: null,
    durationSeconds: null,
    aspectRatio: '4:5',
    captionText: '5 Frameworks for High-Retention Reels',
    createdAt: '2026-10-11T08:31:00.000Z',
    updatedAt: '2026-10-11T08:31:00.000Z',
  },
];

/* ------------------------------------------------------------------ */
/* Surface render harness (data-layer mocks via a fetch stub)          */
/* ------------------------------------------------------------------ */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

interface SurfaceStubOptions {
  /** Stored jobs served by GET …/downloader (recent-list hydration). */
  jobs?: unknown[];
  /** POST …/downloader responder; defaults to "unstubbed". */
  onIngestPost?: (body: { url: string; folderId: string | null }) => Promise<Response>;
}

let downloaderPostCalls: Array<{ url: string; folderId: string | null }> = [];

function installSurfaceFetchStub(options: SurfaceStubOptions = {}) {
  downloaderPostCalls = [];
  const jobs = options.jobs ?? [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/media/folders') && method === 'GET') {
        return jsonResponse({ folders: SAMPLE_FOLDERS, unorganizedCount: 0 });
      }
      if (url.includes('/downloader') && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as {
          url: string;
          folderId: string | null;
        };
        downloaderPostCalls.push(body);
        if (options.onIngestPost) return options.onIngestPost(body);
        throw new Error('Unstubbed downloader POST');
      }
      if (url.includes('/downloader') && method === 'GET') {
        return jsonResponse({ success: true, jobs });
      }
      const mediaMatch = /\/media\/([0-9a-f-]+)$/.exec(url);
      if (mediaMatch && method === 'GET') {
        const item = SAMPLE_DOWNLOADED_ITEMS.find((i) => i.id === mediaMatch[1]);
        if (item) return jsonResponse(item);
      }
      throw new Error(`Unstubbed fetch: ${method} ${url}`);
    })
  );
}

function renderDownloader() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DownloaderSurface subdomain="acme" />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockPush.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Spec 031: MediaDownloader — Default Downloads Folder, Nested Folder Selection & Inline New Folder (US2)', () => {
  it('auto-selects an existing root-level Downloads folder on load without issuing a POST request', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ folders: SAMPLE_FOLDERS, unorganizedCount: 0 }),
        {
          status: 200,
        }
      );
    }) as unknown as typeof fetch;

    const result = await initializeDownloaderFolders({
      subdomain: 'acme',
      fetchImpl: mockFetch,
    });

    expect(result.createdDefaultFolder).toBe(false);
    expect(result.selectedFolderId).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.folders).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(
      (mockFetch as unknown as { mock: { calls: unknown[][] } }).mock
        .calls[0]?.[0]
    ).toBe('/api/tenant/acme/media/folders');
  });

  it('auto-creates a root-level Downloads folder via POST /api/tenant/acme/media/folders when not yet present and selects it', async () => {
    const foldersWithoutDownloads = SAMPLE_FOLDERS.slice(1);
    const createdDownloadsFolder: MediaFolder = {
      id: '99999999-9999-4999-8999-999999999999',
      userId: '00000000-0000-4000-8000-000000000001',
      parentId: null,
      name: 'Downloads',
      itemCount: 0,
      subfolderCount: 0,
      createdAt: '2026-10-11T08:40:00.000Z',
      updatedAt: '2026-10-11T08:40:00.000Z',
    };

    const mockFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          name: string;
          parentId: string | null;
        };
        expect(body).toEqual({ name: 'Downloads', parentId: null });
        return new Response(JSON.stringify(createdDownloadsFolder), {
          status: 201,
        });
      }
      return new Response(
        JSON.stringify({ folders: foldersWithoutDownloads, unorganizedCount: 0 }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const result = await initializeDownloaderFolders({
      subdomain: 'acme',
      fetchImpl: mockFetch,
    });

    expect(result.createdDefaultFolder).toBe(true);
    expect(result.selectedFolderId).toBe('99999999-9999-4999-8999-999999999999');
    expect(result.folders).toHaveLength(3);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it(
    'renders destination folder selector with All Media (Root), Downloads default selected, nested ancestry paths, and inline New Folder dialog',
    async () => {
      installSurfaceFetchStub();
      const user = userEvent.setup();
      renderDownloader();

      const folderSelect = screen.getByTestId('downloader-folder-select');
      expect(folderSelect).toBeTruthy();
      expect(screen.getByTestId('downloader-new-folder-button')).toBeTruthy();

      // Downloads is the default selected folder (its label is what the
      // select trigger shows once the folder list has loaded).
      await waitFor(() => {
        expect(folderSelect.textContent).toContain('Downloads');
      });

      // Every folder is listed by its ancestry path.
      await user.click(folderSelect);
      expect(
        await screen.findByRole('option', { name: 'All Media (Root)' })
      ).toBeTruthy();
      expect(screen.getByRole('option', { name: 'Downloads' })).toBeTruthy();
      expect(screen.getByRole('option', { name: 'Campaign A' })).toBeTruthy();
      expect(
        screen.getByRole('option', { name: 'Campaign A / TikTok Reels' })
      ).toBeTruthy();
      await user.keyboard('{Escape}');

      // Verify inline New Folder modal controls
      await user.click(screen.getByTestId('downloader-new-folder-button'));
      expect(
        await screen.findByTestId('downloader-new-folder-dialog')
      ).toBeTruthy();
      const nameInput = screen.getByTestId('downloader-new-folder-input');
      expect(nameInput).toBeTruthy();
      expect(
        screen.getByTestId('downloader-new-folder-parent-select')
      ).toBeTruthy();
      expect(screen.getByTestId('downloader-new-folder-submit')).toBeTruthy();

      await user.type(nameInput, 'Q4 Viral Clips');
      expect((nameInput as HTMLInputElement).value).toBe('Q4 Viral Clips');
    },
    INTERACTION_TIMEOUT
  );

  it('creates a new folder inline via createDownloaderFolder and immediately returns its ID as selectedFolderId', async () => {
    const newFolderResponse: MediaFolder = {
      id: '44444444-4444-4444-8444-444444444444',
      userId: '00000000-0000-4000-8000-000000000001',
      parentId: '22222222-2222-4222-8222-222222222222',
      name: 'Instagram Carousels',
      itemCount: 0,
      subfolderCount: 0,
      createdAt: '2026-10-11T08:45:00.000Z',
      updatedAt: '2026-10-11T08:45:00.000Z',
    };

    const mockFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as {
        name: string;
        parentId: string | null;
      };
      expect(payload).toEqual({
        name: 'Instagram Carousels',
        parentId: '22222222-2222-4222-8222-222222222222',
      });
      return new Response(JSON.stringify(newFolderResponse), { status: 201 });
    }) as unknown as typeof fetch;

    const created = await createDownloaderFolder({
      subdomain: 'acme',
      name: '  Instagram Carousels  ',
      parentId: '22222222-2222-4222-8222-222222222222',
      existingFolders: SAMPLE_FOLDERS,
      fetchImpl: mockFetch,
    });

    expect(created.selectedFolderId).toBe('44444444-4444-4444-8444-444444444444');
    expect(created.folders).toHaveLength(4);
    expect(created.folder.name).toBe('Instagram Carousels');
  });
});

describe('Spec 031: MediaDownloader — Validation, Batch URL Deduplication & Unified Progress Bar (US3, US5)', () => {
  it(
    'validates empty or invalid URL inputs and renders inline role="alert" error state',
    async () => {
      const emptyCheck = validateDownloaderBatchInput('   \n  ');
      expect(emptyCheck.valid).toBe(false);
      expect(emptyCheck.errorMessage).toContain('Please paste at least one link');

      const invalidCheck = validateDownloaderBatchInput(
        'not-a-valid-url\nhttp://127.0.0.1/private.mp4'
      );
      expect(invalidCheck.valid).toBe(false);
      expect(invalidCheck.errorMessage).toContain('valid public link');

      installSurfaceFetchStub();
      const user = userEvent.setup();
      renderDownloader();

      const urlInput = screen.getByTestId('downloader-url-input');
      await user.type(urlInput, 'invalid-link');
      await user.click(screen.getByTestId('downloader-submit-button'));

      // Inline error (role="alert"), byte-identical copy, nothing submitted.
      const urlError = await screen.findByTestId('downloader-url-error');
      expect(urlError.getAttribute('role')).toBe('alert');
      expect(urlError.textContent).toBe(
        'Please enter at least one valid public link.'
      );
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
      expect(downloaderPostCalls).toHaveLength(0);

      // §3 item 2: typing clears the error.
      await user.type(urlInput, 'x');
      await waitFor(() => {
        expect(screen.queryByTestId('downloader-url-error')).toBeNull();
      });
    },
    INTERACTION_TIMEOUT
  );

  it('deduplicates identical URLs within a pasted batch, handles multi-item carousel responses, and emits unified progress updates', async () => {
    const rawBatchInput = [
      'https://www.tiktok.com/@creator/video/111',
      'https://www.tiktok.com/@creator/video/111', // Duplicate in batch!
      'https://www.instagram.com/p/CAROUSEL999/',
    ].join('\n');

    const validation = validateDownloaderBatchInput(rawBatchInput);
    expect(validation.valid).toBe(true);
    expect(validation.urls).toHaveLength(2);
    expect(validation.duplicateCount).toBe(1);

    const progressUpdates: DownloaderBatchProgressState[] = [];
    const mockFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        url: string;
        folderId: string | null;
      };

      if (body.url.includes('tiktok.com')) {
        return new Response(
          JSON.stringify({
            sourceUrl: body.url,
            platform: 'tiktok',
            items: [SAMPLE_DOWNLOADED_ITEMS[0]],
          }),
          { status: 201 }
        );
      }

      // Multi-item carousel response (2 items from 1 Instagram post)
      return new Response(
        JSON.stringify({
          sourceUrl: body.url,
          platform: 'instagram',
          items: [
            SAMPLE_DOWNLOADED_ITEMS[1],
            {
              ...SAMPLE_DOWNLOADED_ITEMS[1],
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
              name: 'carousel_slide_2.jpg',
            },
          ],
        }),
        { status: 201 }
      );
    }) as unknown as typeof fetch;

    const batchResult = await executeDownloaderBatch({
      subdomain: 'acme',
      rawInput: rawBatchInput,
      folderId: '11111111-1111-4111-8111-111111111111',
      onProgress: (state) => progressUpdates.push(state),
      fetchImpl: mockFetch,
    });

    // Only 2 API calls made (duplicate skipped), and 3 total media items saved (1 TikTok + 2 Instagram carousel slides)
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(batchResult.duplicateCount).toBe(1);
    expect(batchResult.savedEntries).toHaveLength(3);
    expect(batchResult.failedEntries).toHaveLength(0);

    // Verify progress state transitions from 0 of 2 -> 1 of 2 -> 2 of 2 completed
    expect(progressUpdates[0]?.completedLinks).toBe(0);
    expect(progressUpdates[0]?.totalLinks).toBe(2);
    expect(progressUpdates.at(-1)?.status).toBe('completed');
    expect(progressUpdates.at(-1)?.completedLinks).toBe(2);
  });

  it('completes an async 202 job through polling and saves the media item the job produced', async () => {
    const jobId = 'job-async-1';
    const completedJob = {
      id: jobId,
      status: 'completed',
      source_url: 'https://www.tiktok.com/@creator/video/111',
      source_platform: 'tiktok',
      media_id: SAMPLE_DOWNLOADED_ITEMS[0]!.id,
      folder_id: '11111111-1111-4111-8111-111111111111',
      progress_percent: 100,
      error_message: null,
    };

    const mockFetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === 'POST') {
          return new Response(JSON.stringify({ success: true, job: { id: jobId } }), {
            status: 202,
          });
        }
        if (url.includes('jobId=')) {
          return new Response(JSON.stringify({ success: true, job: completedJob }), {
            status: 200,
          });
        }
        // GET /media/<id> — the route returns the BARE item (no envelope)
        return new Response(JSON.stringify(SAMPLE_DOWNLOADED_ITEMS[0]), {
          status: 200,
        });
      }
    ) as unknown as typeof fetch;

    const batchResult = await executeDownloaderBatch({
      subdomain: 'acme',
      rawInput: 'https://www.tiktok.com/@creator/video/111',
      folderId: '11111111-1111-4111-8111-111111111111',
      fetchImpl: mockFetch,
    });

    expect(batchResult.failedEntries).toHaveLength(0);
    expect(batchResult.savedEntries).toHaveLength(1);
    expect(batchResult.savedEntries[0]?.item.id).toBe(SAMPLE_DOWNLOADED_ITEMS[0]!.id);
    expect(batchResult.savedEntries[0]?.platform).toBe('tiktok');
  });

  it(
    'renders a single unified Windows Copy-style batch progress bar and deduplication notice during active downloads',
    async () => {
      // Two links complete immediately; the remaining two stay in
      // flight (their POST never resolves), freezing the batch at
      // 2 of 4 — the state the legacy suite seeded via initial props.
      const neverResolves = new Promise<Response>(() => {});
      installSurfaceFetchStub({
        onIngestPost: async (body) => {
          if (
            body.url.includes('/video/111') ||
            body.url.includes('/video/222')
          ) {
            return jsonResponse(
              {
                sourceUrl: body.url,
                platform: 'tiktok',
                items: [SAMPLE_DOWNLOADED_ITEMS[0]],
              },
              201
            );
          }
          return neverResolves;
        },
      });
      const user = userEvent.setup();
      renderDownloader();

      const urlInput = screen.getByTestId('downloader-url-input');
      await user.type(
        urlInput,
        [
          'https://www.tiktok.com/@creator/video/111',
          'https://www.tiktok.com/@creator/video/111', // Duplicate in batch!
          'https://www.tiktok.com/@creator/video/222',
          'https://www.tiktok.com/@creator/video/333',
          'https://www.tiktok.com/@creator/video/444',
        ].join('\n')
      );
      await user.click(screen.getByTestId('downloader-submit-button'));

      expect(
        await screen.findByTestId('downloader-batch-progress')
      ).toBeTruthy();
      const dedupNotice = await screen.findByTestId('downloader-dedup-notice');
      expect(dedupNotice.textContent).toBe(
        'Skipped 1 duplicate link in batch'
      );
      expect(
        await screen.findByText('Saving 2 of 4 links to Media Library...')
      ).toBeTruthy();
      expect(screen.getByText('50%')).toBeTruthy();
      expect(screen.getByText('Saving to Media Library...')).toBeTruthy();

      // Must render a single semantic progress element
      const progressBars = document.querySelectorAll('progress');
      expect(progressBars).toHaveLength(1);
      expect(progressBars[0]!.getAttribute('value')).toBe('50');
      expect(progressBars[0]!.getAttribute('max')).toBe('100');
    },
    INTERACTION_TIMEOUT
  );
});

describe('Spec 031: MediaDownloader — Recent Downloads List, Open in Folder & Retry Failed Links (US5)', () => {
  it(
    'renders saved items with auto-populated captions, formatted sizes, target folder path, and Open in Folder navigation',
    async () => {
      // The Recent list hydrates from the stored jobs (OD-140-2): two
      // completed jobs (their media items served by GET /media/<id>)
      // and one failed job.
      installSurfaceFetchStub({
        jobs: [
          {
            id: 'job-saved-1',
            status: 'completed',
            source_url: 'https://www.tiktok.com/@creator/video/111',
            source_platform: 'tiktok',
            media_id: SAMPLE_DOWNLOADED_ITEMS[0]!.id,
            folder_id: SAMPLE_DOWNLOADED_ITEMS[0]!.folderId,
            progress_percent: 100,
            error_message: null,
          },
          {
            id: 'job-saved-2',
            status: 'completed',
            source_url: 'https://www.instagram.com/p/CAROUSEL999/',
            source_platform: 'instagram',
            media_id: SAMPLE_DOWNLOADED_ITEMS[1]!.id,
            folder_id: SAMPLE_DOWNLOADED_ITEMS[1]!.folderId,
            progress_percent: 100,
            error_message: null,
          },
          {
            id: 'job-failed-1',
            status: 'failed',
            source_url: 'https://www.tiktok.com/@private/video/999',
            source_platform: 'tiktok',
            media_id: null,
            folder_id: '11111111-1111-4111-8111-111111111111',
            progress_percent: 0,
            error_message:
              'This post is private or unavailable for cloud download.',
          },
        ],
      });
      const user = userEvent.setup();
      const { container } = renderDownloader();

      expect(screen.getByTestId('downloader-recent-list')).toBeTruthy();
      expect(
        await screen.findByTestId(
          `downloader-saved-item-${SAMPLE_DOWNLOADED_ITEMS[0]!.id}`
        )
      ).toBeTruthy();
      expect(
        screen.getByTestId(
          `downloader-item-caption-${SAMPLE_DOWNLOADED_ITEMS[0]!.id}`
        )
      ).toBeTruthy();
      expect(
        screen.getByTestId(
          `downloader-open-folder-${SAMPLE_DOWNLOADED_ITEMS[0]!.id}`
        )
      ).toBeTruthy();

      // Verify auto-populated post captions and folder ancestry paths
      expect(
        screen.getByText(
          'POV: You automated your entire content calendar 🚀 #growth'
        )
      ).toBeTruthy();
      expect(
        screen.getByText('5 Frameworks for High-Retention Reels')
      ).toBeTruthy();
      expect(screen.getByText('12.0 MB')).toBeTruthy();
      expect(screen.getByText('1.5 MB')).toBeTruthy();
      expect(
        screen.getByTestId(
          `downloader-item-folder-${SAMPLE_DOWNLOADED_ITEMS[1]!.id}`
        ).textContent
      ).toBe('Campaign A / TikTok Reels');
      expect(screen.getAllByText('Open in Folder')).toHaveLength(2);
      expect(screen.getByText('2 saved · 1 failed')).toBeTruthy();

      // Verify failed item & Retry button rendering
      expect(screen.getByTestId('downloader-failed-item')).toBeTruthy();
      expect(screen.getByTestId('downloader-retry-btn')).toBeTruthy();
      expect(
        screen.getByText(
          'This post is private or unavailable for cloud download.'
        )
      ).toBeTruthy();

      // Open in Folder navigates into the Media Library at that folder
      await user.click(
        screen.getByTestId(
          `downloader-open-folder-${SAMPLE_DOWNLOADED_ITEMS[1]!.id}`
        )
      );
      expect(mockPush).toHaveBeenCalledWith(
        '/tenant/acme/media?folder=33333333-3333-4333-8333-333333333333'
      );

      // Verify buildMediaFolderHref routes accurately to ?folder=<id> or /media for root
      expect(
        buildMediaFolderHref('acme', '33333333-3333-4333-8333-333333333333')
      ).toBe('/tenant/acme/media?folder=33333333-3333-4333-8333-333333333333');
      expect(buildMediaFolderHref('acme', null)).toBe('/tenant/acme/media');

      // Strict theme compliance: zero capsule pills (9999px), zero
      // decorative status dots, and no raw palette hex in the markup —
      // styling comes from token classes after the PR-140-2 rebuild.
      const html = container.innerHTML;
      expect(html).not.toContain('9999px');
      expect(html).not.toContain('data-slot="status-dot"');
      expect(html).not.toContain(PALETTE.primary);
    },
    INTERACTION_TIMEOUT
  );

  it('retries a failed link via retryFailedDownloadEntry and recovers the saved media item', async () => {
    const failedEntry: DownloaderFailedEntry = {
      id: 'failed-retry-1',
      url: 'https://www.tiktok.com/@creator/video/777',
      folderId: '11111111-1111-4111-8111-111111111111',
      errorMessage: 'Temporary timeout while contacting source platform.',
    };

    const mockFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        url: string;
        folderId: string | null;
      };
      expect(body).toEqual({
        url: 'https://www.tiktok.com/@creator/video/777',
        folderId: '33333333-3333-4333-8333-333333333333',
      });

      return new Response(
        JSON.stringify({
          sourceUrl: body.url,
          platform: 'tiktok',
          items: [SAMPLE_DOWNLOADED_ITEMS[0]],
        }),
        { status: 201 }
      );
    }) as unknown as typeof fetch;

    const retryResult = await retryFailedDownloadEntry({
      subdomain: 'acme',
      entry: failedEntry,
      targetFolderId: '33333333-3333-4333-8333-333333333333',
      fetchImpl: mockFetch,
    });

    expect(retryResult.ok).toBe(true);
    expect(retryResult.savedEntries).toHaveLength(1);
    expect(retryResult.savedEntries[0]?.item.id).toBe(
      SAMPLE_DOWNLOADED_ITEMS[0]!.id
    );
  });
});
