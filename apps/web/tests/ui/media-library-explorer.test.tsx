/**
 * @file media-library-explorer.test.tsx
 * @description Comprehensive UI & integration tests for Spec 029:
 * Nested Media Library Explorer, Recursive Folders, Bounded Multi-File/Folder Upload,
 * Direct Inline & Modal Caption Editing, Batch Selection Bar, Global Search Across
 * Nested Folders, Infinite Scroll Pagination, URL ?folder=<id> Sync, Shift+Click Range
 * Selection, 300ms Hover Video Preview, and Pre-Upload Duplicate Detection Modal.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { RADII, PALETTE } from '@/lib/theme';
import {
  UploadQueueBanner,
  MAX_CONCURRENT_UPLOADS,
  formatBytes,
  deriveDefaultCaption,
  resolveSupportedMimeType,
  resolveFolderPathSegments,
  buildQueuedEntriesFromFileList,
  ensureNestedFolderHierarchy,
  executeBoundedUploadBatch,
  detectDuplicateUploadEntries,
  type UploadBatchState,
} from '@/components/media/upload-queue-banner';
import {
  MediaAssetCard,
  HOVER_VIDEO_PREVIEW_DELAY_MS,
  formatDuration,
} from '@/components/media/media-asset-card';
import { MediaPreviewModal } from '@/components/media/media-preview-modal';
import { BatchActionBar } from '@/components/media/batch-action-bar';
import {
  MediaLibraryExplorer,
  buildFolderBreadcrumbs,
  formatFolderAncestryPath,
  computeRangeSelection,
  computeFolderSubtreeImpact,
  filterAndSortMediaItems,
} from '@/components/media/media-library-explorer';
import { render } from '../components/setup';

const SAMPLE_FOLDERS: MediaFolder[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '00000000-0000-4000-8000-000000000001',
    parentId: null,
    name: 'Campaign A',
    itemCount: 2,
    subfolderCount: 2,
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    userId: '00000000-0000-4000-8000-000000000001',
    parentId: '11111111-1111-4111-8111-111111111111',
    name: 'Reels',
    itemCount: 5,
    subfolderCount: 1,
    createdAt: '2026-10-10T10:05:00.000Z',
    updatedAt: '2026-10-10T10:05:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    userId: '00000000-0000-4000-8000-000000000001',
    parentId: '22222222-2222-4222-8222-222222222222',
    name: 'Week 1',
    itemCount: 3,
    subfolderCount: 0,
    createdAt: '2026-10-10T10:10:00.000Z',
    updatedAt: '2026-10-10T10:10:00.000Z',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    userId: '00000000-0000-4000-8000-000000000001',
    parentId: '11111111-1111-4111-8111-111111111111',
    name: 'Photos',
    itemCount: 4,
    subfolderCount: 0,
    createdAt: '2026-10-10T10:15:00.000Z',
    updatedAt: '2026-10-10T10:15:00.000Z',
  },
];

const SAMPLE_MEDIA_ITEMS: MediaItemResponse[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    userId: '00000000-0000-4000-8000-000000000001',
    folderId: null,
    name: 'Viral Launch Reel.mp4',
    mediaType: 'video',
    mimeType: 'video/mp4',
    fileSize: 15728640, // 15.0 MB
    storageKey: 'users/u1/media/m1.mp4',
    url: 'https://media.fbuploadpro.com/users/u1/media/m1.mp4',
    thumbnailKey: 'users/u1/thumbnails/m1.webp',
    thumbnailUrl: 'https://media.fbuploadpro.com/users/u1/thumbnails/m1.webp',
    durationSeconds: 45,
    aspectRatio: '9:16',
    captionText: 'Viral Launch Reel 🔥',
    createdAt: '2026-10-10T12:00:00.000Z',
    updatedAt: '2026-10-10T12:00:00.000Z',
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    userId: '00000000-0000-4000-8000-000000000001',
    folderId: null,
    name: 'Product_Showcase_Banner.png',
    mediaType: 'image',
    mimeType: 'image/png',
    fileSize: 2097152, // 2.0 MB
    storageKey: 'users/u1/media/m2.png',
    url: 'https://media.fbuploadpro.com/users/u1/media/m2.png',
    thumbnailKey: null,
    thumbnailUrl: null,
    durationSeconds: null,
    aspectRatio: '1:1',
    captionText: '',
    createdAt: '2026-10-10T11:00:00.000Z',
    updatedAt: '2026-10-10T11:00:00.000Z',
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    userId: '00000000-0000-4000-8000-000000000001',
    folderId: '22222222-2222-4222-8222-222222222222',
    name: 'Nested_Folder_Clip.mp4',
    mediaType: 'video',
    mimeType: 'video/mp4',
    fileSize: 8388608, // 8.0 MB
    storageKey: 'users/u1/media/m3.mp4',
    url: 'https://media.fbuploadpro.com/users/u1/media/m3.mp4',
    thumbnailKey: null,
    thumbnailUrl: null,
    durationSeconds: 125,
    aspectRatio: '16:9',
    captionText: 'Viral Nested Folder Clip',
    createdAt: '2026-10-10T13:00:00.000Z',
    updatedAt: '2026-10-10T13:00:00.000Z',
  },
];

describe('Spec 029: UploadQueueBanner & Bounded Ingestion Helpers (US3)', () => {
  it('renders nothing when upload state is idle', () => {
    const idleState: UploadBatchState = {
      status: 'idle',
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      skippedFiles: 0,
      totalBytes: 0,
      transferredBytes: 0,
      currentFileName: null,
    };

    const { html } = render(<UploadQueueBanner state={idleState} />);
    expect(html).toBe('');
  });

  it('renders a single unified Windows Copy-style progress bar showing overall %, file counts, and transferred bytes without per-file progress bars', () => {
    const uploadingState: UploadBatchState = {
      status: 'uploading',
      totalFiles: 350,
      completedFiles: 140,
      failedFiles: 0,
      skippedFiles: 2,
      totalBytes: 100 * 1024 * 1024, // 100.0 MB
      transferredBytes: 40 * 1024 * 1024, // 40.0 MB
      currentFileName: 'viral_hook_141.mp4',
    };

    const { hasText, hasAttribute, findTags } = render(
      <UploadQueueBanner state={uploadingState} onCancel={vi.fn()} />
    );

    expect(hasAttribute('data-testid', 'unified-upload-progress-banner')).toBe(true);
    expect(hasText('Uploading 140 of 350 files...')).toBe(true);
    expect(hasText('Current: viral_hook_141.mp4')).toBe(true);
    expect(hasText('40.0 MB of 100.0 MB')).toBe(true);
    expect(hasText('40%')).toBe(true);
    expect(hasText('Skipped 2 unsupported files.')).toBe(true);
    expect(hasAttribute('data-testid', 'upload-cancel-btn')).toBe(true);

    // Must render exactly 1 progressbar element for the entire batch
    const progressBars = findTags('div').filter(
      (d) => d.attributes['role'] === 'progressbar'
    );
    expect(progressBars).toHaveLength(1);
    expect(progressBars[0]?.attributes['aria-valuenow']).toBe('40');
  });

  it('extracts relative folder segments and filters hidden/unsupported files accurately', () => {
    expect(resolveFolderPathSegments('Campaign A/Reels/Week 1/clip1.mp4')).toEqual([
      'Campaign A',
      'Reels',
      'Week 1',
    ]);
    expect(resolveFolderPathSegments('standalone.mp4')).toEqual([]);
    expect(formatBytes(15728640)).toBe('15.0 MB');
    expect(deriveDefaultCaption('My Summer Promo.mp4')).toBe('My Summer Promo');

    expect(resolveSupportedMimeType({ name: '.DS_Store', type: '' })).toBeNull();
    expect(resolveSupportedMimeType({ name: 'Thumbs.db', type: '' })).toBeNull();
    expect(resolveSupportedMimeType({ name: 'clip.mp4', type: '' })).toBe('video/mp4');
    expect(resolveSupportedMimeType({ name: 'banner.webp', type: 'image/webp' })).toBe(
      'image/webp'
    );
  });

  it('reuses existing sibling folders and creates missing nested subfolders sequentially in ensureNestedFolderHierarchy', async () => {
    const createdPayloads: Array<{ name: string; parentId: string | null }> = [];
    const mockFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        name: string;
        parentId: string | null;
      };
      createdPayloads.push(body);
      const createdFolder: MediaFolder = {
        id: `new-folder-${createdPayloads.length}`,
        userId: '00000000-0000-4000-8000-000000000001',
        parentId: body.parentId,
        name: body.name,
        itemCount: 0,
        subfolderCount: 0,
        createdAt: '2026-10-10T14:00:00.000Z',
        updatedAt: '2026-10-10T14:00:00.000Z',
      };
      return new Response(JSON.stringify(createdFolder), { status: 201 });
    }) as unknown as typeof fetch;

    const entries = buildQueuedEntriesFromFileList([
      Object.assign(new File(['video'], 'clip1.mp4', { type: 'video/mp4' }), {
        webkitRelativePath: 'Campaign A/Reels/Week 2/clip1.mp4',
      }),
      Object.assign(new File(['image'], 'slide1.jpg', { type: 'image/jpeg' }), {
        webkitRelativePath: 'Campaign A/Carousel/slide1.jpg',
      }),
    ]);

    const { folderPathMap, updatedFolders } = await ensureNestedFolderHierarchy({
      subdomain: 'acme',
      baseFolderId: null,
      entries,
      existingFolders: SAMPLE_FOLDERS,
      fetchImpl: mockFetch,
    });

    // "Campaign A" (1111...) and "Reels" (2222...) already exist; only "Week 2" and "Carousel" should be created
    expect(createdPayloads).toEqual([
      {
        name: 'Week 2',
        parentId: '22222222-2222-4222-8222-222222222222',
      },
      {
        name: 'Carousel',
        parentId: '11111111-1111-4111-8111-111111111111',
      },
    ]);
    expect(folderPathMap.get('Campaign A/Reels/Week 2')).toBe('new-folder-1');
    expect(folderPathMap.get('Campaign A/Carousel')).toBe('new-folder-2');
    expect(updatedFolders).toHaveLength(SAMPLE_FOLDERS.length + 2);
  });

  it('processes multi-file uploads with bounded concurrency (max 3 concurrent) and emits unified progress updates', async () => {
    let activeUploads = 0;
    let maxObservedConcurrency = 0;
    let confirmCounter = 0;

    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.endsWith('/media/upload-url')) {
        activeUploads += 1;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, activeUploads);
        await new Promise((r) => setTimeout(r, 15));
        confirmCounter += 1;
        const id = `00000000-0000-4000-8000-00000000010${confirmCounter}`;
        return new Response(
          JSON.stringify({
            mediaId: id,
            mediaKey: `users/u1/media/${id}.mp4`,
            mediaUploadUrl: `https://mock-r2.fbuploadpro.com/upload/${id}`,
            thumbnailKey: `users/u1/thumbnails/${id}.webp`,
            thumbnailUploadUrl: `https://mock-r2.fbuploadpro.com/thumb/${id}`,
            publicMediaUrl: `https://media.fbuploadpro.com/${id}.mp4`,
            publicThumbnailUrl: `https://media.fbuploadpro.com/${id}.webp`,
          }),
          { status: 200 }
        );
      }

      if (url.endsWith('/media/confirm')) {
        await new Promise((r) => setTimeout(r, 10));
        activeUploads -= 1;
        return new Response(
          JSON.stringify({
            ...SAMPLE_MEDIA_ITEMS[0],
            id: `confirmed-${confirmCounter}`,
          }),
          { status: 201 }
        );
      }

      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    const files = Array.from({ length: 7 }, (_, idx) => ({
      file: new File(['content'], `video_${idx + 1}.mp4`, { type: 'video/mp4' }),
      relativePath: `video_${idx + 1}.mp4`,
    }));
    // Add an unsupported hidden system file to verify graceful skip
    files.push({
      file: new File(['sys'], '.DS_Store', { type: '' }),
      relativePath: '.DS_Store',
    });

    const recordedStates: UploadBatchState[] = [];
    const result = await executeBoundedUploadBatch({
      subdomain: 'acme',
      baseFolderId: '11111111-1111-4111-8111-111111111111',
      rawEntries: files,
      existingFolders: SAMPLE_FOLDERS,
      onStateChange: (st) => recordedStates.push(st),
      fetchImpl: mockFetch,
    });

    expect(maxObservedConcurrency).toBeLessThanOrEqual(MAX_CONCURRENT_UPLOADS);
    expect(maxObservedConcurrency).toBeGreaterThanOrEqual(2);
    expect(result.uploadedItems).toHaveLength(7);

    const finalState = recordedStates.at(-1);
    expect(finalState?.status).toBe('completed');
    expect(finalState?.completedFiles).toBe(7);
    expect(finalState?.totalFiles).toBe(7);
    expect(finalState?.skippedFiles).toBe(1);
  });
});

describe('Spec 029: MediaAssetCard & MediaPreviewModal (US2, US6)', () => {
  it('renders MediaAssetCard with inline caption, multi-select checkbox, rectangular RADII.xs metadata badges, and zero capsule pills', () => {
    const videoItem = SAMPLE_MEDIA_ITEMS[0]!;
    const { hasText, hasAttribute, html } = render(
      <MediaAssetCard
        item={videoItem}
        selected={true}
        onToggleSelect={vi.fn()}
        onPreview={vi.fn()}
        onUpdateCaption={vi.fn()}
        onMoveRequest={vi.fn()}
        onDeleteRequest={vi.fn()}
      />
    );

    expect(hasAttribute('data-testid', `media-card-${videoItem.id}`)).toBe(true);
    expect(hasAttribute('data-testid', `media-thumbnail-surface-${videoItem.id}`)).toBe(
      true
    );
    expect(hasAttribute('data-testid', `select-media-${videoItem.id}`)).toBe(true);
    expect(hasAttribute('data-testid', `inline-caption-${videoItem.id}`)).toBe(true);
    expect(hasText('Viral Launch Reel.mp4')).toBe(true);
    expect(hasText('Viral Launch Reel 🔥')).toBe(true);
    expect(hasText('15.0 MB')).toBe(true);
    expect(hasText('9:16')).toBe(true);
    expect(hasText('0:45')).toBe(true);

    // Must use rectangular RADII.xs (4px) and NEVER capsule pills (9999px)
    expect(html).toContain(`border-radius:${RADII.xs}`);
    expect(html).not.toContain('9999px');
  });

  it('enforces 300ms hover video preview delay and renders muted inline <video> preview when hovered', () => {
    expect(HOVER_VIDEO_PREVIEW_DELAY_MS).toBe(300);

    const videoItem = SAMPLE_MEDIA_ITEMS[0]!;
    const { hasAttribute } = render(
      <MediaAssetCard
        item={videoItem}
        initialHoverPlaying={true}
        folderPathLabel="Campaign A / Reels"
        onNavigateFolder={vi.fn()}
      />
    );

    expect(hasAttribute('data-testid', `media-thumbnail-surface-${videoItem.id}`)).toBe(
      true
    );
    expect(hasAttribute('data-testid', `hover-video-preview-${videoItem.id}`)).toBe(
      true
    );
    expect(hasAttribute('data-testid', `media-folder-path-${videoItem.id}`)).toBe(true);
  });

  it('falls back to stripped filename when captionText is empty and renders inline caption input when editing', () => {
    const imageItem = SAMPLE_MEDIA_ITEMS[1]!;
    const { hasText, hasAttribute } = render(
      <MediaAssetCard item={imageItem} initialEditingCaption={true} />
    );

    expect(hasAttribute('data-testid', `inline-caption-input-${imageItem.id}`)).toBe(
      true
    );
    expect(hasAttribute('value', 'Product_Showcase_Banner')).toBe(true);
    expect(hasText('2.0 MB')).toBe(true);
    expect(formatDuration(125)).toBe('2:05');
  });

  it('renders MediaPreviewModal with video player, technical metadata, Previous/Next navigation controls, and multi-line caption textarea', () => {
    const videoItem = SAMPLE_MEDIA_ITEMS[0]!;
    const { hasText, hasAttribute, findTags } = render(
      <MediaPreviewModal
        item={videoItem}
        open={true}
        hasPrevious={true}
        hasNext={true}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(hasAttribute('data-testid', 'media-preview-modal')).toBe(true);
    expect(hasAttribute('data-testid', 'modal-video-player')).toBe(true);
    expect(hasAttribute('data-testid', 'preview-prev-btn')).toBe(true);
    expect(hasAttribute('data-testid', 'preview-next-btn')).toBe(true);
    expect(hasAttribute('data-testid', 'modal-filename-input')).toBe(true);
    expect(hasAttribute('data-testid', 'modal-caption-input')).toBe(true);
    expect(hasAttribute('data-testid', 'modal-save-caption-btn')).toBe(true);
    expect(hasAttribute('data-testid', 'modal-delete-media-btn')).toBe(true);
    expect(hasText('15.0 MB')).toBe(true);
    expect(hasText('9:16')).toBe(true);
    expect(hasText('0:45')).toBe(true);
    expect(hasText('Viral Launch Reel 🔥')).toBe(true);

    const buttons = findTags('button');
    const prevBtn = buttons.find(
      (b) => b.attributes['data-testid'] === 'preview-prev-btn'
    );
    const nextBtn = buttons.find(
      (b) => b.attributes['data-testid'] === 'preview-next-btn'
    );
    expect(prevBtn?.attributes['disabled']).toBeUndefined();
    expect(nextBtn?.attributes['disabled']).toBeUndefined();
  });
});

describe('Spec 029: BatchActionBar & Shift+Click Range Selection (US4, US6)', () => {
  it('renders selected count, Move to folder, Set caption, and Delete selected buttons when items are selected', () => {
    const { hasText, hasAttribute } = render(
      <BatchActionBar
        selectedIds={['id-1', 'id-2', 'id-3']}
        totalAvailableCount={5}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
        onBatchMove={vi.fn()}
        onBatchCaption={vi.fn()}
        onBatchDelete={vi.fn()}
      />
    );

    expect(hasAttribute('data-testid', 'batch-action-bar')).toBe(true);
    expect(hasText('3 selected')).toBe(true);
    expect(hasAttribute('data-testid', 'batch-select-all-btn')).toBe(true);
    expect(hasAttribute('data-testid', 'batch-clear-btn')).toBe(true);
    expect(hasAttribute('data-testid', 'batch-move-btn')).toBe(true);
    expect(hasAttribute('data-testid', 'batch-caption-btn')).toBe(true);
    expect(hasAttribute('data-testid', 'batch-delete-btn')).toBe(true);
  });

  it('computes contiguous range selection when Shift+Click is used', () => {
    const displayedIds = ['m1', 'm2', 'm3', 'm4', 'm5'];
    const selectedRange = computeRangeSelection(
      displayedIds,
      ['m2'],
      'm4',
      'm2',
      true
    );
    expect(selectedRange).toEqual(['m2', 'm3', 'm4']);

    // Single click without shift toggles individual item
    const toggledSingle = computeRangeSelection(
      displayedIds,
      ['m2', 'm3', 'm4'],
      'm3',
      'm4',
      false
    );
    expect(toggledSingle).toEqual(['m2', 'm4']);
  });
});

describe('Spec 029: MediaLibraryExplorer, Global Search, Infinite Scroll, URL Sync & Duplicate Guard (US1, US4, US5, US6, US7)', () => {
  it('computes ancestor breadcrumbs, formatted ancestry path labels, and recursive folder deletion impact accurately', () => {
    const trail = buildFolderBreadcrumbs(
      '33333333-3333-4333-8333-333333333333',
      SAMPLE_FOLDERS
    );
    expect(trail.map((f) => f.name)).toEqual(['Campaign A', 'Reels', 'Week 1']);

    expect(formatFolderAncestryPath(null, SAMPLE_FOLDERS)).toBe('All Media');
    expect(
      formatFolderAncestryPath(
        '22222222-2222-4222-8222-222222222222',
        SAMPLE_FOLDERS
      )
    ).toBe('Campaign A / Reels');

    // Campaign A has 2 direct items + Reels (5 items) + Week 1 (3 items) + Photos (4 items) = 14 total items and 3 descendant subfolders
    const impact = computeFolderSubtreeImpact(
      '11111111-1111-4111-8111-111111111111',
      SAMPLE_FOLDERS
    );
    expect(impact.subfolderCount).toBe(3);
    expect(impact.totalMediaCount).toBe(14);
  });

  it('filters by active folder when searchQuery is empty and searches globally across all nested folders when searchQuery is non-empty', () => {
    const rootVideos = filterAndSortMediaItems(SAMPLE_MEDIA_ITEMS, {
      currentFolderId: null,
      mediaTypeFilter: 'video',
      searchQuery: '',
      sortOption: 'created_at:desc',
    });
    expect(rootVideos).toHaveLength(1);
    expect(rootVideos[0]?.name).toBe('Viral Launch Reel.mp4');

    const sortedByName = filterAndSortMediaItems(SAMPLE_MEDIA_ITEMS, {
      currentFolderId: null,
      mediaTypeFilter: 'all',
      searchQuery: '',
      sortOption: 'name:asc',
    });
    expect(sortedByName.map((i) => i.name)).toEqual([
      'Product_Showcase_Banner.png',
      'Viral Launch Reel.mp4',
    ]);

    // Global search across all folders: returns both root item and nested folder item matching "viral"
    const globalSearchMatches = filterAndSortMediaItems(SAMPLE_MEDIA_ITEMS, {
      currentFolderId: null,
      mediaTypeFilter: 'all',
      searchQuery: 'viral',
      sortOption: 'created_at:desc',
    });
    expect(globalSearchMatches).toHaveLength(2);
    expect(globalSearchMatches.map((i) => i.name)).toEqual([
      'Nested_Folder_Clip.mp4',
      'Viral Launch Reel.mp4',
    ]);
  });

  it('renders global search results across nested folders with clickable folder path badges on media cards', () => {
    const { hasText, hasAttribute } = render(
      <MediaLibraryExplorer
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialMediaItems={SAMPLE_MEDIA_ITEMS}
        initialCurrentFolderId={null}
        initialSearchQuery="viral"
      />
    );

    // Both root item (aaaaaaaa...1) and nested folder item (aaaaaaaa...3) match "viral"
    expect(
      hasAttribute(
        'data-testid',
        'media-folder-path-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      )
    ).toBe(true);
    expect(
      hasAttribute(
        'data-testid',
        'media-folder-path-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'
      )
    ).toBe(true);
    expect(hasText('Campaign A / Reels')).toBe(true);
    expect(hasText('Nested_Folder_Clip.mp4')).toBe(true);
    expect(hasText('Viral Launch Reel.mp4')).toBe(true);
  });

  it('renders Infinite Scroll sentinel and Load More button when totalMediaCount exceeds loaded items', () => {
    const { hasText, hasAttribute } = render(
      <MediaLibraryExplorer
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialMediaItems={SAMPLE_MEDIA_ITEMS.slice(0, 2)}
        initialTotalMediaCount={250}
        initialCurrentFolderId={null}
      />
    );

    expect(hasAttribute('data-testid', 'infinite-scroll-sentinel')).toBe(true);
    expect(hasAttribute('data-testid', 'load-more-media-btn')).toBe(true);
    expect(hasText('Load more (Showing 2 of 250)')).toBe(true);
  });

  it('detects duplicate files against existing folder items and intra-batch duplicates and renders Duplicate Files Detected modal', () => {
    const dupFile = new File(['x'], 'Viral Launch Reel.mp4', { type: 'video/mp4' });
    Object.defineProperty(dupFile, 'size', { value: 15728640 });

    const newFile = new File(['y'], 'Brand_New_Clip.mp4', { type: 'video/mp4' });
    Object.defineProperty(newFile, 'size', { value: 4194304 });

    const intraDupFile = new File(['y'], 'Brand_New_Clip.mp4', { type: 'video/mp4' });
    Object.defineProperty(intraDupFile, 'size', { value: 4194304 });

    const entries = [
      { file: dupFile, relativePath: 'Viral Launch Reel.mp4' },
      { file: newFile, relativePath: 'Brand_New_Clip.mp4' },
      { file: intraDupFile, relativePath: 'Brand_New_Clip.mp4' },
    ];

    const detection = detectDuplicateUploadEntries(
      entries,
      SAMPLE_MEDIA_ITEMS,
      SAMPLE_FOLDERS,
      null
    );

    expect(detection.duplicates).toHaveLength(2);
    expect(detection.uniqueEntries).toHaveLength(1);
    expect(detection.uniqueEntries[0]?.file.name).toBe('Brand_New_Clip.mp4');

    const { hasText, hasAttribute } = render(
      <MediaLibraryExplorer
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialMediaItems={SAMPLE_MEDIA_ITEMS}
        initialPendingDuplicateUpload={{
          allEntries: entries,
          uniqueEntries: detection.uniqueEntries,
          duplicates: detection.duplicates,
        }}
      />
    );

    expect(hasAttribute('data-testid', 'duplicate-upload-modal')).toBe(true);
    expect(hasAttribute('data-testid', 'skip-duplicates-btn')).toBe(true);
    expect(hasAttribute('data-testid', 'upload-all-anyway-btn')).toBe(true);
    expect(hasText('2 Duplicate Files Detected')).toBe(true);
    expect(hasText('Skip duplicates (2)')).toBe(true);
    expect(hasText('Upload all anyway')).toBe(true);
  });

  it('renders MediaLibraryExplorer with breadcrumb navigation, nested subfolders, destructive delete folder modal impact, and strict theme compliance', () => {
    const campaignA = SAMPLE_FOLDERS[0]!;
    const { hasText, hasAttribute, html } = render(
      <MediaLibraryExplorer
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialMediaItems={SAMPLE_MEDIA_ITEMS}
        initialCurrentFolderId="11111111-1111-4111-8111-111111111111"
        initialDeleteFolderTarget={campaignA}
      />
    );

    // Breadcrumb bar shows All Media / Campaign A
    expect(hasAttribute('data-testid', 'folder-breadcrumbs')).toBe(true);
    expect(hasAttribute('data-testid', 'breadcrumb-root')).toBe(true);
    expect(
      hasAttribute(
        'data-testid',
        'breadcrumb-folder-11111111-1111-4111-8111-111111111111'
      )
    ).toBe(true);

    // Search, Filter & Sort toolbar
    expect(hasAttribute('data-testid', 'media-explorer-toolbar')).toBe(true);
    expect(hasAttribute('data-testid', 'media-search-input')).toBe(true);
    expect(hasAttribute('data-testid', 'filter-type-all')).toBe(true);
    expect(hasAttribute('data-testid', 'filter-type-video')).toBe(true);
    expect(hasAttribute('data-testid', 'filter-type-image')).toBe(true);
    expect(hasAttribute('data-testid', 'media-sort-select')).toBe(true);

    // Subfolders inside Campaign A ("Reels" and "Photos") are rendered
    expect(hasAttribute('data-testid', 'subfolders-grid')).toBe(true);
    expect(hasText('Reels')).toBe(true);
    expect(hasText('Photos')).toBe(true);

    // Destructive Delete Folder confirmation modal displays exact recursive subfolder & media file counts
    expect(hasAttribute('data-testid', 'delete-folder-modal')).toBe(true);
    expect(hasAttribute('data-testid', 'delete-folder-impact-summary')).toBe(true);
    expect(hasText('3 subfolders')).toBe(true);
    expect(hasText('14 media files')).toBe(true);

    // Strict DESIGN.md & theme.ts compliance: zero decorative status dots, zero capsule pill badges
    expect(html).not.toContain('data-slot="status-dot"');
    expect(html).not.toContain('9999px');
    expect(html).toContain(PALETTE.primary);
  });
});
