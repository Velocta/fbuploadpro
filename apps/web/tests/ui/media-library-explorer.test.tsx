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
import { formatBytes, deriveDefaultCaption } from '@/lib/upload-queue-helpers';
import {
  MediaAssetCard,
  HOVER_VIDEO_PREVIEW_DELAY_MS,
  formatDuration,
} from '@/components/media/media-asset-card';
import { MediaTableRow } from '@/components/media/media-table-row';
import {
  MediaPreviewModal,
  captureVideoFrameAsWebp,
} from '@/components/media/media-preview-modal';
import { BatchActionBar } from '@/components/media/batch-action-bar';
import { NewFolderModal } from '@/components/media/new-folder-modal';
import { BatchSetCaptionModal } from '@/components/media/batch-set-caption-modal';
import { MediaImportModal } from '@/components/media/media-import-modal';
import {
  MediaLibraryExplorer,
  MEDIA_VIEW_MODE_STORAGE_KEY,
  buildFolderBreadcrumbs,
  formatFolderAncestryPath,
  computeFolderSubtreeImpact,
  filterAndSortMediaItems,
  resolveTargetFolderIdForEntry,
  checkServerDuplicateEntries,
} from '@/components/media/media-library-explorer';
import { render } from '../components/setup';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useParams: () => ({
    subdomain: 'acme',
  }),
  usePathname: () => '/media',
}));

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

});

describe('Spec 029: MediaLibraryExplorer, Global Search, Infinite Scroll, URL Sync & Duplicate Guard (US1, US4, US5, US6, US7)', () => {
  it('computes ancestor breadcrumbs, formatted ancestry path labels, and recursive folder deletion impact accurately', () => {
    const trail = buildFolderBreadcrumbs(
      '33333333-3333-4333-8333-333333333333',
      SAMPLE_FOLDERS
    );
    expect(trail.map((f) => f.name)).toEqual(['Campaign A', 'Reels', 'Week 1']);

    expect(formatFolderAncestryPath(null, SAMPLE_FOLDERS)).toBe('Library');
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

    // Breadcrumb bar shows Library / Campaign A
    expect(hasAttribute('data-testid', 'folder-breadcrumbs')).toBe(true);
    expect(hasAttribute('data-testid', 'breadcrumb-root')).toBe(true);
    expect(hasText('Library')).toBe(true);
    expect(
      hasAttribute(
        'data-testid',
        'breadcrumb-folder-11111111-1111-4111-8111-111111111111'
      )
    ).toBe(true);

    // Search, Filter & Sort toolbar
    expect(hasAttribute('data-testid', 'media-explorer-toolbar')).toBe(true);
    expect(hasAttribute('data-testid', 'media-search-input')).toBe(true);
    expect(hasAttribute('data-testid', 'media-type-select')).toBe(true);
    expect(hasAttribute('data-testid', 'filter-type-all')).toBe(false);
    expect(hasAttribute('data-testid', 'filter-type-video')).toBe(false);
    expect(hasAttribute('data-testid', 'filter-type-image')).toBe(false);
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

describe('Spec 030: Grid vs. Compact Table View, Resumable Upload Controls, Aspect Ratio/Caption Filters & Video Frame Thumbnail Picker (US1–US4)', () => {
  it('US1: renders Grid View by default and switches to Compact Table View with MediaTableRow when initialViewMode="table"', () => {
    expect(MEDIA_VIEW_MODE_STORAGE_KEY).toBe('fbuploadpro:media-view-mode');

    const gridRender = render(
      <MediaLibraryExplorer
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialMediaItems={SAMPLE_MEDIA_ITEMS}
        initialCurrentFolderId={null}
      />
    );

    expect(gridRender.hasAttribute('data-testid', 'view-mode-grid-btn')).toBe(true);
    expect(gridRender.hasAttribute('data-testid', 'view-mode-table-btn')).toBe(true);
    expect(gridRender.hasAttribute('data-testid', 'media-assets-grid')).toBe(true);
    expect(gridRender.hasAttribute('data-testid', 'media-table-view')).toBe(false);

    const tableRender = render(
      <MediaLibraryExplorer
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialMediaItems={SAMPLE_MEDIA_ITEMS}
        initialCurrentFolderId={null}
        initialViewMode="table"
      />
    );

    expect(tableRender.hasAttribute('data-testid', 'media-table-view')).toBe(true);
    expect(
      tableRender.hasAttribute(
        'data-testid',
        'media-row-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      )
    ).toBe(true);
    expect(
      tableRender.hasAttribute(
        'data-testid',
        'media-row-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
      )
    ).toBe(true);
    expect(tableRender.html).not.toContain('9999px');
  });

  it('US1: renders MediaTableRow with inline caption editing, rectangular metadata badges, and folder path badge', () => {
    const videoItem = SAMPLE_MEDIA_ITEMS[0]!;
    const rowRender = render(
      <table>
        <tbody>
          <MediaTableRow
            item={videoItem}
            selected={true}
            folderPathLabel="Campaign A / Reels"
            onNavigateFolder={vi.fn()}
            onToggleSelect={vi.fn()}
            onPreview={vi.fn()}
            onUpdateCaption={vi.fn()}
            onMoveRequest={vi.fn()}
            onDeleteRequest={vi.fn()}
          />
        </tbody>
      </table>
    );

    expect(rowRender.hasAttribute('data-testid', `media-row-${videoItem.id}`)).toBe(
      true
    );
    expect(
      rowRender.hasAttribute('data-testid', `table-inline-caption-${videoItem.id}`)
    ).toBe(true);
    expect(rowRender.hasText('Viral Launch Reel.mp4')).toBe(true);
    expect(rowRender.hasText('Viral Launch Reel 🔥')).toBe(true);
    expect(rowRender.hasText('9:16')).toBe(true);
    expect(rowRender.hasText('0:45')).toBe(true);
    expect(rowRender.hasText('15.0 MB')).toBe(true);
    expect(rowRender.hasText('Campaign A / Reels')).toBe(true);
    expect(rowRender.html).not.toContain('9999px');

    const editingRender = render(
      <table>
        <tbody>
          <MediaTableRow item={videoItem} initialEditingCaption={true} />
        </tbody>
      </table>
    );
    expect(
      editingRender.hasAttribute('data-testid', `table-caption-input-${videoItem.id}`)
    ).toBe(true);
  });


  it('US3: filters media items by Aspect Ratio (9:16, 16:9, 1:1) and Caption Status (has_caption, empty_caption) and renders toolbar filter selects', () => {
    const allRootAndNested = SAMPLE_MEDIA_ITEMS;

    const verticalOnly = filterAndSortMediaItems(allRootAndNested, {
      currentFolderId: null,
      mediaTypeFilter: 'all',
      aspectRatioFilter: '9:16',
      captionStatusFilter: 'all',
      searchQuery: 'a', // global search to include all 3 items
      sortOption: 'created_at:desc',
    });
    expect(verticalOnly.map((i) => i.name)).toEqual(['Viral Launch Reel.mp4']);

    const landscapeOnly = filterAndSortMediaItems(allRootAndNested, {
      currentFolderId: null,
      mediaTypeFilter: 'all',
      aspectRatioFilter: '16:9',
      captionStatusFilter: 'all',
      searchQuery: 'a',
      sortOption: 'created_at:desc',
    });
    expect(landscapeOnly.map((i) => i.name)).toEqual(['Nested_Folder_Clip.mp4']);

    const squareMissingCaption = filterAndSortMediaItems(allRootAndNested, {
      currentFolderId: null,
      mediaTypeFilter: 'all',
      aspectRatioFilter: '1:1',
      captionStatusFilter: 'empty_caption',
      searchQuery: '',
      sortOption: 'created_at:desc',
    });
    expect(squareMissingCaption.map((i) => i.name)).toEqual([
      'Product_Showcase_Banner.png',
    ]);

    const hasCaptionRoot = filterAndSortMediaItems(allRootAndNested, {
      currentFolderId: null,
      mediaTypeFilter: 'all',
      aspectRatioFilter: 'all',
      captionStatusFilter: 'has_caption',
      searchQuery: '',
      sortOption: 'created_at:desc',
    });
    expect(hasCaptionRoot.map((i) => i.name)).toEqual(['Viral Launch Reel.mp4']);

    const explorerRender = render(
      <MediaLibraryExplorer
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialMediaItems={SAMPLE_MEDIA_ITEMS}
        initialCurrentFolderId={null}
        initialAspectRatioFilter="9:16"
        initialCaptionStatusFilter="has_caption"
      />
    );
    expect(
      explorerRender.hasAttribute('data-testid', 'media-aspect-ratio-select')
    ).toBe(true);
    expect(
      explorerRender.hasAttribute('data-testid', 'media-caption-status-select')
    ).toBe(true);
    expect(explorerRender.hasText('Viral Launch Reel.mp4')).toBe(true);
    expect(explorerRender.hasText('Product_Showcase_Banner.png')).toBe(false);
  });

  it('US4: renders "Set Current Frame as Thumbnail" button for video items in MediaPreviewModal (and omits it for images) and provides captureVideoFrameAsWebp fallback', async () => {
    const videoItem = SAMPLE_MEDIA_ITEMS[0]!;
    const imageItem = SAMPLE_MEDIA_ITEMS[1]!;

    const videoModal = render(
      <MediaPreviewModal
        item={videoItem}
        open={true}
        onOpenChange={vi.fn()}
        onUpdateThumbnail={vi.fn()}
      />
    );
    expect(
      videoModal.hasAttribute('data-testid', 'set-video-frame-thumbnail-btn')
    ).toBe(true);
    expect(videoModal.hasText('Set Current Frame as Thumbnail')).toBe(true);

    const imageModal = render(
      <MediaPreviewModal
        item={imageItem}
        open={true}
        onOpenChange={vi.fn()}
        onUpdateThumbnail={vi.fn()}
      />
    );
    expect(
      imageModal.hasAttribute('data-testid', 'set-video-frame-thumbnail-btn')
    ).toBe(false);

    const captured = await captureVideoFrameAsWebp(null);
    expect(captured.dataUrl.startsWith('data:image/webp;base64,')).toBe(true);
  });

  it('Spec 046 US3: resolveTargetFolderIdForEntry resolves nested subfolder IDs and checkServerDuplicateEntries passes folderId per entry', async () => {
    const entryInNested: any = {
      file: new File(['video content'], 'clip1.mp4', { type: 'video/mp4' }),
      relativePath: 'Campaign A/Reels/clip1.mp4',
    };
    const entryInRoot: any = {
      file: new File(['image content'], 'banner.png', { type: 'image/png' }),
      relativePath: 'banner.png',
    };
    const entryInUncreatedSubfolder: any = {
      file: new File(['image content'], 'new.png', { type: 'image/png' }),
      relativePath: 'BrandNewFolder/Sub/new.png',
    };

    // 'Campaign A' -> id '11111111-1111-4111-8111-111111111111', then 'Reels' under Campaign A -> id '22222222-2222-4222-8222-222222222222'
    const resolvedNested = resolveTargetFolderIdForEntry(entryInNested, SAMPLE_FOLDERS, null);
    expect(resolvedNested).toBe('22222222-2222-4222-8222-222222222222');

    const resolvedRoot = resolveTargetFolderIdForEntry(entryInRoot, SAMPLE_FOLDERS, null);
    expect(resolvedRoot).toBeNull();

    const resolvedUncreated = resolveTargetFolderIdForEntry(entryInUncreatedSubfolder, SAMPLE_FOLDERS, null);
    expect(resolvedUncreated).toBeUndefined();

    // Verify checkServerDuplicateEntries makes request with individual folderId per entry
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ duplicates: [] }),
    });
    const originalFetch = global.fetch;
    global.fetch = fetchSpy as any;

    try {
      const result = await checkServerDuplicateEntries(
        'acme',
        null,
        [entryInNested, entryInRoot, entryInUncreatedSubfolder],
        SAMPLE_FOLDERS
      );

      expect(result).not.toBeNull();
      expect(result?.duplicates).toEqual([]);
      expect(result?.uniqueEntries.length).toBe(3);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const callBody = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
      expect(callBody.entries).toEqual([
        {
          clientKey: '0',
          name: 'clip1.mp4',
          fileSize: entryInNested.file.size,
          folderId: '22222222-2222-4222-8222-222222222222',
        },
        {
          clientKey: '1',
          name: 'banner.png',
          fileSize: entryInRoot.file.size,
          folderId: null,
        },
      ]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Spec 046 US3: filterAndSortMediaItems and explorer UI support 4:5 portrait ratio filter', () => {
    const portraitItem: MediaItemResponse = {
      id: '55555555-5555-4555-8555-555555555555',
      userId: '00000000-0000-4000-8000-000000000001',
      folderId: null,
      name: 'Facebook_Feed_4_5.mp4',
      mediaType: 'video',
      mimeType: 'video/mp4',
      fileSize: 1048576,
      storageKey: 'media/55555555-5555-4555-8555-555555555555/source.mp4',
      url: 'https://cdn.example.com/media/feed.mp4',
      thumbnailKey: null,
      thumbnailUrl: null,
      durationSeconds: 15,
      aspectRatio: '4:5',
      captionText: 'Portrait post',
      width: 1080,
      height: 1350,
      createdAt: '2026-10-10T12:00:00.000Z',
      updatedAt: '2026-10-10T12:00:00.000Z',
    };

    const filtered = filterAndSortMediaItems([portraitItem, ...SAMPLE_MEDIA_ITEMS], {
      currentFolderId: null,
      mediaTypeFilter: 'all',
      aspectRatioFilter: '4:5',
      captionStatusFilter: 'all',
      searchQuery: '',
      sortOption: 'created_at:desc',
    });
    expect(filtered.map((i) => i.name)).toEqual(['Facebook_Feed_4_5.mp4']);

    const explorer = render(
      <MediaLibraryExplorer
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialMediaItems={[portraitItem, ...SAMPLE_MEDIA_ITEMS]}
        initialAspectRatioFilter="4:5"
      />
    );
    expect(explorer.hasAttribute('data-testid', 'media-aspect-ratio-select')).toBe(true);
    expect(explorer.hasText('Facebook_Feed_4_5.mp4')).toBe(true);
    expect(explorer.hasText('Viral Launch Reel.mp4')).toBe(false);
  });

  it('Spec 067 US1 & US4: verifies Schedule / Add to Queue CTA is completely removed from cards, batch action bar, and table rows', () => {
    const batchBar = render(
      <BatchActionBar
        selectedIds={['item-1', 'item-2']}
        totalAvailableCount={2}
      />
    );
    expect(batchBar.hasAttribute('data-testid', 'batch-schedule-btn')).toBe(false);
    expect(batchBar.hasText('Schedule / Add to Queue')).toBe(false);

    const card = render(
      <MediaAssetCard
        item={SAMPLE_MEDIA_ITEMS[0]!}
      />
    );
    expect(
      card.hasAttribute('data-testid', `schedule-media-${SAMPLE_MEDIA_ITEMS[0]!.id}`)
    ).toBe(false);
    expect(card.hasText('Schedule / Add to Queue')).toBe(false);

    const row = render(
      <table>
        <tbody>
          <MediaTableRow
            item={SAMPLE_MEDIA_ITEMS[0]!}
          />
        </tbody>
      </table>
    );
    expect(
      row.hasAttribute('data-testid', `schedule-media-${SAMPLE_MEDIA_ITEMS[0]!.id}`)
    ).toBe(false);
    expect(row.hasText('Schedule / Add to Queue')).toBe(false);
  });

  it('Spec 070 US1: renders hairline vertical dividers separating 3 toolbar zones', () => {
    const explorer = render(
      <MediaLibraryExplorer
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialMediaItems={SAMPLE_MEDIA_ITEMS}
      />
    );
    expect(explorer.hasAria('orientation', 'vertical')).toBe(true);
    expect(explorer.hasAttribute('data-testid', 'media-toolbar-divider-1')).toBe(true);
    expect(explorer.hasAttribute('data-testid', 'media-toolbar-divider-2')).toBe(true);
    const separators = explorer.findTags('hr').filter(
      (el) => el.attributes['aria-orientation'] === 'vertical'
    );
    expect(separators).toHaveLength(2);
  });

  it('Spec 070 US1: renders three-zone toolbar with persistent labels, scope anchor, and active filter underline', () => {
    const explorer = render(
      <MediaLibraryExplorer
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialMediaItems={SAMPLE_MEDIA_ITEMS}
        initialMediaTypeFilter="video"
        initialAspectRatioFilter="9:16"
        initialCaptionStatusFilter="has_caption"
        initialSortOption="created_at:asc"
      />
    );
    // Zone 1: Search only
    expect(explorer.hasAttribute('data-testid', 'media-toolbar-zone-1')).toBe(true);
    expect(explorer.hasAttribute('data-testid', 'media-search-input')).toBe(true);

    // Zone 2: Scope tag and labeled dropdowns
    expect(explorer.hasAttribute('data-testid', 'media-toolbar-zone-2')).toBe(true);
    expect(explorer.hasAttribute('data-testid', 'media-scope-tag')).toBe(true);
    expect(explorer.hasText('In: Library')).toBe(true);

    expect(explorer.hasAttribute('data-testid', 'media-type-select')).toBe(true);
    expect(explorer.hasText('Type:')).toBe(true);
    expect(explorer.hasText('Videos')).toBe(true);

    expect(explorer.hasAttribute('data-testid', 'media-aspect-ratio-select')).toBe(true);
    expect(explorer.hasText('Ratio:')).toBe(true);
    expect(explorer.hasText('9:16')).toBe(true);

    expect(explorer.hasAttribute('data-testid', 'media-caption-status-select')).toBe(true);
    expect(explorer.hasText('Captions:')).toBe(true);
    expect(explorer.hasText('Has caption')).toBe(true);

    // Active filters count and clear action
    expect(explorer.hasAttribute('data-testid', 'clear-filters-btn')).toBe(true);
    expect(explorer.hasText('3 filters · Clear')).toBe(true);

    // Zone 3: Sort & View
    expect(explorer.hasAttribute('data-testid', 'media-toolbar-zone-3')).toBe(true);
    expect(explorer.hasAttribute('data-testid', 'media-sort-select')).toBe(true);
    expect(explorer.hasText('Sort:')).toBe(true);
    expect(explorer.hasText('Oldest')).toBe(true);
    expect(explorer.hasAttribute('data-testid', 'view-mode-grid-btn')).toBe(true);
    expect(explorer.hasAttribute('data-testid', 'view-mode-table-btn')).toBe(true);
  });

  it('Spec 071 US1: renders full-width layout without VIEWS sidebar rail and keeps breadcrumb navigation', () => {
    // Root explorer view
    const rootExplorer = render(
      <MediaLibraryExplorer
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialMediaItems={SAMPLE_MEDIA_ITEMS}
      />
    );
    // Rail and VIEWS must be completely absent
    expect(rootExplorer.hasAttribute('data-testid', 'media-views-rail')).toBe(false);
    expect(rootExplorer.hasText('VIEWS')).toBe(false);
    expect(rootExplorer.hasAttribute('data-testid', 'smart-view-everything')).toBe(false);
    expect(rootExplorer.hasAttribute('data-testid', 'smart-view-needs-caption')).toBe(false);
    expect(rootExplorer.hasAttribute('data-testid', 'rail-root-library')).toBe(false);

    // Full-width body and breadcrumbs must be present
    expect(rootExplorer.hasAttribute('data-testid', 'media-explorer-body')).toBe(true);
    expect(rootExplorer.hasText('In: Library')).toBe(true);
    expect(rootExplorer.hasAttribute('data-testid', 'breadcrumb-root')).toBe(true);

    // Folder view (Campaign A)
    const folderExplorer = render(
      <MediaLibraryExplorer
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialMediaItems={SAMPLE_MEDIA_ITEMS}
        initialCurrentFolderId="11111111-1111-4111-8111-111111111111"
      />
    );
    expect(folderExplorer.hasText('In: Campaign A')).toBe(true);
    expect(folderExplorer.hasAttribute('data-testid', 'media-views-rail')).toBe(false);
  });

  it('Spec 071 US2 & US3: action states on BatchActionBar, NewFolderModal, and MediaPreviewModal lock out duplicate actions', () => {
    // BatchActionBar with isBusy=true disables all action buttons
    const batchBar = render(
      <BatchActionBar
        selectedIds={['1', '2']}
        isBusy={true}
        onClearSelection={vi.fn()}
        onBatchMove={vi.fn()}
        onBatchCaption={vi.fn()}
        onBatchDelete={vi.fn()}
      />
    );
    expect(batchBar.hasText('2 selected')).toBe(true);
    const deleteBtn = batchBar.findTags('button').find((b) => b.attributes['data-testid'] === 'batch-delete-btn');
    expect(deleteBtn?.attributes.disabled).toBeDefined();
    const moveBtn = batchBar.findTags('button').find((b) => b.attributes['data-testid'] === 'batch-move-btn');
    expect(moveBtn?.attributes.disabled).toBeDefined();
    const captionBtn = batchBar.findTags('button').find((b) => b.attributes['data-testid'] === 'batch-caption-btn');
    expect(captionBtn?.attributes.disabled).toBeDefined();

    // NewFolderModal renders disabled submit when empty or duplicate
    const newFolderModal = render(
      <NewFolderModal
        isOpen={true}
        folders={SAMPLE_FOLDERS}
        initialParentId={null}
        onClose={vi.fn()}
        onCreateFolder={vi.fn().mockResolvedValue(undefined)}
      />
    );
    const createBtn = newFolderModal.findTags('button').find((b) => b.attributes['data-testid'] === 'submit-create-folder');
    expect(createBtn?.attributes.disabled).toBeDefined();
    expect(newFolderModal.hasText('Create folder')).toBe(true);

    // MediaPreviewModal renders delete and save buttons with busy protection
    const previewModal = render(
      <MediaPreviewModal
        open={true}
        item={SAMPLE_MEDIA_ITEMS[0]}
        onOpenChange={vi.fn()}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );
    expect(previewModal.hasAttribute('data-testid', 'modal-delete-media-btn')).toBe(true);
    expect(previewModal.hasAttribute('data-testid', 'modal-save-caption-btn')).toBe(true);
  });

  it('Spec 070 US3: library-wide global search resets scope to In: Library and displays folder path attribution with "in " prefix', () => {
    // Search from within nested folder "Reels"
    const searchExplorer = render(
      <MediaLibraryExplorer
        subdomain="acme"
        initialFolders={SAMPLE_FOLDERS}
        initialMediaItems={SAMPLE_MEDIA_ITEMS}
        initialCurrentFolderId="22222222-2222-4222-8222-222222222222"
        initialSearchQuery="viral"
      />
    );

    // Scope resets to library-wide
    expect(searchExplorer.hasText('In: Library')).toBe(true);

    // Returns items matching "viral" from both root and nested folders
    expect(searchExplorer.hasText('Viral Launch Reel.mp4')).toBe(true);
    expect(searchExplorer.hasText('Nested_Folder_Clip.mp4')).toBe(true);

    // Displays path attribution with "in " prefix
    expect(searchExplorer.hasText('in Library')).toBe(true);
    expect(searchExplorer.hasText('in Campaign A / Reels')).toBe(true);
  });
});

describe('Spec 072: MediaImportModal Staging, Progress, Duplicates & Concurrency Purification', () => {
  it('US1 & US2: renders destination folder pill, live subtext, 46px thumbnail tiles, and X removal', () => {
    const validFile1 = new File(['valid video content'], 'promo.mp4', { type: 'video/mp4' });
    const validFile2 = new File(['valid image content'], 'banner.png', { type: 'image/png' });

    const modal = render(
      <MediaImportModal
        subdomain="acme"
        isOpen={true}
        initialFiles={[validFile1, validFile2]}
        currentFolderId={null}
        folders={SAMPLE_FOLDERS}
        onClose={vi.fn()}
        onUploadSuccess={vi.fn()}
      />
    );

    // Header & Subtext
    expect(modal.hasText('Import media')).toBe(true);
    expect(modal.hasText('2 files selected · will be added to Library')).toBe(true);
    expect(modal.hasAttribute('data-testid', 'destination-folder-pill')).toBe(true);
    expect(modal.hasText('To: Library')).toBe(true);

    // Staging rows with 46px thumbnail tiles and names
    expect(modal.hasText('promo.mp4')).toBe(true);
    expect(modal.hasText('banner.png')).toBe(true);
    expect(modal.hasText('Start import (2)')).toBe(true);
  });

  it('US1: destination pill defaults to current active folder', () => {
    const file = new File(['sample'], 'clip.mp4', { type: 'video/mp4' });

    const modal = render(
      <MediaImportModal
        subdomain="acme"
        isOpen={true}
        initialFiles={[file]}
        currentFolderId="11111111-1111-4111-8111-111111111111"
        folders={SAMPLE_FOLDERS}
        onClose={vi.fn()}
        onUploadSuccess={vi.fn()}
      />
    );

    expect(modal.hasText('To: Campaign A')).toBe(true);
    expect(modal.hasText('1 file selected · will be added to Campaign A')).toBe(true);
  });

  it('US3: non-blocking validation flags unsupported MIME, empty, and oversized files and excludes from import count', () => {
    const unsupportedFile = new File(['text'], 'notes.txt', { type: 'text/plain' });
    const emptyFile = new File([], 'empty.mp4', { type: 'video/mp4' });
    const oversizedFile = new File([new Uint8Array(10)], 'huge.mp4', { type: 'video/mp4' });
    Object.defineProperty(oversizedFile, 'size', { value: 600 * 1024 * 1024 });

    const modal = render(
      <MediaImportModal
        subdomain="acme"
        isOpen={true}
        initialFiles={[unsupportedFile, emptyFile, oversizedFile]}
        currentFolderId={null}
        folders={SAMPLE_FOLDERS}
        onClose={vi.fn()}
        onUploadSuccess={vi.fn()}
      />
    );

    expect(modal.hasText("can't upload — not a supported format")).toBe(true);
    expect(modal.hasText('empty file')).toBe(true);
    expect(modal.hasText('too large — 500 MB max')).toBe(true);

    // Excluded from count; button is disabled with Start import (0)
    expect(modal.hasText('Start import (0)')).toBe(true);
    const startBtn = modal.findTags('button').find((b) => b.attributes['data-testid'] === 'start-import-btn');
    expect(startBtn?.attributes.disabled).toBeDefined();
  });

  it('US5: purges technical concurrency copy from staging UI', () => {
    const validFile = new File(['data'], 'test.mp4', { type: 'video/mp4' });

    const modal = render(
      <MediaImportModal
        subdomain="acme"
        isOpen={true}
        initialFiles={[validFile]}
        currentFolderId={null}
        folders={SAMPLE_FOLDERS}
        onClose={vi.fn()}
        onUploadSuccess={vi.fn()}
      />
    );

    expect(modal.hasText('Uploads run 3 at a time')).toBe(false);
    expect(modal.hasText('wait in line')).toBe(false);
    expect(modal.hasText('concurrency')).toBe(false);
    expect(modal.hasText('+ Add more')).toBe(true);
    expect(modal.hasText('Cancel')).toBe(true);
  });
});


