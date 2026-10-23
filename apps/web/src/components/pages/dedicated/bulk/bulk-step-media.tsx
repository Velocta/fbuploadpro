'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import {
  BULK_MAX_ITEMS,
  type MediaFolder,
  type MediaItemResponse,
} from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import { MediaListResponseSchema, type MediaItem } from '@/lib/api/schemas/media';
import { queryKeys } from '@/lib/data/query-keys';
import { Button } from '@/components/shared/ui/button';
import { Skeleton } from '@/components/shared/ui/skeleton';
import { cn } from '@/lib/utils';
import { type ComposerMediaItem } from '../composer/composer-media-area';

/**
 * The media-library import dialog (spec 133's `MediaImportModal`) is
 * consumed unmodified and loaded on demand (spec 137 §3.6.1), exactly
 * as the Facebook composer (PR-C1) loads it.
 */
const MediaImportModal = dynamic(
  () =>
    import('@/components/media/media-import-modal').then((m) => ({
      default: m.MediaImportModal,
    })),
  { ssr: false }
);

export interface BulkStepMediaProps {
  subdomain: string;
  selected: ComposerMediaItem[];
  onSelectedChange: (assets: ComposerMediaItem[]) => void;
}

const LIBRARY_FETCH_LIMIT = 200;

function toBulkAsset(item: MediaItemResponse): ComposerMediaItem {
  return {
    id: item.id,
    name: item.name,
    mediaType: item.mediaType,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl,
    captionText: item.captionText,
    durationSeconds: item.durationSeconds,
    width: item.width,
    height: item.height,
  };
}

function listItemToBulkAsset(item: MediaItem): ComposerMediaItem {
  return {
    id: item.id,
    name: item.name,
    mediaType: item.mediaType,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl,
    captionText: item.captionText,
    durationSeconds: item.durationSeconds,
    width: item.width ?? null,
    height: item.height ?? null,
  };
}

export function BulkStepMedia({ subdomain, selected, onSelectedChange }: Readonly<BulkStepMediaProps>) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [capNotice, setCapNotice] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Library reads go through the typed API client + React Query
  // (spec 137 §3.1/§3.2), reusing PR-C1's picker pattern: the list loads
  // only while the picker is open, and a failure surfaces as the picker's
  // inline error — never silently.
  const libraryQuery = useQuery({
    queryKey: queryKeys.tenant(subdomain).media.list,
    queryFn: ({ signal }) =>
      api.get(buildTenantApiPath(subdomain, '/media'), {
        schema: MediaListResponseSchema,
        query: { limit: LIBRARY_FETCH_LIMIT },
        signal,
      }),
    enabled: isPickerOpen,
  });
  const libraryItems: ComposerMediaItem[] = (libraryQuery.data?.items ?? []).map(
    listItemToBulkAsset
  );
  const isLoadingLibrary = isPickerOpen && libraryQuery.isPending && libraryQuery.isEnabled;
  const libraryError =
    isPickerOpen && libraryQuery.isError
      ? "Couldn't load your media. Please try again."
      : null;

  const addAssets = (incoming: ComposerMediaItem[]) => {
    const existingIds = new Set(selected.map((a) => a.id));
    const fresh = incoming.filter((a) => !existingIds.has(a.id));
    if (fresh.length === 0) return;
    const room = BULK_MAX_ITEMS - selected.length;
    if (room <= 0) {
      setCapNotice(true);
      return;
    }
    if (fresh.length > room) setCapNotice(true);
    onSelectedChange([...selected, ...fresh.slice(0, room)]);
  };

  const toggleFromLibrary = (item: ComposerMediaItem) => {
    if (selected.some((a) => a.id === item.id)) {
      onSelectedChange(selected.filter((a) => a.id !== item.id));
      setCapNotice(false);
    } else {
      addAssets([item]);
    }
  };

  const handleFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setPendingFiles(files);
    setIsImportOpen(true);
  };

  const handleUploadSuccess = (item: MediaItemResponse) => {
    addAssets([toBulkAsset(item)]);
  };

  const handleImportClose = () => {
    setIsImportOpen(false);
    setPendingFiles([]);
  };

  const selectedCountLabel = `${selected.length} selected`;
  const capLabel = `Up to ${BULK_MAX_ITEMS} posts per run.`;

  return (
    <div data-testid="bulk-step-media" className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-body font-medium text-ink">Choose media</span>
        <span data-testid="bulk-selected-counter" className="text-metadata font-semibold text-ink-sub">
          {selectedCountLabel} · {capLabel}
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          data-testid="bulk-choose-library-btn"
          onClick={() => setIsPickerOpen(true)}
        >
          Choose from library
        </Button>
        <Button
          variant="secondary"
          data-testid="bulk-upload-new-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload new
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*"
          multiple
          onChange={handleFilesChosen}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {capNotice && (
        <p data-testid="bulk-cap-notice" className="m-0 text-metadata text-ink-sub">
          That would take you over {BULK_MAX_ITEMS} — keeping the first {BULK_MAX_ITEMS}.
        </p>
      )}

      {selected.length > 0 && (
        <div data-testid="bulk-selected-media" className="flex flex-wrap gap-1.5">
          {selected.map((item) => {
            const thumb = item.thumbnailUrl || item.url;
            return (
              <div
                key={item.id}
                className="relative size-22 overflow-hidden rounded-sm border border-line"
              >
                {thumb ? (
                  <Image
                    src={thumb}
                    alt={item.name}
                    width={176}
                    height={176}
                    unoptimized
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-metadata text-ink-sub">
                    {item.mediaType}
                  </div>
                )}
                <button
                  type="button"
                  data-testid={`bulk-remove-media-${item.id}`}
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onSelectedChange(selected.filter((a) => a.id !== item.id))}
                  className="absolute top-1 right-1 inline-flex size-8 items-center justify-center rounded-full bg-neutral-black/60 text-body text-neutral-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isPickerOpen && (
        <div data-testid="bulk-library-picker" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-body font-medium text-ink">Your media</span>
            <Button variant="ghost" onClick={() => setIsPickerOpen(false)}>
              Done
            </Button>
          </div>
          {isLoadingLibrary && (
            <div aria-busy="true" className="flex flex-col gap-2">
              <Skeleton className="h-20 w-full" />
              <p className="m-0 text-metadata text-ink-sub">Loading media…</p>
            </div>
          )}
          {libraryError && (
            <p role="alert" className="m-0 text-metadata font-medium text-brand-rose">
              {libraryError}
            </p>
          )}
          {!isLoadingLibrary && !libraryError && libraryItems.length === 0 && (
            <div className="flex flex-col items-start gap-1.5">
              <p className="m-0 text-metadata text-ink-sub">No media yet.</p>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                Upload files to get started
              </Button>
            </div>
          )}
          {!isLoadingLibrary && libraryItems.length > 0 && (
            <div className="grid max-h-60 grid-cols-4 gap-1.5 overflow-y-auto p-0.5 sm:grid-cols-6">
              {libraryItems.map((media) => {
                const isSelected = selected.some((a) => a.id === media.id);
                const thumb = media.thumbnailUrl || media.url;
                return (
                  <button
                    key={media.id}
                    type="button"
                    data-testid={`bulk-library-pick-${media.id}`}
                    aria-pressed={isSelected}
                    onClick={() => toggleFromLibrary(media)}
                    className={cn(
                      'relative aspect-square overflow-hidden rounded-sm bg-panel p-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold',
                      isSelected ? 'border-2 border-brand-gold' : 'border border-line'
                    )}
                  >
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt={media.name}
                        width={176}
                        height={176}
                        unoptimized
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-metadata text-ink-sub">
                        {media.mediaType}
                      </div>
                    )}
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1 left-1 flex size-5 items-center justify-center rounded-full bg-primary text-metadata text-on-primary"
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <MediaImportModal
        subdomain={subdomain}
        isOpen={isImportOpen}
        initialFiles={pendingFiles}
        currentFolderId={null}
        folders={[] as MediaFolder[]}
        onClose={handleImportClose}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}
