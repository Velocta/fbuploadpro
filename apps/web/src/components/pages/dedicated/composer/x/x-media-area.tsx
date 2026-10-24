'use client';

/**
 * The X composer's media area (spec 132 §4.5) — the PR-C1 media-area
 * structure (library picker + in-composer upload through the media
 * library's import dialog, spec 133) with the X rules:
 *
 * - MAX-1 attachment: the unified queue item carries a single primary
 *   media and the X publisher uploads exactly one file. A second add is
 *   blocked with the cap notice — never a silent drop.
 * - Per-item validity comes from the contracts `validateXMedia`
 *   (image ≤ 5 MB, GIF ≤ 15 MB, video ≤ 512 MB / 0.5–140 s); a library
 *   item typed 'image' is validated as an image (a stored GIF is an
 *   'image' row, and X's image cap is the stricter one anyway).
 * - Poll XOR media: while a poll is on, attaching is blocked with the
 *   reason shown and the poll kept.
 */
import React, { useRef, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { validateXMedia, type MediaItemResponse, type MediaFolder } from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import { MediaListResponseSchema, type MediaItem } from '@/lib/api/schemas/media';
import { queryKeys } from '@/lib/data/query-keys';
import { Button } from '@/components/shared/ui/button';
import { Skeleton } from '@/components/shared/ui/skeleton';
import { cn } from '@/lib/utils';

const MediaImportModal = dynamic(
  () =>
    import('@/components/media/media-import-modal').then((m) => ({
      default: m.MediaImportModal,
    })),
  { ssr: false }
);

export interface XMediaItem {
  id: string;
  name: string;
  mediaType: 'image' | 'video';
  url: string;
  thumbnailUrl?: string | null | undefined;
  captionText?: string | null | undefined;
  durationSeconds?: number | null | undefined;
  /** Kept (unlike the Facebook item) — `validateXMedia` needs the size. */
  fileSizeBytes?: number | null | undefined;
}

export interface XMediaAreaProps {
  subdomain: string;
  item: XMediaItem | null;
  onItemChange: (item: XMediaItem | null) => void;
  /** A poll is being authored — media and polls never combine on X. */
  pollEnabled: boolean;
}

const MEDIA_LIST_LIMIT = 50;

/** The visible cap notice when a second attachment is attempted. */
export const X_MEDIA_CAP_NOTICE = 'Posts on X take 1 media file. Remove the current one to pick another.';
/** The visible block shown while a poll makes attaching impossible. */
export const X_MEDIA_POLL_NOTICE =
  "You added a poll — polls and media can't be combined on X. Remove the poll to attach media.";

function mediaItemFromResponse(item: MediaItemResponse): XMediaItem {
  return {
    id: item.id,
    name: item.name,
    mediaType: item.mediaType,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl,
    captionText: item.captionText,
    durationSeconds: item.durationSeconds,
    fileSizeBytes: item.fileSize,
  };
}

function mediaItemFromListItem(item: MediaItem): XMediaItem {
  return {
    id: item.id,
    name: item.name,
    mediaType: item.mediaType,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl,
    captionText: item.captionText,
    durationSeconds: item.durationSeconds,
    fileSizeBytes: item.fileSize,
  };
}

/** The contracts media-validation error for the attached item, or null. */
export function getXMediaItemError(item: XMediaItem): string | null {
  const result = validateXMedia({
    mediaType: item.mediaType,
    fileSizeBytes: item.fileSizeBytes ?? undefined,
    durationSeconds: item.durationSeconds ?? undefined,
  });
  return result.valid ? null : (result.error ?? 'This file cannot be posted to X.');
}

export function XMediaArea({ subdomain, item, onItemChange, pollEnabled }: Readonly<XMediaAreaProps>) {
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
  const libraryItems: XMediaItem[] = (libraryQuery.data?.items ?? []).map(mediaItemFromListItem);
  const isLoadingLibrary = isPickerOpen && libraryQuery.isPending && libraryQuery.isEnabled;
  const libraryError =
    isPickerOpen && libraryQuery.isError ? "Couldn't load your media. Please try again." : null;

  const addItem = (incoming: XMediaItem) => {
    if (item) {
      setCapNotice(X_MEDIA_CAP_NOTICE);
      return;
    }
    setCapNotice(null);
    onItemChange(incoming);
  };

  const handlePickFromLibrary = (picked: XMediaItem) => {
    if (item && item.id === picked.id) {
      onItemChange(null);
      setCapNotice(null);
      return;
    }
    addItem(picked);
    if (!item) {
      setIsPickerOpen(false);
    }
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

  const handleUploadSuccess = (uploaded: MediaItemResponse) => {
    addItem(mediaItemFromResponse(uploaded));
  };

  const handleImportClose = () => {
    setIsImportOpen(false);
    setPendingFiles([]);
  };

  const handleRemove = () => {
    onItemChange(null);
    setCapNotice(null);
  };

  const itemError = item ? getXMediaItemError(item) : null;
  const thumb = item ? item.thumbnailUrl || item.url : null;

  return (
    <div data-testid="x-composer-media-area" className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">Media</span>

      {item && (
        <div data-testid="x-composer-selected-media" className="flex flex-wrap gap-3">
          <div className="flex max-w-36 flex-col gap-1.5">
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
              <button
                type="button"
                data-testid="x-composer-remove-media"
                aria-label={`Remove ${item.name}`}
                onClick={handleRemove}
                className="absolute top-1 right-1 inline-flex size-8 items-center justify-center rounded-full bg-neutral-black/60 text-body text-neutral-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
              >
                ×
              </button>
            </div>
            {itemError && (
              <div className="flex flex-col gap-0.5">
                <span
                  data-testid="x-composer-media-error"
                  className="text-metadata font-medium text-brand-rose"
                >
                  {itemError}
                </span>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="min-h-11 self-start text-left text-metadata font-semibold text-brand-rose outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!item && (
        <p data-testid="x-composer-media-empty" className="m-0 text-metadata text-ink-sub">
          No media selected yet.
        </p>
      )}
      {capNotice && (
        <p data-testid="x-composer-media-cap-notice" className="m-0 text-metadata text-ink-sub">
          {capNotice}
        </p>
      )}
      {pollEnabled && (
        <p data-testid="x-composer-media-poll-notice" className="m-0 text-metadata text-ink-sub">
          {X_MEDIA_POLL_NOTICE}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          data-testid="x-composer-choose-library-btn"
          disabled={pollEnabled}
          onClick={() => setIsPickerOpen(true)}
        >
          Choose from library
        </Button>
        <Button
          variant="secondary"
          data-testid="x-composer-upload-new-btn"
          disabled={pollEnabled}
          onClick={handleUploadClick}
        >
          Upload new
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*"
          data-testid="x-composer-file-input"
          onChange={handleFilesChosen}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {isPickerOpen && (
        <div data-testid="x-composer-library-picker" className="flex flex-col gap-3">
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
              <Button variant="secondary" onClick={handleUploadClick}>
                Upload files to get started
              </Button>
            </div>
          )}
          {!isLoadingLibrary && libraryItems.length > 0 && (
            <div className="grid max-h-45 grid-cols-4 gap-1.5 overflow-y-auto p-0.5 sm:grid-cols-6">
              {libraryItems.map((media) => {
                const isSelected = item?.id === media.id;
                const mediaThumb = media.thumbnailUrl || media.url;
                return (
                  <button
                    key={media.id}
                    type="button"
                    data-testid={`x-composer-library-pick-${media.id}`}
                    aria-pressed={isSelected}
                    onClick={() => handlePickFromLibrary(media)}
                    className={cn(
                      'relative aspect-square overflow-hidden rounded-sm bg-panel p-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold',
                      isSelected ? 'border-2 border-brand-gold' : 'border border-line'
                    )}
                  >
                    {mediaThumb ? (
                      <Image
                        src={mediaThumb}
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
