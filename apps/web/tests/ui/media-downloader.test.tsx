/**
 * @file media-downloader.test.tsx
 * @description Comprehensive UI & behavioral tests for Spec 031:
 * Cloud Media Downloader, Auto-Provisioned 'Downloads' Default Folder,
 * Nested Folder Selection & Inline 'New Folder' Creation, Intra-Batch URL
 * Deduplication, Unified Batch Progress Bar, Recent Downloads List with
 * Auto-Populated Captions, 'Open in Folder' Navigation, and Failed Link 'Retry'.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { PALETTE, RADII } from '@/lib/theme';
import { MediaDownloader } from '@/components/downloader/media-downloader';
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
import { render } from '../components/setup';

/**
 * Spec 140 PR-140-1 data-path setup: the surface now reads its data
 * through React Query hooks (downloader-data.ts), so renders are
 * wrapped in a QueryClientProvider. Behaviour assertions are unchanged
 * in this PR; the behavioural migration lands in PR-140-4.
 */
function renderDownloader(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

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

  it('renders destination folder selector with All Media (Root), Downloads default selected, nested ancestry paths, and inline New Folder dialog', () => {
    const { hasText, hasAttribute, findTags } = renderDownloader(
      <MediaDownloader
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialNewFolderDialogOpen={true}
        initialNewFolderName="Q4 Viral Clips"
      />
    );

    expect(hasAttribute('data-testid', 'downloader-folder-select')).toBe(true);
    expect(hasAttribute('data-testid', 'downloader-new-folder-button')).toBe(true);
    expect(hasText('All Media (Root)')).toBe(true);
    expect(hasText('Downloads')).toBe(true);
    expect(hasText('Campaign A')).toBe(true);
    expect(hasText('Campaign A / TikTok Reels')).toBe(true);

    // Verify Downloads option is selected by default when initialFolders contains Downloads
    const options = findTags('option');
    const selectedDownloadsOption = options.find(
      (opt) =>
        opt.attributes['value'] === '11111111-1111-4111-8111-111111111111' &&
        opt.attributes['selected'] !== undefined
    );
    expect(selectedDownloadsOption).toBeDefined();

    // Verify inline New Folder modal controls
    expect(hasAttribute('data-testid', 'downloader-new-folder-dialog')).toBe(true);
    expect(hasAttribute('data-testid', 'downloader-new-folder-input')).toBe(true);
    expect(hasAttribute('data-testid', 'downloader-new-folder-parent-select')).toBe(
      true
    );
    expect(hasAttribute('data-testid', 'downloader-new-folder-submit')).toBe(true);
    expect(hasAttribute('value', 'Q4 Viral Clips')).toBe(true);
  });

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
  it('validates empty or invalid URL inputs and renders inline role="alert" error state', () => {
    const emptyCheck = validateDownloaderBatchInput('   \n  ');
    expect(emptyCheck.valid).toBe(false);
    expect(emptyCheck.errorMessage).toContain('Please paste at least one link');

    const invalidCheck = validateDownloaderBatchInput(
      'not-a-valid-url\nhttp://127.0.0.1/private.mp4'
    );
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.errorMessage).toContain('valid public link');

    const { hasText, hasAttribute, findByRole } = renderDownloader(
      <MediaDownloader
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialUrlInput="invalid-link"
        initialUrlError={invalidCheck.errorMessage}
      />
    );

    expect(findByRole('alert')).toBe(true);
    expect(hasAttribute('data-testid', 'downloader-url-error')).toBe(true);
    expect(
      hasText('Please enter at least one valid public link.')
    ).toBe(true);
  });

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

  it('renders a single unified Windows Copy-style batch progress bar and deduplication notice during active downloads', () => {
    const activeProgress: DownloaderBatchProgressState = {
      status: 'downloading',
      totalLinks: 4,
      completedLinks: 2,
      currentUrl: 'https://www.tiktok.com/@creator/video/333',
      duplicateCount: 1,
      invalidCount: 0,
    };

    const { hasText, hasAttribute, findTags } = renderDownloader(
      <MediaDownloader
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialBatchProgress={activeProgress}
      />
    );

    expect(hasAttribute('data-testid', 'downloader-batch-progress')).toBe(true);
    expect(hasAttribute('data-testid', 'downloader-dedup-notice')).toBe(true);
    expect(hasText('Skipped 1 duplicate link in batch')).toBe(true);
    expect(hasText('Saving 2 of 4 links to Media Library...')).toBe(true);
    expect(hasText('50%')).toBe(true);
    expect(hasText('Saving to Media Library...')).toBe(true);

    // Must render a single semantic progress element
    const progressBars = findTags('progress');
    expect(progressBars).toHaveLength(1);
    expect(progressBars[0]?.attributes['value']).toBe('50');
    expect(progressBars[0]?.attributes['max']).toBe('100');
  });
});

describe('Spec 031: MediaDownloader — Recent Downloads List, Open in Folder & Retry Failed Links (US5)', () => {
  it('renders saved items with auto-populated captions, formatted sizes, target folder path, and Open in Folder navigation', () => {
    const failedEntry: DownloaderFailedEntry = {
      id: 'failed-1',
      url: 'https://www.tiktok.com/@private/video/999',
      folderId: '11111111-1111-4111-8111-111111111111',
      errorMessage: 'This post is private or unavailable for cloud download.',
    };

    const { hasText, hasAttribute, html } = renderDownloader(
      <MediaDownloader
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialSavedEntries={[
          {
            item: SAMPLE_DOWNLOADED_ITEMS[0]!,
            sourceUrl: 'https://www.tiktok.com/@creator/video/111',
            platform: 'tiktok',
          },
          {
            item: SAMPLE_DOWNLOADED_ITEMS[1]!,
            sourceUrl: 'https://www.instagram.com/p/CAROUSEL999/',
            platform: 'instagram',
          },
        ]}
        initialFailedEntries={[failedEntry]}
      />
    );

    expect(hasAttribute('data-testid', 'downloader-recent-list')).toBe(true);
    expect(
      hasAttribute(
        'data-testid',
        `downloader-saved-item-${SAMPLE_DOWNLOADED_ITEMS[0]!.id}`
      )
    ).toBe(true);
    expect(
      hasAttribute(
        'data-testid',
        `downloader-item-caption-${SAMPLE_DOWNLOADED_ITEMS[0]!.id}`
      )
    ).toBe(true);
    expect(
      hasAttribute(
        'data-testid',
        `downloader-open-folder-${SAMPLE_DOWNLOADED_ITEMS[0]!.id}`
      )
    ).toBe(true);

    // Verify auto-populated post captions and folder ancestry paths
    expect(
      hasText('POV: You automated your entire content calendar 🚀 #growth')
    ).toBe(true);
    expect(hasText('5 Frameworks for High-Retention Reels')).toBe(true);
    expect(hasText('12.0 MB')).toBe(true);
    expect(hasText('1.5 MB')).toBe(true);
    expect(hasText('Campaign A / TikTok Reels')).toBe(true);
    expect(hasText('Open in Folder')).toBe(true);

    // Verify failed item & Retry button rendering
    expect(hasAttribute('data-testid', 'downloader-failed-item')).toBe(true);
    expect(hasAttribute('data-testid', 'downloader-retry-btn')).toBe(true);
    expect(
      hasText('This post is private or unavailable for cloud download.')
    ).toBe(true);

    // Verify buildMediaFolderHref routes accurately to ?folder=<id> or /media for root
    expect(
      buildMediaFolderHref('acme', '33333333-3333-4333-8333-333333333333')
    ).toBe('/tenant/acme/media?folder=33333333-3333-4333-8333-333333333333');
    expect(buildMediaFolderHref('acme', null)).toBe('/tenant/acme/media');

    // Strict DESIGN.md & theme.ts compliance: zero capsule pills (9999px) and zero decorative status dots
    expect(html).not.toContain('9999px');
    expect(html).not.toContain('data-slot="status-dot"');
    expect(html).toContain(`border-radius:${RADII.xs}`);
    expect(html).toContain(PALETTE.primary);
  });

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
