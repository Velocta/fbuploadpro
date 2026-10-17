import type { MediaItemResponse } from '@fbuploadpro/contracts';

export type SmartCollectionKey = 'all' | 'video' | 'image' | 'uncaptioned';

export interface SmartCollectionCounts {
  all: number;
  video: number;
  image: number;
  uncaptioned: number;
}

/**
 * Filters a list of media assets by the specified smart collection key.
 */
export function filterMediaByCollection(
  items: MediaItemResponse[],
  collection: SmartCollectionKey
): MediaItemResponse[] {
  switch (collection) {
    case 'video':
      return items.filter((item) => item.mediaType === 'video');
    case 'image':
      return items.filter((item) => item.mediaType === 'image');
    case 'uncaptioned':
      return items.filter(
        (item) => !item.captionText || item.captionText.trim().length === 0
      );
    case 'all':
    default:
      return items;
  }
}

/**
 * Computes dynamic asset counts across all smart collections for the provided items.
 */
export function computeCollectionCounts(
  items: MediaItemResponse[]
): SmartCollectionCounts {
  let video = 0;
  let image = 0;
  let uncaptioned = 0;

  for (const item of items) {
    if (item.mediaType === 'video') {
      video++;
    } else if (item.mediaType === 'image') {
      image++;
    }
    if (!item.captionText || item.captionText.trim().length === 0) {
      uncaptioned++;
    }
  }

  return {
    all: items.length,
    video,
    image,
    uncaptioned,
  };
}
