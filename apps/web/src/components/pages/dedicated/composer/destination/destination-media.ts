import type { MediaItemResponse } from '@fbuploadpro/contracts';
import type { MediaItem } from '@/lib/api/schemas/media';
import type { ComposerMediaItem } from '../composer-media-area';

/**
 * A media item as the destination composers (spec 132 gated sets) carry
 * it: the Facebook composer's item shape plus the file facts the
 * platform contracts validators read (`mimeType`, `fileSize` — the
 * Instagram facts helpers check JPEG/8 MB from exactly these fields).
 */
export interface DestinationMediaItem extends ComposerMediaItem {
  mimeType?: string | null | undefined;
  fileSize?: number | null | undefined;
}

export function destinationMediaItemFromListItem(
  item: MediaItem
): DestinationMediaItem {
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
    mimeType: item.mimeType,
    fileSize: item.fileSize,
  };
}

export function destinationMediaItemFromResponse(
  item: MediaItemResponse
): DestinationMediaItem {
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
    mimeType: item.mimeType,
    fileSize: item.fileSize,
  };
}
