# Data Model & State Machine: Toolbar Zones & Smart Views

**Feature**: Three-Zone Toolbar & Rail Smart Views  
**Spec ID**: 070

---

## 1. View & Navigation State

```typescript
export type MediaSmartViewKey = 'everything' | 'needs_caption';

export type MediaActiveView =
  | { type: 'folder'; folderId: string | null } // null is 'Library' (root)
  | { type: 'smart'; view: MediaSmartViewKey };

export type MediaTypeFilterKey = 'all' | 'video' | 'image';
export type AspectRatioFilterKey = 'all' | '9:16' | '16:9' | '1:1' | '4:5';
export type CaptionStatusFilterKey = 'all' | 'has_caption' | 'empty_caption';
export type SortOptionKey =
  | 'created_at:desc'
  | 'created_at:asc'
  | 'name:asc'
  | 'file_size:desc';
```

---

## 2. Labels and Values Mapping

```typescript
export const MEDIA_TYPE_LABELS: Record<MediaTypeFilterKey, string> = {
  all: 'All',
  video: 'Videos',
  image: 'Images',
};

export const ASPECT_RATIO_LABELS: Record<AspectRatioFilterKey, string> = {
  all: 'All ratios',
  '9:16': '9:16 Vertical',
  '16:9': '16:9 Landscape',
  '1:1': '1:1 Square',
  '4:5': '4:5 Portrait',
};

export const ASPECT_RATIO_SHORT_VALUES: Record<AspectRatioFilterKey, string> = {
  all: 'All',
  '9:16': '9:16',
  '16:9': '16:9',
  '1:1': '1:1',
  '4:5': '4:5',
};

export const CAPTION_STATUS_LABELS: Record<CaptionStatusFilterKey, string> = {
  all: 'All captions',
  has_caption: 'Has caption',
  empty_caption: 'Missing caption',
};

export const CAPTION_STATUS_SHORT_VALUES: Record<CaptionStatusFilterKey, string> = {
  all: 'All',
  has_caption: 'Has caption',
  empty_caption: 'Missing caption',
};

export const SORT_OPTION_LABELS: Record<SortOptionKey, string> = {
  'created_at:desc': 'Newest first',
  'created_at:asc': 'Oldest first',
  'name:asc': 'Name (A–Z)',
  'file_size:desc': 'Largest size',
};

export const SORT_OPTION_SHORT_VALUES: Record<SortOptionKey, string> = {
  'created_at:desc': 'Newest',
  'created_at:asc': 'Oldest',
  'name:asc': 'Name A–Z',
  'file_size:desc': 'Largest',
};
```

---

## 3. Scope Resolution Logic

```typescript
export function computeScopeTagLabel(
  activeView: MediaActiveView,
  searchQuery: string,
  folders: MediaFolder[]
): string {
  if (searchQuery.trim().length > 0) {
    return 'In: Library';
  }

  if (activeView.type === 'smart') {
    if (activeView.view === 'everything') return 'In: Everything';
    if (activeView.view === 'needs_caption') return 'In: Needs caption';
  }

  if (!activeView.folderId) {
    return 'In: Library';
  }

  const folder = folders.find((f) => f.id === activeView.folderId);
  return folder ? `In: ${folder.name}` : 'In: Library';
}
```

---

## 4. Filter & Item Matching

```typescript
export function filterMediaItems(
  items: MediaItemResponse[],
  options: {
    activeView: MediaActiveView;
    mediaTypeFilter: MediaTypeFilterKey;
    aspectRatioFilter: AspectRatioFilterKey;
    captionStatusFilter: CaptionStatusFilterKey;
    searchQuery: string;
    sortOption: SortOptionKey;
  }
): MediaItemResponse[] {
  const {
    activeView,
    mediaTypeFilter,
    aspectRatioFilter,
    captionStatusFilter,
    searchQuery,
    sortOption,
  } = options;

  const trimmedSearch = searchQuery.trim().toLowerCase();
  const isSearching = trimmedSearch.length > 0;

  return items
    .filter((item) => {
      // 1. Global Search overrides view & folder scope
      if (isSearching) {
        const matchName = item.name.toLowerCase().includes(trimmedSearch);
        const matchCaption = (item.captionText || '').toLowerCase().includes(trimmedSearch);
        return matchName || matchCaption;
      }

      // 2. View / Folder Scope
      if (activeView.type === 'smart') {
        if (activeView.view === 'needs_caption') {
          if (item.captionText && item.captionText.trim().length > 0) {
            return false;
          }
        }
        // 'everything' allows all items across all folders
      } else {
        // Folder scope
        if ((item.folderId ?? null) !== activeView.folderId) {
          return false;
        }
      }

      // 3. Local Filters
      if (mediaTypeFilter !== 'all' && item.mediaType !== mediaTypeFilter) {
        return false;
      }
      if (aspectRatioFilter !== 'all' && item.aspectRatio !== aspectRatioFilter) {
        return false;
      }
      if (
        captionStatusFilter === 'has_caption' &&
        (!item.captionText || item.captionText.trim().length === 0)
      ) {
        return false;
      }
      if (
        captionStatusFilter === 'empty_caption' &&
        item.captionText &&
        item.captionText.trim().length > 0
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => sortMediaItems(a, b, sortOption));
}
```
