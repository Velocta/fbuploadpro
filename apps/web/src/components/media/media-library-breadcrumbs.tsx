'use client';

import type { MediaFolder } from '@fbuploadpro/contracts';

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
