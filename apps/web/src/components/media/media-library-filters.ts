'use client';

import type { MediaItemResponse, MediaFolder } from '@fbuploadpro/contracts';
import type {
  MediaTypeFilterKey,
  AspectRatioFilterKey,
  CaptionStatusFilterKey,
  SortOptionKey,
  MediaSmartViewKey,
} from './media-types';

export interface FolderSubtreeImpact {
  descendantFolderIds: string[];
  subfolderCount: number;
  totalMediaCount: number;
}

export function computeFolderSubtreeImpact(
  folderId: string,
  folders: MediaFolder[]
): FolderSubtreeImpact {
  const childrenByParent = new Map<string, MediaFolder[]>();
  const folderById = new Map<string, MediaFolder>();

  for (const f of folders) {
    folderById.set(f.id, f);
    if (f.parentId) {
      const list = childrenByParent.get(f.parentId) ?? [];
      list.push(f);
      childrenByParent.set(f.parentId, list);
    }
  }

  const rootFolder = folderById.get(folderId);
  const descendantFolderIds: string[] = [];
  let totalMediaCount = rootFolder ? rootFolder.itemCount || 0 : 0;

  const queue: string[] = [folderId];
  const visited = new Set<string>([folderId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = childrenByParent.get(currentId) ?? [];
    for (const child of children) {
      if (!visited.has(child.id)) {
        visited.add(child.id);
        descendantFolderIds.push(child.id);
        totalMediaCount += child.itemCount || 0;
        queue.push(child.id);
      }
    }
  }

  return {
    descendantFolderIds,
    subfolderCount: descendantFolderIds.length,
    totalMediaCount,
  };
}
export function matchesSearch(item: MediaItemResponse, query: string): boolean {
  if (!query) return true;
  const matchName = item.name.toLowerCase().includes(query);
  const matchCaption = (item.captionText || '').toLowerCase().includes(query);
  return matchName || matchCaption;
}

export function matchesSmartViewOrFolder(
  item: MediaItemResponse,
  currentFolderId: string | null,
  activeSmartView: MediaSmartViewKey | null | undefined
): boolean {
  if (activeSmartView === 'everything') return true;
  if (activeSmartView === 'needs_caption') {
    return !item.captionText || item.captionText.trim().length === 0;
  }
  return (item.folderId ?? null) === currentFolderId;
}

export function matchesMediaType(item: MediaItemResponse, filter: MediaTypeFilterKey): boolean {
  return filter === 'all' || item.mediaType === filter;
}

export function matchesAspectRatio(item: MediaItemResponse, filter: AspectRatioFilterKey): boolean {
  return filter === 'all' || item.aspectRatio === filter;
}

export function matchesCaptionStatus(item: MediaItemResponse, filter: CaptionStatusFilterKey): boolean {
  if (filter === 'all') return true;
  const hasCaption = Boolean(item.captionText && item.captionText.trim().length > 0);
  return filter === 'has_caption' ? hasCaption : !hasCaption;
}

export function matchesMediaFilters(
  item: MediaItemResponse,
  currentFolderId: string | null,
  activeSmartView: MediaSmartViewKey | null | undefined,
  mediaTypeFilter: MediaTypeFilterKey,
  aspectRatioFilter: AspectRatioFilterKey,
  captionStatusFilter: CaptionStatusFilterKey,
  trimmedSearch: string
): boolean {
  if (trimmedSearch.length > 0) {
    if (!matchesSearch(item, trimmedSearch)) return false;
  } else if (!matchesSmartViewOrFolder(item, currentFolderId, activeSmartView)) {
    return false;
  }

  return (
    matchesMediaType(item, mediaTypeFilter) &&
    matchesAspectRatio(item, aspectRatioFilter) &&
    matchesCaptionStatus(item, captionStatusFilter)
  );
}

export function sortMediaItems(a: MediaItemResponse, b: MediaItemResponse, sortOption: SortOptionKey): number {
  if (sortOption === 'created_at:desc') {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }
  if (sortOption === 'created_at:asc') {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  }
  if (sortOption === 'name:asc') {
    return a.name.localeCompare(b.name);
  }
  if (sortOption === 'file_size:desc') {
    return b.fileSize - a.fileSize;
  }
  return 0;
}

export function filterAndSortMediaItems(
  items: MediaItemResponse[],
  options: {
    currentFolderId: string | null;
    activeSmartView?: MediaSmartViewKey | null | undefined;
    mediaTypeFilter: MediaTypeFilterKey;
    aspectRatioFilter?: AspectRatioFilterKey | undefined;
    captionStatusFilter?: CaptionStatusFilterKey | undefined;
    searchQuery: string;
    sortOption: SortOptionKey;
  }
): MediaItemResponse[] {
  const {
    currentFolderId,
    activeSmartView,
    mediaTypeFilter,
    aspectRatioFilter = 'all',
    captionStatusFilter = 'all',
    searchQuery,
    sortOption,
  } = options;
  const trimmedSearch = searchQuery.trim().toLowerCase();

  return items
    .filter((item) =>
      matchesMediaFilters(
        item,
        currentFolderId,
        activeSmartView,
        mediaTypeFilter,
        aspectRatioFilter,
        captionStatusFilter,
        trimmedSearch
      )
    )
    .sort((a, b) => sortMediaItems(a, b, sortOption));
}

export function getScopeTagLabel(
  debouncedSearch: string,
  activeSmartView: MediaSmartViewKey | null,
  currentFolderId: string | null,
  folders: MediaFolder[]
): string {
  if (debouncedSearch.length > 0) {
    return 'In: Library';
  }
  if (activeSmartView === 'everything') {
    return 'In: Everything';
  }
  if (activeSmartView === 'needs_caption') {
    return 'In: Needs caption';
  }
  if (!currentFolderId) {
    return 'In: Library';
  }
  const folder = folders.find((f) => f.id === currentFolderId);
  return folder ? `In: ${folder.name}` : 'In: Library';
}

export function getEmptyStateInfo(
  activeSmartView: MediaSmartViewKey | null,
  debouncedSearch: string
): { title: string; subtext: string } {
  if (activeSmartView === 'needs_caption') {
    return {
      title: 'All files have captions',
      subtext: 'Upload new files or organize existing folders.',
    };
  }
  if (debouncedSearch) {
    return {
      title: 'No matching files found',
      subtext: 'Try a different search term or clear filters.',
    };
  }
  return {
    title: 'No media in this folder',
    subtext: 'Upload files or drag them anywhere into this folder to get started.',
  };
}

export function resolveTargetFolderIdForEntry(
  entry: any,
  existingFolders: MediaFolder[],
  baseFolderId: string | null
): string | null | undefined {
  const segments: string[] = entry.relativeSubfolderPath ?? (entry.relativePath
    ? entry.relativePath
        .replaceAll('\\', '/')
        .trim()
        .split('/')
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0 && p !== '.')
        .slice(0, -1)
    : []);

  if (segments.length === 0) {
    return baseFolderId ?? null;
  }

  let currentParentId: string | null = baseFolderId ?? null;
  for (const rawSegment of segments) {
    const segmentLower = rawSegment.trim().toLowerCase();
    const matched = existingFolders.find(
      (f) =>
        (f.parentId ?? null) === currentParentId &&
        f.name.trim().toLowerCase() === segmentLower
    );
    if (!matched) {
      return undefined;
    }
    currentParentId = matched.id;
  }
  return currentParentId;
}

export async function checkServerDuplicateEntries(
  subdomain: string,
  folderId: string | null | undefined,
  entries: any[],
  existingFolders: MediaFolder[] = []
): Promise<{ duplicates: any[]; uniqueEntries: any[] } | null> {
  try {
    const checkableEntries: Array<{
      clientKey: string;
      name: string;
      fileSize: number;
      folderId: string | null;
    }> = [];

    entries.forEach((e, idx) => {
      const targetFolderId = resolveTargetFolderIdForEntry(
        e,
        existingFolders,
        folderId ?? null
      );
      if (targetFolderId !== undefined) {
        checkableEntries.push({
          clientKey: String(idx),
          name: e.file.name,
          fileSize: e.file.size,
          folderId: targetFolderId,
        });
      }
    });

    if (checkableEntries.length === 0) {
      return { duplicates: [], uniqueEntries: entries };
    }

    const payload = {
      folderId: folderId ?? null,
      entries: checkableEntries,
    };
    const checkRes = await fetch(`/api/tenant/${subdomain}/media/check-duplicates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!checkRes.ok) return null;

    const checkData = (await checkRes.json()) as {
      duplicates: Array<{ clientKey: string; existingItem: any }>;
    };
    if (!checkData.duplicates || checkData.duplicates.length === 0) {
      return { duplicates: [], uniqueEntries: entries };
    }

    const dupKeySet = new Set(checkData.duplicates.map((d) => d.clientKey));
    const duplicates: any[] = [];
    const uniqueEntries: any[] = [];

    entries.forEach((e, idx) => {
      if (dupKeySet.has(String(idx))) {
        duplicates.push(e);
      } else {
        uniqueEntries.push(e);
      }
    });

    return { duplicates, uniqueEntries };
  } catch {
    return null;
  }
}

export const MEDIA_TYPE_LABELS: Record<MediaTypeFilterKey, string> = {
  all: 'All',
  video: 'Videos',
  image: 'Images',
};

export const ASPECT_RATIO_SHORT_VALUES: Record<AspectRatioFilterKey, string> = {
  all: 'All',
  '9:16': '9:16',
  '16:9': '16:9',
  '1:1': '1:1',
  '4:5': '4:5',
};

export const CAPTION_STATUS_SHORT_VALUES: Record<CaptionStatusFilterKey, string> = {
  all: 'All',
  has_caption: 'Has caption',
  empty_caption: 'Missing caption',
};

export const SORT_OPTION_SHORT_VALUES: Record<SortOptionKey, string> = {
  'created_at:desc': 'Newest',
  'created_at:asc': 'Oldest',
  'name:asc': 'Name A–Z',
  'file_size:desc': 'Largest',
};

export type ActiveDropdownKey = 'type' | 'ratio' | 'caption' | 'sort' | null;

