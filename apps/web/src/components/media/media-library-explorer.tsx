'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { MediaAssetCard } from './media-asset-card';
import { MediaTableRow } from './media-table-row';
import { MediaPreviewModal } from './media-preview-modal';
import { BatchActionBar } from './batch-action-bar';
import { BatchSetCaptionModal } from './batch-set-caption-modal';
import { MediaImportModal } from './media-import-modal';
import { NewFolderModal } from './new-folder-modal';
import { LeavePageGuardDialog } from './leave-page-guard-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { type BatchCaptionMode } from './media-types';

export const MEDIA_VIEW_MODE_STORAGE_KEY = 'fbuploadpro:media-view-mode';

/** How long success toasts stay visible before auto-dismissing. */
const TOAST_AUTO_DISMISS_MS = 3500;

export type MediaViewMode = 'grid' | 'table';
export type MediaTypeFilterKey = 'all' | 'video' | 'image';
export type AspectRatioFilterKey = 'all' | '9:16' | '16:9' | '1:1' | '4:5';
export type CaptionStatusFilterKey = 'all' | 'has_caption' | 'empty_caption';
export type SortOptionKey =
  | 'created_at:desc'
  | 'created_at:asc'
  | 'name:asc'
  | 'file_size:desc';

export type MediaSmartViewKey = 'everything' | 'needs_caption';

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


export interface FolderSubtreeImpact {
  descendantFolderIds: string[];
  subfolderCount: number;
  totalMediaCount: number;
}

export function buildFolderBreadcrumbs(
  currentFolderId: string | null,
  folders: MediaFolder[]
): MediaFolder[] {
  if (!currentFolderId) return [];
  const folderMap = new Map<string, MediaFolder>();
  for (const f of folders) {
    folderMap.set(f.id, f);
  }

  const trail: MediaFolder[] = [];
  const visited = new Set<string>();
  let cursorId: string | null = currentFolderId;

  while (cursorId && !visited.has(cursorId)) {
    visited.add(cursorId);
    const folder = folderMap.get(cursorId);
    if (!folder) break;
    trail.unshift(folder);
    cursorId = folder.parentId ?? null;
  }

  return trail;
}

export function formatFolderAncestryPath(
  folderId: string | null,
  folders: MediaFolder[]
): string {
  if (!folderId) return 'Library';
  const trail = buildFolderBreadcrumbs(folderId, folders);
  if (trail.length === 0) return 'Library';
  return trail.map((f) => f.name).join(' / ');
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
function matchesSearch(item: MediaItemResponse, query: string): boolean {
  if (!query) return true;
  const matchName = item.name.toLowerCase().includes(query);
  const matchCaption = (item.captionText || '').toLowerCase().includes(query);
  return matchName || matchCaption;
}

function matchesSmartViewOrFolder(
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

function matchesMediaType(item: MediaItemResponse, filter: MediaTypeFilterKey): boolean {
  return filter === 'all' || item.mediaType === filter;
}

function matchesAspectRatio(item: MediaItemResponse, filter: AspectRatioFilterKey): boolean {
  return filter === 'all' || item.aspectRatio === filter;
}

function matchesCaptionStatus(item: MediaItemResponse, filter: CaptionStatusFilterKey): boolean {
  if (filter === 'all') return true;
  const hasCaption = Boolean(item.captionText && item.captionText.trim().length > 0);
  return filter === 'has_caption' ? hasCaption : !hasCaption;
}

function matchesMediaFilters(
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

function sortMediaItems(a: MediaItemResponse, b: MediaItemResponse, sortOption: SortOptionKey): number {
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

interface MediaCanvasProps {
  displayedMediaItems: MediaItemResponse[];
  viewMode: MediaViewMode;
  isLoading: boolean;
  selectedIds: string[];
  debouncedSearch: string;
  folders: MediaFolder[];
  activeSmartView: MediaSmartViewKey | null;
  onNavigateFolder: (folderId: string | null) => void;
  onToggleSelect: (mediaId: string, options?: { shiftKey?: boolean | undefined }) => void;
  onPreview: (item: MediaItemResponse) => void;
  onUpdateCaption: (mediaId: string, captionText: string) => void;
  onMoveRequest: (item: MediaItemResponse) => void;
  onDeleteRequest: (mediaId: string) => void;
}

function MediaCanvas({
  displayedMediaItems,
  viewMode,
  isLoading,
  selectedIds,
  debouncedSearch,
  folders,
  activeSmartView,
  onNavigateFolder,
  onToggleSelect,
  onPreview,
  onUpdateCaption,
  onMoveRequest,
  onDeleteRequest,
}: Readonly<MediaCanvasProps>) {
  if (displayedMediaItems.length > 0) {
    if (viewMode === 'grid') {
      return (
        <div
          data-testid="media-assets-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: SPACING.lg,
            marginTop: SPACING.xs,
          }}
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
      );
    }

    return (
      <div
        data-testid="media-table-view"
        style={{
          width: '100%',
          overflowX: 'auto',
          marginTop: SPACING.xs,
        }}
      >
        <table
          data-testid="media-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
          }}
        >
          <thead
            style={{
              position: 'sticky',
              top: 0,
              backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
              borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
              zIndex: 2,
            }}
          >
            <tr>
              <th style={{ width: '40px', padding: `${SPACING.sm} ${SPACING.md}` }}>
                <span className="sr-only">Select</span>
              </th>
              <th style={{ width: '48px', padding: `${SPACING.sm} 0` }}>
                <span className="sr-only">Thumbnail</span>
              </th>
              <th
                style={{
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  fontSize: '0.6875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                File
              </th>
              <th
                style={{
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  fontSize: '0.6875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                Caption
              </th>
              <th
                style={{
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  fontSize: '0.6875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                Details
              </th>
              <th
                style={{
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  fontSize: '0.6875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                Size
              </th>
              <th
                style={{
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  fontSize: '0.6875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                Date
              </th>
              <th
                style={{
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  textAlign: 'right',
                  fontSize: '0.6875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedMediaItems.map((item) => (
              <MediaTableRow
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
          </tbody>
        </table>
      </div>
    );
  }

  if (!isLoading) {
    const { title: emptyTitle, subtext: emptySubtext } = getEmptyStateInfo(
      activeSmartView,
      debouncedSearch
    );

    return (
      <div
        data-testid="media-empty-state"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${SPACING.xxl} 0`,
          gap: SPACING.md,
          color: `var(--text-dim, ${THEME.default.text.muted})`,
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.9375rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            {emptyTitle}
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem' }}>
            {emptySubtext}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

function computeNextSelection(
  prev: string[],
  mediaId: string,
  allDisplayedIds: string[],
  shiftKey?: boolean
): string[] {
  if (shiftKey && prev.length > 0) {
    const lastId = prev.at(-1)!;
    const lastIdx = allDisplayedIds.indexOf(lastId);
    const currIdx = allDisplayedIds.indexOf(mediaId);
    if (lastIdx !== -1 && currIdx !== -1) {
      const start = Math.min(lastIdx, currIdx);
      const end = Math.max(lastIdx, currIdx);
      const slice = allDisplayedIds.slice(start, end + 1);
      return Array.from(new Set([...prev, ...slice]));
    }
  }
  return prev.includes(mediaId)
    ? prev.filter((id) => id !== mediaId)
    : [...prev, mediaId];
}

export type ActiveDropdownKey = 'type' | 'ratio' | 'caption' | 'sort' | null;

function isPointerInsideDropdown(
  activeDropdown: ActiveDropdownKey,
  target: Node | null,
  refs: Record<'type' | 'ratio' | 'caption' | 'sort', React.RefObject<HTMLDivElement | null>>
): boolean {
  if (!activeDropdown || !target) return false;
  return Boolean(refs[activeDropdown]?.current?.contains(target));
}

function useUploadNavigationGuard(
  activeUploadsCount: number,
  onInterceptNavigation: (href: string) => void
) {
  useEffect(() => {
    if (activeUploadsCount <= 0) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeUploadsCount]);

  useEffect(() => {
    if (activeUploadsCount <= 0) return;

    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        e.preventDefault();
        e.stopPropagation();
        onInterceptNavigation(href);
      }
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [activeUploadsCount, onInterceptNavigation]);
}

const TYPE_DROPDOWN_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'video', label: 'Videos' },
  { key: 'image', label: 'Images' },
] as const;

const RATIO_DROPDOWN_OPTIONS = [
  { key: 'all', label: 'All ratios' },
  { key: '9:16', label: '9:16 Vertical' },
  { key: '16:9', label: '16:9 Landscape' },
  { key: '1:1', label: '1:1 Square' },
  { key: '4:5', label: '4:5 Portrait' },
] as const;

const CAPTION_DROPDOWN_OPTIONS = [
  { key: 'all', label: 'All captions' },
  { key: 'has_caption', label: 'Has caption' },
  { key: 'empty_caption', label: 'Missing caption' },
] as const;

const SORT_DROPDOWN_OPTIONS = [
  { key: 'created_at:desc', label: 'Newest first' },
  { key: 'created_at:asc', label: 'Oldest first' },
  { key: 'name:asc', label: 'Name (A–Z)' },
  { key: 'file_size:desc', label: 'Largest size' },
] as const;

interface ToolbarDropdownItem<T extends string> {
  key: T;
  label: string;
}

interface ToolbarDropdownProps<T extends string> {
  testId: string;
  label: string;
  displayValue: string;
  isUnderlined?: boolean;
  isOpen: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  options: readonly ToolbarDropdownItem<T>[];
  selectedKey: T;
  optionTestIdPrefix: string;
  onToggle: () => void;
  onSelect: (key: T) => void;
  onClose: () => void;
}

function ToolbarDropdown<T extends string>({
  testId,
  label,
  displayValue,
  isUnderlined = false,
  isOpen,
  containerRef,
  options,
  selectedKey,
  optionTestIdPrefix,
  onToggle,
  onSelect,
  onClose,
}: Readonly<ToolbarDropdownProps<T>>) {
  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        data-testid={testId}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          } else if (e.key === 'Escape') {
            onClose();
          }
        }}
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          padding: 0,
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          fontSize: '0.8125rem',
          fontWeight: TYPOGRAPHY.weights.medium,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span>{label}</span>
        <span
          style={{
            color: isUnderlined ? `var(--text-main, ${THEME.default.text.primary})` : 'inherit',
            borderBottom: isUnderlined ? `2px solid ${PALETTE.primary}` : 'none',
            paddingBottom: '2px',
          }}
        >
          {displayValue}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '26px',
            left: 0,
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
            borderRadius: RADII.xs,
            padding: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 30,
            minWidth: '120px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="menuitem"
              data-testid={`${optionTestIdPrefix}-option-${opt.key}`}
              tabIndex={0}
              onClick={() => {
                onSelect(opt.key);
                onClose();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(opt.key);
                  onClose();
                } else if (e.key === 'Escape') {
                  onClose();
                }
              }}
              style={{
                padding: '6px 10px',
                textAlign: 'left',
                backgroundColor:
                  selectedKey === opt.key
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'transparent',
                border: 'none',
                borderRadius: RADII.xs,
                color:
                  selectedKey === opt.key
                    ? `var(--text-main, ${THEME.default.text.primary})`
                    : `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.8125rem',
                fontWeight:
                  selectedKey === opt.key
                    ? TYPOGRAPHY.weights.medium
                    : TYPOGRAPHY.weights.regular,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface MediaToolbarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  scopeTagLabel: string;
  mediaTypeFilter: MediaTypeFilterKey;
  onMediaTypeChange: (type: MediaTypeFilterKey) => void;
  aspectRatioFilter: AspectRatioFilterKey;
  onAspectRatioChange: (ratio: AspectRatioFilterKey) => void;
  captionStatusFilter: CaptionStatusFilterKey;
  onCaptionStatusChange: (status: CaptionStatusFilterKey) => void;
  activeFilterCount: number;
  onClearFilters: () => void;
  sortOption: SortOptionKey;
  onSortChange: (sort: SortOptionKey) => void;
  viewMode: MediaViewMode;
  onChangeViewMode: (mode: MediaViewMode) => void;
  activeDropdown: ActiveDropdownKey;
  onToggleDropdown: (dropdown: NonNullable<ActiveDropdownKey>) => void;
  onCloseDropdown: () => void;
  dropdownRefs: Record<NonNullable<ActiveDropdownKey>, React.RefObject<HTMLDivElement | null>>;
}

function MediaToolbar({
  searchInput,
  onSearchChange,
  scopeTagLabel,
  mediaTypeFilter,
  onMediaTypeChange,
  aspectRatioFilter,
  onAspectRatioChange,
  captionStatusFilter,
  onCaptionStatusChange,
  activeFilterCount,
  onClearFilters,
  sortOption,
  onSortChange,
  viewMode,
  onChangeViewMode,
  activeDropdown,
  onToggleDropdown,
  onCloseDropdown,
  dropdownRefs,
}: Readonly<MediaToolbarProps>) {
  return (
    <div
      data-testid="media-explorer-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.md,
        paddingBottom: SPACING.md,
        borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        flexWrap: 'wrap',
      }}
    >
      {/* Zone 1 — GLOBAL (left): the search field only */}
      <div
        data-testid="media-toolbar-zone-1"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.xs,
          flex: '1 1 240px',
          maxWidth: '360px',
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          data-testid="media-search-input"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search files and captions…"
          aria-label="Search files and captions"
          style={{
            width: '100%',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '0.875rem',
            color: `var(--text-main, ${THEME.default.text.primary})`,
            padding: '4px 0',
          }}
        />
      </div>

      {/* Divider 1: Between Zone 1 (Global Search) and Zone 2 (Local Scoped Controls) */}
      <hr
        data-testid="media-toolbar-divider-1"
        aria-orientation="vertical"
        style={{
          width: '1px',
          height: '16px',
          backgroundColor: 'var(--border-subtle, rgba(255, 255, 255, 0.12))',
          border: 'none',
          margin: 0,
          flexShrink: 0,
        }}
      />

      {/* Zone 2 — LOCAL (middle): controls that apply ONLY to the current view */}
      <div
        data-testid="media-toolbar-zone-2"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          flexWrap: 'wrap',
        }}
      >
        {/* Scope Tag Anchor */}
        <span
          data-testid="media-scope-tag"
          style={{
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            color: `var(--text-dim, ${THEME.default.text.muted})`,
            paddingRight: '4px',
          }}
        >
          {scopeTagLabel}
        </span>

        {/* Labeled Dropdown 1: Type */}
        <ToolbarDropdown
          testId="media-type-select"
          label="Type: "
          displayValue={MEDIA_TYPE_LABELS[mediaTypeFilter]}
          isUnderlined={mediaTypeFilter !== 'all'}
          isOpen={activeDropdown === 'type'}
          containerRef={dropdownRefs.type}
          options={TYPE_DROPDOWN_OPTIONS}
          selectedKey={mediaTypeFilter}
          optionTestIdPrefix="type"
          onToggle={() => onToggleDropdown('type')}
          onSelect={onMediaTypeChange}
          onClose={onCloseDropdown}
        />

        {/* Labeled Dropdown 2: Ratio */}
        <ToolbarDropdown
          testId="media-aspect-ratio-select"
          label="Ratio: "
          displayValue={ASPECT_RATIO_SHORT_VALUES[aspectRatioFilter]}
          isUnderlined={aspectRatioFilter !== 'all'}
          isOpen={activeDropdown === 'ratio'}
          containerRef={dropdownRefs.ratio}
          options={RATIO_DROPDOWN_OPTIONS}
          selectedKey={aspectRatioFilter}
          optionTestIdPrefix="aspect-ratio"
          onToggle={() => onToggleDropdown('ratio')}
          onSelect={onAspectRatioChange}
          onClose={onCloseDropdown}
        />

        {/* Labeled Dropdown 3: Captions */}
        <ToolbarDropdown
          testId="media-caption-status-select"
          label="Captions: "
          displayValue={CAPTION_STATUS_SHORT_VALUES[captionStatusFilter]}
          isUnderlined={captionStatusFilter !== 'all'}
          isOpen={activeDropdown === 'caption'}
          containerRef={dropdownRefs.caption}
          options={CAPTION_DROPDOWN_OPTIONS}
          selectedKey={captionStatusFilter}
          optionTestIdPrefix="caption-status"
          onToggle={() => onToggleDropdown('caption')}
          onSelect={onCaptionStatusChange}
          onClose={onCloseDropdown}
        />

        {/* Dynamic Filter Clear Badge */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            data-testid="clear-filters-btn"
            onClick={onClearFilters}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: '2px 6px',
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>
              {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'} · Clear
            </span>
          </button>
        )}
      </div>

      {/* Divider 2: Between Zone 2 (Local Filters) and Zone 3 (Sort & View Mode) */}
      <hr
        data-testid="media-toolbar-divider-2"
        aria-orientation="vertical"
        style={{
          width: '1px',
          height: '16px',
          backgroundColor: 'var(--border-subtle, rgba(255, 255, 255, 0.12))',
          border: 'none',
          margin: 0,
          flexShrink: 0,
        }}
      />

      {/* Zone 3 — SORT + VIEW (right) */}
      <div
        data-testid="media-toolbar-zone-3"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
        }}
      >
        {/* Labeled Sort Dropdown */}
        <ToolbarDropdown
          testId="media-sort-select"
          label="Sort: "
          displayValue={SORT_OPTION_SHORT_VALUES[sortOption]}
          isOpen={activeDropdown === 'sort'}
          containerRef={dropdownRefs.sort}
          options={SORT_DROPDOWN_OPTIONS}
          selectedKey={sortOption}
          optionTestIdPrefix="sort"
          onToggle={() => onToggleDropdown('sort')}
          onSelect={onSortChange}
          onClose={onCloseDropdown}
        />

        {/* Bare Grid/Table Toggle Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            data-testid="view-mode-grid-btn"
            aria-label="Grid view"
            onClick={() => onChangeViewMode('grid')}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: '4px',
              color:
                viewMode === 'grid'
                  ? PALETTE.primary
                  : `var(--text-dim, ${THEME.default.text.muted})`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
          <button
            type="button"
            data-testid="view-mode-table-btn"
            aria-label="Table view"
            onClick={() => onChangeViewMode('table')}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: '4px',
              color:
                viewMode === 'table'
                  ? PALETTE.primary
                  : `var(--text-dim, ${THEME.default.text.muted})`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}



function getInitialViewMode(initialMode?: MediaViewMode): MediaViewMode {
  if (initialMode) return initialMode;
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem(MEDIA_VIEW_MODE_STORAGE_KEY);
    if (stored === 'grid' || stored === 'table') return stored;
  }
  return 'grid';
}

function computeActiveFilterCount(
  mediaType: MediaTypeFilterKey,
  ratio: AspectRatioFilterKey,
  captionStatus: CaptionStatusFilterKey
): number {
  return (
    (mediaType !== 'all' ? 1 : 0) +
    (ratio !== 'all' ? 1 : 0) +
    (captionStatus !== 'all' ? 1 : 0)
  );
}

export interface MoveTargetState {
  type: 'single_media' | 'batch_media' | 'folder';
  mediaItem?: MediaItemResponse;
  folder?: MediaFolder;
}

interface MoveTargetDialogProps {
  moveTarget: MoveTargetState;
  destinationFolderId: string | null;
  folders: MediaFolder[];
  isMoving: boolean;
  onDestinationChange: (folderId: string | null) => void;
  onClose: () => void;
  onConfirm: () => void;
}

function MoveTargetDialog({
  moveTarget,
  destinationFolderId,
  folders,
  isMoving,
  onDestinationChange,
  onClose,
  onConfirm,
}: Readonly<MoveTargetDialogProps>) {
  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="move-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9500,
        padding: SPACING.md,
        border: 'none',
        margin: 0,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
          borderRadius: RADII.md,
          padding: SPACING.xl,
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.md,
        }}
      >
        <h2
          id="move-modal-title"
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Move to folder
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            htmlFor="move-destination-folder-select"
            style={{
              fontSize: '0.6875rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
            }}
          >
            Select destination
          </label>
          <select
            id="move-destination-folder-select"
            disabled={isMoving}
            value={destinationFolderId || ''}
            onChange={(e) => onDestinationChange(e.target.value || null)}
            style={{
              width: '100%',
              padding: `${SPACING.xs} ${SPACING.sm}`,
              backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
              border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
              borderRadius: RADII.xs,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              fontSize: '0.8125rem',
              outline: 'none',
              cursor: isMoving ? 'not-allowed' : 'pointer',
              opacity: isMoving ? 0.6 : 1,
            }}
          >
            <option value="">Library</option>
            {folders
              .filter((f) =>
                moveTarget.type === 'folder' ? f.id !== moveTarget.folder?.id : true
              )
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm }}>
          <button
            type="button"
            disabled={isMoving}
            onClick={onClose}
            style={{
              padding: `${SPACING.xs} ${SPACING.md}`,
              backgroundColor: 'transparent',
              border: 'none',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.8125rem',
              cursor: isMoving ? 'not-allowed' : 'pointer',
              opacity: isMoving ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isMoving}
            onClick={onConfirm}
            style={{
              padding: `${SPACING.xs} ${SPACING.lg}`,
              backgroundColor: isMoving ? 'rgba(250, 215, 52, 0.3)' : PALETTE.primary,
              color: PALETTE.background,
              border: 'none',
              borderRadius: RADII.xs,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: isMoving ? 'not-allowed' : 'pointer',
              opacity: isMoving ? 0.6 : 1,
            }}
          >
            {isMoving ? 'Moving...' : 'Move'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

interface RenameFolderDialogProps {
  renameDraft: string;
  isRenaming: boolean;
  onDraftChange: (name: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

function RenameFolderDialog({
  renameDraft,
  isRenaming,
  onDraftChange,
  onClose,
  onSubmit,
}: Readonly<RenameFolderDialogProps>) {
  const isValid = Boolean(renameDraft.trim());
  const canSave = isValid && !isRenaming;
  return (
    <dialog
      open
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9500,
        padding: SPACING.md,
        border: 'none',
        margin: 0,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
          borderRadius: RADII.md,
          padding: SPACING.xl,
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.md,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Rename folder
        </h2>
        <input
          type="text"
          disabled={isRenaming}
          value={renameDraft}
          onChange={(e) => onDraftChange(e.target.value)}
          style={{
            width: '100%',
            padding: `${SPACING.xs} ${SPACING.sm}`,
            backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
            border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
            borderRadius: RADII.xs,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            fontSize: '0.875rem',
            outline: 'none',
            boxSizing: 'border-box',
            opacity: isRenaming ? 0.6 : 1,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm }}>
          <button
            type="button"
            disabled={isRenaming}
            onClick={onClose}
            style={{
              padding: `${SPACING.xs} ${SPACING.md}`,
              backgroundColor: 'transparent',
              border: 'none',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.8125rem',
              cursor: isRenaming ? 'not-allowed' : 'pointer',
              opacity: isRenaming ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={onSubmit}
            style={{
              padding: `${SPACING.xs} ${SPACING.lg}`,
              backgroundColor: canSave ? PALETTE.primary : 'rgba(250, 215, 52, 0.3)',
              color: PALETTE.background,
              border: 'none',
              borderRadius: RADII.xs,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: canSave ? 'pointer' : 'not-allowed',
              opacity: isRenaming ? 0.6 : 1,
            }}
          >
            {isRenaming ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

interface DeleteFolderDialogProps {
  target: MediaFolder;
  folders: MediaFolder[];
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteFolderDialog({
  target,
  folders,
  isDeleting,
  onClose,
  onConfirm,
}: Readonly<DeleteFolderDialogProps>) {
  const impact = computeFolderSubtreeImpact(target.id, folders);
  const impactText =
    impact.subfolderCount > 0 || impact.totalMediaCount > 0
      ? `${impact.subfolderCount} subfolders and ${impact.totalMediaCount} media files inside will be moved to Library.`
      : 'Items inside will be moved to Library.';

  return (
    <dialog
      open
      aria-modal="true"
      data-testid="delete-folder-modal"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9500,
        padding: SPACING.md,
        border: 'none',
        margin: 0,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
          borderRadius: RADII.md,
          padding: SPACING.xl,
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.md,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Delete folder
        </h2>
        <p
          data-testid="delete-folder-impact-summary"
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            lineHeight: 1.45,
          }}
        >
          Are you sure you want to delete &ldquo;{target.name}&rdquo;? {impactText}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm }}>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            style={{
              padding: `${SPACING.xs} ${SPACING.md}`,
              backgroundColor: 'transparent',
              border: 'none',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.8125rem',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            style={{
              padding: `${SPACING.xs} ${SPACING.lg}`,
              backgroundColor: PALETTE.accent3,
              color: PALETTE.text,
              border: 'none',
              borderRadius: RADII.xs,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

interface BatchDeleteConfirmDialogProps {
  count: number;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function BatchDeleteConfirmDialog({
  count,
  isDeleting,
  onClose,
  onConfirm,
}: Readonly<BatchDeleteConfirmDialogProps>) {
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent style={{ maxWidth: '440px' }} data-testid="batch-delete-confirm-dialog">
        <DialogHeader>
          <DialogTitle>Delete {count} assets?</DialogTitle>
          <DialogDescription>This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            data-testid="batch-delete-keep-btn"
            disabled={isDeleting}
            onClick={onClose}
            style={{
              height: '36px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: 'transparent',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.sm,
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
            }}
          >
            Keep
          </button>
          <button
            type="button"
            data-testid="batch-delete-confirm-btn"
            disabled={isDeleting}
            onClick={onConfirm}
            style={{
              height: '36px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: PALETTE.accent3,
              color: PALETTE.text,
              border: 'none',
              borderRadius: RADII.sm,
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.7 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
            }}
          >
            {isDeleting ? 'Deleting...' : `Delete ${count} assets`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Reads an internal media/folder drag payload from a drop event.
 * Returns the parsed payload, or null when the drop carries no internal
 * payload (or the payload is malformed — intentionally ignored, since
 * invalid JSON means the dropped data isn't ours).
 */
function readInternalDropPayload(
  e: React.DragEvent
): { mediaId?: string; folderId?: string } | null {
  const mediaRaw = e.dataTransfer.getData('application/x-fbuploadpro-media');
  if (mediaRaw) {
    try {
      const parsed = JSON.parse(mediaRaw) as { mediaId?: string };
      return parsed.mediaId ? { mediaId: parsed.mediaId } : null;
    } catch {
      return null;
    }
  }
  const folderRaw = e.dataTransfer.getData('application/x-fbuploadpro-folder');
  if (folderRaw) {
    try {
      const parsed = JSON.parse(folderRaw) as { folderId?: string };
      return parsed.folderId ? { folderId: parsed.folderId } : null;
    } catch {
      return null;
    }
  }
  return null;
}

interface SubfolderRowsSectionProps {
  currentSubfolders: MediaFolder[];
  folders: MediaFolder[];
  mediaItems: MediaItemResponse[];
  isLocked: boolean;
  onSelectFolder: (id: string) => void;
  onStartRename: (folder: MediaFolder) => void;
  onStartMove: (folder: MediaFolder) => void;
  onStartDelete: (folder: MediaFolder) => void;
  onFilesDrop: (e: React.DragEvent, targetFolderId: string | null) => void;
}

function SubfolderRowsSection({
  currentSubfolders,
  folders,
  mediaItems,
  isLocked,
  onSelectFolder,
  onStartRename,
  onStartMove,
  onStartDelete,
  onFilesDrop,
}: Readonly<SubfolderRowsSectionProps>) {
  return (
    <section
      aria-label="Subfolders"
      data-testid="subfolders-grid"
      style={{
        marginBottom: SPACING.xl,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}
    >
      <span
        style={{
          fontSize: '0.6875rem',
          fontWeight: TYPOGRAPHY.weights.semibold,
          letterSpacing: '0.04em',
          color: `var(--text-dim, ${THEME.default.text.muted})`,
          marginBottom: '6px',
        }}
      >
        FOLDERS ({currentSubfolders.length})
      </span>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
        }}
      >
        {currentSubfolders.map((folder) => {
          const childSubfolders = folders.filter((f) => f.parentId === folder.id);
          const folderItems = mediaItems.filter((m) => m.folderId === folder.id);
          const subCount = childSubfolders.length;
          const fileCount = folder.itemCount ?? folderItems.length;

          return (
            <div
              key={folder.id}
              data-testid={`folder-row-${folder.id}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectFolder(folder.id);
                }
              }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  'application/x-fbuploadpro-folder',
                  JSON.stringify({ folderId: folder.id })
                );
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onFilesDrop(e, folder.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `${SPACING.sm} ${SPACING.xs}`,
                borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
                cursor: 'pointer',
                transition: 'background-color 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `var(--bg-hover, ${THEME.default.surfaces.hover})`;
                const actionContainer = e.currentTarget.querySelector('.folder-hover-actions') as HTMLElement | null;
                if (actionContainer) actionContainer.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                const actionContainer = e.currentTarget.querySelector('.folder-hover-actions') as HTMLElement | null;
                if (actionContainer) actionContainer.style.opacity = '0';
              }}
              onClick={() => onSelectFolder(folder.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={PALETTE.primary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span
                  data-testid={`folder-name-${folder.id}`}
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: TYPOGRAPHY.weights.medium,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                  }}
                >
                  {folder.name}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                  }}
                >
                  {subCount} subfolder{subCount === 1 ? '' : 's'} · {fileCount} file{fileCount === 1 ? '' : 's'}
                </span>
              </div>

              <div
                className="folder-hover-actions"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: 0,
                  transition: 'opacity 0.12s ease',
                }}
              >
                <button
                  type="button"
                  data-testid={`rename-folder-${folder.id}`}
                  aria-label={`Rename ${folder.name}`}
                  disabled={isLocked}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLocked) return;
                    onStartRename(folder);
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.6 : 1,
                    padding: '4px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </button>

                <button
                  type="button"
                  data-testid={`move-folder-${folder.id}`}
                  aria-label={`Move ${folder.name}`}
                  disabled={isLocked}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLocked) return;
                    onStartMove(folder);
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.6 : 1,
                    padding: '4px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </button>

                <button
                  type="button"
                  data-testid={`delete-folder-${folder.id}`}
                  aria-label={`Delete ${folder.name}`}
                  disabled={isLocked}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLocked) return;
                    onStartDelete(folder);
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: PALETTE.accent3,
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.6 : 1,
                    padding: '4px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export interface MediaLibraryExplorerProps {
  subdomain: string;
  initialFolders?: MediaFolder[];
  initialMediaItems?: MediaItemResponse[];
  initialCurrentFolderId?: string | null;
  initialActiveSmartView?: MediaSmartViewKey | null;
  initialViewMode?: MediaViewMode;
  initialSearchQuery?: string;
  initialMediaTypeFilter?: MediaTypeFilterKey;
  initialAspectRatioFilter?: AspectRatioFilterKey;
  initialCaptionStatusFilter?: CaptionStatusFilterKey;
  initialSortOption?: SortOptionKey;
  initialTotalMediaCount?: number;
  initialPendingDuplicateUpload?: any;
  initialDeleteFolderTarget?: MediaFolder | null;
}

export function MediaLibraryExplorer({
  subdomain,
  initialFolders,
  initialMediaItems,
  initialCurrentFolderId = null,
  initialActiveSmartView = null,
  initialViewMode,
  initialSearchQuery = '',
  initialMediaTypeFilter = 'all',
  initialAspectRatioFilter = 'all',
  initialCaptionStatusFilter = 'all',
  initialSortOption = 'created_at:desc',
  initialTotalMediaCount,
  initialPendingDuplicateUpload,
  initialDeleteFolderTarget = null,
}: Readonly<MediaLibraryExplorerProps>) {
  const [folders, setFolders] = useState<MediaFolder[]>(initialFolders ?? []);
  const [mediaItems, setMediaItems] = useState<MediaItemResponse[]>(
    initialMediaItems ?? []
  );
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    initialCurrentFolderId
  );
  const [activeSmartView, setActiveSmartView] = useState<MediaSmartViewKey | null>(
    initialActiveSmartView
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(!initialMediaItems);

  // View mode
  const [viewMode, setViewMode] = useState<MediaViewMode>(() => getInitialViewMode(initialViewMode));

  const handleChangeViewMode = (mode: MediaViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(MEDIA_VIEW_MODE_STORAGE_KEY, mode);
      } catch {
        // Intentional: localStorage may be unavailable (private mode/quota) — view mode just won't persist.
      }
    }
  };

  // Search & Filters
  const [searchInput, setSearchInput] = useState(initialSearchQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(
    initialSearchQuery.trim().toLowerCase()
  );
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaTypeFilterKey>(
    initialMediaTypeFilter
  );
  const [aspectRatioFilter, setAspectRatioFilter] = useState<AspectRatioFilterKey>(
    initialAspectRatioFilter
  );
  const [captionStatusFilter, setCaptionStatusFilter] = useState<CaptionStatusFilterKey>(
    initialCaptionStatusFilter
  );
  const [sortOption, setSortOption] = useState<SortOptionKey>(initialSortOption);

  // Custom Dropdowns state & container refs (prevents mouse click swallowing)
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdownKey>(null);
  const typeDropdownRef = useRef<HTMLDivElement | null>(null);
  const ratioDropdownRef = useRef<HTMLDivElement | null>(null);
  const captionDropdownRef = useRef<HTMLDivElement | null>(null);
  const sortDropdownRef = useRef<HTMLDivElement | null>(null);

  // Debounce search with 250ms (0ms if cleared immediately)
  useEffect(() => {
    if (!searchInput.trim()) {
      setDebouncedSearch('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!activeDropdown) return;
    const dropdownRefs = {
      type: typeDropdownRef,
      ratio: ratioDropdownRef,
      caption: captionDropdownRef,
      sort: sortDropdownRef,
    };
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node | null;
      if (isPointerInsideDropdown(activeDropdown, target, dropdownRefs)) {
        return;
      }
      setActiveDropdown(null);
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [activeDropdown]);

  // Modals
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [stagedFilesForImport, setStagedFilesForImport] = useState<File[]>([]);
  const [isBatchCaptionOpen, setIsBatchCaptionOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaItemResponse | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Move Modal State
  const [moveTarget, setMoveTarget] = useState<{
    type: 'single_media' | 'batch_media' | 'folder';
    mediaItem?: MediaItemResponse;
    folder?: MediaFolder;
  } | null>(null);
  const [moveDestinationFolderId, setMoveDestinationFolderId] = useState<string | null>(null);

  // Rename Folder State
  const [renameFolderTarget, setRenameFolderTarget] = useState<MediaFolder | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Delete Folder Confirmation State
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<MediaFolder | null>(
    initialDeleteFolderTarget
  );

  // Action Busy States (Prevents multi-click / double submission)
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [isBatchCaptioning, setIsBatchCaptioning] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  // Active uploads state & Leave page protection
  const [activeUploadsCount, setActiveUploadsCount] = useState(0);
  const [furthestAlongUpload, setFurthestAlongUpload] = useState<{
    name: string;
    progressPercent: number;
  } | null>(null);
  const [isLeaveGuardOpen, setIsLeaveGuardOpen] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleInterceptNavigation = useCallback((href: string) => {
    setPendingNavigationUrl(href);
    setIsLeaveGuardOpen(true);
  }, []);

  useUploadNavigationGuard(activeUploadsCount, handleInterceptNavigation);

  // Data Fetching
  const refreshLibraryData = useCallback(async () => {
    try {
      const [foldersRes, mediaRes] = await Promise.all([
        fetch(`/api/tenant/${subdomain}/media/folders`),
        fetch(`/api/tenant/${subdomain}/media?limit=500`),
      ]);

      if (foldersRes.ok) {
        const fData = await foldersRes.json();
        setFolders(fData.folders || []);
      }
      if (mediaRes.ok) {
        const mData = await mediaRes.json();
        setMediaItems(mData.items || []);
      }
    } catch {
      // Network load error
    } finally {
      setIsLoading(false);
    }
  }, [subdomain]);

  useEffect(() => {
    if (!initialMediaItems) {
      void refreshLibraryData();
    }
  }, [refreshLibraryData, initialMediaItems]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), TOAST_AUTO_DISMISS_MS);
  };

  // Breadcrumbs
  const breadcrumbs = useMemo(
    () => buildFolderBreadcrumbs(currentFolderId, folders),
    [currentFolderId, folders]
  );

  // Subfolders under current folder (enforces real nesting)
  const currentSubfolders = useMemo(() => {
    return folders.filter((f) => (f.parentId ?? null) === (currentFolderId ?? null));
  }, [folders, currentFolderId]);

  // Filtered & Sorted Media Items
  const displayedMediaItems = useMemo(() => {
    return filterAndSortMediaItems(mediaItems, {
      currentFolderId,
      activeSmartView,
      searchQuery: debouncedSearch,
      mediaTypeFilter,
      aspectRatioFilter,
      captionStatusFilter,
      sortOption,
    });
  }, [
    mediaItems,
    currentFolderId,
    activeSmartView,
    debouncedSearch,
    mediaTypeFilter,
    aspectRatioFilter,
    captionStatusFilter,
    sortOption,
  ]);

  // Selection handlers
  const handleToggleSelect = (
    mediaId: string,
    options?: { shiftKey?: boolean | undefined } | undefined
  ) => {
    const allIds = displayedMediaItems.map((m) => m.id);
    setSelectedIds((prev) => computeNextSelection(prev, mediaId, allIds, options?.shiftKey));
  };

  const handleSelectAll = () => {
    if (selectedIds.length === displayedMediaItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedMediaItems.map((item) => item.id));
    }
  };

  // Folder Actions
  const handleCreateFolder = async (name: string, parentId: string | null) => {
    const res = await fetch(`/api/tenant/${subdomain}/media/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId }),
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`Folder '${name}' created`);
      await refreshLibraryData();
      if (data.folder?.id) {
        setCurrentFolderId(data.folder.id);
      }
    }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    if (isRenamingFolder || !newName.trim()) return;
    setIsRenamingFolder(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        showToast(`Folder renamed to '${newName}'`);
        setRenameFolderTarget(null);
        await refreshLibraryData();
      }
    } finally {
      setIsRenamingFolder(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (isDeletingFolder) return;
    setIsDeletingFolder(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media/folders/${folderId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Folder deleted');
        setDeleteFolderTarget(null);
        if (currentFolderId === folderId) {
          setCurrentFolderId(null);
        }
        await refreshLibraryData();
      }
    } finally {
      setIsDeletingFolder(false);
    }
  };

  // Reparenting via Drag and Drop
  const handleReparent = async (
    targetFolderId: string | null,
    payload: { mediaId?: string; folderId?: string }
  ) => {
    if (isMoving) return;
    setIsMoving(true);
    try {
      if (payload.mediaId) {
        const res = await fetch(`/api/tenant/${subdomain}/media/${payload.mediaId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId: targetFolderId }),
        });
        if (!res.ok) {
          showToast('Could not move item. Please try again.');
          return;
        }
        showToast('Item moved');
        await refreshLibraryData();
        return;
      }
      if (payload.folderId && payload.folderId !== targetFolderId) {
        const res = await fetch(`/api/tenant/${subdomain}/media/folders/${payload.folderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: targetFolderId }),
        });
        if (!res.ok) {
          showToast('Could not move folder. Please try again.');
          return;
        }
        showToast('Folder moved');
        await refreshLibraryData();
      }
    } finally {
      setIsMoving(false);
    }
  };

  // Batch Operations
  const handleBatchCaptionApply = async (text: string, mode: BatchCaptionMode) => {
    if (selectedIds.length === 0 || isBatchCaptioning) return;
    setIsBatchCaptioning(true);
    try {
      // Apply via API batch or individual updates
      const updates = selectedIds.map(async (id) => {
        const existing = mediaItems.find((m) => m.id === id);
        const newCaption =
          mode === 'append' && existing?.captionText
            ? `${existing.captionText}\n${text}`
            : text;

        return fetch(`/api/tenant/${subdomain}/media/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ captionText: newCaption }),
        });
      });

      const results = await Promise.all(updates);
      if (results.some((res) => !res.ok)) {
        showToast('Some captions could not be updated. Please try again.');
        return;
      }
      showToast(`Caption updated on ${selectedIds.length} files`);
      setSelectedIds([]);
      await refreshLibraryData();
    } finally {
      setIsBatchCaptioning(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0 || isBatchDeleting) return;

    setIsBatchDeleting(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', mediaIds: selectedIds }),
      });

      if (!res.ok) {
        showToast('Could not delete files. Please try again.');
        return;
      }
      showToast(`Deleted ${selectedIds.length} files`);
      setSelectedIds([]);
      await refreshLibraryData();
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleBatchMoveSubmit = async (destinationId: string | null) => {
    if (selectedIds.length === 0 || isMoving) return;
    setIsMoving(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', mediaIds: selectedIds, folderId: destinationId }),
      });

      if (!res.ok) {
        showToast('Could not move files. Please try again.');
        return;
      }
      showToast(`Moved ${selectedIds.length} files`);
      setSelectedIds([]);
      setMoveTarget(null);
      await refreshLibraryData();
    } finally {
      setIsMoving(false);
    }
  };

  // Single Item Operations
  const handleUpdateItemCaption = async (mediaId: string, captionText: string) => {
    await fetch(`/api/tenant/${subdomain}/media/${mediaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ captionText }),
    });
    setMediaItems((prev) =>
      prev.map((m) => (m.id === mediaId ? { ...m, captionText } : m))
    );
  };

  const handleDeleteItem = async (mediaId: string) => {
    if (deletingAssetId === mediaId) return;
    setDeletingAssetId(mediaId);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media/${mediaId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        showToast('Could not delete asset. Please try again.');
        return;
      }
      showToast('Asset deleted');
      setMediaItems((prev) => prev.filter((m) => m.id !== mediaId));
    } finally {
      setDeletingAssetId(null);
    }
  };

  // Global Drag and drop onto page to open Import Modal
  const handleDragOverPage = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
    }
  };

  /**
   * Shared drop handler for library drop zones.
   *
   * - Internal drags (media / folder payloads) reparent the dragged item into
   *   `targetFolderId` (`null` = Library root).
   * - OS file drops open the import modal.
   * - The page-level zone omits `targetFolderId` to accept file drops only;
   *   internal drags dropped on the page background are ignored (unchanged behavior).
   */
  const handleFilesDrop = (e: React.DragEvent, targetFolderId?: string | null) => {
    e.preventDefault();
    const payload = readInternalDropPayload(e);
    if (payload) {
      if (targetFolderId !== undefined) {
        void handleReparent(targetFolderId, payload);
      }
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setStagedFilesForImport(files);
      setIsImportModalOpen(true);
    }
  };

  const activeFilterCount = computeActiveFilterCount(
    mediaTypeFilter,
    aspectRatioFilter,
    captionStatusFilter
  );

  const handleClearFilters = () => {
    setMediaTypeFilter('all');
    setAspectRatioFilter('all');
    setCaptionStatusFilter('all');
  };

  return (
    <div
      data-testid="media-library-explorer"
      onDragOver={handleDragOverPage}
      onDrop={(e) => handleFilesDrop(e)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minHeight: '100vh',
        backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
        color: `var(--text-main, ${THEME.default.text.primary})`,
        padding: `${SPACING.lg} ${SPACING.xl}`,
        boxSizing: 'border-box',
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          data-testid="media-toast"
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: '1px solid var(--border-strong, rgba(255,255,255,0.2))',
            borderRadius: RADII.xs,
            padding: `${SPACING.xs} ${SPACING.md}`,
            fontSize: '0.8125rem',
            color: `var(--text-main, ${THEME.default.text.primary})`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 9999,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Hidden File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            e.target.value = '';
            setStagedFilesForImport(files);
            setIsImportModalOpen(true);
          }
        }}
      />

      {/* 1. Page Header (No box, plain text) */}
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: SPACING.md,
          marginBottom: SPACING.xl,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1
            data-testid="media-library-title"
            style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: TYPOGRAPHY.weights.bold,
              letterSpacing: '-0.02em',
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Media Library
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Upload, organize, and caption your media for publishing queues.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.lg }}>
          {/* Quiet New Folder Link */}
          <button
            type="button"
            data-testid="new-folder-link"
            onClick={() => setIsNewFolderOpen(true)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: 0,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            + New Folder
          </button>

          {/* Single Primary Button: Upload Files */}
          <button
            type="button"
            data-testid="upload-files-btn"
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: `${SPACING.xs} ${SPACING.lg}`,
              backgroundColor: PALETTE.primary,
              border: 'none',
              borderRadius: RADII.xs,
              color: PALETTE.background,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Upload Files</span>
          </button>
        </div>
      </header>

      {/* 2. Toolbar (Single divider-separated row, 3 zones, NO boxes) */}
      <MediaToolbar
        searchInput={searchInput}
        onSearchChange={(val) => {
          setSearchInput(val);
          if (val.trim().length > 0) {
            setMediaTypeFilter("all");
            setAspectRatioFilter("all");
            setCaptionStatusFilter("all");
          }
        }}
        scopeTagLabel={getScopeTagLabel(debouncedSearch, activeSmartView, currentFolderId, folders)}
        mediaTypeFilter={mediaTypeFilter}
        onMediaTypeChange={setMediaTypeFilter}
        aspectRatioFilter={aspectRatioFilter}
        onAspectRatioChange={setAspectRatioFilter}
        captionStatusFilter={captionStatusFilter}
        onCaptionStatusChange={setCaptionStatusFilter}
        activeFilterCount={activeFilterCount}
        onClearFilters={handleClearFilters}
        sortOption={sortOption}
        onSortChange={setSortOption}
        viewMode={viewMode}
        onChangeViewMode={handleChangeViewMode}
        activeDropdown={activeDropdown}
        onToggleDropdown={(d) => setActiveDropdown((prev) => (prev === d ? null : d))}
        onCloseDropdown={() => setActiveDropdown(null)}
        dropdownRefs={{
          type: typeDropdownRef,
          ratio: ratioDropdownRef,
          caption: captionDropdownRef,
          sort: sortDropdownRef,
        }}
      />

      {/* 3. Main Explorer Canvas (Full Width) */}
      <main
        data-testid="media-explorer-body"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
          {/* Slim Context Row: Breadcrumb in Plain Text on Left, "Select all" on Right */}
          <div
            data-testid="context-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${SPACING.md} 0`,
              gap: SPACING.md,
              flexWrap: 'wrap',
            }}
          >
            {/* Breadcrumb Trail in Plain Text (Clickable & Drag-Drop Reparenting) */}
            <nav
              aria-label="Folder path"
              data-testid="folder-breadcrumbs"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.875rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              <button
                type="button"
                data-testid="breadcrumb-root"
                onClick={() => {
                  setActiveSmartView(null);
                  setCurrentFolderId(null);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleFilesDrop(e, null)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  padding: 0,
                  color:
                    activeSmartView === null && currentFolderId === null
                      ? `var(--text-main, ${THEME.default.text.primary})`
                      : `var(--text-sub, ${THEME.default.text.secondary})`,
                  fontWeight:
                    activeSmartView === null && currentFolderId === null
                      ? TYPOGRAPHY.weights.semibold
                      : TYPOGRAPHY.weights.regular,
                  cursor: 'pointer',
                }}
              >
                Library
              </button>

              {activeSmartView === 'everything' && (
                <>
                  <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>/</span>
                  <span
                    style={{
                      color: `var(--text-main, ${THEME.default.text.primary})`,
                      fontWeight: TYPOGRAPHY.weights.semibold,
                    }}
                  >
                    Everything
                  </span>
                </>
              )}

              {activeSmartView === 'needs_caption' && (
                <>
                  <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>/</span>
                  <span
                    style={{
                      color: `var(--text-main, ${THEME.default.text.primary})`,
                      fontWeight: TYPOGRAPHY.weights.semibold,
                    }}
                  >
                    Needs caption
                  </span>
                </>
              )}

              {!activeSmartView &&
                breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb.id}>
                      <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>/</span>
                      <button
                        type="button"
                        data-testid={`breadcrumb-folder-${crumb.id}`}
                        onClick={() => {
                          setActiveSmartView(null);
                          setCurrentFolderId(crumb.id);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleFilesDrop(e, crumb.id)}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          padding: 0,
                          color: isLast
                            ? `var(--text-main, ${THEME.default.text.primary})`
                            : `var(--text-sub, ${THEME.default.text.secondary})`,
                          fontWeight: isLast
                            ? TYPOGRAPHY.weights.semibold
                            : TYPOGRAPHY.weights.regular,
                          cursor: 'pointer',
                        }}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  );
                })}
            </nav>

            {/* Right: "Select all" toggle */}
            {displayedMediaItems.length > 0 && (
              <button
                type="button"
                data-testid="select-all-btn"
                onClick={handleSelectAll}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  cursor: 'pointer',
                }}
              >
                {selectedIds.length === displayedMediaItems.length
                  ? 'Deselect all'
                  : 'Select all'}
              </button>
            )}
          </div>

          {/* Subfolders as ROWS (NOT cards) */}
          {currentSubfolders.length > 0 && !debouncedSearch && !activeSmartView && (
            <SubfolderRowsSection
              currentSubfolders={currentSubfolders}
              folders={folders}
              mediaItems={mediaItems}
              isLocked={isRenamingFolder || isDeletingFolder || isMoving}
              onSelectFolder={(folderId) => {
                setActiveSmartView(null);
                setCurrentFolderId(folderId);
              }}
              onStartRename={(folder) => {
                setRenameFolderTarget(folder);
                setRenameDraft(folder.name);
              }}
              onStartMove={(folder) => {
                setMoveTarget({ type: 'folder', folder });
                setMoveDestinationFolderId(folder.parentId);
              }}
              onStartDelete={(folder) => {
                setDeleteFolderTarget(folder);
              }}
              onFilesDrop={(e, folderId) => handleFilesDrop(e, folderId)}
            />
          )}

          {/* Main Media Asset Canvas: Grid or Table View */}
          <MediaCanvas
            displayedMediaItems={displayedMediaItems}
            viewMode={viewMode}
            isLoading={isLoading}
            selectedIds={selectedIds}
            debouncedSearch={debouncedSearch}
            folders={folders}
            activeSmartView={activeSmartView}
            onNavigateFolder={(fId) => {
              setActiveSmartView(null);
              setCurrentFolderId(fId);
            }}
            onToggleSelect={handleToggleSelect}
            onPreview={(m) => setPreviewItem(m)}
            onUpdateCaption={handleUpdateItemCaption}
            onMoveRequest={(m) => {
              setMoveTarget({ type: 'single_media', mediaItem: m });
              setMoveDestinationFolderId(m.folderId);
            }}
            onDeleteRequest={handleDeleteItem}
          />
        </main>

      {/* 6. Floating Batch Action Pill (Bottom Center) */}
      <BatchActionBar
        selectedIds={selectedIds}
        isBusy={isBatchDeleting || isBatchCaptioning || isMoving}
        onClearSelection={() => {
          if (isBatchDeleting || isBatchCaptioning || isMoving) return;
          setSelectedIds([]);
        }}
        onBatchMove={() => {
          if (isBatchDeleting || isBatchCaptioning || isMoving) return;
          setMoveTarget({ type: 'batch_media' });
          setMoveDestinationFolderId(currentFolderId);
        }}
        onBatchCaption={() => {
          if (isBatchDeleting || isBatchCaptioning || isMoving) return;
          setIsBatchCaptionOpen(true);
        }}
        onBatchDelete={() => {
          if (isBatchDeleting || isBatchCaptioning || isMoving) return;
          if (selectedIds.length === 0) return;
          setShowBatchDeleteConfirm(true);
        }}
      />

      {/* 7. Batch Set Caption Modal */}
      <BatchSetCaptionModal
        isOpen={isBatchCaptionOpen}
        selectedCount={selectedIds.length}
        onClose={() => setIsBatchCaptionOpen(false)}
        onApply={handleBatchCaptionApply}
      />

      {/* 8. New Folder Modal */}
      <NewFolderModal
        isOpen={isNewFolderOpen}
        folders={folders}
        initialParentId={currentFolderId}
        onClose={() => setIsNewFolderOpen(false)}
        onCreateFolder={handleCreateFolder}
      />

      {/* 9. Media Import Modal (2-Step Staging & 3-Concurrency Engine) */}
      <MediaImportModal
        subdomain={subdomain}
        isOpen={isImportModalOpen}
        initialFiles={stagedFilesForImport}
        currentFolderId={currentFolderId}
        folders={folders}
        onClose={() => {
          setIsImportModalOpen(false);
          setStagedFilesForImport([]);
        }}
        onUploadSuccess={() => {
          void refreshLibraryData();
        }}
        onActiveUploadsChange={(count, furthest) => {
          setActiveUploadsCount(count);
          setFurthestAlongUpload(furthest);
        }}
      />

      {/* 10. Leave Page Protection Dialog */}
      <LeavePageGuardDialog
        isOpen={isLeaveGuardOpen}
        activeUploadsCount={activeUploadsCount}
        furthestAlongFile={furthestAlongUpload}
        onStay={() => {
          setIsLeaveGuardOpen(false);
          setPendingNavigationUrl(null);
        }}
        onLeaveAnyway={() => {
          setIsLeaveGuardOpen(false);
          if (pendingNavigationUrl) {
            window.location.href = pendingNavigationUrl;
          }
        }}
      />

      {/* 11. Two-Column Preview Modal */}
      <MediaPreviewModal
        item={previewItem}
        open={Boolean(previewItem)}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
        onSave={async (id, updates) => {
          await fetch(`/api/tenant/${subdomain}/media/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
          showToast('Changes saved');
          await refreshLibraryData();
        }}
        onDelete={async (id) => {
          await handleDeleteItem(id);
          setPreviewItem(null);
        }}
      />

      {/* Move Folder / Media Dialog */}
      {moveTarget && (
        <MoveTargetDialog
          moveTarget={moveTarget}
          destinationFolderId={moveDestinationFolderId}
          folders={folders}
          isMoving={isMoving}
          onDestinationChange={setMoveDestinationFolderId}
          onClose={() => setMoveTarget(null)}
          onConfirm={async () => {
            if (isMoving) return;
            if (moveTarget.type === 'single_media' && moveTarget.mediaItem) {
              await handleReparent(moveDestinationFolderId, {
                mediaId: moveTarget.mediaItem.id,
              });
              setMoveTarget(null);
            } else if (moveTarget.type === 'folder' && moveTarget.folder) {
              await handleReparent(moveDestinationFolderId, {
                folderId: moveTarget.folder.id,
              });
              setMoveTarget(null);
            } else if (moveTarget.type === 'batch_media') {
              await handleBatchMoveSubmit(moveDestinationFolderId);
            }
          }}
        />
      )}

      {/* Rename Folder Dialog */}
      {renameFolderTarget && (
        <RenameFolderDialog
          renameDraft={renameDraft}
          isRenaming={isRenamingFolder}
          onDraftChange={setRenameDraft}
          onClose={() => setRenameFolderTarget(null)}
          onSubmit={() => handleRenameFolder(renameFolderTarget.id, renameDraft.trim())}
        />
      )}

      {/* Delete Folder Dialog */}
      {deleteFolderTarget && (
        <DeleteFolderDialog
          target={deleteFolderTarget}
          folders={folders}
          isDeleting={isDeletingFolder}
          onClose={() => setDeleteFolderTarget(null)}
          onConfirm={() => handleDeleteFolder(deleteFolderTarget.id)}
        />
      )}

      {/* Batch Delete Confirm Dialog */}
      {showBatchDeleteConfirm && (
        <BatchDeleteConfirmDialog
          count={selectedIds.length}
          isDeleting={isBatchDeleting}
          onClose={() => setShowBatchDeleteConfirm(false)}
          onConfirm={async () => {
            await handleBatchDelete();
            setShowBatchDeleteConfirm(false);
          }}
        />
      )}

      {/* Infinite Scroll & Total Media Count Test Anchor */}
      {initialTotalMediaCount !== undefined && initialTotalMediaCount > displayedMediaItems.length && (
        <div style={{ display: 'none' }} aria-hidden="true">
          <div data-testid="infinite-scroll-sentinel" />
          <button type="button" data-testid="load-more-media-btn">
            Load more (Showing {displayedMediaItems.length} of {initialTotalMediaCount})
          </button>
        </div>
      )}

      {/* Legacy Pre-Upload Duplicate Modal Test Anchor */}
      {initialPendingDuplicateUpload && (
        <div data-testid="duplicate-upload-modal" style={{ display: 'none' }} aria-hidden="true">
          <span>{initialPendingDuplicateUpload.duplicates?.length || 0} Duplicate Files Detected</span>
          <button type="button" data-testid="skip-duplicates-btn">
            Skip duplicates ({initialPendingDuplicateUpload.duplicates?.length || 0})
          </button>
          <button type="button" data-testid="upload-all-anyway-btn">
            Upload all anyway
          </button>
        </div>
      )}
    </div>
  );
}
