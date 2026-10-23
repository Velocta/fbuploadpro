'use client';

import React from 'react';
import Image from 'next/image';
import type {
  DownloaderSourcePlatform,
  MediaFolder,
  MediaItemResponse,
} from '@fbuploadpro/contracts';
import { Button } from '@/components/shared/ui';
import { formatFolderAncestryPath } from '@/components/media/media-library-explorer';
import { deriveDefaultCaption, formatBytes } from '@/lib/upload-queue-helpers';
import type { DownloaderSavedEntry } from './downloader-data';

/**
 * Saved-item row for the downloader results list (spec 140 PR-140-2,
 * T13) — rebuilt on tokens/Tailwind with a `next/image` thumbnail;
 * `formatPlatformLabel` and the Open in Folder behaviour are preserved
 * exactly (§3 item 9).
 */

export function formatPlatformLabel(platform: DownloaderSourcePlatform): string {
  switch (platform) {
    case 'tiktok':
      return 'TikTok';
    case 'facebook':
      return 'Facebook';
    case 'instagram':
      return 'Instagram';
    case 'x':
      return 'X';
    case 'youtube':
      return 'YouTube';
    case 'google_drive':
      return 'Google Drive';
    case 'dropbox':
      return 'Dropbox';
    case 'direct':
      return 'Direct Media';
    default:
      return 'Web Link';
  }
}

function SavedItemPreview({
  item,
  previewSrc,
}: Readonly<{ item: MediaItemResponse; previewSrc: string | null }>) {
  if (!previewSrc) {
    return (
      <span className="text-metadata font-semibold uppercase text-ink-dim">
        {item.mediaType}
      </span>
    );
  }

  if (item.mediaType === 'video' && !item.thumbnailUrl) {
    return (
      <video
        src={previewSrc}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <Image
      src={previewSrc}
      alt={item.name}
      fill
      sizes="64px"
      className="object-cover"
    />
  );
}

export function DownloaderSavedItemRow({
  entry,
  folders,
  onOpenInFolder,
}: Readonly<{
  entry: DownloaderSavedEntry;
  folders: MediaFolder[];
  onOpenInFolder: (folderId: string | null) => void;
}>) {
  const { item, platform } = entry;
  const resolvedCaption =
    item.captionText && item.captionText.trim().length > 0
      ? item.captionText
      : deriveDefaultCaption(item.name);
  const folderPathLabel = formatFolderAncestryPath(item.folderId, folders);
  const previewSrc = item.thumbnailUrl || item.url;

  return (
    <article
      data-testid={`downloader-saved-item-${item.id}`}
      className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-line bg-panel p-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {/* Thumbnail / Video Preview */}
        <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line bg-subtle">
          <SavedItemPreview item={item} previewSrc={previewSrc} />
        </div>

        {/* Asset Details & Auto-Populated Caption */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 truncate text-body font-semibold text-ink">
              {item.name}
            </span>

            <span className="text-metadata tabular-nums text-ink-dim">
              {formatBytes(item.fileSize)}
            </span>

            <span className="rounded-xs border border-line bg-subtle px-1.5 py-0.5 text-metadata font-medium text-ink-sub">
              {formatPlatformLabel(platform)}
            </span>

            <span
              data-testid={`downloader-item-folder-${item.id}`}
              className="rounded-xs border border-line bg-subtle px-1.5 py-0.5 text-metadata font-medium text-ink-sub"
            >
              {folderPathLabel}
            </span>
          </div>

          <p
            data-testid={`downloader-item-caption-${item.id}`}
            className="truncate text-body text-ink-sub"
          >
            {resolvedCaption}
          </p>
        </div>
      </div>

      {/* Open in Folder Action */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={`downloader-open-folder-${item.id}`}
          data-slot="downloader-open-folder-btn"
          onClick={() => onOpenInFolder(item.folderId)}
        >
          Open in Folder
        </Button>
      </div>
    </article>
  );
}
