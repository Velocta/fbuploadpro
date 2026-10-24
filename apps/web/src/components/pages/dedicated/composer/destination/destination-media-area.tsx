'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { type MediaItemResponse, type MediaFolder } from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import { MediaListResponseSchema } from '@/lib/api/schemas/media';
import { queryKeys } from '@/lib/data/query-keys';
import { Button } from '@/components/shared/ui/button';
import { Skeleton } from '@/components/shared/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  destinationMediaItemFromListItem,
  destinationMediaItemFromResponse,
  type DestinationMediaItem,
} from './destination-media';

/**
 * The media-library import dialog (spec 133's `MediaImportModal`) is
 * consumed unmodified and loaded on demand, exactly as the Facebook
 * composer's media area consumes it (spec 132 §8 read-only consumption).
 */
const MediaImportModal = dynamic(
  () =>
    import('@/components/media/media-import-modal').then((m) => ({
      default: m.MediaImportModal,
    })),
  { ssr: false }
);

export interface DestinationMediaAreaProps {
  subdomain: string;
  items: DestinationMediaItem[];
  onItemsChange: (items: DestinationMediaItem[]) => void;
  /** Hard cap for this format (1 for photo/Reel/Story, 10/20 for carousels). */
  maxItems: number;
  /** Plain-language notice shown when an add is blocked by the cap. */
  capMessage: string;
  /** Blocking per-item error for the current format, or null. */
  getItemError: (item: DestinationMediaItem) => string | null;
  /** File-picker accept attribute for the current format. */
  accept: string;
  testIdPrefix: string;
  /** Extra per-item controls (e.g. Threads carousel alt-text fields). */
  renderItemExtra?:
    | ((item: DestinationMediaItem, index: number) => React.ReactNode)
    | undefined;
}

const MEDIA_LIST_LIMIT = 50;

/**
 * Multi-select media area for the destination composers — the Facebook
 * area's interaction shell (library picker + in-composer import +
 * selected thumbnails with per-item errors) with multi-item selection:
 * the picker toggles items and stays open until Done, adds beyond the
 * format's cap are blocked with a visible notice, and nothing is ever
 * dropped silently.
 */
export function DestinationMediaArea({
  subdomain,
  items,
  onItemsChange,
  maxItems,
  capMessage,
  getItemError,
  accept,
  testIdPrefix,
  renderItemExtra,
}: Readonly<DestinationMediaAreaProps>) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [capNotice, setCapNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const libraryQuery = useQuery({
    queryKey: queryKeys.tenant(subdomain).media.list,
    queryFn: ({ signal }) =>
      api.get(buildTenantApiPath(subdomain, '/media'), {
        schema: MediaListResponseSchema,
        query: { limit: MEDIA_LIST_LIMIT },
        signal,
      }),
    enabled: isPickerOpen,
  });
  const libraryItems: DestinationMediaItem[] = (libraryQuery.data?.items ?? []).map(
    destinationMediaItemFromListItem
  );
  const isLoadingLibrary = isPickerOpen && libraryQuery.isPending && libraryQuery.isEnabled;
  const libraryError =
    isPickerOpen && libraryQuery.isError
      ? "Couldn't load your media. Please try again."
      : null;

  const addItems = (incoming: DestinationMediaItem[]) => {
    if (incoming.length === 0) return;
    const fresh = incoming.filter((item) => !items.some((i) => i.id === item.id));
    if (fresh.length === 0) return;
    const room = maxItems - items.length;
    if (room <= 0) {
      setCapNotice(capMessage);
      return;
    }
    setCapNotice(null);
    onItemsChange([...items, ...fresh.slice(0, room)]);
    if (fresh.length > room) setCapNotice(capMessage);
  };

  const handlePickFromLibrary = (item: DestinationMediaItem) => {
    const alreadySelected = items.some((i) => i.id === item.id);
    if (alreadySelected) {
      onItemsChange(items.filter((i) => i.id !== item.id));
      setCapNotice(null);
      return;
    }
    addItems([item]);
    if (maxItems === 1) setIsPickerOpen(false);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setPendingFiles(files);
    setIsImportOpen(true);
  };

  const handleUploadSuccess = (item: MediaItemResponse) => {
    addItems([destinationMediaItemFromResponse(item)]);
  };

  const handleImportClose = () => {
    setIsImportOpen(false);
    setPendingFiles([]);
  };

  const handleRemove = (id: string) => {
    onItemsChange(items.filter((i) => i.id !== id));
    setCapNotice(null);
  };

  return (
    <div data-testid={`${testIdPrefix}-media-area`} className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">Media</span>

      {items.length > 0 && (
        <div data-testid={`${testIdPrefix}-selected-media`} className="flex flex-wrap gap-3">
          {items.map((item, index) => {
            const itemError = getItemError(item);
            const thumb = item.thumbnailUrl || item.url;
            return (
              <div key={item.id} className="flex max-w-36 flex-col gap-1.5">
                <div className="relative aspect-square w-30 overflow-hidden rounded-sm border border-line">
                  {thumb ? (
                    <Image
                      src={thumb}
                      alt={item.name}
                      width={120}
                      height={120}
                      unoptimized
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-metadata text-ink-sub">
                      {item.mediaType}
                    </div>
                  )}
                  {items.length > 1 && (
                    <span
                      aria-hidden
                      className="absolute bottom-1 left-1 inline-flex size-6 items-center justify-center rounded-full bg-neutral-black/60 text-metadata font-semibold text-neutral-white"
                    >
                      {index + 1}
                    </span>
                  )}
                  <button
                    type="button"
                    data-testid={`${testIdPrefix}-remove-media-${item.id}`}
                    aria-label={`Remove ${item.name}`}
                    onClick={() => handleRemove(item.id)}
                    className="absolute top-1 right-1 inline-flex size-8 items-center justify-center rounded-full bg-neutral-black/60 text-body text-neutral-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                  >
                    ×
                  </button>
                </div>
                <span className="truncate text-metadata text-ink-sub">{item.name}</span>
                {renderItemExtra?.(item, index)}
                {itemError && (
                  <p role="alert" className="m-0 text-metadata font-medium text-brand-rose">
                    {itemError}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {capNotice && (
        <p
          data-testid={`${testIdPrefix}-media-cap-notice`}
          role="alert"
          className="m-0 text-metadata font-medium text-brand-rose"
        >
          {capNotice}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          data-testid={`${testIdPrefix}-open-library-btn`}
          onClick={() => setIsPickerOpen((open) => !open)}
        >
          {isPickerOpen ? 'Close library' : 'Choose from library'}
        </Button>
        <Button
          type="button"
          variant="outline"
          data-testid={`${testIdPrefix}-upload-btn`}
          onClick={handleUploadClick}
        >
          Upload media
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={maxItems > 1}
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={handleFilesChosen}
        />
      </div>

      {isPickerOpen && (
        <div
          data-testid={`${testIdPrefix}-library-picker`}
          className="flex flex-col gap-3 border-t border-line pt-3"
        >
          {isLoadingLibrary && (
            <div className="flex gap-3" aria-label="Loading your media">
              <Skeleton className="aspect-square w-24" />
              <Skeleton className="aspect-square w-24" />
              <Skeleton className="aspect-square w-24" />
            </div>
          )}
          {libraryError && (
            <p role="alert" className="m-0 text-body text-brand-rose">
              {libraryError}
            </p>
          )}
          {!isLoadingLibrary && !libraryError && libraryItems.length === 0 && (
            <p className="m-0 text-body text-ink-sub">
              Your library is empty — upload media to get started.
            </p>
          )}
          {libraryItems.length > 0 && (
            <>
              <div className="flex flex-wrap gap-3">
                {libraryItems.map((item) => {
                  const isSelected = items.some((i) => i.id === item.id);
                  const thumb = item.thumbnailUrl || item.url;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`${testIdPrefix}-library-item-${item.id}`}
                      aria-pressed={isSelected}
                      onClick={() => handlePickFromLibrary(item)}
                      className={cn(
                        'flex w-24 flex-col gap-1.5 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold',
                        isSelected && 'ring-2 ring-brand-gold'
                      )}
                    >
                      <span className="relative block aspect-square w-24 overflow-hidden rounded-sm border border-line">
                        {thumb ? (
                          <Image
                            src={thumb}
                            alt=""
                            width={96}
                            height={96}
                            unoptimized
                            className="size-full object-cover"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center text-metadata text-ink-sub">
                            {item.mediaType}
                          </span>
                        )}
                      </span>
                      <span className="w-full truncate text-left text-metadata text-ink-sub">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div>
                <Button
                  type="button"
                  data-testid={`${testIdPrefix}-library-done-btn`}
                  onClick={() => setIsPickerOpen(false)}
                >
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {isImportOpen && (
        <MediaImportModal
          subdomain={subdomain}
          isOpen={isImportOpen}
          initialFiles={pendingFiles}
          currentFolderId={null}
          folders={[] as MediaFolder[]}
          onClose={handleImportClose}
          onUploadSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
}
