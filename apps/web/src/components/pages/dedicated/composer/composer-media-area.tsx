'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import {
  type PostFormat,
  type MediaItemResponse,
  type MediaFolder,
} from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import { MediaListResponseSchema, type MediaItem } from '@/lib/api/schemas/media';
import { queryKeys } from '@/lib/data/query-keys';
import { Button } from '@/components/shared/ui/button';
import { Skeleton } from '@/components/shared/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * The media-library import dialog (spec 133's `MediaImportModal`) is
 * consumed unmodified and loaded on demand (spec 137 §3.6.1): it only
 * enters the bundle when a composer upload actually opens it.
 */
const MediaImportModal = dynamic(
  () =>
    import('@/components/media/media-import-modal').then((m) => ({
      default: m.MediaImportModal,
    })),
  { ssr: false }
);

export interface ComposerMediaItem {
  id: string;
  name: string;
  mediaType: 'video' | 'image';
  url: string;
  thumbnailUrl?: string | null | undefined;
  captionText?: string | null | undefined;
  durationSeconds?: number | null | undefined;
  width?: number | null | undefined;
  height?: number | null | undefined;
}

export interface ComposerMediaAreaProps {
  pageId: string;
  subdomain: string;
  format: PostFormat;
  items: ComposerMediaItem[];
  onItemsChange: (items: ComposerMediaItem[]) => void;
  /** Edit mode: pre-filled media cannot be changed. */
  readOnly?: boolean;
}

const MEDIA_LIST_LIMIT = 50;

function mediaItemFromResponse(item: MediaItemResponse): ComposerMediaItem {
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

function mediaItemFromListItem(item: MediaItem): ComposerMediaItem {
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

/** Blocking per-item type errors for the current format. Never rewrites silently. */
export function getMediaItemError(item: ComposerMediaItem, format: PostFormat): string | null {
  switch (format) {
    case 'reel':
      return item.mediaType === 'video'
        ? null
        : 'Reels need a video file — this is an image.';
    case 'video':
      return item.mediaType === 'video'
        ? null
        : 'Videos need a video file — this is an image.';
    case 'image':
      return item.mediaType === 'image'
        ? null
        : 'Photos need image files — this is a video.';
    case 'story':
      return null;
    case 'text':
      return 'Text posts do not use media.';
    default:
      return null;
  }
}

/**
 * Single-media cap: every format takes at most one media item.
 * 2026-10-19 decision — Shahzeb capped Photo at 1 image (was "one or more");
 * multi-photo/carousel is future work.
 * Returns the plain-language notice to show when the cap blocks an add,
 * or null when the add is allowed. Never silently drops.
 */
export function getMediaCapNotice(format: PostFormat, currentCount: number): string | null {
  if (currentCount === 0) return null;
  switch (format) {
    case 'image':
      return 'Photo posts take 1 image. Remove the current one to pick another.';
    case 'video':
      return 'Video posts take 1 video. Remove the current one to pick another.';
    case 'reel':
      return 'Reels take 1 video. Remove the current one to pick another.';
    case 'story':
      return 'Stories take 1 file. Remove the current one to pick another.';
    default:
      return null;
  }
}

/** A cap notice together with the format it was raised under. */
export interface CapNoticeState {
  format: PostFormat;
  message: string;
}

/**
 * The notice to show for the CURRENT format. A notice raised under a
 * previous format (e.g. Photo) must never stay visible after switching to
 * another format (e.g. Video) where it does not apply.
 */
export function capNoticeForFormat(notice: CapNoticeState | null, format: PostFormat): string | null {
  if (!notice || notice.format !== format) return null;
  return notice.message;
}

export interface MediaSelectionResult {
  items: ComposerMediaItem[];
  /** Cap notice to surface when the add was blocked, otherwise null. */
  capNotice: string | null;
  /** True when the single-media cap blocked the add (nothing was dropped silently). */
  blocked: boolean;
}

/**
 * Selection after adding media — used both for library picks and for
 * in-composer imports, so an imported file becomes the selected media just
 * like a manual pick. Every format takes at most one item: when one is
 * already selected the add is blocked and the cap notice explains why,
 * instead of the new file being silently dropped.
 */
export function resolveSelectionAfterAdd(
  current: ComposerMediaItem[],
  incoming: ComposerMediaItem[],
  format: PostFormat
): MediaSelectionResult {
  if (incoming.length === 0) return { items: current, capNotice: null, blocked: false };
  const blockedNotice = getMediaCapNotice(format, current.length);
  if (blockedNotice) return { items: current, capNotice: blockedNotice, blocked: true };
  const newest = incoming.at(-1);
  return { items: newest ? [newest] : current, capNotice: null, blocked: false };
}

export function ComposerMediaArea({
  subdomain,
  format,
  items,
  onItemsChange,
  readOnly = false,
}: Readonly<ComposerMediaAreaProps>) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [capNotice, setCapNotice] = useState<CapNoticeState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Library reads go through the typed API client + React Query
  // (spec 137 §3.1/§3.2): the list loads only while the picker is open,
  // and a failure surfaces as the picker's inline error — never silently.
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
  const libraryItems: ComposerMediaItem[] = (libraryQuery.data?.items ?? []).map(
    mediaItemFromListItem
  );
  const isLoadingLibrary = isPickerOpen && libraryQuery.isPending && libraryQuery.isEnabled;
  const libraryError =
    isPickerOpen && libraryQuery.isError
      ? "Couldn't load your media. Please try again."
      : null;

  const addItems = (incoming: ComposerMediaItem[]) => {
    const result = resolveSelectionAfterAdd(items, incoming, format);
    if (result.blocked) {
      // Tag the notice with the format that raised it so it can never leak
      // into another format's view after a format switch.
      setCapNotice(result.capNotice ? { format, message: result.capNotice } : null);
      return;
    }
    setCapNotice(null);
    if (incoming.length > 0) onItemsChange(result.items);
  };

  const visibleCapNotice = capNoticeForFormat(capNotice, format);

  const handlePickFromLibrary = (item: ComposerMediaItem) => {
    const alreadySelected = items.some((i) => i.id === item.id);
    if (alreadySelected) {
      onItemsChange(items.filter((i) => i.id !== item.id));
      setCapNotice(null);
      return;
    }
    addItems([item]);
    setIsPickerOpen(false);
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
    // Completed uploads are saved to the media library by the import dialog
    // itself and auto-selected here — one flow, no detour through the library.
    addItems([mediaItemFromResponse(item)]);
  };

  const handleImportClose = () => {
    setIsImportOpen(false);
    setPendingFiles([]);
  };

  const handleRemove = (id: string) => {
    onItemsChange(items.filter((i) => i.id !== id));
    setCapNotice(null);
  };

  const acceptAttr = format === 'image' ? 'image/*' : 'video/*,image/*';

  return (
    <div data-testid="composer-media-area" className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">Media</span>

      {/* Selected thumbnails */}
      {items.length > 0 && (
        <div data-testid="composer-selected-media" className="flex flex-wrap gap-3">
          {items.map((item) => {
            const itemError = getMediaItemError(item, format);
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
                  {!readOnly && (
                    <button
                      type="button"
                      data-testid={`composer-remove-media-${item.id}`}
                      aria-label={`Remove ${item.name}`}
                      onClick={() => handleRemove(item.id)}
                      className="absolute top-1 right-1 inline-flex size-8 items-center justify-center rounded-full bg-neutral-black/60 text-body text-neutral-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                    >
                      ×
                    </button>
                  )}
                </div>
                {itemError && (
                  <div className="flex flex-col gap-0.5">
                    <span
                      data-testid={`composer-media-error-${item.id}`}
                      className="text-metadata font-medium text-brand-rose"
                    >
                      {itemError}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        className="min-h-11 self-start text-left text-metadata font-semibold text-brand-rose outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state + actions */}
      {items.length === 0 && !readOnly && (
        <p data-testid="composer-media-empty" className="m-0 text-metadata text-ink-sub">
          No media selected yet.
        </p>
      )}
      {visibleCapNotice && !readOnly && (
        <p data-testid="composer-media-cap-notice" className="m-0 text-metadata text-ink-sub">
          {visibleCapNotice}
        </p>
      )}
      {!readOnly && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            data-testid="composer-choose-library-btn"
            onClick={() => setIsPickerOpen(true)}
          >
            Choose from library
          </Button>
          <Button
            variant="secondary"
            data-testid="composer-upload-new-btn"
            onClick={handleUploadClick}
          >
            Upload new
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptAttr}
            data-testid="composer-file-input"
            onChange={handleFilesChosen}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      )}
      {readOnly && (
        <p className="m-0 text-metadata text-ink-sub">
          Media can&apos;t be changed when editing.
        </p>
      )}

      {/* Library picker (built by 132 on shared/ui primitives + the typed
          media schema, per OD132-4 recommendation (a)) */}
      {isPickerOpen && (
        <div data-testid="composer-library-picker" className="flex flex-col gap-3">
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
                const isSelected = items.some((i) => i.id === media.id);
                const thumb = media.thumbnailUrl || media.url;
                return (
                  <button
                    key={media.id}
                    type="button"
                    data-testid={`composer-library-pick-${media.id}`}
                    aria-pressed={isSelected}
                    onClick={() => handlePickFromLibrary(media)}
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
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Direct upload via the existing media-library import dialog */}
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
