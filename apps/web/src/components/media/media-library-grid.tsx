'use client';

import React from 'react';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { CircleAlertIcon, ImageIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/shared/ui/alert';
import { Button } from '@/components/shared/ui/button';
import { EmptyState } from '@/components/shared/ui/empty-state';
import { Skeleton } from '@/components/shared/ui/skeleton';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shared/ui/table';
import { MediaAssetCard } from './media-asset-card';
import { MediaTableRow } from './media-table-row';
import type { MediaViewMode, MediaSmartViewKey } from './media-types';
import { formatFolderAncestryPath } from './media-library-breadcrumbs';
import { getEmptyStateInfo } from './media-library-filters';

export interface MediaCanvasProps {
  displayedMediaItems: MediaItemResponse[];
  viewMode: MediaViewMode;
  isLoading: boolean;
  selectedIds: string[];
  debouncedSearch: string;
  folders: MediaFolder[];
  activeSmartView: MediaSmartViewKey | null;
  /** Total assets in the library (unfiltered), for the loaded/total line. */
  totalMediaCount?: number;
  /** Number of active local filters (Type/Ratio/Captions). */
  activeFilterCount?: number;
  /** Human labels of the active local filters, echoed in the empty state. */
  activeFilterLabels?: string[];
  /** Name of the folder being viewed (folder-empty state), if any. */
  currentFolderName?: string | null;
  /** The library query failed (section-scope error state). */
  isError?: boolean;
  onRetry?: () => void;
  onClearSearch?: () => void;
  onClearFilters?: () => void;
  onUploadClick?: () => void;
  onNavigateFolder: (folderId: string | null) => void;
  onToggleSelect: (mediaId: string, options?: { shiftKey?: boolean | undefined }) => void;
  onPreview: (item: MediaItemResponse) => void;
  onUpdateCaption: (mediaId: string, captionText: string) => void;
  onMoveRequest: (item: MediaItemResponse) => void;
  onDeleteRequest: (mediaId: string) => void;
}

/**
 * The browse canvas (spec 133 §6.2): grid of boxless tiles or the
 * shared/ui Table pattern, plus the typed empty-state inventory of
 * spec §8.3 — exactly one state per cause, each with exactly one
 * primary action. Local filtering acknowledges without a spinner
 * (the canvas simply re-renders); the loading skeleton sits at the
 * grid's final geometry.
 */
export function MediaCanvas({
  displayedMediaItems,
  viewMode,
  isLoading,
  selectedIds,
  debouncedSearch,
  folders,
  activeSmartView,
  totalMediaCount,
  activeFilterCount = 0,
  activeFilterLabels = [],
  currentFolderName = null,
  isError = false,
  onRetry,
  onClearSearch,
  onClearFilters,
  onUploadClick,
  onNavigateFolder,
  onToggleSelect,
  onPreview,
  onUpdateCaption,
  onMoveRequest,
  onDeleteRequest,
}: Readonly<MediaCanvasProps>) {
  if (isError) {
    return (
      <Alert variant="destructive" data-testid="media-error-state" className="mt-2">
        <CircleAlertIcon className="size-5 shrink-0" aria-hidden />
        <div className="flex flex-col items-start gap-2">
          <AlertTitle>Couldn&apos;t load your library</AlertTitle>
          <AlertDescription>
            Your files are safe — this was a loading problem. Try again.
          </AlertDescription>
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="media-error-retry-btn"
              onClick={onRetry}
              className="h-10 md:h-8"
            >
              Retry
            </Button>
          ) : null}
        </div>
      </Alert>
    );
  }

  if (displayedMediaItems.length > 0) {
    const loadedCount = displayedMediaItems.length;
    const totalCount = totalMediaCount ?? loadedCount;
    return (
      <>
        {viewMode === 'grid' ? (
          <div
            data-testid="media-assets-grid"
            className="mt-1 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-4 2xl:grid-cols-5"
          >
            {displayedMediaItems.map((item) => (
              <MediaAssetCard
                key={item.id}
                item={item}
                selected={selectedIds.includes(item.id)}
                folderPathLabel={
                  debouncedSearch ? `in ${formatFolderAncestryPath(item.folderId, folders)}` : null
                }
                onNavigateFolder={onNavigateFolder}
                onToggleSelect={onToggleSelect}
                onPreview={onPreview}
                onUpdateCaption={onUpdateCaption}
                onMoveRequest={onMoveRequest}
                onDeleteRequest={() => onDeleteRequest(item.id)}
              />
            ))}
          </div>
        ) : (
          <div data-testid="media-table-view" className="mt-1 w-full">
            <Table data-testid="media-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <span className="sr-only">Select</span>
                  </TableHead>
                  <TableHead className="w-12 px-0">
                    <span className="sr-only">Thumbnail</span>
                  </TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Caption</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedMediaItems.map((item) => (
                  <MediaTableRow
                    key={item.id}
                    item={item}
                    selected={selectedIds.includes(item.id)}
                    folderPathLabel={
                      debouncedSearch
                        ? `in ${formatFolderAncestryPath(item.folderId, folders)}`
                        : null
                    }
                    onNavigateFolder={onNavigateFolder}
                    onToggleSelect={onToggleSelect}
                    onPreview={onPreview}
                    onUpdateCaption={onUpdateCaption}
                    onMoveRequest={onMoveRequest}
                    onDeleteRequest={() => onDeleteRequest(item.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {/* Loaded/total relationship (UI Rule 10 / PB-21) */}
        <p data-testid="media-loaded-count" className="pt-4 text-xs text-ink-dim tabular-nums">
          Showing {loadedCount} of {totalCount} {totalCount === 1 ? 'file' : 'files'}
        </p>
      </>
    );
  }

  if (isLoading) {
    return (
      <div
        data-testid="media-loading-state"
        aria-busy="true"
        aria-label="Loading media"
        className="mt-1 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-4 2xl:grid-cols-5"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  /* ---- Typed empty states (spec §8.3) ---- */
  const legacy = getEmptyStateInfo(activeSmartView, debouncedSearch);

  // Needs-caption smart view, all captioned — positive cleared state.
  if (activeSmartView === 'needs_caption') {
    return (
      <EmptyState
        type="cleared"
        data-testid="media-empty-state"
        icon={<ImageIcon className="size-10 text-ink-dim" aria-hidden />}
        title={legacy.title}
        description={legacy.subtext}
      />
    );
  }

  // No results — search (library-wide; echoes the query).
  if (debouncedSearch) {
    return (
      <EmptyState
        type="no-results"
        data-testid="media-empty-state"
        icon={<ImageIcon className="size-10 text-ink-dim" aria-hidden />}
        title={legacy.title}
        description={`No files match “${debouncedSearch}”. Search looks across your whole library, in every folder.`}
        action={
          onClearSearch ? (
            <Button
              type="button"
              data-testid="media-empty-clear-search-btn"
              onClick={onClearSearch}
              className="h-11 md:h-10"
            >
              Clear search
            </Button>
          ) : undefined
        }
      />
    );
  }

  // No results — local filters on the current view (search query kept).
  if (activeFilterCount > 0) {
    return (
      <EmptyState
        type="no-results"
        data-testid="media-empty-state"
        icon={<ImageIcon className="size-10 text-ink-dim" aria-hidden />}
        title="No files match these filters"
        description="Try widening the filters, or clear them to see everything in this view."
        activeFilters={activeFilterLabels}
        action={
          onClearFilters ? (
            <Button
              type="button"
              data-testid="media-empty-clear-filters-btn"
              onClick={onClearFilters}
              className="h-11 md:h-10"
            >
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );
  }

  // First use — the library is totally empty.
  if ((totalMediaCount ?? 0) === 0 && folders.length === 0 && !activeSmartView) {
    return (
      <EmptyState
        type="first-use"
        data-testid="media-empty-state"
        icon={<ImageIcon className="size-10 text-ink-dim" aria-hidden />}
        title="Your media library is empty"
        description="Upload photos and videos here once, then schedule them to every platform from one place."
        action={
          onUploadClick ? (
            <Button
              type="button"
              data-testid="media-empty-upload-btn"
              onClick={onUploadClick}
              className="h-11 md:h-10"
            >
              Upload Files
            </Button>
          ) : undefined
        }
      />
    );
  }

  // Folder empty (including a just-created folder).
  return (
    <EmptyState
      type="first-use"
      data-testid="media-empty-state"
      icon={<ImageIcon className="size-10 text-ink-dim" aria-hidden />}
      title={currentFolderName ? `No media in ${currentFolderName}` : legacy.title}
      description={legacy.subtext}
      action={
        onUploadClick ? (
          <Button
            type="button"
            data-testid="media-empty-upload-btn"
            onClick={onUploadClick}
            className="h-11 md:h-10"
          >
            Upload Files
          </Button>
        ) : undefined
      }
    />
  );
}
